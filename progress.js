(() => {
  'use strict';
  const dataAPI=window.ConnextData;
  const make=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
  const toggle=make('button','Progress Graph');toggle.id='connext-progress-toggle';toggle.type='button';toggle.setAttribute('aria-expanded','false');
  const panel=make('section');panel.id='connext-progress';panel.hidden=true;panel.setAttribute('aria-label','Assessment progress');
  const head=make('header'),title=make('strong','Progress Graph');title.tabIndex=-1;head.append(title);
  const choices=make('div');choices.className='cx-subjects';const chart=make('div');const scan=make('button','Refresh assessments');scan.type='button';
  panel.append(head,choices,scan,chart);document.body.append(toggle,panel);let selected='',signature='';
  const svgEl=(tag,attrs,text)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs||{}))e.setAttribute(k,v);if(text)e.textContent=text;return e;};
  function history(subjects){
    // Exam component rows worth 0% are already represented by the weighted full exam.
    const eligible=subjects.filter(s=>/\bATAR\b/i.test(s.name)&&!/\bGeneral\b/i.test(s.name)).map(s=>({...s,tasks:s.tasks.filter(t=>t.weight!==0)}));
    const invalid=eligible.flatMap(s=>s.tasks.filter(t=>!Number.isFinite(t.weight)||t.weight<0).map(t=>`${s.name}: ${t.name}`));
    if(invalid.length)return {error:'Assessment weights are unavailable for: '+invalid.join('; ')+'. Expand all outlines and refresh.'};
    const byAssessment=eligible.some(s=>s.tasks.some(t=>!Number.isFinite(t.order)));
    const ordered=eligible.map(s=>({...s,tasks:byAssessment?[...s.tasks].sort((a,b)=>a.sequence-b.sequence).map((t,i)=>({...t,order:i+1})):s.tasks}));
    const steps=[...new Set(ordered.flatMap(s=>s.tasks.map(t=>t.order)))].sort((a,b)=>a-b),points=[];
    for(const step of steps){const rows=ordered.map(s=>{const tasks=s.tasks.filter(t=>t.order<=step),weight=tasks.reduce((n,t)=>n+t.weight,0);return {name:s.name.replace(/\bATAR\b|\bYear\s*\d+\b/gi,'').trim(),include:weight>0,score:weight?tasks.reduce((n,t)=>n+t.score*t.weight,0)/weight:undefined};});const r=window.ConnextAtar.calculate(rows);if(!r.error)points.push({name:byAssessment?`Assessment round ${step}`:`Week ${Number(step.toFixed(1))}`,caption:'',score:r.atar==='<30'?null:Number(r.atar),display:r.atar,order:step});}
    return {points,byAssessment};
  }

  function refresh(){if(panel.hidden)return;const data=dataAPI.collect(),sig=JSON.stringify(data);if(sig===signature)return;signature=sig;render(data);}
  function render(data){
    choices.replaceChildren();chart.replaceChildren();const isHistory=selected==='__atar';const current=data.find(s=>s.name===selected)||data[0];
    for(const subject of data){const b=make('button',subject.name.replace(/\bATAR\b|\bYear\s*\d+\b/gi,'').trim());b.type='button';b.setAttribute('aria-pressed',String(!isHistory&&subject===current));b.onclick=()=>{selected=subject.name;render(data);};choices.append(b);}
    if(/\bYear\s*(11|12)\b/i.test(data.map(s=>s.name).join(' '))){const b=make('button','ATAR Progression');b.type='button';b.setAttribute('aria-pressed',String(isHistory));b.onclick=()=>{selected='__atar';render(data);};choices.append(b);}
    if(!current){chart.append(make('p','No assessments found. Expand all subjects and refresh.'));return;}
    let points,byAssessment=false;
    if(isHistory){const result=history(data);chart.append(make('h3','ATAR Progression'));if(result.error){chart.append(make('p',result.error));return;}points=result.points;byAssessment=result.byAssessment;chart.append(make('p','Estimated from weighted running school averages using the 2025 model. Begins once four subjects have results.'));if(byAssessment)chart.append(make('p','Some assessments have chapter labels or no readable date. Each assessment round uses the first N completed weighted assessments in each subject’s outline order (or all available if fewer). These rounds are not calendar dates.'));
    }else{selected=current.name;points=current.tasks;chart.append(make('h3',current.name));const legend=make('div');legend.className='cx-legend';const red=make('span','Red line -> Average Cohort performance'),blue=make('span','Blue line -> Your performance');red.className='cx-red-key';blue.className='cx-blue-key';legend.append(red,blue);chart.append(legend);}
    if(!points.length){chart.append(make('p',isHistory?'Not enough completed results yet to estimate ATAR progression.':'No completed assessments found. Expand all subjects and refresh.'));return;}
    let minY=0,maxY=100;
    if(isHistory){
      const valid=points.map(p=>p.score).filter(Number.isFinite);
      if(valid.length){
        const sorted=[...valid].sort((a,b)=>a-b);
        const secondLowest=sorted.length>1?sorted[1]:sorted[0];
        minY=Math.max(0,Math.floor((secondLowest-5)/5)*5);
        if(minY>=maxY)minY=maxY-5;
      }
    }
    const range=maxY-minY;
    const step=!isHistory||range===100?25:range>30&&range%10===0?10:5;
    const yFor=v=>260-((v-minY)/range)*220;
    const svg=svgEl('svg',{viewBox:'0 0 680 310',role:'img','aria-label':isHistory?(byAssessment?'Estimated ATAR progression by assessment round':'Estimated ATAR progression over school weeks'):`${current.name}: your assessment scores and estimated cohort means`});
    for(let value=minY;value<=maxY;value+=step){const py=yFor(value);svg.append(svgEl('line',{x1:44,y1:py,x2:655,y2:py,class:'cx-grid'}),svgEl('text',{x:36,y:py+4,'text-anchor':'end'},value+(isHistory?'':'%')));}
    const first=points[0].order,last=points.at(-1).order;
    const x=i=>points.length===1?350:isHistory&&last>first?52+(points[i].order-first)*595/(last-first):52+i*595/(points.length-1);
    function series(key,cls){let segment=[];const flush=()=>{if(segment.length)svg.append(svgEl('polyline',{points:segment.join(' '),fill:'none',class:cls}));segment=[];};points.forEach((p,i)=>{if(!Number.isFinite(p[key])){flush();return;}const cy=Math.max(40,Math.min(260,yFor(p[key])));segment.push(`${x(i)},${cy}`);const circle=svgEl('circle',{cx:x(i),cy,r:4.5,tabindex:0,class:cls+'-point'});circle.append(svgEl('title',{},`${p.name}: ${key==='mean'?'Cohort mean':isHistory?'Estimated ATAR':'Your score'} ${Number(p[key].toFixed(2))}${isHistory?'':'%'}`));svg.append(circle);});flush();}
    if(!isHistory)series('mean','cx-cohort');series('score','cx-line');
    points.forEach((p,i)=>{if(points.length<=18||i%Math.ceil(points.length/14)===0)svg.append(svgEl('text',{x:x(i),y:283,'text-anchor':'middle'},isHistory?Number(p.order.toFixed(1)):String(i+1)));});svg.append(svgEl('text',{x:350,y:306,'text-anchor':'middle'},isHistory?(byAssessment?'Assessment round':'School week'):'Assessment'));chart.append(svg);
    if(!isHistory&&points.some(p=>p.mean===null))chart.append(make('p','Gaps in the red line mean cohort statistics are not available for that task.'));
    const table=make('table'),header=make('tr');(isHistory?['When','Estimated ATAR']:['#','Assessment','When','Your score','Cohort mean']).forEach(t=>header.append(make('th',t)));table.append(header);
    points.forEach((p,i)=>{const r=make('tr');(isHistory?[p.name,p.display]:[String(i+1),p.name,p.caption,Number(p.score.toFixed(2))+'%',Number.isFinite(p.mean)?Number(p.mean.toFixed(2))+'%':'Unavailable']).forEach(t=>r.append(make('td',t)));table.append(r);});chart.append(table);
  }
  function expand(){dataAPI.expandAll();signature='';refresh();}
  toggle.onclick=()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden){window.dispatchEvent(new CustomEvent('connext-open',{detail:'progress'}));expand();title.focus();}};
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){panel.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.focus();}});scan.onclick=expand;
  window.addEventListener('connext-open',e=>{if(e.detail!=='progress'){panel.hidden=true;toggle.setAttribute('aria-expanded','false');}});
  function arrows(){const wanted=new Set(),courses=window.ConnextAtar.readCourses(false);for(const subject of dataAPI.collect()){const latest=subject.tasks.at(-1);if(!latest?.row)continue;const name=subject.name.replace(/\bATAR\b|\bYear\s*\d+\b/gi,'').trim();const current=courses[1].find(r=>r.name===name)||courses[0].find(r=>r.name===name);if(!Number.isFinite(current?.mark)||latest.score<=current.mark)continue;const row=latest.row,stats=row.querySelector('.connectea-panel');if(!stats)continue;wanted.add(row);if(!row.querySelector('.cx-improved')){const badge=make('span','↑');badge.className='cx-improved';badge.title='Latest assessment is above your current overall subject average';badge.setAttribute('aria-label',badge.title);const group=make('div');group.className='cx-performance-row';stats.before(group);group.append(stats,badge);}}
    for(const group of document.querySelectorAll('.cx-performance-row'))if(!wanted.has(group.closest('.cvr-c-task'))||!group.querySelector('.connectea-panel')){group.querySelector('.cx-improved')?.remove();group.replaceWith(...group.childNodes);}
  }
  window.ConnextProgress={history};setInterval(()=>{refresh();arrows();},1500);arrows();
})();
