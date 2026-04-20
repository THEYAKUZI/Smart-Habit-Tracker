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
  modal.querySelectorAll('.auth-error').forEach(el => el.remove());
}

function showAuthError(form, message) {
  form.querySelectorAll('.auth-error').forEach(el => el.remove());
  const hint = document.createElement('p');
  hint.className = 'auth-error';
  hint.textContent = message;
  form.insertBefore(hint, form.querySelector('.btn-modal'));
  form.closest('.modal').classList.add('shake');
  form.closest('.modal').addEventListener('animationend', () => {
    form.closest('.modal')?.classList.remove('shake');
  }, { once: true });
}

function validateEmail(val) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

// ── Sign up submit ────────────────────────────────────────────

signupForm.addEventListener('submit', async e => {
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
  const originalText = btn.textContent;
  btn.textContent = 'Creating account…';
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.value.trim(), email: email.value.trim(), password: pass.value })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');

    localStorage.setItem('cadence-token', data.token);
    localStorage.setItem('cadence-user', JSON.stringify(data.user));
    showSuccess('Welcome to Cadence!', 'Taking you to your dashboard…');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);
  } catch (err) {
    btn.textContent = originalText;
    btn.classList.remove('loading');
    btn.disabled = false;
    showAuthError(signupForm, err.message);
  }
});

// ── Sign in submit ────────────────────────────────────────────

signinForm.addEventListener('submit', async e => {
  e.preventDefault();
  clearErrors();

  const email = document.getElementById('si-email');
  const pass  = document.getElementById('si-pass');
  let valid = true;

  if (!validateEmail(email.value)) { showError(email); valid = false; }
  if (!pass.value) { showError(pass); valid = false; }

  if (!valid) return;

  const btn = signinForm.querySelector('.btn-modal');
  const originalText = btn.textContent;
  btn.textContent = 'Signing in…';
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value.trim(), password: pass.value })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Sign in failed');

    localStorage.setItem('cadence-token', data.token);
    localStorage.setItem('cadence-user', JSON.stringify(data.user));
    window.location.href = 'dashboard.html';
  } catch (err) {
    btn.textContent = originalText;
    btn.classList.remove('loading');
    btn.disabled = false;
    showError(email);
    showError(pass);
    showAuthError(signinForm, err.message);
  }
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
}
