function animateSceneStep(from, to, step, cardDiameter = 480) {
  const smooth = value => {
    const t = Math.max(0, Math.min(1, value));
    return t*t*(3-2*t);
  };
  const transform = (x, scale) => 'translateX(' + step*x/cardDiameter*100 + '%) scale(' + scale + ')';
  const exitFrames = [], entryFrames = [];
  for (let frame = 0; frame <= 60; frame++) {
    const t = frame/60;
    const slide = smooth((t-.16)/.44);
    exitFrames.push({transform:transform(-274*slide - 106*smooth((t-.56)/.3), 1-.5*smooth(t/.26))});
    const u = Math.max(0,(t-.60)/.40);
    const spring = 1-Math.exp(-6*u)*(Math.cos(6*u)+Math.sin(6*u));
    entryFrames.push({transform:transform(380*(1-slide), frame === 60 ? 1 : .5+.5*spring)});
  }
  const options = {duration:matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 640};
  return Promise.all([from.animate(exitFrames,options).finished,to.animate(entryFrames,options).finished]);
}

(() => {
  const groups = {
    activities: [
      ['game-1','Colour\nThief','colour-thief/cover-character.svg'],
      ['game-2','游戏 2','ui4/Quest-Zig-still.png'],
      ['game-3','游戏 3','colour-thief/snap-island.svg']
    ],
    review: [
      ['badges','Badge','ui4/Hub-badge.png'],
      ['photos','Photo','ui4/Hub-photo.png'],
      ['avatar','Avatar','ui4/Hub-zig.png']
    ]
  };
  for (const [page,items] of Object.entries(groups)) {
    const list = document.createElement('div');
    list.className = 'idle-scene scene-list';
    list.dataset.list = page;
    const dots = document.createElement('div');
    dots.className = 'scene-list-dots';
    const cards = items.map(([target,title,src],index) => {
      const card = document.createElement('div');
      card.className = 'scene-card';
      card.style.backgroundColor = '#898989';
      card.dataset.target = target;
      const art = new Image();
      art.src = src;
      art.alt = '';
      const label = document.createElement('strong');
      label.textContent = title;
      card.append(art,label);
      card.dataset.selected = String(index === 0);
      list.append(card);
      const dot = document.createElement('i');
      dot.classList.toggle('active',index === 0);
      dots.append(dot);
      return card;
    });
    list.append(dots);
    homeDevice.screen.append(list);
    let position = 0, target = 0, moving = false;
    const wrap = n => (n % items.length + items.length) % items.length;
    async function rotate() {
      if (moving) return;
      moving = true;
      try {
        while (position !== target && homeDevice.screen.dataset.page === page) {
          const step = Math.sign(target-position);
          const from = cards[wrap(position)], to = cards[wrap(position+step)];
          to.classList.add('incoming');
          await animateSceneStep(from,to,step,340);
          position += step;
          from.dataset.selected = 'false';
          to.dataset.selected = 'true';
          to.classList.remove('incoming');
          [...dots.children].forEach((dot,i) => dot.classList.toggle('active',i === wrap(position)));
        }
      } finally { moving = false; target = position; }
    }
    homeDevice.onInput(({control,action,source,direction}) => {
      if (homeDevice.screen.dataset.page !== page || control !== 'wheel') return;
      if (action === 'rotate') {
        target += source === 'keyboard' ? -direction : direction;
        rotate();
      } else if (action === 'press' && !moving) homeDevice.setPage(items[wrap(position)][0]);
    });
  }
})();

(() => {
  const collections = {
    badges: ['徽章1','徽章2','徽章3'],
    photos: ['照片1','照片2','照片3'],
    avatar: ['Zig','Zag']
  };
  for (const [page,labels] of Object.entries(collections)) {
    const scene = document.createElement('div');
    scene.className = 'idle-scene collection-scene';
    scene.dataset.collection = page;
    const cards = labels.map((label,index) => {
      const card = document.createElement('div');
      card.className = 'collection-bubble';
      if (page === 'avatar') {
        const image = new Image();
        image.src = 'avatar-' + label.toLowerCase() + '.svg?v='+ 'publish-20261122-1';
        image.alt = label;
        card.append(image);
      }
      const text = document.createElement('strong');
      text.textContent = label;
      card.append(text);
      scene.append(card);
      return card;
    });
    let selected = 0;
    function draw() {
      cards.forEach((card,index) => {
        const offset = (index-selected+cards.length)%cards.length;
        card.dataset.slot = String(cards.length === 3 && offset === 2 ? 3 : offset);
        card.dataset.selected = String(index === selected);
      });
    }
    draw();
    homeDevice.screen.append(scene);
    homeDevice.onInput(({control,action,source,direction}) => {
      if (homeDevice.screen.dataset.page !== page || control !== 'wheel') return;
      if (action === 'rotate') {
        selected = (selected+(source === 'keyboard' ? direction : -direction)+cards.length)%cards.length;
        draw();
      }
      if (action === 'press' && page === 'avatar') {
        try { localStorage.setItem('zigzag.avatar',labels[selected]); } catch {}
        homeDevice.screen.dataset.avatar = labels[selected];
        cards[selected].animate([{scale:'1'},{scale:'.94'},{scale:'1'}],{duration:220});
      }
    });
  }
})();
