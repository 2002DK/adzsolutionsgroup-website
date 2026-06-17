// ============================================================
//  ADZ Solutions — NJ SBE Bid Tracker
//  tracker.js — All shared logic, no credentials stored here
//  Connects to Google Apps Script for data persistence
// ============================================================

// ── REPLACE THIS with your deployed Apps Script Web App URL ──
const APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL_HERE';

// ── STATE ──
let bids = [];
let scrapedBids = [];
let editingId = null;
let isSaving = false;

// ── COUNTY DATA ──
const counties = [
  { name:'Atlantic',   portal:'https://www.atlanticcountynj.gov/government/county-departments/department-of-administrative-services/division-of-budget-and-purchasing/open-bids', label:'County Purchasing Portal', note:'Also check acianj.org — CDBG Consulting RFP active' },
  { name:'Bergen',     portal:'https://bergenbids.com/', label:'Bergen Bids Portal', note:'IT & consulting regular procurement; BC-RFP-26-004 Environmental/Consulting Services' },
  { name:'Burlington', portal:'https://bcnj.co.burlington.nj.us/Pages/PT/Bids', label:'County Purchasing Portal', note:'Healthcare RFPs open — RFP-26-0017 Medication-Assisted Treatment' },
  { name:'Camden',     portal:'https://procurements.camdencounty.com/', label:'Camden Procurement Portal', note:'Marketing & consulting history via CCMUA; check regularly' },
  { name:'Cape May',   portal:'https://capemayprocure.org/', label:'County Purchasing Portal', note:'Register to download bid packages and view current opportunities' },
  { name:'Cumberland', portal:'https://www.cumberlandprocure.org/', label:'Cumberland Procure Portal', note:'Call (856) 453-2132 for bid details and submission procedures' },
  { name:'Essex',      portal:'https://www.essexcountynjprocure.org/bids/search?rfp_filter_status=current', label:'Essex Purchasing Portal', note:'Free registration required to download full RFP documents' },
  { name:'Gloucester', portal:'https://www.gloucestercountynj.gov/Bids.aspx', label:'County Bid Postings', note:'Crisis counselor & opioid recovery consulting RFPs recently posted' },
  { name:'Hudson',     portal:'http://www.hcnj.us/blog/category/purchasing/', label:'Hudson County Purchasing', note:'MIS & Telecom Admin RFP open — proposals due July 10, 2026' },
  { name:'Hunterdon',  portal:'https://www.co.hunterdon.nj.us/1399/Current-Requests-For-Proposals', label:'County RFP Listing', note:'Corporate Health Services (RFP-0067) and Risk Management bids active' },
  { name:'Mercer',     portal:'https://www.bidnetdirect.com/new-jersey/mercercounty', label:'BidNet Direct — Mercer', note:'Vision/healthcare and consulting solicitations open via BidNet' },
  { name:'Middlesex',  portal:'https://www.middlesexcountynj.gov/government/departments/department-of-economic-development/middlesex-county-improvement-authority/bidding-opportunities/new-procurement-portal', label:'OpenGov Procurement Portal', note:'IT consulting procured regularly; new portal via OpenGov' },
  { name:'Monmouth',   portal:'https://www.bidnetdirect.com/new-jersey', label:'BidNet NJ Purchasing Group', note:'Filter by Monmouth County on BidNet Direct NJ portal' },
  { name:'Morris',     portal:'https://www.bidnetdirect.com/new-jersey/morris-county', label:'BidNet Direct — Morris', note:'Active on NJ Purchasing Group; Morris View Healthcare Center bids frequent' },
  { name:'Ocean',      portal:'https://www.bidnetdirect.com/new-jersey', label:'BidNet NJ Purchasing Group', note:'Filter by Ocean County on BidNet Direct NJ portal' },
  { name:'Passaic',    portal:'https://www.passaicbids.com/', label:'Passaic County Purchasing', note:'Multiple healthcare RFQs open for Preakness Healthcare Center' },
  { name:'Salem',      portal:'https://www.salemcountynj.gov/category/bid-opportunities/', label:'Salem Bid Opportunities', note:'Smaller county; periodic consulting needs — check regularly' },
  { name:'Somerset',   portal:'https://www.somersetcountynj.gov/government/finance-and-administrative-services/purchasing/list-rfp', label:'Somerset RFP Listing', note:'Separate bid and RFP lists — check both tabs on the purchasing page' },
  { name:'Sussex',     portal:'https://www.sussex.nj.us/cn/bids/', label:'Sussex County Bids', note:'Submit online request form or email CASylvester@sussex.nj.us' },
  { name:'Union',      portal:'https://ucnj.org/vendor-opportunities/rfqs-and-rfps/current/', label:'Union Vendor Opportunities', note:'Auditing & Consulting Services 2026 RFP open; IT support services history' },
  { name:'Warren',     portal:'https://www.warrencountynj.gov/government/bids-and-purchases', label:'Warren Bids & Purchases', note:'Follows NJ Local Public Contracts Law — check for professional services' },
];

// ── INIT ──
function initApp() {
  populateCountyFilter();
  loadBids();
  loadScrapedBids();
}

// ── API HELPERS ──
function getCredential() {
  const user = JSON.parse(sessionStorage.getItem('adz_user') || '{}');
  return user.credential || '';
}

async function apiCall(action, payload = {}) {
  const body = { action, credential: getCredential(), ...payload };
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
    redirect: 'follow'
  });
  if (!res.ok) throw new Error('Network error: ' + res.status);
  let data;
  try { data = await res.json(); } catch { throw new Error('Invalid response from server.'); }
  if (data.error) {
    if (data.error.includes('expired') || data.error.includes('Invalid token')) {
      sessionStorage.removeItem('adz_user');
      window.location.href = '/tracker/login.html';
    }
    throw new Error(data.error);
  }
  return data;
}

// ── LOAD BIDS ──
async function loadBids() {
  try {
    showTableLoading(true);
    const data = await apiCall('getBids');
    bids = data.bids || [];
    renderStats();
    renderTable();
    renderNotifications();
  } catch (e) {
    showToast('Could not load bids. Check your connection.', 'error');
    showTableError(e.message);
    console.error(e);
  } finally {
    showTableLoading(false);
  }
}

// ── LOAD SCRAPED BIDS ──
async function loadScrapedBids() {
  try {
    const data = await apiCall('getScrapedBids');
    scrapedBids = data.bids || [];
    renderDirectory();
  } catch (e) {
    console.error('Could not load scraped bids:', e);
    scrapedBids = [];
    renderDirectory();
  }
}

function showTableLoading(on) {
  const tbody = document.getElementById('bidTableBody');
  const empty = document.getElementById('emptyState');
  if (on) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2.5rem;color:var(--muted);font-size:0.85rem;">Loading bids...</td></tr>`;
    empty.style.display = 'none';
  }
}

function showTableError(msg) {
  document.getElementById('bidTableBody').innerHTML = `
    <tr><td colspan="8" style="text-align:center;padding:3rem;">
      <div style="color:var(--red);font-size:0.85rem;margin-bottom:0.75rem;">⚠️ ${msg}</div>
      <button class="btn btn-ghost btn-sm" onclick="loadBids()">Try Again</button>
    </td></tr>`;
}

// ── TABS ──
function switchTab(id, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  el.classList.add('active');
}

// ── STATS ──
function renderStats() {
  const total = bids.length;
  const active = bids.filter(b => ['new','reviewing','submitted'].includes(b.status)).length;
  const won = bids.filter(b => b.status === 'won').length;
  const soon = bids.filter(b => {
    if (!b.deadline) return false;
    const d = (new Date(b.deadline) - new Date()) / 86400000;
    return d >= 0 && d <= 14;
  }).length;
  const val = bids.reduce((s, b) => {
    const v = parseFloat((b.value || '').replace(/[^0-9.]/g,''));
    return s + (isNaN(v) ? 0 : v);
  }, 0);
  const fmtVal = val >= 1000000 ? '$'+(val/1000000).toFixed(1)+'M' : val >= 1000 ? '$'+Math.round(val/1000)+'K' : val > 0 ? '$'+val : '—';

  document.getElementById('statsRow').innerHTML = `
    <div class="stat-card"><div class="stat-label">Total Bids</div><div class="stat-value">${total}</div><div class="stat-sub">tracked opportunities</div></div>
    <div class="stat-card"><div class="stat-label">Active</div><div class="stat-value">${active}</div><div class="stat-sub">in progress</div></div>
    <div class="stat-card amber"><div class="stat-label">Due Soon</div><div class="stat-value">${soon}</div><div class="stat-sub">within 14 days</div></div>
    <div class="stat-card green"><div class="stat-label">Won</div><div class="stat-value">${won}</div><div class="stat-sub">contracts awarded</div></div>
    <div class="stat-card purple"><div class="stat-label">Pipeline Value</div><div class="stat-value">${fmtVal}</div><div class="stat-sub">estimated total</div></div>
  `;
}

// ── TABLE ──
function dlClass(dl) {
  if (!dl) return '';
  const d = (new Date(dl) - new Date()) / 86400000;
  if (d < 0) return 'deadline-past';
  if (d <= 14) return 'deadline-soon';
  return '';
}
function fmtDate(dl) {
  if (!dl) return '—';
  return new Date(dl + 'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}
function statusBadge(s) {
  const map = {new:'New',reviewing:'Reviewing',submitted:'Submitted',won:'Won',lost:'Lost',passed:'Passed'};
  return `<span class="badge badge-${s}">${map[s]||s}</span>`;
}

function renderTable() {
  const q  = document.getElementById('searchInput').value.toLowerCase();
  const co = document.getElementById('filterCounty').value;
  const st = document.getElementById('filterStatus').value;
  const ca = document.getElementById('filterCat').value;

  const filtered = bids.filter(b => {
    if (co && b.county !== co) return false;
    if (st && b.status !== st) return false;
    if (ca && b.category !== ca) return false;
    if (q && !`${b.title} ${b.county} ${b.contact} ${b.assigned} ${b.bidNum}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const tbody = document.getElementById('bidTableBody');
  const empty = document.getElementById('emptyState');

  if (!filtered.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  tbody.innerHTML = filtered.map(b => `
    <tr>
      <td class="td-title">
        ${b.link ? `<a href="${b.link}" target="_blank">${b.title}</a>` : b.title}
        ${b.bidNum ? `<div class="td-meta">${b.bidNum}</div>` : ''}
      </td>
      <td class="td-muted">${b.county||'—'}</td>
      <td>${b.category ? `<span class="cat-chip">${b.category}</span>` : '—'}</td>
      <td><span class="${dlClass(b.deadline)}">${fmtDate(b.deadline)}</span></td>
      <td style="font-weight:500;font-size:0.85rem;">${b.value ? '$'+b.value : '—'}</td>
      <td class="td-muted">${b.assigned||'—'}</td>
      <td>${statusBadge(b.status)}</td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-ghost btn-sm" onclick="openModal('${b.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteBid('${b.id}')">✕</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ── COUNTY FILTER ──
function populateCountyFilter() {
  const sel = document.getElementById('filterCounty');
  counties.forEach(c => {
    const o = document.createElement('option');
    o.value = c.name; o.textContent = c.name;
    sel.appendChild(o);
  });
}

// ── DIRECTORY — scraped bids per county ──
function renderDirectory() {
  const activeBidCounties = new Set(
    bids
      .filter(b => ['new','reviewing','submitted'].includes(b.status))
      .map(b => b.county)
  );

  // Track which scraped bids are already in the tracker by link/title match
  const trackerTitles = new Set(bids.map(b => b.title.toLowerCase().trim()));

  document.getElementById('countyGrid').innerHTML = counties.map(c => {
    const hasActiveBid   = activeBidCounties.has(c.name);
    const countyScraped  = scrapedBids.filter(b => b.county === c.name);

    let bidsHtml = '';
    if (countyScraped.length === 0) {
      bidsHtml = `<div class="county-no-bids">No bids detected yet — scraper runs daily at 8am</div>`;
    } else {
      bidsHtml = countyScraped.map(b => {
        const alreadyAdded = trackerTitles.has(b.title.toLowerCase().trim()) || b.addedToTracker === 'yes';
        let deadlineClass  = '';
        let deadlineText   = '';
        if (b.deadline) {
          const days    = (new Date(b.deadline) - new Date()) / 86400000;
          deadlineText  = fmtDate(b.deadline);
          deadlineClass = days < 0 ? 'past' : days <= 14 ? 'soon' : '';
        }

        return `
          <div class="county-bid-item">
            <div class="county-bid-info">
              <div class="county-bid-title">
                ${b.link
                  ? `<a href="${b.link}" target="_blank" style="color:var(--accent);text-decoration:none;">${b.title}</a>`
                  : b.title}
              </div>
              <div class="county-bid-row2">
                ${b.category ? `<span class="county-bid-cat">${b.category}</span>` : ''}
                ${deadlineText ? `<span class="county-bid-deadline ${deadlineClass}">Due ${deadlineText}</span>` : ''}
              </div>
            </div>
            <div class="county-bid-action">
              ${alreadyAdded
                ? `<span class="county-bid-added">✓ Added</span>`
                : `<button class="county-bid-add-btn" onclick="addScrapedToTracker('${b.key}', this)">+ Track</button>`}
            </div>
          </div>`;
      }).join('');
    }

    return `
      <div class="county-card">
        <div class="county-name">
          ${c.name} County
          ${hasActiveBid ? '<span class="active-badge">● Active Bid</span>' : ''}
        </div>
        <a class="county-link" href="${c.portal}" target="_blank">🔗 ${c.label}</a>
        <div class="county-note">${c.note}</div>
        <div class="county-bids">
          <div class="county-bids-label">
            Bid Monitor
            ${countyScraped.length > 0 ? `<span>${countyScraped.length}</span>` : ''}
          </div>
          <div class="county-bids-list">${bidsHtml}</div>
        </div>
      </div>`;
  }).join('');
}

// ── ADD SCRAPED BID TO TRACKER ────────────────────────────────
async function addScrapedToTracker(bidKey, btnEl) {
  btnEl.textContent = 'Adding...';
  btnEl.disabled = true;
  try {
    await apiCall('addScrapedToTracker', { bidKey });
    // Refresh both datasets
    const [bidsData, scrapedData] = await Promise.all([
      apiCall('getBids'),
      apiCall('getScrapedBids'),
    ]);
    bids        = bidsData.bids        || [];
    scrapedBids = scrapedData.bids     || [];
    renderStats();
    renderTable();
    renderNotifications();
    renderDirectory();
    showToast('Bid added to tracker.', 'success');
  } catch (e) {
    btnEl.textContent = '+ Track';
    btnEl.disabled = false;
    showToast('Failed to add bid: ' + e.message, 'error');
  }
}

// ── MODAL ──
function openModal(id = null) {
  editingId = id;
  const b = id ? bids.find(x => x.id === id) : null;
  document.getElementById('modalTitle').textContent = id ? 'Edit Bid' : 'Add New Bid';
  document.getElementById('fTitle').value    = b?.title    || '';
  document.getElementById('fCounty').value   = b?.county   || '';
  document.getElementById('fCategory').value = b?.category || '';
  document.getElementById('fBidNum').value   = b?.bidNum   || '';
  document.getElementById('fDeadline').value = b?.deadline || '';
  document.getElementById('fValue').value    = b?.value    || '';
  document.getElementById('fStatus').value   = b?.status   || 'new';
  document.getElementById('fAssigned').value = b?.assigned || '';
  document.getElementById('fContact').value  = b?.contact  || '';
  document.getElementById('fLink').value     = b?.link     || '';
  document.getElementById('fNotes').value    = b?.notes    || '';
  document.getElementById('modalOverlay').classList.add('open');
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  editingId = null;
}
function handleOverlayClick(e) {
  if (e.target.id === 'modalOverlay') closeModal();
}

async function saveBid() {
  if (isSaving) return;
  const title  = document.getElementById('fTitle').value.trim();
  const county = document.getElementById('fCounty').value;
  if (!title || !county) { showToast('Please fill in Bid Title and County.', 'error'); return; }

  const bid = {
    id:       editingId || (Date.now().toString(36) + Math.random().toString(36).slice(2)),
    title, county,
    category: document.getElementById('fCategory').value,
    bidNum:   document.getElementById('fBidNum').value.trim(),
    deadline: document.getElementById('fDeadline').value,
    value:    document.getElementById('fValue').value.trim(),
    status:   document.getElementById('fStatus').value,
    assigned: document.getElementById('fAssigned').value.trim(),
    contact:  document.getElementById('fContact').value.trim(),
    link:     document.getElementById('fLink').value.trim(),
    notes:    document.getElementById('fNotes').value.trim(),
  };

  isSaving = true;
  const saveBtn = document.getElementById('saveBtn');
  saveBtn.textContent = 'Saving...';
  saveBtn.disabled = true;

  try {
    await apiCall(editingId ? 'updateBid' : 'addBid', { bid });
    if (editingId) {
      bids[bids.findIndex(b => b.id === editingId)] = bid;
    } else {
      bids.unshift(bid);
    }
    renderStats();
    renderTable();
    renderNotifications();
    closeModal();
    showToast(editingId ? 'Bid updated.' : 'Bid added.', 'success');
  } catch (e) {
    showToast('Save failed. Please try again.', 'error');
  } finally {
    isSaving = false;
    saveBtn.textContent = 'Save Bid';
    saveBtn.disabled = false;
  }
}

async function deleteBid(id) {
  if (!confirm('Remove this bid from the tracker?')) return;
  try {
    await apiCall('deleteBid', { id });
    bids = bids.filter(b => b.id !== id);
    renderStats();
    renderTable();
    renderNotifications();
    showToast('Bid removed.', 'success');
  } catch (e) {
    showToast('Delete failed. Please try again.', 'error');
  }
}

// ── EXPORT CSV ──
function exportCSV() {
  if (!bids.length) { showToast('No bids to export.', 'error'); return; }
  const headers = ['Title','County','Category','Bid Number','Deadline','Est. Value','Status','Assigned To','Contact','Portal Link','Notes'];
  const rows = bids.map(b =>
    [b.title,b.county,b.category,b.bidNum,b.deadline,b.value,b.status,b.assigned,b.contact,b.link,b.notes]
    .map(v => `"${(v||'').replace(/"/g,'""')}"`)
  );
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = `adz-sbe-bids-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  showToast('CSV exported.', 'success');
}

// ── NOTIFICATIONS ──
const NOTIF_KEY = 'adz_notif_cleared_at';

function getNewBids() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const clearedAt   = localStorage.getItem(NOTIF_KEY);
  const clearedDate = clearedAt ? new Date(clearedAt) : null;
  return bids.filter(b => {
    if (!b.createdAt) return false;
    const created = new Date(b.createdAt);
    if (created < sevenDaysAgo) return false;
    if (clearedDate && created <= clearedDate) return false;
    return true;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function renderNotifications() {
  const newBids = getNewBids();
  const badge   = document.getElementById('notifBadge');
  const list    = document.getElementById('notifList');
  const footer  = document.getElementById('notifFooter');

  if (newBids.length > 0) {
    badge.textContent = newBids.length > 9 ? '9+' : newBids.length;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }

  if (newBids.length === 0) {
    list.innerHTML = `
      <div class="notif-empty">
        <div class="notif-empty-icon">✅</div>
        <div>No new bids in the last 7 days</div>
      </div>`;
    footer.textContent = '';
    return;
  }

  list.innerHTML = newBids.map(b => {
    const created  = new Date(b.createdAt);
    const daysAgo  = Math.floor((new Date() - created) / 86400000);
    const timeText = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : daysAgo + ' days ago';
    return `
      <div class="notif-item" onclick="highlightBid('${b.id}')">
        <div class="notif-item-title">${b.title}</div>
        <div class="notif-item-meta">
          <span class="notif-item-county">${b.county || '—'}</span>
          <span>${timeText}</span>
          ${b.category ? `<span>${b.category}</span>` : ''}
        </div>
      </div>`;
  }).join('');

  footer.textContent = `${newBids.length} new bid${newBids.length > 1 ? 's' : ''} added in the last 7 days`;
}

function toggleNotifDropdown() {
  const dropdown = document.getElementById('notifDropdown');
  dropdown.classList.toggle('open');
  if (dropdown.classList.contains('open')) {
    setTimeout(() => document.addEventListener('click', closeNotifOnOutsideClick), 0);
  }
}

function closeNotifOnOutsideClick(e) {
  const wrap = document.getElementById('notifBtn').closest('.notif-wrap');
  if (!wrap.contains(e.target)) {
    document.getElementById('notifDropdown').classList.remove('open');
    document.removeEventListener('click', closeNotifOnOutsideClick);
  }
}

function clearNotifications() {
  localStorage.setItem(NOTIF_KEY, new Date().toISOString());
  document.getElementById('notifDropdown').classList.remove('open');
  renderNotifications();
  showToast('Notifications cleared.', 'success');
}

function highlightBid(id) {
  document.getElementById('notifDropdown').classList.remove('open');
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tracker').classList.add('active');
  document.querySelector('.tab').classList.add('active');
  document.getElementById('searchInput').value = '';
  document.getElementById('filterCounty').value = '';
  document.getElementById('filterStatus').value = '';
  document.getElementById('filterCat').value = '';
  renderTable();
  setTimeout(() => {
    const rows = document.querySelectorAll('#bidTableBody tr');
    rows.forEach(row => {
      if (row.innerHTML.includes(id)) {
        row.style.background = 'rgba(26,110,245,0.08)';
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => row.style.background = '', 2000);
      }
    });
  }, 100);
}

// ── TOAST ──
let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}