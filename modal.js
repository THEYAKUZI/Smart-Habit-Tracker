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

    // Store creds temporarily — redirect after email verification
    pendingAuth = { token: data.token, user: data.user, devCode: data.devCode || null };
    showVerifyScreen(email.value.trim());
  } catch (err) {
    btn.textContent = originalText;
    btn.classList.remove('loading');
    btn.disabled = false;
    showAuthError(signupForm, err.message);
  }
});

// ── Email verification (placeholder) ─────────────────────────

let pendingAuth = null;

function showVerifyScreen(emailAddr) {
  const inner = modal.querySelector('.modal-tabs');
  if (inner) inner.style.display = 'none';
  signupForm.style.display = 'none';
  signinForm.style.display = 'none';

  let verify = modal.querySelector('#verifyScreen');
  if (!verify) {
    verify = document.createElement('div');
    verify.id = 'verifyScreen';
    verify.innerHTML = `
      <div class="verify-screen">
        <span class="verify-icon">✉️</span>
        <h3 class="verify-title">Check your email</h3>
        <p class="verify-sub">We sent a 6-digit code to <strong id="verifyEmail"></strong></p>
        <div class="verify-inputs" id="verifyInputs">
          <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]" autocomplete="off" />
          <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]" autocomplete="off" />
          <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]" autocomplete="off" />
          <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]" autocomplete="off" />
          <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]" autocomplete="off" />
          <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]" autocomplete="off" />
        </div>
        <button class="btn-modal" id="verifyBtn" disabled>Verify</button>
        <p class="verify-resend">Didn't get it? <button type="button" class="verify-resend-btn" id="resendBtn">Resend code</button></p>
        <p class="verify-hint" id="verifyHint"></p>
      </div>
    `;
    modal.appendChild(verify);

    const inputs = verify.querySelectorAll('.verify-inputs input');
    inputs.forEach((inp, i) => {
      inp.addEventListener('input', () => {
        inp.value = inp.value.replace(/\D/g, '');
        if (inp.value && i < inputs.length - 1) inputs[i + 1].focus();
        document.getElementById('verifyBtn').disabled =
          [...inputs].some(x => !x.value);
      });
      inp.addEventListener('keydown', e => {
        if (e.key === 'Backspace' && !inp.value && i > 0) inputs[i - 1].focus();
      });
      inp.addEventListener('paste', e => {
        const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
        if (text.length >= 6) {
          e.preventDefault();
          inputs.forEach((x, j) => { x.value = text[j] || ''; });
          inputs[5].focus();
          document.getElementById('verifyBtn').disabled = false;
        }
      });
    });

    document.getElementById('verifyBtn').addEventListener('click', async () => {
      const code = [...inputs].map(x => x.value).join('');
      if (code.length < 6 || !pendingAuth) return;
      const btn = document.getElementById('verifyBtn');
      btn.textContent = 'Verifying…';
      btn.disabled = true;
      try {
        const res = await fetch('/api/verify-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${pendingAuth.token}`,
          },
          body: JSON.stringify({ code })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Verification failed');
        localStorage.setItem('cadence-token', pendingAuth.token);
        localStorage.setItem('cadence-user', JSON.stringify(data.user || pendingAuth.user));
        pendingAuth = null;
        window.location.href = 'dashboard.html';
      } catch (err) {
        btn.textContent = 'Verify';
        btn.disabled = false;
        const hint = document.getElementById('verifyHint');
        hint.textContent = err.message;
        hint.style.color = '#d85555';
        inputs.forEach(x => { x.value = ''; });
        inputs[0].focus();
        setTimeout(() => { hint.textContent = ''; hint.style.color = ''; }, 4000);
      }
    });

    document.getElementById('resendBtn').addEventListener('click', async () => {
      if (!pendingAuth) return;
      const hint = document.getElementById('verifyHint');
      try {
        const res = await fetch('/api/resend-code', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${pendingAuth.token}`,
          }
        });
        const rData = await res.json();
        if (!res.ok) throw new Error('Failed to resend');
        hint.style.color = '#B9F23C';
        if (rData.devCode) {
          pendingAuth.devCode = rData.devCode;
          hint.textContent = `New code: ${rData.devCode}`;
        } else {
          hint.textContent = 'New code sent — check your inbox.';
        }
      } catch {
        hint.style.color = '#d85555';
        hint.textContent = 'Couldn\'t resend. Try again.';
      }
      setTimeout(() => { hint.textContent = ''; hint.style.color = ''; }, 4000);
    });
  }

  document.getElementById('verifyEmail').textContent = emailAddr;
  verify.style.display = 'block';

  // Dev mode: show the code on screen so you don't need the console
  const hint = document.getElementById('verifyHint');
  if (pendingAuth?.devCode) {
    hint.textContent = `Dev code: ${pendingAuth.devCode}`;
    hint.style.color = '#B9F23C';
  }

  setTimeout(() => verify.querySelector('.verify-inputs input')?.focus(), 200);
}

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

