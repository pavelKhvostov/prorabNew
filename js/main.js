// ============ Появление блоков при скролле ============
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        entry.target.style.transitionDelay = `${(i % 4) * 90}ms`;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
);

document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

// ============ Анимация счётчиков ============
function animateCount(el) {
  const target = +el.dataset.count;
  if (!target) { el.textContent = el.dataset.count; return; }
  const duration = 1600;
  const start = performance.now();

  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * eased);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

const statsObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateCount(entry.target);
        statsObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.6 }
);

document.querySelectorAll('.stat__num').forEach((el) => statsObserver.observe(el));

// ============ Навигация: фон при скролле ============
const nav = document.querySelector('.nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('is-scrolled', window.scrollY > 40);
}, { passive: true });

// ============ Мобильное меню ============
const burger = document.querySelector('.nav__burger');
const navLinks = document.querySelector('.nav__links');

burger.addEventListener('click', () => navLinks.classList.toggle('is-open'));
navLinks.addEventListener('click', (e) => {
  if (e.target.tagName === 'A') navLinks.classList.remove('is-open');
});

// ============ Лента отзывов: дублируем для бесшовного цикла ============
const track = document.querySelector('.marquee__track');
track.innerHTML += track.innerHTML;

// ============ Скролл-видео: пролёт по объекту ============
(function () {
  const section = document.getElementById('flythrough');
  if (!section) return;

  const canvas = document.getElementById('flyCanvas');
  const video = section.querySelector('.flythrough__video');
  const progressBar = document.getElementById('flyProgress');
  const ctx = canvas.getContext('2d');

  const FRAMES = 140;
  const src = (i) => `img/fly/f_${String(i + 1).padStart(3, '0')}.webp`;

  // reduced-motion: показываем обычное видео с контролами
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    fallback();
    return;
  }

  function fallback() {
    section.classList.add('is-fallback');
    video.hidden = false;
    video.preload = 'metadata';
  }

  const frames = new Array(FRAMES).fill(null);
  let loadStarted = false;
  let drawnIndex = -1;
  let current = 0;
  let target = 0;
  let rafActive = false;

  function loadFrames() {
    if (loadStarted) return;
    loadStarted = true;
    let failed = 0;
    for (let i = 0; i < FRAMES; i++) {
      const img = new Image();
      img.src = src(i);
      img.onload = () => {
        frames[i] = img;
        if (i === Math.round(current)) draw(i, true);
      };
      img.onerror = () => { if (++failed > FRAMES / 4) fallback(); };
    }
  }

  // начинаем грузить кадры заранее, за экран до секции
  new IntersectionObserver((entries, obs) => {
    if (entries[0].isIntersecting) { loadFrames(); obs.disconnect(); }
  }, { rootMargin: '100% 0px' }).observe(section);

  function nearestLoaded(i) {
    for (let d = 0; d < FRAMES; d++) {
      if (frames[i - d]) return i - d;
      if (frames[i + d]) return i + d;
    }
    return -1;
  }

  function draw(i, force) {
    const idx = nearestLoaded(Math.max(0, Math.min(FRAMES - 1, i)));
    if (idx < 0 || (idx === drawnIndex && !force)) return;
    drawnIndex = idx;
    ctx.drawImage(frames[idx], 0, 0, canvas.width, canvas.height);
  }

  function readProgress() {
    const rect = section.getBoundingClientRect();
    const total = section.offsetHeight - innerHeight;
    const p = Math.min(Math.max(-rect.top / total, 0), 1);
    target = p * (FRAMES - 1);
    progressBar.style.width = `${p * 100}%`;
    if (!rafActive) { rafActive = true; requestAnimationFrame(tick); }
  }

  function tick() {
    current += (target - current) * 0.18;
    if (Math.abs(target - current) < 0.4) current = target;
    draw(Math.round(current));
    if (current !== target) requestAnimationFrame(tick);
    else rafActive = false;
  }

  addEventListener('scroll', readProgress, { passive: true });
  addEventListener('resize', readProgress);
  readProgress();
})();

// ============ Форма ============
document.getElementById('contactForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.textContent = 'Заявка отправлена ✓';
  btn.disabled = true;
  // TODO: подключите отправку — например, Formspree или Telegram-бот
});
