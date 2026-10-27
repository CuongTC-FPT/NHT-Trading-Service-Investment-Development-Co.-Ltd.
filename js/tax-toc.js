(() => {
  const links = [...document.querySelectorAll('.tax-sidebar nav a')];
  if (!links.length) return;
  const entries = links.map(link => ({link, section:document.getElementById(link.hash.slice(1))})).filter(entry => entry.section);
  const activate = link => links.forEach(item => {
    if (item === link) item.setAttribute('aria-current','location');
    else item.removeAttribute('aria-current');
  });
  let pending = false;
  let selected = null;
  let settleTimer;
  const releaseSelection = () => { selected = null; schedule(); };
  const activationLine = () => {
    const padding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const margin = entries.length ? parseFloat(getComputedStyle(entries[0].section).scrollMarginTop) || 0 : 0;
    return padding + margin + 12;
  };
  const update = () => {
    pending = false;
    if (selected) { activate(selected); return; }
    let current = entries[0];
    const line = activationLine();
    for (const entry of entries) {
      if (entry.section.getBoundingClientRect().top <= line) current = entry;
    }
    if (current) activate(current.link);
  };
  const schedule = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(update);
  };
  links.forEach(link => link.addEventListener('click',event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    selected = link;
    activate(link);
    clearTimeout(settleTimer);
    settleTimer = setTimeout(releaseSelection, 1200);
  }));
  window.addEventListener('scroll',() => {
    schedule();
    if (selected) {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(releaseSelection, 180);
    }
  },{passive:true});
  window.addEventListener('wheel',releaseSelection,{passive:true});
  window.addEventListener('touchstart',releaseSelection,{passive:true});
  window.addEventListener('keydown',event => {
    if (['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key)) releaseSelection();
  });
  window.addEventListener('resize',schedule);
  window.addEventListener('hashchange',schedule);
  update();
})();
