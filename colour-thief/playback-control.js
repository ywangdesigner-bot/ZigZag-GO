// A shared virtual clock keeps scene timers, animation frames and audio in sync.
(() => {
  const realNow = performance.now.bind(performance);
  const nativeTimeout = window.setTimeout.bind(window);
  const nativeClear = window.clearTimeout.bind(window);
  const nativeFrame = window.requestAnimationFrame.bind(window);
  const nativeCancelFrame = window.cancelAnimationFrame.bind(window);
  let paused = false;
  let pausedAt = 0;
  let elapsedPause = 0;
  let nextId = 1;
  const timers = new Map();
  const frames = new Map();
  const playingAudio = new Set();
  const pausedAnimations = new Set();
  const audioElements = new Set();
  const now = () => (paused ? pausedAt : realNow()) - elapsedPause;
  Object.defineProperty(performance, 'now', { value: now });

  function schedule(timer) {
    timer.started = realNow();
    timer.handle = nativeTimeout(() => {
      if (paused) return;
      if (timer.interval) {
        timer.remaining = timer.delay;
        schedule(timer);
      } else timers.delete(timer.id);
      timer.callback(...timer.args);
    }, timer.remaining);
  }
  function addTimer(callback, delay, args, interval) {
    const id = nextId++;
    const duration = Math.max(interval ? 1 : 0, Number(delay) || 0);
    const timer = { id, callback, delay: duration, remaining: duration, args, interval };
    timers.set(id, timer);
    if (!paused) schedule(timer);
    return id;
  }
  window.setTimeout = (callback, delay, ...args) => addTimer(callback, delay, args, false);
  window.setInterval = (callback, delay, ...args) => addTimer(callback, delay, args, true);
  window.clearTimeout = window.clearInterval = id => {
    const timer = timers.get(id);
    if (timer) nativeClear(timer.handle);
    timers.delete(id);
  };
  function scheduleFrame(frame) {
    frame.handle = nativeFrame(() => {
      frames.delete(frame.id);
      frame.callback(now());
    });
  }
  window.requestAnimationFrame = callback => {
    const frame = { id: nextId++, callback };
    frames.set(frame.id, frame);
    if (!paused) scheduleFrame(frame);
    return frame.id;
  };
  window.cancelAnimationFrame = id => {
    const frame = frames.get(id);
    if (frame) nativeCancelFrame(frame.handle);
    frames.delete(id);
  };

  const originalPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    audioElements.add(this);
    if (paused) {
      playingAudio.add(this);
      return Promise.resolve();
    }
    return originalPlay.call(this);
  };

  const button = document.createElement('button');
  button.className = 'playback-control';
  button.type = 'button';
  button.textContent = 'Ⅱ Stop';
  button.setAttribute('aria-label', '暂停');
  button.setAttribute('aria-pressed', 'false');
  document.body.append(button);
  button.addEventListener('click', () => {
    if (!paused) {
      pausedAt = realNow();
      paused = true;
      for (const timer of timers.values()) {
        nativeClear(timer.handle);
        timer.remaining = Math.max(0, timer.remaining - (pausedAt - timer.started));
      }
      for (const frame of frames.values()) nativeCancelFrame(frame.handle);
      for (const media of audioElements) {
        if (!media.paused && !media.ended) {
          playingAudio.add(media);
          media.pause();
        }
      }
      for (const animation of document.getAnimations()) {
        if (animation.playState === 'running') {
          pausedAnimations.add(animation);
          animation.pause();
        }
      }
      document.documentElement.classList.add('playback-paused');
      button.textContent = '▶ Play';
      button.setAttribute('aria-label', '继续播放');
    } else {
      elapsedPause += realNow() - pausedAt;
      paused = false;
      document.documentElement.classList.remove('playback-paused');
      for (const timer of timers.values()) schedule(timer);
      for (const frame of frames.values()) scheduleFrame(frame);
      for (const animation of pausedAnimations) animation.play();
      pausedAnimations.clear();
      for (const media of playingAudio) originalPlay.call(media).catch(() => {});
      playingAudio.clear();
      button.textContent = 'Ⅱ Stop';
      button.setAttribute('aria-label', '暂停');
    }
    button.setAttribute('aria-pressed', String(paused));
  });
  for (const type of ['click', 'pointerdown', 'pointerup', 'wheel', 'keydown', 'keyup']) {
    document.addEventListener(type, event => {
      if (!paused || button.contains(event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, { capture: true, passive: false });
  }
})();
