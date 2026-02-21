const canvas = document.getElementById('matrix-rain');
const ctx = canvas.getContext('2d');
const chars = '01ABCDEFGHIJKLMNOPQRSTUVWXYZ#$%&*+-<>/';
let columns = [];

function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const count = Math.floor(canvas.width / 18);
  columns = Array.from({ length: count }, () => Math.random() * canvas.height);
}

function drawMatrixRain() {
  ctx.fillStyle = 'rgba(10, 14, 18, 0.07)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#7fffd4';
  ctx.font = '16px monospace';

  columns = columns.map((y, i) => {
    const text = chars[Math.floor(Math.random() * chars.length)];
    const x = i * 18;
    ctx.fillText(text, x, y);
    if (y > canvas.height + Math.random() * 2000) return 0;
    return y + 18;
  });

  requestAnimationFrame(drawMatrixRain);
}

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showLogin = document.getElementById('show-login');
const showRegister = document.getElementById('show-register');
const feedback = document.getElementById('auth-feedback');

function setMode(mode) {
  const login = mode === 'login';
  loginForm.classList.toggle('hidden', !login);
  registerForm.classList.toggle('hidden', login);
  showLogin.classList.toggle('active', login);
  showRegister.classList.toggle('active', !login);
  feedback.textContent = '';
}

function saveAuth(data) {
  localStorage.setItem('knowme_token', data.token);
  localStorage.setItem('knowme_user', JSON.stringify(data.user));
}

async function handleAuth(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Error de autenticación');
  saveAuth(data);
  const nextPath = data.user.role === 'ADMIN' ? '/admin' : '/chat';
  window.location.href = nextPath;
}

showLogin.onclick = () => setMode('login');
showRegister.onclick = () => setMode('register');

loginForm.onsubmit = async (event) => {
  event.preventDefault();
  feedback.textContent = 'Verificando...';
  try {
    await handleAuth('/api/auth/login', {
      email: document.getElementById('login-email').value,
      password: document.getElementById('login-password').value,
    });
  } catch (error) {
    feedback.textContent = error.message;
  }
};

registerForm.onsubmit = async (event) => {
  event.preventDefault();
  feedback.textContent = 'Creando cuenta...';
  try {
    await handleAuth('/api/auth/register', {
      username: document.getElementById('register-username').value,
      email: document.getElementById('register-email').value,
      password: document.getElementById('register-password').value,
    });
  } catch (error) {
    feedback.textContent = error.message;
  }
};

fitCanvas();
window.addEventListener('resize', fitCanvas);
drawMatrixRain();
