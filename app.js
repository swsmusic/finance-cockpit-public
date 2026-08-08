const $ = (id) => document.getElementById(id);
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const money2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const num = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

function fmtMoney(value, cents = false) {
  const n = Number(value || 0);
  return (cents ? money2 : money).format(n);
}
function fmtDays(value) {
  return value === null || value === undefined || Number.isNaN(Number(value)) ? '—' : `${num.format(value)}d`;
}
function ageText(seconds) {
  if (seconds === null || seconds === undefined) return 'No local reports found';
  if (seconds < 90) return `${seconds}s old`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes}m old`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h old`;
  return `${Math.round(hours / 24)}d old`;
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function row(title, meta, value, cls = '') {
  return `<div class="list-row ${cls}"><div><b>${escapeHtml(title)}</b><span>${escapeHtml(meta || '')}</span></div><strong>${escapeHtml(value || '')}</strong></div>`;
}
function monthDay(date) {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date || '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function renderFlow(days) {
  const chart = $('flowChart');
  const clean = (days || []).filter(d => d.date).slice(-14);
  if (!clean.length) {
    chart.innerHTML = '<div class="empty">No daily flow yet. Refresh after the next finance pull.</div>';
    return;
  }
  const max = Math.max(1, ...clean.flatMap(d => [Math.abs(d.income || 0), Math.abs(d.outflow || 0)]));
  chart.innerHTML = clean.map(d => {
    const incomeH = Math.max(3, Math.round((Math.abs(d.income || 0) / max) * 100));
    const outflowH = Math.max(3, Math.round((Math.abs(d.outflow || 0) / max) * 100));
    const net = Number(d.net || 0);
    return `<div class="day" title="${escapeHtml(monthDay(d.date))}: income ${fmtMoney(d.income, true)}, outflow ${fmtMoney(d.outflow, true)}, net ${fmtMoney(net, true)}">
      <div class="bars"><div class="bar income" style="height:${incomeH}%"></div><div class="bar outflow" style="height:${outflowH}%"></div></div>
      <div class="net-line" style="background:${net < 0 ? 'var(--red)' : 'var(--yellow)'}"></div>
      <label>${escapeHtml(monthDay(d.date).replace(' ', '\u00a0'))}</label>
    </div>`;
  }).join('');
}

function renderTables(data) {
  $('accountsBody').innerHTML = (data.topAccounts || []).map(a => `
    <tr>
      <td><b>${escapeHtml(a.name)}</b><span class="subtle">${escapeHtml(a.institution || '')}${a.last4 ? ` · ${escapeHtml(a.last4)}` : ''}</span></td>
      <td><span class="pill">${escapeHtml(a.lane || '—')}</span></td>
      <td><span class="pill">${escapeHtml(a.pool || '—')}</span>${a.review ? '<span class="subtle severity">review</span>' : ''}</td>
      <td class="money ${Number(a.balance) < 0 ? 'amount-neg' : 'amount-pos'}">${fmtMoney(a.balance, true)}</td>
    </tr>`).join('') || '<tr><td colspan="4">No account rows available.</td></tr>';

  $('txBody').innerHTML = (data.transactions || []).map(t => `
    <tr>
      <td>${escapeHtml(t.date || '—')}</td>
      <td><b>${escapeHtml(t.description || 'Transaction')}</b><span class="subtle">${escapeHtml(t.account || '')}</span></td>
      <td><span class="pill">${escapeHtml(t.lane || t.pool || '—')}</span></td>
      <td class="money ${Number(t.amount) < 0 ? 'amount-neg' : 'amount-pos'}">${fmtMoney(t.amount, true)}</td>
    </tr>`).join('') || '<tr><td colspan="4">No transaction rows available.</td></tr>';
}

function render(data) {
  const c = data.cards || {};
  const runway = Number(c.adjustedRunwayDays || 0);
  const isRed = runway && runway <= 14;
  const isYellow = runway && runway <= 30;
  // Header status must key off adjusted runway, not any posted-runway status carried in data.json.
  $('statusText').textContent = isRed ? 'RED — adjusted runway' : isYellow ? 'YELLOW — adjusted runway' : 'OK — adjusted runway';
  $('statusDot').style.background = isRed ? 'var(--red)' : isYellow ? 'var(--yellow)' : 'var(--green)';
  $('statusDot').style.boxShadow = `0 0 30px ${isRed ? 'var(--red)' : isYellow ? 'var(--yellow)' : 'var(--green)'}`;
  $('freshness').textContent = `${ageText(data.freshness?.secondsOld)} · ${data.dataUpdatedAt ? new Date(data.dataUpdatedAt).toLocaleString() : 'local files'}`;

  $('runwayDays').textContent = fmtDays(c.adjustedRunwayDays);
  $('nmsCash').textContent = fmtMoney(c.nmsCash, true);
  $('homeCash').textContent = fmtMoney(c.homeCash, true);
  $('dailyGap').textContent = fmtMoney(c.dailyGap, true);
  $('dailyGap').closest('.metric-card').classList.toggle('negative', Number(c.dailyGap) < 0);
  $('burnBasis').textContent = `${fmtMoney(c.burnBasis, true)} / day`;
  $('avgIncome').textContent = `${fmtMoney(c.avgIncome, true)} / day`;
  $('postedOutflow').textContent = `${fmtMoney(c.postedOutflow, true)} / day`;
  $('committedBurn').textContent = `${fmtMoney(c.committedBurn, true)} / day`;
  $('postedRunway').textContent = fmtDays(c.postedRunwayDays);
  $('realRunway').textContent = fmtDays(c.adjustedRunwayDays);

  $('readHeadline').textContent = isRed ? 'Cash is close. Decide now.' : isYellow ? 'A short runway, but manageable.' : 'Runway is breathing.';
  $('readCopy').textContent = isRed
    ? 'Adjusted runway is inside the two-week danger zone after committed burn. Treat collections, expense pauses, and owner-pay timing as today decisions.'
    : isYellow
      ? 'The headline bank balance looks better than the committed-burn view. Keep the dashboard focused on real cash velocity, not posted-only comfort.'
      : 'Current operating cash covers the near-term burn. Keep refreshing before major spend decisions.';

  renderFlow(data.dailyFlow);
  renderTables(data);

  $('commitments').innerHTML = (data.commitments || []).map(x => row(x.label, `${x.lane || 'lane'} · ${x.treatment || 'planning'}`, `${fmtMoney(x.daily, true)}/d`)).join('') || row('No active commitments', 'config/finance-committed-burn.json', '—');

  const alerts = [];
  if (runway && runway <= 14) alerts.push(row('Runway danger zone', 'Adjusted runway after committed burn is below 14 days', fmtDays(runway), 'severity red'));
  else if (runway && runway <= 30) alerts.push(row('Runway watch zone', 'Adjusted runway after committed burn is below 30 days', fmtDays(runway), 'severity'));
  if ((data.reviewAccounts || []).length) alerts.push(row('Account mapping review', `${data.reviewAccounts.length} account(s) need classification`, 'Review', 'severity'));
  if (data.freshness?.secondsOld > 60 * 60 * 8) alerts.push(row('Data is getting stale', 'Refresh SimpleFIN/local reports before decisions', ageText(data.freshness.secondsOld), 'severity'));
  $('alerts').innerHTML = alerts.join('') || row('No urgent alerts', 'Local finance files are fresh enough for a quick read', 'Clear');

  $('excluded').innerHTML = (data.bdtAccounts || []).map(a => row(a.name, `${a.institution || 'Institution'}${a.last4 ? ` · ${a.last4}` : ''}`, fmtMoney(a.balance, true))).join('') || row('No excluded BDT accounts', 'Nothing matched the excluded cash mapping', '—');
}

async function loadFinance() {
  const res = await fetch('./data.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Finance API returned ${res.status}`);
  render(await res.json());
}
async function refreshFinance() {
  const btn = $('refreshBtn');
  btn.disabled = true;
  btn.textContent = 'Reloading…';
  try {
    await loadFinance();
    btn.textContent = 'Snapshot reloaded ✓';
    setTimeout(() => { btn.textContent = 'Reload snapshot'; }, 1600);
  } catch (err) {
    console.error(err);
    btn.textContent = 'Reload failed';
    $('alerts').insertAdjacentHTML('afterbegin', row('Reload failed', err.message || String(err), 'Check GitHub Pages', 'severity red'));
    setTimeout(() => { btn.textContent = 'Reload snapshot'; }, 2600);
  } finally {
    btn.disabled = false;
  }
}

$('refreshBtn').addEventListener('click', refreshFinance);
loadFinance().catch(err => {
  console.error(err);
  $('statusText').textContent = 'Dashboard error';
  $('freshness').textContent = err.message || String(err);
  $('statusDot').style.background = 'var(--red)';
});
setInterval(loadFinance, 5 * 60 * 1000);
