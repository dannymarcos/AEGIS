const output = document.getElementById('output');

async function loadDashboard() {
  const token = document.getElementById('token').value.trim();
  if (!token) {
    output.textContent = 'Agrega un token JWT para cargar datos.';
    return;
  }

  const [configRes, dashboardRes] = await Promise.all([
    fetch('/api/monetization/config', { headers: { Authorization: `Bearer ${token}` } }),
    fetch('/api/monetization/dashboard/me?days=30', { headers: { Authorization: `Bearer ${token}` } }),
  ]);

  const config = await configRes.json();
  const dashboard = await dashboardRes.json();

  output.textContent = JSON.stringify({ config, dashboard }, null, 2);
}

document.getElementById('loadBtn').addEventListener('click', loadDashboard);
