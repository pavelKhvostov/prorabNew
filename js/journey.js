// Фоновое видео, листаемое скроллом: кадры рисуются на канвас с кроссфейдом
// между соседними кадрами и инерцией — движение остаётся плавным при любой
// скорости скролла. Главы проявляются по прогрессу.
(function () {
  const canvas = document.getElementById('bgVideo');
  const veil = document.querySelector('.journey-veil');
  const journey = document.querySelector('.journey');
  const loaderEl = document.getElementById('loader');
  const hint = document.getElementById('hint');
  const chapters = [...document.querySelectorAll('.chapter')].map((el) => ({
    el,
    start: +el.dataset.start,
    end: +el.dataset.end,
  }));

  const FRAMES = 238;
  const src = (i) => `img/bg/b_${String(i + 1).padStart(3, '0')}.webp`;

  function staticFallback() {
    document.body.classList.add('is-static');
    loaderEl.classList.add('done');
  }

  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !canvas.getContext) {
    staticFallback();
    return;
  }

  const ctx = canvas.getContext('2d');
  const frames = new Array(FRAMES).fill(null);
  let target = 0;
  let current = 0;
  let pastJourney = 0;
  let loaderDone = false;
  let failed = 0;

  function resize() {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
  }
  resize();
  addEventListener('resize', resize);

  // грузим кадры с приоритетом начала: первые 24 — сразу, остальные следом
  function loadFrame(i) {
    const img = new Image();
    img.src = src(i);
    img.onload = () => {
      frames[i] = img;
      if (i === 0 && !loaderDone) {
        loaderDone = true;
        setTimeout(() => loaderEl.classList.add('done'), 400);
      }
    };
    img.onerror = () => { if (++failed > FRAMES / 4) staticFallback(); };
  }
  for (let i = 0; i < 24; i++) loadFrame(i);
  setTimeout(() => { for (let i = 24; i < FRAMES; i++) loadFrame(i); }, 200);

  function readScroll() {
    const max = journey.offsetHeight - innerHeight;
    const p = Math.min(Math.max(scrollY / max, 0), 1);
    target = p * (FRAMES - 1);
    pastJourney = Math.min(Math.max((scrollY - max) / (innerHeight * 0.7), 0), 1);
  }
  addEventListener('scroll', readScroll, { passive: true });
  readScroll();

  function nearestLoaded(i) {
    i = Math.max(0, Math.min(FRAMES - 1, i));
    for (let d = 0; d < FRAMES; d++) {
      if (frames[i - d]) return i - d;
      if (frames[i + d]) return i + d;
    }
    return -1;
  }

  // отрисовка кадра на весь экран по принципу object-fit: cover
  function drawCover(img, alpha) {
    const cw = canvas.width, ch = canvas.height;
    const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  }

  let lastTime = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);

    const fade = 1 - pastJourney;
    canvas.style.opacity = fade;
    veil.style.opacity = fade;
    if (fade <= 0) return;

    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    // инерция: догоняем цель постепенно, скорость не зависит от FPS
    current += (target - current) * Math.min(1, dt * 5);
    if (Math.abs(target - current) < 0.01) current = target;

    const lo = nearestLoaded(Math.floor(current));
    if (lo >= 0) {
      const hi = nearestLoaded(Math.ceil(current));
      drawCover(frames[lo], 1);
      // кроссфейд со следующим кадром убирает ступенчатость
      if (hi !== lo && hi >= 0) drawCover(frames[hi], current - Math.floor(current));
      ctx.globalAlpha = 1;
    }

    updateChapters();
    hint.style.opacity = target < 3 ? 1 : 0;
  }

  function updateChapters() {
    const progress = current / (FRAMES - 1);
    for (const ch of chapters) {
      const local = (progress - ch.start) / (ch.end - ch.start);
      let o = 0;
      if (local > 0 && local < 1) {
        o = Math.min(local / 0.18, 1) * Math.min((1 - local) / 0.18, 1);
      }
      ch.el.style.opacity = o;
      ch.el.style.transform = `translateY(${(1 - o) * (local > 0.5 ? -34 : 34)}px)`;
      ch.el.style.visibility = o > 0.01 ? 'visible' : 'hidden';
    }
  }

  requestAnimationFrame(frame);
})();
