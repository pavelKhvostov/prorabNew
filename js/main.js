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

// ============ Форма ============
document.getElementById('contactForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.textContent = 'Заявка отправлена ✓';
  btn.disabled = true;
  // TODO: подключите отправку — например, Formspree или Telegram-бот
});
