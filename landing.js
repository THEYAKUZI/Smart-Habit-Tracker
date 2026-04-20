// ── Theme toggle ─────────────────────────────────────────────
document.getElementById('themeToggle').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? null : 'light';
  if (next) {
    document.documentElement.dataset.theme = next;
    localStorage.setItem('cadence-theme', next);
  } else {
    delete document.documentElement.dataset.theme;
    localStorage.removeItem('cadence-theme');
  }
});

// ── Scroll reveal ─────────────────────────────────────────────
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal-up, .reveal-left, .reveal-right, .reveal-strip')
  .forEach(el => revealObserver.observe(el));

// ── Count-up animation ────────────────────────────────────────
function countUp(el) {
  const target   = parseInt(el.dataset.target);
  const suffix   = el.dataset.suffix || '';
  const duration = 1400;
  const start    = performance.now();

  const tick = (now) => {
    const elapsed  = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // ease out expo
    const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    el.textContent = Math.floor(ease * target) + suffix;
    if (progress < 1) requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

const countObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.querySelectorAll('.count-up').forEach(countUp);
      countObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.3 });

const strip = document.querySelector('.reveal-strip');
if (strip) countObserver.observe(strip);

// ── Hero desc slideshow ───────────────────────────────────────
const descLines = document.querySelectorAll('.desc-line');
let current = 0;

if (descLines.length) {
  setInterval(() => {
    descLines[current].classList.remove('active');
    descLines[current].classList.add('exit');

    const prev = current;
    current = (current + 1) % descLines.length;

    descLines[current].classList.add('active');

    setTimeout(() => descLines[prev].classList.remove('exit'), 400);
  }, 2800);
}

// ── Feature rows hover line ───────────────────────────────────
document.querySelectorAll('.feature-row').forEach(row => {
  row.addEventListener('mouseenter', () => {
    row.querySelector('.feature-num').style.color = 'var(--lime)';
  });
  row.addEventListener('mouseleave', () => {
    row.querySelector('.feature-num').style.color = '';
  });
});
