(function () {
  const form = document.getElementById('authForm');
  const nameInput = document.getElementById('name');
  const pwInput = document.getElementById('password');
  const confirmWrap = document.getElementById('confirmWrap');
  const confirmInput = document.getElementById('confirm');
  const submitBtn = document.getElementById('submitBtn');
  const submitLabel = document.getElementById('submitLabel');
  const submitLoader = document.getElementById('submitLoader');
  const formTitle = document.getElementById('formTitle');
  const formSubtitle = document.getElementById('formSubtitle');
  const switchPrompt = document.getElementById('switchPrompt');
  const switchModeLink = document.getElementById('switchModeLink');
  const modeBtns = document.querySelectorAll('.mode-btn');
  const segThumb = document.getElementById('segThumb');
  const togglePw = document.getElementById('togglePw');

  let mode = 'login'; // or 'signup'

  // Redirect straight to dashboard if already logged in
  if (localStorage.getItem('wp_token')) {
    window.location.replace('dashboard.html');
  }

  function setMode(next) {
    mode = next;
    modeBtns.forEach((b) => {
      const active = b.dataset.mode === mode;
      b.style.color = active ? 'var(--brand-deep)' : 'var(--ink-soft)';
    });
    segThumb.style.transform = mode === 'signup' ? 'translateX(100%)' : 'translateX(0)';

    if (mode === 'login') {
      formTitle.textContent = 'Welcome back';
      formSubtitle.textContent = "Log in to see today's dashboard.";
      confirmWrap.classList.add('hidden');
      submitLabel.textContent = 'Log in';
      switchPrompt.textContent = 'New to Wisepurse?';
      switchModeLink.textContent = 'Create an account';
      pwInput.setAttribute('autocomplete', 'current-password');
    } else {
      formTitle.textContent = 'Create your account';
      formSubtitle.textContent = 'Set a name and password to start tracking.';
      confirmWrap.classList.remove('hidden');
      submitLabel.textContent = 'Create account';
      switchPrompt.textContent = 'Already have an account?';
      switchModeLink.textContent = 'Log in';
      pwInput.setAttribute('autocomplete', 'new-password');
    }
    clearErrors();
  }

  modeBtns.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  switchModeLink.addEventListener('click', () => setMode(mode === 'login' ? 'signup' : 'login'));

  togglePw.addEventListener('click', () => {
    const showing = pwInput.type === 'text';
    pwInput.type = showing ? 'password' : 'text';
    togglePw.textContent = showing ? '👁️' : '🙈';
  });

  function clearErrors() {
    document.querySelectorAll('.field-error').forEach((el) => {
      el.textContent = '';
      el.classList.add('hidden');
    });
    [nameInput, pwInput, confirmInput].forEach((el) => (el.style.borderColor = 'var(--line)'));
  }

  function showFieldError(input, message) {
    input.style.borderColor = 'var(--expense)';
    const err = input.closest('div').querySelector('.field-error') || input.parentElement.parentElement.querySelector('.field-error');
    if (err) {
      err.textContent = message;
      err.classList.remove('hidden');
    }
  }

  function validate() {
    clearErrors();
    let valid = true;
    const name = nameInput.value.trim();
    const password = pwInput.value;

    if (!name) {
      showFieldError(nameInput, 'Please enter your name.');
      valid = false;
    }
    if (!password || password.length < 6) {
      showFieldError(pwInput, 'Password must be more than 5 characters.');
      valid = false;
    }
    if (mode === 'signup' && confirmInput.value !== password) {
      showFieldError(confirmInput, "Passwords don't match.");
      valid = false;
    }
    return valid;
  }

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitLabel.classList.toggle('hidden', loading);
    submitLoader.classList.toggle('hidden', !loading);
    submitLoader.classList.toggle('flex', loading);
  }

  // Ripple feedback on any .btn element
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const span = document.createElement('span');
    span.className = 'ripple';
    span.style.width = span.style.height = size + 'px';
    span.style.left = e.clientX - rect.left - size / 2 + 'px';
    span.style.top = e.clientY - rect.top - size / 2 + 'px';
    btn.appendChild(span);
    setTimeout(() => span.remove(), 650);
  });

  function openStatus({ success, title, message, actionLabel, onAction }) {
    const overlay = document.getElementById('statusOverlay');
    const ring = document.getElementById('avatarRing');
    const slot = document.getElementById('avatarSlot');
    const titleEl = document.getElementById('statusTitle');
    const msgEl = document.getElementById('statusMessage');
    const actionBtn = document.getElementById('statusAction');

    slot.innerHTML = maleAvatarSVG(success ? 'happy' : 'sad');
    ring.className = 'mx-auto w-24 h-24 rounded-full flex items-center justify-center avatar-pop ' + (success ? 'ring-success' : 'ring-error avatar-shake');
    titleEl.textContent = title;
    titleEl.style.color = success ? 'var(--income)' : 'var(--expense)';
    msgEl.textContent = message;
    actionBtn.textContent = actionLabel;

    overlay.classList.remove('hidden');
    overlay.classList.add('flex');

    const handler = () => {
      overlay.classList.add('hidden');
      overlay.classList.remove('flex');
      actionBtn.removeEventListener('click', handler);
      if (onAction) onAction();
    };
    actionBtn.addEventListener('click', handler);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) return;

    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('PASTE_YOUR')) {
      openStatus({
        success: false,
        title: 'Backend not connected yet',
        message: 'Add your deployed Google Apps Script URL to js/config.js first.',
        actionLabel: 'Got it',
      });
      return;
    }

    setLoading(true);
    try {
      // text/plain avoids a CORS preflight that Apps Script web apps can't answer;
      // the body is still parsed as JSON on the other end.
      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: mode,
          name: nameInput.value.trim(),
          password: pwInput.value,
        }),
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('wp_token', data.token);
        localStorage.setItem('wp_user', JSON.stringify(data.user));
        openStatus({
          success: true,
          title: mode === 'signup' ? 'Account created!' : 'Welcome back!',
          message: `Good to see you, ${data.user.name.split(' ')[0]}. Taking you to your dashboard…`,
          actionLabel: 'Go to dashboard',
          onAction: () => (window.location.href = 'dashboard.html'),
        });
        setTimeout(() => (window.location.href = 'dashboard.html'), 1600);
      } else {
        openStatus({
          success: false,
          title: mode === 'signup' ? "Couldn't create account" : 'Login failed',
          message: data.message || 'Something went wrong. Please try again.',
          actionLabel: 'Try again',
        });
      }
    } catch (err) {
      console.error(err);
      openStatus({
        success: false,
        title: 'Connection problem',
        message: "We couldn't reach the server. Check your connection and try again.",
        actionLabel: 'Try again',
      });
    } finally {
      setLoading(false);
    }
  });

  setMode('login');
})();
