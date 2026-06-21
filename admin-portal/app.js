// NG Whot — Admin Portal Controller
let currentAdminTab = 'overview';

// Mock Admin Data
let adminUsers = [
  { id: 'u1', name: 'ChukwuEmeka', tribe: 'Igbo', status: 'Active', wallet: 28400, kyc: 'Verified' },
  { id: 'u2', name: 'Adunola', tribe: 'Yoruba', status: 'Active', wallet: 18200, kyc: 'Verified' },
  { id: 'u3', name: 'Garba', tribe: 'Hausa', status: 'Active', wallet: 9800, kyc: 'Pending' },
  { id: 'u4', name: 'Effiong', tribe: 'Efik', status: 'Banned', wallet: 7600, kyc: 'Unverified' }
];

let adminWithdrawals = [
  { id: 'w1', name: 'Adunola', amount: 5000, bank: 'GTBank', status: 'Pending', date: '2026-06-12' },
  { id: 'w2', name: 'ChukwuEmeka', amount: 12000, bank: 'Access Bank', status: 'Approved', date: '2026-06-11' },
  { id: 'w3', name: 'Garba', amount: 3000, bank: 'OPay', status: 'Pending', date: '2026-06-12' }
];

let adminStats = {
  dau: 1420,
  activeGames: 34,
  totalStakes: 425000,
  revenue: 42500, // 10% platform wagers & withdrawal fee share
  feePercent: 1.5
};

function showAdminToast(msg) {
  const t = document.getElementById('adminToast');
  t.innerText = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}

function switchAdminTab(el, tabName) {
  const items = document.querySelectorAll('.sidebar-item');
  items.forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  
  currentAdminTab = tabName;
  renderAdminContent();
}

function renderAdminContent() {
  const container = document.getElementById('adminContent');
  container.innerHTML = '';

  switch(currentAdminTab) {
    case 'overview':
      container.appendChild(renderAdminOverview());
      break;
    case 'users':
      container.appendChild(renderAdminUsers());
      break;
    case 'competitions':
      container.appendChild(renderAdminCompetitions());
      break;
    case 'withdrawals':
      container.appendChild(renderAdminWithdrawals());
      break;
    case 'settings':
      container.appendChild(renderAdminSettings());
      break;
  }
}

function renderAdminOverview() {
  const div = document.createElement('div');
  div.innerHTML = `
    <h2>Platform Health Dashboard</h2>
    <p class="text-muted text-xs">Real-time statistics across all NG Whot games and stakes.</p>
    
    <div class="grid-4 mt-1" style="margin-top:1.5rem;">
      <div class="stat-card">
        <div class="stat-label">Daily Active Players (DAU)</div>
        <div class="stat-val">${adminStats.dau}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Active Matches Room</div>
        <div class="stat-val">${adminStats.activeGames}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Stakes Wagered</div>
        <div class="stat-val">₦${adminStats.totalStakes.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Accumulated Revenue</div>
        <div class="stat-val">₦${adminStats.revenue.toLocaleString()}</div>
      </div>
    </div>

    <div class="panel">
      <h3>Active Platform Actions</h3>
      <p class="text-muted text-xs">Quick review of issues requiring operator response:</p>
      <div style="margin-top:1rem; font-size:0.88rem; display:flex; flex-direction:column; gap:0.5rem;">
        <div>• <strong>2</strong> Pending withdrawals require approvals.</div>
        <div>• <strong>1</strong> Pending player identity (KYC) verification request.</div>
        <div>• Server status: <span style="color:var(--green); font-weight:700;">Healthy (99.9% uptime)</span></div>
      </div>
    </div>
  `;
  return div;
}

function renderAdminUsers() {
  const div = document.createElement('div');
  div.innerHTML = `
    <h2>User Administration</h2>
    <p class="text-muted text-xs">Manage player restrictions, ban abusive accounts, and verify KYC submissions.</p>

    <div class="panel">
      <h3>Registered Players</h3>
      <table>
        <thead>
          <tr>
            <th>Username</th>
            <th>Tribe</th>
            <th>Wallet Balance</th>
            <th>KYC Status</th>
            <th>Account Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${adminUsers.map(u => `
            <tr>
              <td><strong>${u.name}</strong></td>
              <td>${u.tribe}</td>
              <td>₦${u.wallet.toLocaleString()}</td>
              <td><span class="badge-status ${u.kyc === 'Verified' ? 'status-active' : 'status-pending'}">${u.kyc}</span></td>
              <td><span class="badge-status ${u.status === 'Active' ? 'status-active' : 'status-banned'}">${u.status}</span></td>
              <td>
                ${u.status === 'Active' ? `
                  <button class="btn-red" onclick="banUser('${u.id}')">Ban</button>
                ` : `
                  <button class="btn-green" onclick="unbanUser('${u.id}')">Unban</button>
                `}
                ${u.kyc === 'Pending' ? `
                  <button class="btn-primary" style="padding:4px 8px; font-size:0.75rem;" onclick="verifyUser('${u.id}')">Verify KYC</button>
                ` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  return div;
}

function banUser(userId) {
  const u = adminUsers.find(x => x.id === userId);
  if (u) {
    u.status = 'Banned';
    showAdminToast(`Banned user ${u.name}`);
    renderAdminContent();
  }
}

function unbanUser(userId) {
  const u = adminUsers.find(x => x.id === userId);
  if (u) {
    u.status = 'Active';
    showAdminToast(`Activated user ${u.name}`);
    renderAdminContent();
  }
}

function verifyUser(userId) {
  const u = adminUsers.find(x => x.id === userId);
  if (u) {
    u.kyc = 'Verified';
    showAdminToast(`Verified KYC details for ${u.name}`);
    renderAdminContent();
  }
}

function renderAdminCompetitions() {
  const div = document.createElement('div');
  div.innerHTML = `
    <h2>Launch New Competitions</h2>
    <p class="text-muted text-xs">Create official tournaments or tribe matches for all players on the platform.</p>

    <div class="grid-2 mt-1" style="margin-top:1.5rem;">
      <div class="panel">
        <h3>Create Public Tournament</h3>
        <form id="adminCompForm" onsubmit="event.preventDefault(); submitAdminComp();">
          <div class="form-group mt-1">
            <label>Tournament Title</label>
            <input type="text" id="adminCompTitle" value="Tribal Cup Championship" required>
          </div>
          <div class="form-group">
            <label>Prize Pool Allocation (₦)</label>
            <input type="number" id="adminCompPrize" value="25000" required>
          </div>
          <div class="form-group">
            <label>Tribe Restriction</label>
            <select id="adminCompTribe">
              <option value="none">Open to all tribes</option>
              <option value="Igbo">Igbo Tribe Only</option>
              <option value="Yoruba">Yoruba Tribe Only</option>
              <option value="Hausa">Hausa Tribe Only</option>
              <option value="Efik">Efik Tribe Only</option>
            </select>
          </div>
          <button type="submit" class="btn-primary" style="width:100%;">Deploy Tournament</button>
        </form>
      </div>

      <div class="panel">
        <h3>Deployment Logs</h3>
        <p class="text-muted text-xs">Records of matches launched by admin:</p>
        <div style="margin-top:1rem; font-size:0.8rem; line-height:1.6;" id="adminDeployLogs">
          <div>• <strong>NG Whot Open</strong> deployed successfully.</div>
          <div>• <strong>Yoruba weekly cup</strong> deployed successfully.</div>
        </div>
      </div>
    </div>
  `;
  return div;
}

function submitAdminComp() {
  const title = document.getElementById('adminCompTitle').value;
  const prize = document.getElementById('adminCompPrize').value;
  const logs = document.getElementById('adminDeployLogs');

  const logRow = document.createElement('div');
  logRow.innerHTML = `• <strong>${title}</strong> (Prize: ₦${parseInt(prize).toLocaleString()}) deployed successfully.`;
  logs.prepend(logRow);

  showAdminToast(`Successfully launched tournament: ${title}`);
  document.getElementById('adminCompTitle').value = '';
}

function renderAdminWithdrawals() {
  const div = document.createElement('div');
  div.innerHTML = `
    <h2>Financial Controls & Withdrawal Approvals</h2>
    <p class="text-muted text-xs">Review pending wire cashouts from player wallets. Admin verifies legitimacy before releasing funds.</p>

    <div class="panel">
      <h3>Cash Withdrawal Logs</h3>
      <table>
        <thead>
          <tr>
            <th>User</th>
            <th>Amount Requested</th>
            <th>Destination Bank</th>
            <th>Date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${adminWithdrawals.map(w => `
            <tr>
              <td><strong>${w.name}</strong></td>
              <td>₦${w.amount.toLocaleString()}</td>
              <td>${w.bank}</td>
              <td>${w.date}</td>
              <td><span class="badge-status ${w.status === 'Approved' ? 'status-active' : 'status-pending'}">${w.status}</span></td>
              <td>
                ${w.status === 'Pending' ? `
                  <button class="btn-green" onclick="approveWithdrawal('${w.id}')">Approve Payment</button>
                  <button class="btn-red" onclick="rejectWithdrawal('${w.id}')">Reject</button>
                ` : '<span class="text-muted">Completed</span>'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  return div;
}

function approveWithdrawal(wId) {
  const w = adminWithdrawals.find(x => x.id === wId);
  if (w) {
    w.status = 'Approved';
    showAdminToast(`Payout of ₦${w.amount} approved for ${w.name}`);
    renderAdminContent();
  }
}

function rejectWithdrawal(wId) {
  const w = adminWithdrawals.find(x => x.id === wId);
  if (w) {
    w.status = 'Rejected';
    showAdminToast(`Payout of ₦${w.amount} rejected`);
    renderAdminContent();
  }
}

function renderAdminSettings() {
  const div = document.createElement('div');
  div.innerHTML = `
    <h2>Platform Fee Config</h2>
    <p class="text-muted text-xs">Manage system-wide percentages, withdrawal commissions, and matchmaking policies.</p>

    <div class="panel" style="max-width:480px;">
      <div class="form-group mt-1">
        <label>Withdrawal Commission Fee (%)</label>
        <input type="number" id="settingFee" value="${adminStats.feePercent}" step="0.1" min="0">
      </div>
      <div class="form-group">
        <label>Platform Commission on Wagers (%)</label>
        <input type="number" value="10" step="1" min="0">
      </div>
      <button class="btn-primary" onclick="saveAdminSettings()">Save Configurations</button>
    </div>
  `;
  return div;
}

function saveAdminSettings() {
  const fee = parseFloat(document.getElementById('settingFee').value) || 0;
  adminStats.feePercent = fee;
  showAdminToast(`Platform settings updated! Withdrawal fee set to ${fee}%`);
  renderAdminContent();
}

window.onload = () => {
  renderAdminContent();
};
