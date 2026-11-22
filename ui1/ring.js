(() => {
  const menu = document.querySelector('.ui1-ring');
  const items = [
    ['ZigDex', '#dedede', '#b7b7b7', 'center-darkZigDex'],
    ['Quest', '#bfbfbf', '#9b9b9b', 'Quest'],
    ['Hub', '#b0b0b0', '#838383', 'Hub'],
    ['Snap', '#c8c8c8', '#9c9c9c', 'Snap']
  ];
  // Clockwise slots: right, bottom, left, upper-left.
  const slots = [[-60,60,0],[84,138,85],[162,198,162.86],[222,276,224]];
  const wrap = i => (i % 4 + 4) % 4;
  const point = angle => [240 + 190*Math.cos(angle*Math.PI/180),240 + 190*Math.sin(angle*Math.PI/180)];
  const centerIcon = i => i === 0 ? 'ZigDex' : 'center-' + items[i][0];
  menu.innerHTML = '<defs>' + items.map(([name,light,dark]) =>
    '<linearGradient id="arc-'+name+'" gradientUnits="userSpaceOnUse"><stop stop-color="'+light+'"/><stop offset="1" stop-color="'+dark+'"/></linearGradient>').join('') + '</defs>' +
    items.map(([name]) => '<g><path fill="none" stroke="url(#arc-'+name+')" stroke-width="48" stroke-linecap="round"/><image width="30" height="30"/></g>').join('') +
    '<image class="center-icon" x="192" y="157" width="96" height="96"/><text x="240" y="307" text-anchor="middle" fill="#f5f2ed" font-family="UIRounded,system-ui" font-weight="700" font-size="40"></text>';
  const groups = [...menu.querySelectorAll('g')];
  groups.forEach((group,i) => { group.dataset.entry = items[i][0]; });
  const gradients = [...menu.querySelectorAll('linearGradient')];
  let position = 0, target = 0, frame = 0;
  function draw() {
    groups.forEach((g,i) => {
      const phase = i+position, base = Math.floor(phase), fraction = phase-base;
      const a = slots[wrap(base)], b = slots[wrap(base+1)];
      const angles = a.map((angle,j) => angle + fraction * ((b[j]-angle+360)%360));
      const [start,end,icon] = angles;
      const first = point(start), last = point(end);
      const reverse = i === 1 || i === 2;
      const [light, dark] = reverse ? [last, first] : [first, last];
      const gradient = gradients[i];
      gradient.setAttribute('x1', light[0]);
      gradient.setAttribute('y1', light[1]);
      gradient.setAttribute('x2', dark[0]);
      gradient.setAttribute('y2', dark[1]);
      g.firstChild.setAttribute('d','M'+first+' A190 190 0 0 1 '+last);
      const [x,y] = point(icon), selected = wrap(Math.round(phase))===0;
      g.dataset.selected = String(selected);
      g.lastChild.setAttribute('href','ui1/'+(selected?'Enter':items[i][3])+'.svg');
      const size = !selected && items[i][0] === 'Hub' ? 38.45 : 30;
      g.lastChild.setAttribute('width',size);g.lastChild.setAttribute('height',size);
      g.lastChild.setAttribute('x',x-size/2);g.lastChild.setAttribute('y',y-size/2);
    });
    const selected = wrap(-Math.round(position));
    menu.querySelector('.center-icon').setAttribute('href','ui1/'+centerIcon(selected)+'.svg');
    menu.querySelector('text').textContent = items[selected][0];
  }
  function rotate(step) {
    target += step;
    cancelAnimationFrame(frame);
    const from = position, started = performance.now();
    function animate(now) {
      const t = Math.min(1,(now-started)/280);
      position = from+(target-from)*(1-(1-t)**3);
      draw();
      if (t<1) frame=requestAnimationFrame(animate);
    }
    frame=requestAnimationFrame(animate);
  }
  draw();
  window.homeDevice.onInput(({control,action,direction,source}) => {
    const screen = window.homeDevice.screen;
    if (!entering && control==='wheel' && action==='rotate' && screen.dataset.page==='apps' && screen.dataset.ui==='1')
      rotate(source==='keyboard'?-direction:direction);
  });
})();
