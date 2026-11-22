// Render GIF frames through the shared pausable timer.
(() => {
  const sources = new Map();
  const runs = new WeakMap();
  async function readGif(url) {
    if (!sources.has(url)) sources.set(url, (window.colourThiefGifData?.[decodeURIComponent(new URL(url).pathname.split('/').pop())]
      ? Promise.resolve(Uint8Array.from(atob(window.colourThiefGifData[decodeURIComponent(new URL(url).pathname.split('/').pop())]), ch => ch.charCodeAt(0)).buffer)
      : fetch(url).then(r => {
      if (!r.ok) throw new Error('GIF load failed');
      return r.arrayBuffer();
    })).then(buffer => {
      const reader = new GifReader(new Uint8Array(buffer));
      const canvas = document.createElement('canvas');
      canvas.width = reader.width;
      canvas.height = reader.height;
      const context = canvas.getContext('2d');
      const frames = [];
      let previous;
      let restore;
      for (let index = 0; index < reader.numFrames(); index++) {
        if (previous?.disposal === 2) context.clearRect(previous.x, previous.y, previous.width, previous.height);
        if (previous?.disposal === 3 && restore) context.putImageData(restore, 0, 0);
        const info = reader.frameInfo(index);
        restore = info.disposal === 3 ? context.getImageData(0, 0, canvas.width, canvas.height) : null;
        const rgba = new Uint8ClampedArray(canvas.width * canvas.height * 4);
        reader.decodeAndBlitFrameRGBA(index, rgba);
        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = canvas.width;
        frameCanvas.height = canvas.height;
        frameCanvas.getContext('2d').putImageData(new ImageData(rgba, canvas.width, canvas.height), 0, 0);
        context.drawImage(frameCanvas, 0, 0);
        frames.push({ src: canvas.toDataURL('image/png'), duration: Math.max(20, info.delay * 10) });
        previous = info;
      }
      return { frames, loops: reader.loopCount() };
    }));
    return sources.get(url);
  }
  async function watch(image) {
    const src = image.getAttribute('src') || '';
    if (!/\.gif(?:[?#]|$)/i.test(src)) return;
    const previous = runs.get(image);
    if (previous) clearTimeout(previous.timer);
    const run = { timer: null };
    runs.set(image, run);
    try {
      const { frames, loops } = await readGif(new URL(src, location.href).href);
      if (runs.get(image) !== run || image.getAttribute('src') !== src) return;
      let index = 0;
      let pass = 0;
      function show() {
        if (!image.isConnected || runs.get(image) !== run) return;
        const frame = frames[index];
        image.src = frame.src;
        run.timer = setTimeout(() => {
          index++;
          if (index === frames.length) {
            if (loops === null || (loops !== 0 && pass >= loops)) return;
            index = 0;
            pass++;
          }
          show();
        }, frame.duration);
      }
      show();
    } catch {
      // Native playback remains available if decoding is unsupported.
    }
  }
  const observer = new MutationObserver(records => {
    const images = new Set();
    for (const record of records) {
      if (record.type === 'attributes' && record.target instanceof HTMLImageElement) images.add(record.target);
      for (const node of record.addedNodes || []) {
        if (node instanceof HTMLImageElement) images.add(node);
        if (node instanceof Element) node.querySelectorAll('img').forEach(image => images.add(image));
      }
    }
    images.forEach(watch);
  });
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });
  document.querySelectorAll('img').forEach(watch);
})();
