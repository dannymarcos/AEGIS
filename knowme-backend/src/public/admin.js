const tokenInput = document.getElementById('token');
const kpis = document.getElementById('kpis');
const usersTable = document.getElementById('users-table');
const moderationOutput = document.getElementById('moderation-output');

function authHeaders() {
  return { Authorization: `Bearer ${tokenInput.value.trim()}` };
}

async function loadAnalytics() {
  const [analyticsRes, revenueRes] = await Promise.all([
    fetch('/api/admin/analytics?days=30', { headers: authHeaders() }),
    fetch('/api/admin/revenue/tracking?days=30', { headers: authHeaders() }),
  ]);
  const analytics = await analyticsRes.json();
  const revenue = await revenueRes.json();

  const gross = Array.isArray(revenue.rows)
    ? revenue.rows.reduce((acc, row) => acc + Number(row.grossRevenueUsd || 0), 0)
    : 0;

  kpis.innerHTML = `
    <div class="kpi"><div class="label">Usuarios</div><div class="value">${analytics.users?.total ?? '-'}</div></div>
    <div class="kpi"><div class="label">Nuevos (30d)</div><div class="value">${analytics.users?.newInRange ?? '-'}</div></div>
    <div class="kpi"><div class="label">Open reports</div><div class="value">${analytics.moderation?.openReports ?? '-'}</div></div>
    <div class="kpi"><div class="label">Gross revenue</div><div class="value">$${gross.toFixed(2)}</div></div>
  `;
}

async function loadUsers() {
  const res = await fetch('/api/admin/users?take=100', { headers: authHeaders() });
  const users = await res.json();
  usersTable.innerHTML = '<tr><th>User</th><th>Email</th><th>Role</th><th>Status</th></tr>' + users.map((user) => (
    `<tr><td>${user.username}</td><td>${user.email}</td><td>${user.role}</td><td>${user.isSuspended ? 'SUSPENDED' : 'ACTIVE'}</td></tr>`
  )).join('');
}

async function moderateUser(suspend) {
  const userId = document.getElementById('suspend-user-id').value.trim();
  const reason = document.getElementById('suspend-reason').value.trim();
  if (!userId) return;

  const res = await fetch(`/api/admin/users/${userId}/suspend`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ suspend, reason }),
  });
  moderationOutput.textContent = JSON.stringify(await res.json(), null, 2);
}

document.getElementById('load').addEventListener('click', loadAnalytics);
document.getElementById('load-users').addEventListener('click', loadUsers);
document.getElementById('suspend').addEventListener('click', () => moderateUser(true));
document.getElementById('unsuspend').addEventListener('click', () => moderateUser(false));
