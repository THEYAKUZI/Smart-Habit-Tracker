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

function validateUsername(val) {
  return /^[a-z0-9_]{3,20}$/.test(val);
}

function validatePassword(pw) {
  if (pw.length < 8) return 'Password needs at least 8 characters';
  if (!/[a-zA-Z]/.test(pw)) return 'Password needs at least one letter';
  if (!/[0-9]/.test(pw))    return 'Password needs at least one number';
  return null;
}

// ── Sign up submit ────────────────────────────────────────────

signupForm.addEventListener('submit', async e => {
  e.preventDefault();
  clearErrors();

  const name     = document.getElementById('su-name');
  const username = document.getElementById('su-username');
  const email    = document.getElementById('su-email');
  const pass     = document.getElementById('su-pass');
  let valid = true;

  if (!name.value.trim()) { showError(name); valid = false; }
  if (!validateUsername(username.value.trim().toLowerCase())) { showError(username); valid = false; }
  if (!validateEmail(email.value)) { showError(email); valid = false; }

  const pwErr = validatePassword(pass.value);
  if (pwErr) { showError(pass); valid = false; }

  if (!valid) {
    if (pwErr) showAuthError(signupForm, pwErr);
    else if (!validateUsername(username.value.trim().toLowerCase()))
      showAuthError(signupForm, 'Username: 3–20 chars (letters, numbers, underscore)');
    return;
  }

  const btn = signupForm.querySelector('.btn-modal');
  const originalText = btn.textContent;
  btn.textContent = 'Creating account…';
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.value.trim(),
        username: username.value.trim().toLowerCase(),
        email: email.value.trim(),
        password: pass.value
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');

    if (data.pendingVerification) {
      showVerifyUI(data.email);
      return;
    }
    localStorage.setItem('cadence-token', data.token);
    localStorage.setItem('cadence-user', JSON.stringify(data.user));
    window.location.href = 'dashboard.html';
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

  const ident = document.getElementById('si-id');
  const pass  = document.getElementById('si-pass');
  let valid = true;

  if (!ident.value.trim()) { showError(ident); valid = false; }
  if (!pass.value)         { showError(pass);  valid = false; }

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
      body: JSON.stringify({ identifier: ident.value.trim(), password: pass.value })
    });
    const data = await res.json();
    if (res.status === 403 && data.needsVerification) {
      await fetch('/api/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email })
      });
      showVerifyUI(data.email);
      return;
    }
    if (!res.ok) throw new Error(data.error || 'Sign in failed');

    localStorage.setItem('cadence-token', data.token);
    localStorage.setItem('cadence-user', JSON.stringify(data.user));
    window.location.href = 'dashboard.html';
  } catch (err) {
    btn.textContent = originalText;
    btn.classList.remove('loading');
    btn.disabled = false;
    showError(ident);
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

// ── Verify email ──────────────────────────────────────────────

function showVerifyUI(email) {
  modal.innerHTML = `
    <button class="modal-close" id="modalClose" aria-label="Close">✕</button>
    <div class="modal-logo">Cadence</div>
    <h3 class="verify-title">Check your email</h3>
    <p class="verify-sub">We sent a 6-digit code to<br><strong>${email}</strong></p>
    <form class="modal-form" id="verifyForm" novalidate>
      <div class="field">
        <label for="verify-code">Verification code</label>
        <input type="text" id="verify-code" inputmode="numeric" maxlength="6" placeholder="000000" autocomplete="one-time-code" />
      </div>
      <button type="submit" class="btn-modal">Verify</button>
      <button type="button" class="verify-resend" id="verifyResend">Didn't get it? Resend code</button>
    </form>
  `;

  document.getElementById('modalClose').addEventListener('click', closeModal);

  const input = document.getElementById('verify-code');
  input.focus();
  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '');
    if (input.value.length === 6) document.getElementById('verifyForm').requestSubmit();
  });

  document.getElementById('verifyForm').addEventListener('submit', async e => {
    e.preventDefault();
    const code = input.value.trim();
    if (code.length !== 6) { showError(input); return; }

    const btn = e.target.querySelector('.btn-modal');
    btn.textContent = 'Verifying…';
    btn.classList.add('loading');
    btn.disabled = true;

    try {
      const res = await fetch('/api/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');

      localStorage.setItem('cadence-token', data.token);
      localStorage.setItem('cadence-user', JSON.stringify(data.user));
      window.location.href = 'dashboard.html';
    } catch (err) {
      btn.textContent = 'Verify';
      btn.classList.remove('loading');
      btn.disabled = false;
      showError(input);
      showAuthError(document.getElementById('verifyForm'), err.message);
    }
  });

  document.getElementById('verifyResend').addEventListener('click', async () => {
    const link = document.getElementById('verifyResend');
    link.textContent = 'Sending…';
    link.disabled = true;
    try {
      await fetch('/api/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      link.textContent = 'New code sent';
      setTimeout(() => {
        link.textContent = "Didn't get it? Resend code";
        link.disabled = false;
      }, 3000);
    } catch {
      link.textContent = "Didn't get it? Resend code";
      link.disabled = false;
    }
  });
}
