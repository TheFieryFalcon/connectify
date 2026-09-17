(() => {
  'use strict';
  const key = 'connectea:theme:v1';
  let dark = false, queued = false;
  try { dark = localStorage.getItem(key) === 'dark'; } catch {}
  const button = document.createElement('button');
  button.id = 'connectea-theme-toggle'; button.type = 'button';
  button.setAttribute('aria-label', 'Dark mode');
  document.body.append(button);
  function rgb(value, allowTranslucent=false) {
    const m = value.match(/^rgba?\(([^)]+)\)/);
    if (!m) return null;
    const parts = m[1].split(',').map(Number);
    return parts.length === 4 && (parts[3] === 0 || (!allowTranslucent && parts[3] < 0.9)) ? null : parts.slice(0,3);
  }
  function neutral(c) { return c && Math.max(...c) - Math.min(...c) < 24; }
  const textColors=new Map();
  function restoreText(){
    for(const [el,saved] of textColors){
      if(el.style.getPropertyValue(saved.property)==='rgb(255, 255, 255)'){
        if(saved.value)el.style.setProperty(saved.property,saved.value,saved.priority);
        else el.style.removeProperty(saved.property);
      }
    }
    textColors.clear();
  }
  function surfaces() {
    if (!dark) return;
    // Catch native and dynamically loaded neutral surfaces across Connect versions.
    // Preserve images, SVG chart data, brand colors and colored status indicators.
    for (const el of document.body.querySelectorAll('*')) {
      const svgText=el instanceof SVGElement && ['text','tspan'].includes(el.localName);
      if (!(el instanceof HTMLElement)&&!svgText)continue;
      if(el.closest('video,canvas,iframe,#connectea-theme-toggle') || ['SCRIPT','STYLE','LINK'].includes(el.tagName)) continue;
      const style = getComputedStyle(el);
      const bg = rgb(style.backgroundColor), fg = rgb(svgText?style.fill:style.color,true);
      if (!svgText&&!el.closest('.connectea-panel')&&neutral(bg) && Math.min(...bg) > 165) el.setAttribute('data-connectea-surface', '');
      if (neutral(fg) && Math.max(...fg) < 170){
        const property=svgText?'fill':'color';
        textColors.set(el,{property,value:el.style.getPropertyValue(property),priority:el.style.getPropertyPriority(property)});
        el.style.setProperty(property,'rgb(255, 255, 255)','important');
      }
    }
  }
  let headerInset=null;
  function position(reset=false) {
    if(reset)headerInset=null;
    if(button.parentElement!==document.body)document.body.append(button);
    const bell=document.querySelector('.cvr-c-icon--notification-hollow')?.closest('[role="button"],button');
    const rect=bell?.getBoundingClientRect();
    if(headerInset===null&&rect?.width&&rect.left>120)headerInset=Math.max(8,window.innerWidth-rect.left+12);
    button.style.right=(headerInset??16)+'px';
  }
  function detailArrows() {
    for (const heading of document.querySelectorAll('.eds-c-tile .eds-c-accordion__section-heading')) {
      const text = heading.textContent.replace(/\s+/g, ' ').trim();
      const arrow = /hide details/i.test(text) ? '▴' : /show details/i.test(text) ? '▾' : null;
      if (arrow && heading.getAttribute('data-cx-details-arrow') !== arrow) heading.setAttribute('data-cx-details-arrow', arrow);
      else if (!arrow && heading.hasAttribute('data-cx-details-arrow')) heading.removeAttribute('data-cx-details-arrow');
    }
  }
  function update() {
    if(!button.isConnected)document.body.append(button);
    if(!dark)restoreText();
    document.documentElement.classList.toggle('connectea-dark', dark);
    const label = dark ? '☀ Light mode' : '☾ Dark mode';
    if (button.textContent !== label) button.textContent = label;
    button.setAttribute('aria-pressed', String(dark));
    position(); surfaces(); detailArrows();
  }
  function schedule() {
    if (queued) return;
    queued = true;
    setTimeout(() => { queued = false; update(); }, 100);
  }
  button.addEventListener('click', () => {
    dark = !dark;
    try { localStorage.setItem(key, dark ? 'dark' : 'light'); } catch {}
    update();
  });
  new MutationObserver(records => {
    if (records.some(r => {
      if(r.target===button||r.target.parentElement?.closest('#connectea-theme-toggle'))return false;
      const saved=textColors.get(r.target);
      return !(r.type==='attributes'&&r.attributeName==='style'&&saved&&r.target.style.getPropertyValue(saved.property)==='rgb(255, 255, 255)');
    })) schedule();
  }).observe(document.body, {childList:true, subtree:true,characterData:true,attributes:true,attributeFilter:['class','style']});
  window.addEventListener('resize', ()=>position(true));
  setInterval(()=>{if(!button.isConnected)update();},1000);
  window.addEventListener('storage', e => { if (e.key === key) { dark = e.newValue === 'dark'; update(); } });
  update();
})();

