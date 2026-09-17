(() => {
  'use strict';
  const make=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
  const rail=make('aside');rail.id='connext-sidebar';rail.hidden=true;rail.setAttribute('aria-label','Connext tools');
  const handle=make('button','❮');handle.id='connext-sidebar-handle';handle.type='button';handle.title='Open Connext tools';handle.setAttribute('aria-label','Open Connext tools');handle.setAttribute('aria-expanded','false');
  function handleState(open){
    const icon=make('span',open?'❮':'❯');icon.className='cx-handle-arrow';
    handle.replaceChildren(icon);
    if(!open){const label=make('span');label.className='cx-handle-label';label.append(make('strong','Connext tools'),make('small','ATAR · Grades · Progress'));handle.append(label);}
    handle.title=open?'Close Connext tools':'Open Connext tools';
    handle.setAttribute('aria-label',handle.title);handle.setAttribute('aria-expanded',String(open));
  }
  handleState(false);
  const heading=make('header'),brand=make('strong','Connext'),home=make('button','← Back to Main Menu'),hide=make('button','❮ Close');home.type=hide.type='button';home.className='cx-back-menu';heading.append(brand,home,hide);
  const menu=make('nav');menu.className='cx-tool-menu';menu.setAttribute('aria-label','Tools');
  const content=make('div');content.className='cx-workspace';const actions=make('div');actions.className='cx-outline-actions';
  const expand=make('button','Expand all'),collapse=make('button','Unexpand all');expand.type=collapse.type='button';expand.onclick=()=>window.ConnextData.expandAll(true);collapse.onclick=()=>window.ConnextData.expandAll(false);actions.append(expand,collapse);
  const economy=make('button','Calculate Economics average');economy.type='button';economy.hidden=true;
  const economics=make('section');economics.id='cx-economics';economics.hidden=true;const intro=make('p','Choose a tool to explore your results.');intro.className='cx-tools-intro';
  rail.append(heading,intro,menu,actions,content);document.body.append(rail,handle);
  function mount(){const graph=document.getElementById('connext-progress-toggle');for(const b of [...(window.ConnextAtar.toolButtons||[]),graph])if(b&&b.parentElement!==menu)menu.append(b);if(economy.parentElement!==menu)menu.append(economy);for(const id of ['connectea-atar','connext-progress']){const p=document.getElementById(id);if(p&&p.parentElement!==content)content.append(p);}if(economics.parentElement!==content)content.append(economics);}
  function show(){rail.hidden=false;handleState(true);}
  function allClosed(){window.dispatchEvent(new CustomEvent('connext-open',{detail:'home'}));economics.hidden=true;}
  handle.onclick=()=>{if(rail.hidden)show();else{allClosed();rail.hidden=true;handleState(false);}};
  hide.onclick=()=>{if(!rail.hidden)handle.click();};home.onclick=allClosed;
  window.addEventListener('connext-open',e=>{if(e.detail!=='home')show();economics.hidden=e.detail!=='economics';});
  let econSignature='';
  function renderEconomics(){const rows=window.ConnextAtar.readCourses(false).map(list=>list.find(r=>r.economics));const signature=JSON.stringify(rows);if(signature===econSignature)return;econSignature=signature;economics.replaceChildren(make('h2','Economics overall average'),make('p','Weighted average of completed assessments. Semester 2 includes semester 1 results once.'));
    rows.forEach((r,i)=>{const box=make('div');box.className='cx-econ-result';box.append(make('h3',`Semester ${i+1}`));box.append(make('strong',Number.isFinite(r?.mark)?r.mark.toFixed(2)+'%':'Expand the Economics outline to calculate.'));if(r?.progress.error)box.append(make('p',r.progress.error));economics.append(box);});
  }
  economy.onclick=()=>{window.ConnextData.expandAll();window.dispatchEvent(new CustomEvent('connext-open',{detail:'economics'}));econSignature='';renderEconomics();};
  function sync(){mount();economy.hidden=!window.ConnextData.economicsStatus().active;if(economy.hidden&&!economics.hidden)economics.hidden=true;const active=Array.from(content.children).some(p=>!p.hidden);rail.classList.toggle('cx-tool-active',active);intro.hidden=active;if(!economics.hidden)renderEconomics();}
  new MutationObserver(sync).observe(content,{attributes:true,attributeFilter:['hidden'],subtree:true});
  rail.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();hide.click();handle.focus();}});setInterval(sync,1000);sync();
})();
