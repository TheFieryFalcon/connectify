/* Connect Tea: local 2025 ATAR scenario calculator. No network requests. */
(() => {
  'use strict';
  // Published facts: TISC 2025 TEA/ATAR summary table, accessed 14 September 2026.
  // https://www.tisc.edu.au/static/guide/atar-about.tisc
  const table = [[127.4,30],[157.5,40.05],[178.4,50],[187.4,55],[197.2,60],[198.9,61],[201,62],[202.8,63],[204.6,64],[206.2,65],[207.8,66],[209.7,67.05],[211.7,68],[213.8,69.05],[215.7,70.05],[217.9,71],[220,72],[222.2,73],[224.3,74],[226.4,75],[228.7,76],[231.1,77],[233.1,78],[235.4,79],[237.9,80],[240.3,81],[243,82],[245.7,83],[248.4,84],[251.7,85],[254.9,86],[257.9,87],[261.9,88],[265.5,89],[269.6,90],[273.9,91],[278.5,92],[283.6,93],[289.2,94],[295.3,95],[303.6,96],[313.6,97],[326.7,98],[335.5,98.5],[348.1,99],[364.1,99.5],[375.5,99.7],[385.2,99.8],[395,99.9],[405.5,99.95]];
  const normal = s => String(s ?? '').replace(/\s+/g,' ').trim();
  const scoreValue = s => s !== '' && s !== null && s !== undefined && Number.isFinite(Number(s)) && Number(s) >= 0 && Number(s) <= 100 ? Number(s) : undefined;
  const round = n => Number(n.toFixed(2));
  // User-selected rule: nearest integer, with exact halves rounded down.
  const wholeScore = value => scoreValue(value) === undefined ? undefined : Math.max(0, Math.ceil(Number(value) - 0.5));
  const isAtarCourse = title => /\bATAR\b/i.test(title) && !/\bGeneral\b|\bmathematics essentials?\b/i.test(title);
  function convert(tea) {
    if (tea < table[0][0]) return '<30';
    if (tea >= table.at(-1)[0]) return '99.95';
    for (let i=1;i<table.length;i++) {
      const [a,x]=table[i-1], [b,y]=table[i];
      if (tea <= b) return (Math.round((x+(tea-a)/(b-a)*(y-x))*20)/20).toFixed(2);
    }
  }
  const languages = new Set(['arabic','auslan','bengali','bosnian','chinese','croatian','dutch','filipino','french','german','hebrew','hindi','hungarian','indonesian','italian','japanese','korean','modern greek','persian','polish','portuguese','punjabi','russian','serbian','sinhala','spanish','swedish','tamil','turkish','vietnamese']);
  function bonusType(name) {
    const n = normal(name).toLowerCase();
    if (n === 'mathematics methods' || n === 'mathematics specialist') return n;
    const language = n.split(':')[0].replace(/ (second|first|background) language$/,'').trim();
    return languages.has(language) ? 'language' : '';
  }
  function calculate(rows) {
    const eligible = rows.filter(r => !/\bGeneral\b|\bmathematics essentials?\b/i.test(r.name));
    const used = eligible.filter(r => r.include && scoreValue(r.score) !== undefined).map(r=>({...r,score:wholeScore(r.score)}));
    if (used.length < 4) return {error:'At least four ATAR subject scores are needed.'};
    if (eligible.some(r => r.include && scoreValue(r.score) === undefined)) return {error:'Enter a score from 0 to 100 for every included subject.'};
    const sorted = [...used].sort((a,b)=>b.score-a.score);
    const top = sorted.slice(0,4);
    const bestLanguage = Math.max(0,...used.filter(r=>bonusType(r.name)==='language').map(r=>r.score));
    const methods = Math.max(0,...used.filter(r=>bonusType(r.name)==='mathematics methods').map(r=>r.score));
    const specialist = Math.max(0,...used.filter(r=>bonusType(r.name)==='mathematics specialist').map(r=>r.score));
    const base = top.reduce((sum,r)=>sum+r.score,0);
    const bonus = (bestLanguage+methods+specialist)*0.1;
    const tea = Math.min(430,base+bonus);
    return {atar:convert(tea),tea,base,bonus,top};
  }
  function parseAssessment(raw, weighted, name) {
    const score = normal(raw).match(/^(\d+(?:\.\d+)?)\s*Out\s+of\s+(\d+(?:\.\d+)?)$/i);
    const pending = /^[-–—]\s*Out\s+of\s+\d+(?:\.\d+)?$/i.test(normal(raw));
    const weight = normal(weighted).match(/^(?:\d+(?:\.\d+)?|[-–—])\s*Out\s+of\s+(\d+(?:\.\d+)?)$/i);
    if (!weight || (!score && !pending)) return null;
    const w=Number(weight[1]);
    if(w<0 || w>100 || (score && (Number(score[2])<=0 || Number(score[1])>Number(score[2]))))return null;
    return {name,weight:w,pending,score:score?Number(score[1])/Number(score[2])*100:undefined,earned:score?Number(score[1])/Number(score[2])*w:0};
  }
  function taskProgress(tasks, mark, semesterNumber=2) {
    if(!tasks.length || tasks.some(t=>!t))return {error:'Assessment weights are missing or unreadable.'};
    const total=tasks.reduce((s,t)=>s+t.weight,0);
    if(total<=0 || total>100.05)return {error:'The outline total weight must be greater than 0 and at most 100%.'};
    if(semesterNumber===2 && Math.abs(total-100)>0.05)return {error:`Visible annual weights total ${round(total)}%, not 100%. Expand the complete semester 2 outline.`};
    const remaining=tasks.filter(t=>t.pending).reduce((s,t)=>s+t.weight,0);
    const earned=tasks.reduce((s,t)=>s+t.earned,0),completed=total-remaining;
    if(completed>0 && scoreValue(mark)!==undefined && Math.abs(earned/completed*100-mark)>1.5)return {error:'Task weights do not reconcile with the displayed overall mark.'};
    // Semester 1 is a subset of annual weighting (e.g. 42%). Normalize to its own total.
    return {earned:earned/total*100,remaining:remaining/total*100,total,rawEarned:earned,rawRemaining:remaining,allTasks:tasks,tasks:tasks.filter(t=>t.pending&&t.weight>0)};
  }
  function gradePlan(progress,target) {
    if(progress.error)return {error:progress.error};
    if(scoreValue(target)===undefined)return {error:'Enter an overall target percentage from 0 to 100.'};
    const maximum=progress.earned+progress.remaining;
    if(target>maximum+1e-9)return {impossible:true,maximum};
    if(progress.remaining<=1e-9)return {finished:true,maximum,final:progress.earned};
    const exact=Math.max(0,(target-progress.earned)/progress.remaining*100);
    return {required:Math.min(100,Math.ceil((exact-1e-9)*10)/10),maximum};
  }
  function targetPlan(rows, target) {
    if(!Number.isFinite(target)||target<30||target>99.95)return {error:'Enter a target ATAR from 30 to 99.95.'};
    if(rows.length<4)return {error:'Include at least four ATAR subjects.'};
    const missing=rows.filter(r=>r.progress.error);
    if(missing.length)return {error:missing.map(r=>`${r.name}: ${r.progress.error}`).join('\n')};
    const projected=p=>rows.map(r=>({name:r.name,include:true,score:Math.max(0,Math.min(100,r.progress.earned+r.progress.remaining*p/100+r.offset))}));
    const at=p=>calculate(projected(p));
    const reaches=r=>!r.error&&r.atar!=='<30'&&Number(r.atar)>=target;
    const maximum=at(100);
    if(maximum.error)return {error:maximum.error};
    if(!reaches(maximum))return {impossible:true,maximum,rows:projected(100)};
    let lo=0,hi=100;
    if(reaches(at(0)))hi=0;
    else for(let i=0;i<50;i++){const mid=(lo+hi)/2;if(reaches(at(mid)))hi=mid;else lo=mid;}
    // Round UP to one decimal so the recommendation actually reaches the target.
    let required=Math.min(100,Math.ceil(hi*10)/10);
    if(!reaches(at(required)))required=Math.min(100,required+0.1);
    return {required,maximum,result:at(required),rows:projected(required)};
  }
  if(typeof window!=='undefined')window.ConnextAtar={calculate};
  function readCourses(atarOnly=true) {
    const result = [[],[]], seen = [new Set(),new Set()];
    for (const card of document.querySelectorAll('.eds-c-tile')) {
      const title = normal(card.querySelector('.eds-c-tile__title')?.textContent);
      const semester = title.match(/\bSemester\s*([12])\b/i);
      if (!semester || (atarOnly && !isAtarCourse(title))) continue;
      const name = normal(title.replace(/\s*[-–—]\s*Semester\s*[12].*$/i,'').replace(/\bATAR\b/ig,'').replace(/\bYear\s*\d+\b/ig,''));
      const index=Number(semester[1])-1, id=name.toLowerCase();
      if (seen[index].has(id)) continue;
      seen[index].add(id);
      const summary = Array.from(card.querySelectorAll('.cvr-c-task')).find(row=>!row.closest('.cvr-c-tasks'));
      const text=normal(summary?.querySelector('.cvr-c-task__marks .cvr-c-task__mark')?.textContent);
      const mark=text.match(/^(\d+(?:\.\d+)?)\s*%$/);
      let tasks=Array.from(card.querySelectorAll('.cvr-c-tasks .cvr-c-task')).filter(r=>r.closest('.eds-c-tile')===card).map((r,i)=>{
        const cells=r.querySelectorAll('.cvr-c-task__marks .cvr-c-task__mark');
        const labels=Array.from(r.querySelectorAll('.cvr-c-task__details .v-label')).map(e=>normal(e.textContent)).filter(Boolean);
        return parseAssessment(cells[0]?.textContent,cells[1]?.textContent,labels.at(-1)||`Assessment ${i+1}`);
      });
      let value=mark?scoreValue(mark[1]):undefined;
      const economics=window.ConnextData?.economicsStatus().active&&window.ConnextData.economicsCard(card);
      if(economics){
        if(index===1){const subject=window.ConnextData.collect(true).find(s=>/^Economics ATAR Year 11$/i.test(s.name));if(subject)tasks=subject.tasks.map(t=>t.weight===null?null:{name:t.name,weight:t.weight,pending:t.pending,score:t.score,earned:t.pending?0:t.score*t.weight/100});}
        const valid=tasks.length&&tasks.every(Boolean),completed=valid?tasks.filter(t=>!t.pending).reduce((s,t)=>s+t.weight,0):0;
        value=completed>0?tasks.reduce((s,t)=>s+t.earned,0)/completed*100:undefined;
      }
      const finalLetter=Array.from(summary?.querySelectorAll('.cvr-c-task__marks .cvr-c-task__mark')||[]).some(c=>/^[ABCDE]$/i.test(normal(c.textContent)));
      result[index].push({id,name,mark:value,economics,finalLetter,progress:taskProgress(tasks,value,index+1)});
    }
    return result;
  }
  const account = new URL(location.href).searchParams.get('coisp') || 'current';
  const storageKey=`connectea:atar:2025:${account}:${new Date().getFullYear()}`;
  let saved={};
  try { const value=JSON.parse(localStorage.getItem(storageKey)||'{}'); if(value && typeof value==='object' && !Array.isArray(value))saved=value; } catch {}
  let courses=[[],[]], gradeCourses=[[],[]], semester=1, signature='';
  function persist() { try{localStorage.setItem(storageKey,JSON.stringify(saved));}catch{} }
  function state(row,index) {
    const entry=saved[`${index}:${row.id}`];
    return {...row,include:entry?.include ?? row.mark!==undefined,score:wholeScore(entry?.score!==undefined?entry.score:row.mark)};
  }
  function el(tag,cls,text) {const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;}
  const panel=el('aside','','');panel.id='connectea-atar';panel.hidden=true;panel.setAttribute('aria-label','2025 ATAR estimates');
  const heading=el('div','cta-heading');
  const panelTitle=el('strong','','Your estimated ATAR based on 2025 scaling');panelTitle.tabIndex=-1;heading.append(panelTitle);
  const estimateTab=el('button','cta-semester','ATAR estimate'),targetTab=el('button','cta-semester','Target ATAR'),gradeTab=el('button','cta-semester','Target grade');
  estimateTab.type=targetTab.type=gradeTab.type='button';
  for(const button of [estimateTab,targetTab,gradeTab]){button.className='cx-calculator-tool';button.setAttribute('aria-controls','connectea-atar');}
  window.ConnextAtar.toolButtons=[estimateTab,targetTab,gradeTab];
  let planning=false,grading=false;
  const atarEligible=()=>/\bYear\s*(?:11|12)\b/i.test(Array.from(document.querySelectorAll('.eds-c-tile')).map(c=>c.innerText).join(' '));
  const semesterTwoStarted=()=>gradeCourses.flat().some(r=>r.finalLetter);
  const targetClosed=i=>gradeCourses[i].some(r=>r.finalLetter)||(i===1&&!gradeCourses.flat().some(r=>r.finalLetter));
  function selectTab(value){if(!atarEligible())value='grade';planning=value==='target';grading=value==='grade';panelTitle.textContent=planning?'Calculate whether or not an ATAR of your choosing is still possible':grading?'Calculate whether or not a subject average of your pleasing is still possible':'Your estimated ATAR based on 2025 scaling';panel.setAttribute('aria-label',panelTitle.textContent);if(grading&&semesterTwoStarted())semester=1;estimateTab.setAttribute('aria-pressed',String(!planning&&!grading));targetTab.setAttribute('aria-pressed',String(planning));gradeTab.setAttribute('aria-pressed',String(grading));list.hidden=detail.hidden=reset.hidden=methods.hidden=planning||grading;planner.hidden=!planning;gradePanel.hidden=!grading;renderRows();}
  function openTool(value){window.ConnextData?.expandAll();refresh();panel.hidden=false;window.dispatchEvent(new CustomEvent('connext-open',{detail:'calculator'}));selectTab(value);panelTitle.focus();}
  estimateTab.addEventListener('click',()=>openTool('estimate'));targetTab.addEventListener('click',()=>openTool('target'));gradeTab.addEventListener('click',()=>openTool('grade'));
  const cards=el('div','cta-semesters');const outputs=[0,1].map(i=>{const b=el('button','cta-semester',`Semester ${i+1} ATAR`);b.type='button';b.addEventListener('click',()=>{if((grading&&semesterTwoStarted()&&i===0)||(planning&&targetClosed(i)))return;semester=i;renderRows();});cards.append(b);return b;});
  const list=el('div','cta-courses');const detail=el('p','cta-breakdown');detail.setAttribute('aria-live','polite');
  const reset=el('button','cta-reset','Reset this semester to school marks');reset.type='button';reset.addEventListener('click',()=>{for(const r of courses[semester])delete saved[`${semester}:${r.id}`];persist();renderRows();});
  const methods=el('details','cta-method');methods.append(el('summary','','Calculation & sources'));
  methods.append(el('p','','Scores round to whole numbers before the best four and bonuses are calculated; exact .5 values round down (69.9 → 70; 69.5 → 69). Best four included scaled-score assumptions, plus 10% of Methods, 10% of Specialist and 10% of the best language score. General and other non-ATAR courses are excluded. Estimates interpolate the published 2025 TISC table. Below the table range, <30 is shown.'));
  methods.append(el('p','','Semester 2 uses the cumulative percentage shown by Connect. This does not check WACE eligibility, English competency or unacceptable course combinations. Exclude an incompatible course before calculating. No marks are sent to another website.'));
  const planner=el('div','cta-planner');
  const targetLabel=el('label','cta-target-label','Target ATAR '),targetInput=el('input','cta-score');targetInput.type='number';targetInput.min='30';targetInput.max='99.95';targetInput.step='0.05';targetInput.value=saved.target ?? '98';targetLabel.append(targetInput);
  const scan=el('button','cta-reset','Calculate');scan.type='button';
  const targetOutput=el('div','cta-target-output');targetOutput.setAttribute('aria-live','polite');
  const targetControls=el('div','cta-form-controls');targetControls.append(targetLabel,scan);planner.append(targetControls,targetOutput);
  targetInput.addEventListener('input',()=>{saved.target=targetInput.value;persist();renderTarget();});
  function scanOutline(allSubjects=false){
    for(const card of document.querySelectorAll('.eds-c-tile')){
      const title=normal(card.querySelector('.eds-c-tile__title')?.textContent);
      if((!allSubjects&&!isAtarCourse(title))||!new RegExp(`Semester\\s*${semester+1}\\b`,'i').test(title))continue;
      for(const h of card.querySelectorAll('.eds-c-accordion__section-heading'))if(/show details/i.test(h.textContent)){const b=h.querySelector('button,.v-button,[role="button"]');if(b)b.click();}
    }
    refresh();if(grading)renderGrade();else renderTarget();
  }
  scan.addEventListener('click',()=>scanOutline());
  const gradePanel=el('div','cta-planner');
  const subjectLabel=el('label','cta-target-label','Subject '),subjectSelect=el('select','cta-subject-select');subjectLabel.append(subjectSelect);
  const gradeLabel=el('label','cta-target-label','Overall target (%) '),gradeInput=el('input','cta-score');gradeInput.type='number';gradeInput.min='0';gradeInput.max='100';gradeInput.step='any';gradeInput.value=saved.gradeTarget??'80';gradeLabel.append(gradeInput);
  const gradeScan=el('button','cta-reset','Calculate');gradeScan.type='button';gradeScan.addEventListener('click',()=>scanOutline(true));
  const gradeNote=el('p','cta-note'),gradeOutput=el('div','cta-target-output');gradeOutput.setAttribute('aria-live','polite');
  const gradeControls=el('div','cta-form-controls');subjectLabel.classList.add('cta-subject-label');gradeControls.append(subjectLabel,gradeLabel,gradeScan);gradePanel.append(gradeControls,gradeOutput);
  let gradeSelected=['',''];
  subjectSelect.addEventListener('change',()=>{gradeSelected[semester]=subjectSelect.value;renderGrade();});
  gradeInput.addEventListener('input',()=>{saved.gradeTarget=gradeInput.value;persist();renderGrade();});
  panel.append(heading,cards,list,detail,reset,methods,planner,gradePanel);document.body.append(panel);selectTab('estimate');
  function renderGrade(){
    const available=gradeCourses[semester],wanted=gradeSelected[semester];
    const selected=available.find(r=>r.id===wanted)||available[0];
    const optionSignature=JSON.stringify(available.map(r=>[r.id,r.name]));
    if(subjectSelect.dataset.options!==optionSignature){subjectSelect.replaceChildren();for(const r of available){const o=el('option','',r.name);o.value=r.id;subjectSelect.append(o);}subjectSelect.dataset.options=optionSignature;}
    if(selected){subjectSelect.value=selected.id;gradeSelected[semester]=selected.id;}
    gradeNote.textContent=(semesterTwoStarted()?'A–E overall grade letters detected: semester 1 grade planning is closed. ':'')+'This plans a percentage, not an A–E grade boundary. It uses published task scores and weights without ATAR scaling or whole-score rounding.';
    gradeOutput.replaceChildren();
    if(!selected){gradeOutput.append(el('p','','No subjects found for this semester. Show all classes in Connect.'));return;}
    const p=selected.progress,plan=gradePlan(p,scoreValue(gradeInput.value));
    if(plan.error){gradeOutput.append(el('p','',plan.error),el('p','cta-note','Expand Show Details, then scan again. Include the entire published semester outline.'));return;}
    const summary=plan.impossible?`Not achievable from the remaining tasks. Maximum overall mark: ${round(plan.maximum)}%.`:plan.finished?`No weighted tasks remain. Final overall mark: ${round(plan.final)}%.`:plan.required===0?'Your target is already secured even with 0% on the remaining tasks.':`Aim for at least ${plan.required}% across the remaining assessments to reach ${gradeInput.value}% overall.`;
    gradeOutput.append(el('strong','',summary),el('p','cta-note',`Outline total: ${round(p.total)} annual-weight points. Completed: ${round(p.total-p.rawRemaining)}; remaining: ${round(p.rawRemaining)} (${round(p.remaining)}% of this semester). Current completed-task average: ${p.remaining<100?round(p.earned/(100-p.remaining)*100)+'%':'not marked'}.`));
    const imported=el('table','cta-grade-table');const header=el('tr');for(const t of ['Assessment','Score','Weight'])header.append(el('th','',t));imported.append(header);
    for(const t of p.allTasks){const tr=el('tr');tr.append(el('td','',t.name),el('td','',t.pending?'Pending':`${round(t.score??(t.weight?t.earned/t.weight*100:0))}%`),el('td','',`${round(t.weight)}%`));imported.append(tr);}
    const assessmentDetails=el('section','cta-assessment-details');assessmentDetails.append(el('strong','cta-breakdown-title',`Assessment breakdown (${p.allTasks.length})`),imported);gradeOutput.append(assessmentDetails);
    if(!plan.impossible&&!plan.finished)for(const t of p.tasks)assessmentDetails.append(el('p','cta-note',`${t.name}: aim ${plan.required}% · ${round(t.weight)}% annual weight`));
  }
  function renderTarget(){
    targetInput.disabled=scan.disabled=targetClosed(semester);
    if(targetClosed(semester)){targetOutput.replaceChildren(el('p','',gradeCourses[semester].some(r=>r.finalLetter)?`Semester ${semester+1} Target ATAR is closed because overall A–E grades have been published.`:'Semester 2 Target ATAR is not open yet. Use semester 1 until overall A–E grades are published.'));return;}
    const rows=courses[semester].filter(r=>state(r,semester).include).map(r=>{const current=state(r,semester);return {...r,progress:current.score===undefined?{error:'Enter a valid scaled-score assumption in the ATAR estimate tab.'}:r.progress,offset:current.score===undefined||r.mark===undefined?0:current.score-wholeScore(r.mark)};});
    const plan=targetPlan(rows,scoreValue(targetInput.value));targetOutput.replaceChildren();
    if(plan.error){targetOutput.append(el('p','',plan.error),el('p','cta-note','Expand Show Details for each included subject, then scan again. Missing weights are never treated as zero.'));return;}
    if(plan.impossible)targetOutput.append(el('strong','',`Not achievable with the remaining weights under these assumptions. Maximum ATAR: ${plan.maximum.atar}, even with 100% on every remaining task.`));
    else targetOutput.append(el('strong','',plan.required===0?`Target already secured under these assumptions, even with 0% on remaining tasks.`:`Aim for at least ${round(plan.required)}% on every remaining assessment. Projected ATAR: ${plan.result.atar}.`));
    targetOutput.append(el('p','cta-note',`Maximum possible in this model: ${plan.maximum.atar}. This is one uniform-score plan, not the only possible combination.`));
    const taskDetails=el('section','cta-assessment-details');taskDetails.append(el('strong','cta-breakdown-title',`Subject and assessment breakdown (${rows.length} subjects)`));targetOutput.append(taskDetails);
    rows.forEach((r,i)=>{
      const block=el('div','cta-course');block.append(el('strong','',r.name),el('small','',`Outline weight ${round(r.progress.total)}% · ${round(r.progress.earned)} normalized points earned · ${round(r.progress.remaining)}% of semester remaining · projected rounded score ${wholeScore(plan.rows[i].score)}`));
      for(const task of r.progress.tasks)block.append(el('small','',`${task.name}: weight ${round(task.weight)}% · ${plan.impossible?'maximum 100%':`aim ${round(plan.required)}%`}`));
      if(!r.progress.remaining)block.append(el('small','','No unmarked weighted tasks remain.'));
      taskDetails.append(block);
    });
  }
  function results() {
    if(grading&&semesterTwoStarted())semester=1;
    if(planning&&targetClosed(semester)&&!targetClosed(1-semester))semester=1-semester;
    for(let i=0;i<2;i++) {
      const r=calculate(courses[i].map(row=>state(row,i)));
      outputs[i].textContent=grading?`Semester ${i+1} target grade`:`Semester ${i+1} ATAR\n${r.error?'—':r.atar}`;
      outputs[i].hidden=grading&&semesterTwoStarted()&&i===0;
      outputs[i].disabled=outputs[i].hidden||(planning&&targetClosed(i));
      if(planning&&targetClosed(i))outputs[i].textContent=`Semester ${i+1} Target ATAR · Closed`;
      outputs[i].setAttribute('aria-pressed',String(i===semester));
      if(i===semester) detail.textContent=r.error || `TEA ${round(r.tea)} = best four ${round(r.base)} + bonuses ${round(r.bonus)}. Best four: ${r.top.map(x=>x.name).join(', ')}.`;
    }
    if(planning)renderTarget();
    if(grading)renderGrade();
  }
  function renderRows() {
    const eligible=atarEligible();estimateTab.hidden=targetTab.hidden=!eligible;if(!eligible&&!grading){selectTab('grade');return;}
    list.replaceChildren();
    if(!courses[semester].length)list.append(el('p','','No ATAR subjects found for this semester. Show all classes in Connect.'));
    for(const course of courses[semester]) {
      const current=state(course,semester),index=semester;
      const row=el('div','cta-course'),label=el('label','cta-include');
      const check=el('input');check.type='checkbox';check.checked=current.include;
      label.append(check,el('span','',course.name));
      const input=el('input','cta-score');input.type='number';input.min='0';input.max='100';input.step='any';input.value=current.score ?? '';input.setAttribute('aria-label',`${course.name} semester ${index+1} estimated scaled score`);
      const source=el('small','',course.mark===undefined?'No school mark':`${course.economics?'Calculated Economics':'School'} ${round(course.mark)}%`);
      const update=()=>{saved[`${index}:${course.id}`]={include:check.checked,score:input.value};input.setAttribute('aria-invalid',String(check.checked&&scoreValue(input.value)===undefined));persist();results();};
      check.addEventListener('change',update);input.addEventListener('input',update);
      input.addEventListener('change',()=>{const score=wholeScore(input.value);if(score!==undefined){input.value=score;update();}});
      row.append(label,input,source);list.append(row);
    }
    results();
  }
  function refresh() {const next=readCourses(false),eligible=atarEligible(),s=JSON.stringify([eligible,next]);estimateTab.hidden=targetTab.hidden=!eligible;if(s!==signature){gradeCourses=next;courses=readCourses();signature=s;if(!panel.hidden)renderRows();}}
  window.addEventListener('connext-open',e=>{if(e.detail!=='calculator'){panel.hidden=true;for(const b of [estimateTab,targetTab,gradeTab])b.setAttribute('aria-pressed','false');}});
  function hide(){panel.hidden=true;for(const b of [estimateTab,targetTab,gradeTab])b.setAttribute('aria-pressed','false');(grading?gradeTab:planning?targetTab:estimateTab).focus();}
  panel.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});
  window.ConnextAtar.readCourses=readCourses;
  setInterval(refresh,1500);refresh();
})();
