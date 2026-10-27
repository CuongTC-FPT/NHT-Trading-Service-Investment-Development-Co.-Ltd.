(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const jumpLinks = [...document.querySelectorAll('.pricing-jump a')];
  const selectGroup = hash => jumpLinks.forEach(link => {
    if (link.hash === hash) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  jumpLinks.forEach(link => link.addEventListener('click', () => selectGroup(link.hash)));
  window.addEventListener('hashchange', () => selectGroup(location.hash));
  selectGroup(location.hash);
  document.querySelectorAll('.pricing-group').forEach(group => {
    const track = group.querySelector('.pricing-track');
    const cards = [...track.children];
    const buttons = [...group.querySelectorAll('[data-direction]')];
    const step = () => cards[0].getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap);
    const behavior = () => reduced.matches ? 'instant' : 'smooth';
    const centerFeatured = () => {
      const featuredIndex = cards.findIndex(card => card.classList.contains('price-card-featured'));
      if (featuredIndex < 0) return;
      const width = cards[featuredIndex].getBoundingClientRect().width;
      track.scrollTo({left:Math.max(0, featuredIndex * step() - (track.clientWidth - width) / 2), behavior:'instant'});
    };
    const update = () => {
      buttons[0].disabled = track.scrollLeft <= 2;
      buttons[1].disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
      const first = Math.round(track.scrollLeft / step()) + 1;
      const visible = Math.max(1, Math.floor((track.clientWidth + 16) / step()));
      group.querySelector('.pricing-position').textContent = `${first}–${Math.min(cards.length,first+visible-1)} / ${cards.length}`;
    };
    const move = direction => track.scrollBy({left:direction * step(),behavior:behavior()});
    buttons.forEach(button => button.addEventListener('click',() => move(Number(button.dataset.direction))));
    track.addEventListener('keydown',event => {
      if(event.target !== track || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      if(event.key === 'Home' || event.key === 'End') track.scrollTo({left:event.key === 'Home' ? 0 : track.scrollWidth,behavior:behavior()});
      else move(event.key === 'ArrowRight' ? 1 : -1);
    });
    let drag = null, suppress = false;
    track.addEventListener('pointerdown',event => {
      if(event.pointerType !== 'mouse' || event.button !== 0) return;
      suppress = false;
      drag = {id:event.pointerId,x:event.clientX,scroll:track.scrollLeft,moved:false};
    });
    track.addEventListener('pointermove',event => {
      if(!drag || event.pointerId !== drag.id) return;
      const delta = event.clientX - drag.x;
      if(!drag.moved && Math.abs(delta) < 6) return;
      drag.moved = suppress = true;
      track.setPointerCapture(event.pointerId);
      track.classList.add('is-dragging');
      track.scrollLeft = drag.scroll - delta;
      event.preventDefault();
    });
    const finish = () => {
      if(!drag) return;
      const moved = drag.moved;
      drag = null;
      track.classList.remove('is-dragging');
      if(moved) track.scrollTo({left:Math.round(track.scrollLeft / step()) * step(),behavior:behavior()});
    };
    ['pointerup','pointercancel','lostpointercapture'].forEach(name => track.addEventListener(name,finish));
    window.addEventListener('pointerup',finish);
    track.addEventListener('dragstart',event => event.preventDefault());
    track.addEventListener('click',event => {if(suppress){event.preventDefault();suppress=false;}},true);
    track.addEventListener('scroll',update,{passive:true});
    let previousWidth = 0;
    new ResizeObserver(() => {
      if (Math.abs(track.clientWidth - previousWidth) > 1) {
        previousWidth = track.clientWidth;
        centerFeatured();
      }
      update();
    }).observe(track);
    update();
  });
})();
