const backdrop = document.getElementById('authBackdrop');
const modal    = document.getElementById('authModal');
const closeBtn = document.getElementById('modalClose');
const tabs     = document.querySelectorAll('.tab');
const signupForm = document.getElementById('signupForm');
const signinForm = document.getElementById('signinForm');

// ── Open / close ──────────────────────────────────────────────

function openModal(tab = 'signup') {
  switchTab(tab);
  backdrop.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    const firstInput = modal.querySelector(`#${tab === 'signup' ? 'signupForm' : 'signinForm'} input`);
    firstInput?.focus();
  }, 260);
}

function closeModal() {
  backdrop.classList.remove('open');
  document.body.style.overflow = '';
}

// ── Triggers ─────────────────────────────────────────────────

document.querySelectorAll('[data-open]').forEach(el => {
  el.addEventListener('click', () => openModal(el.dataset.open));
});

closeBtn.addEventListener('click', closeModal);

backdrop.addEventListener('click', e => {
  if (e.target === backdrop) closeModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && backdrop.classList.contains('open')) closeModal();
});

// ── Tab switching ─────────────────────────────────────────────

function switchTab(name) {
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  signupForm.classList.toggle('hidden', name !== 'signup');
  signinForm.classList.toggle('hidden', name !== 'signin');
  clearErrors();
}

tabs.forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

// ── Password visibility toggle ────────────────────────────────

document.querySelectorAll('.pass-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    btn.textContent = showing ? 'Show' : 'Hide';
  });
});

// ── Validation helpers ────────────────────────────────────────

function showError(input) {
  input.classList.add('error');
  input.closest('.modal').classList.add('shake');
  input.closest('.modal').addEventListener('animationend', () => {
    input.closest('.modal')?.classList.remove('shake');
  }, { once: true });
}

function clearErrors() {
  modal.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
}

function validateEmail(val) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

// ── Sign up submit ────────────────────────────────────────────

signupForm.addEventListener('submit', e => {
  e.preventDefault();
  clearErrors();

  const name  = document.getElementById('su-name');
  const email = document.getElementById('su-email');
  const pass  = document.getElementById('su-pass');
  let valid = true;

  if (!name.value.trim()) { showError(name); valid = false; }
  if (!validateEmail(email.value)) { showError(email); valid = false; }
  if (pass.value.length < 8) { showError(pass); valid = false; }

  if (!valid) return;

  const btn = signupForm.querySelector('.btn-modal');
  btn.textContent = 'Creating account…';
  btn.classList.add('loading');

  // Simulated async — replace with real auth call
  setTimeout(() => {
    showSuccess('Welcome to Cadence!', 'Your account has been created. Start building your first habit.');
  }, 1400);
});

// ── Sign in submit ────────────────────────────────────────────

signinForm.addEventListener('submit', e => {
  e.preventDefault();
  clearErrors();

  const email = document.getElementById('si-email');
  const pass  = document.getElementById('si-pass');
  let valid = true;

  if (!email.value.trim()) { showError(email); valid = false; }
  if (!pass.value) { showError(pass); valid = false; }

  if (!valid) return;

  // Dummy auth check
  if (email.value.trim() !== 'admin' || pass.value !== 'admin') {
    showError(email);
    showError(pass);
    const hint = signinForm.querySelector('.auth-error') || document.createElement('p');
    hint.className = 'auth-error';
    hint.textContent = 'Incorrect email or password.';
    signinForm.insertBefore(hint, signinForm.querySelector('.btn-modal'));
    return;
  }

  const btn = signinForm.querySelector('.btn-modal');
  btn.textContent = 'Signing in…';
  btn.classList.add('loading');

  setTimeout(() => {
    window.location.href = 'dashboard.html';
  }, 900);
});

// ── Success screen ────────────────────────────────────────────

function showSuccess(title, message) {
  modal.innerHTML = `
    <button class="modal-close" id="modalClose" aria-label="Close">✕</button>
    <div class="modal-success">
      <span class="success-icon">✦</span>
      <h3>${title}</h3>
      <p>${message}</p>
    </div>
  `;
  document.getElementById('modalClose').addEventListener('click', closeModal);
  setTimeout(closeModal, 3200);
}
