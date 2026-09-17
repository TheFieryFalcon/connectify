(() => {
'use strict';
  const norm=s=>String(s??'').replace(/\s+/g,' ').trim();
  function orderHint(text) {
    let m=text.match(/term\s*(\d).*?week[s]?\s*(\d+)/i);if(m)return (+m[1]-1)*10+(+m[2]);
    m=text.match(/weeks?\s*(\d+)(?:\s*(?:&|and|[\/–-])\s*\d+)?\s*[,;]?\s*term\s*(\d)/i);if(m)return (+m[2]-1)*10+(+m[1]);
    m=text.match(/^(?:week[s]?\s*)?(\d{1,2})(?:\s*[\/–-]\s*\d{1,2})?$/i);if(m)return +m[1];
    const cleaned=text.replace(/(\d)(st|nd|rd|th)\b/gi,'$1').replace(/^(mon|tue|wed|thu|fri|sat|sun)\w*\s+/i,'');
    if(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(cleaned)){const d=Date.parse(cleaned+' '+new Date().getFullYear());if(Number.isFinite(d))return (d-Date.UTC(new Date().getFullYear(),0,26))/604800000+1;}
    return null;
  }
  function correctedCaption(title,task,caption){
    if(!/\bPhysics\s+ATAR\s+Year\s*11\b/i.test(title))return caption;
    if(/^portfolio\s+assessment\s+1c$/i.test(task)&&/^term\s*3,?\s*week\s*6$/i.test(caption))return 'Term 3, week 4';
    if(/^test\s*3\s*:\s*waves$/i.test(task)&&/^term\s*3,?\s*week\s*4$/i.test(caption))return 'Term 3, week 6';
    return caption;
  }
  function collect(includePending=false){
    const subjects=new Map();
    const cards=Array.from(document.querySelectorAll('.eds-c-tile')).sort((a,b)=>semester(a)-semester(b));
    function semester(c){return +(norm(c.querySelector('.eds-c-tile__title')?.textContent).match(/Semester\s*([12])/i)?.[1]||1);}
    for(const card of cards){
      const title=norm(card.querySelector('.eds-c-tile__title')?.textContent);if(!/Semester\s*[12]/i.test(title))continue;
      const name=title.replace(/\s*[-–—]\s*Semester\s*[12].*$/i,'');
      if(!subjects.has(name))subjects.set(name,new Map());const tasks=subjects.get(name),occurrences=new Map();
      for(const row of card.querySelectorAll('.cvr-c-tasks .cvr-c-task')){
        const labels=Array.from(row.querySelectorAll('.cvr-c-task__details .v-label')).map(e=>norm(e.textContent)).filter(Boolean);
        const raw=norm(row.querySelector('.cvr-c-task__marks .cvr-c-task__mark')?.textContent);
        const m=raw.match(/^(\d+(?:\.\d+)?)\s*Out\s+of\s+(\d+(?:\.\d+)?)$/i);
        const pending=/^[-–—]\s*Out\s+of\s+\d/i.test(raw);
        if(!m&&!(includePending&&pending))continue;if(m&&(+m[2]<=0||+m[1]>+m[2]))continue;
        const max=m?+m[2]:Number(raw.match(/Out\s+of\s+(\d+(?:\.\d+)?)/i)?.[1]);
        const weighted=norm(row.querySelectorAll('.cvr-c-task__marks .cvr-c-task__mark')[1]?.textContent).match(/Out\s+of\s+(\d+(?:\.\d+)?)/i);
        const weight=weighted?Number(weighted[1]):null;
        const task=labels.at(-1)||`Assessment ${tasks.size+1}`,caption=correctedCaption(title,task,labels[1]||'');
        const base=JSON.stringify([labels,max]),occ=occurrences.get(base)||0;occurrences.set(base,occ+1);
        const id=base+':'+occ;const record={id,name:task,caption,score:m?+m[1]/+m[2]*100:null,pending,weight,mean:cohortMean(row),semester:Math.min(semester(card),tasks.get(id)?.semester??2),order:orderHint(caption),sequence:tasks.get(id)?.sequence??tasks.size};
        Object.defineProperty(record,'row',{value:row});tasks.set(id,record);
      }
    }
    return Array.from(subjects,([name,tasks])=>({name,tasks:Array.from(tasks.values()).sort((a,b)=>a.order!==null&&b.order!==null?a.order-b.order:a.sequence-b.sequence)}));
  }

  function cohortMean(row){
    const host=row.querySelector('.cvr-c-task__chart [data-highcharts-chart]');if(!host)return null;
    const chart=window.Highcharts?.charts?.[Number(host.getAttribute('data-highcharts-chart'))];
    if(!chart||(chart.container&&!host.contains(chart.container)))return null;
    for(const series of chart.series||[])for(const point of [...(series.points||[]),...(series.options?.data||[])]){
      const p=point?.options||point,s=Array.isArray(p)?p.slice(-5):[p?.low,p?.q1,p?.median,p?.q3,p?.high];
      if(s.length===5&&s.every(v=>typeof v==='number'&&Number.isFinite(v))&&s.every((v,i)=>!i||v>=s[i-1]))return (s[0]+2*s[1]+2*s[2]+2*s[3]+s[4])/8;
    }return null;
  }
  function economicsCard(card){const title=norm(card.querySelector('.eds-c-tile__title')?.textContent);const text=[card.innerText,...Array.from(card.querySelectorAll('.v-label')).map(e=>e.textContent)].join(' ');return /\bEconomics\s+ATAR\s+Year\s*11\b/i.test(title)&&/\bWilletton\s+Senior\s+High\s*School\b/i.test(text);}
  function economicsStatus(){const cards=Array.from(document.querySelectorAll('.eds-c-tile')).filter(economicsCard);const finalized=[1,2].map(n=>cards.some(c=>Number(c.querySelector('.eds-c-tile__title').textContent.match(/Semester\s*([12])/i)?.[1])===n&&Array.from(c.querySelectorAll('.cvr-c-task')).filter(r=>!r.closest('.cvr-c-tasks')).some(r=>Array.from(r.querySelectorAll('.cvr-c-task__mark')).some(e=>/^[A-E]$/.test(norm(e.textContent))))));return {eligible:cards.length>0,active:cards.length>0&&!finalized.every(Boolean),finalized};}
  function expandAll(expand=true){for(const h of document.querySelectorAll('.eds-c-tile .eds-c-accordion__section-heading'))if((expand?/show details/i:/hide details/i).test(h.textContent))h.querySelector('button,.v-button,[role="button"]')?.click();}
  window.ConnextData={collect,cohortMean,orderHint,correctedCaption,economicsCard,economicsStatus,expandAll};

})();
