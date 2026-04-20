// ── Theme on load ─────────────────────────────────────────────
const t = localStorage.getItem('cadence-theme');
if (t) document.documentElement.dataset.theme = t;

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

// ── Cursor glow on hero ───────────────────────────────────────
const hero = document.querySelector('.hero');
if (hero) {
  const glow = document.createElement('div');
  glow.className = 'cursor-glow';
  hero.appendChild(glow);

  hero.addEventListener('mousemove', e => {
    const rect = hero.getBoundingClientRect();
    glow.style.left = (e.clientX - rect.left) + 'px';
    glow.style.top  = (e.clientY - rect.top) + 'px';
  });

  hero.addEventListener('mouseleave', () => {
    glow.style.opacity = '0';
  });
  hero.addEventListener('mouseenter', () => {
    glow.style.opacity = '1';
  });
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
