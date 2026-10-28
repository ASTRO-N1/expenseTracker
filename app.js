/**
 * SpendWise — app.js
 * Main application logic: auth, routing, API calls, charts, and UI interactions.
 */

'use strict';

/* ================================================
   CONFIG — Azure API endpoints
================================================ */
const API_BASE = '/api';  // SWA Managed Functions base path

/* ================================================
   CATEGORY METADATA
================================================ */
const CATEGORIES = {
  'Food & Dining':     { emoji: '🍔', color: '#f97316' },
  'Transportation':    { emoji: '🚗', color: '#3b82f6' },
  'Shopping':          { emoji: '🛍️', color: '#ec4899' },
  'Entertainment':     { emoji: '🎬', color: '#8b5cf6' },
  'Health & Medical':  { emoji: '💊', color: '#10b981' },
  'Housing':           { emoji: '🏠', color: '#f59e0b' },
  'Utilities':         { emoji: '⚡', color: '#06b6d4' },
  'Education':         { emoji: '📚', color: '#6366f1' },
  'Travel':            { emoji: '✈️', color: '#14b8a6' },
  'Personal Care':     { emoji: '💅', color: '#d946ef' },
  'Subscriptions':     { emoji: '📱', color: '#84cc16' },
  'Other':             { emoji: '📦', color: '#94a3b8' },
};

/* ================================================
   APP STATE
================================================ */
let state = {
  user: null,
  expenses: [],
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth() + 1,  // 1-indexed
  editingId: null,
  deleteTargetId: null,
  charts: {},
  filterCategory: '',
  searchQuery: '',
  sortMode: 'date-desc',
};

/* ================================================
   HELPERS
================================================ */
const $ = (id) => document.getElementById(id);
const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
const fmtDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};
const monthName = (year, month) => new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
const today = () => new Date().toISOString().split('T')[0];
const daysInMonth = (year, month) => new Date(year, month, 0).getDate();
const getCatMeta = (cat) => CATEGORIES[cat] || CATEGORIES['Other'];

function showToast(message, type = 'info') {
  const icons = { success: 'check-circle', error: 'alert-circle', info: 'info', warning: 'alert-triangle' };
  const container = $('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i data-lucide="${icons[type]}" class="toast-icon"></i><span>${message}</span>`;
  container.appendChild(toast);
  lucide.createIcons({ nodes: [toast] });
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(30px)'; toast.style.transition = 'all 0.3s'; setTimeout(() => toast.remove(), 300); }, 3500);
}

function setLoader(show) { $('globalLoader').classList.toggle('hidden', !show); }

/* ================================================
   AUTH — Azure Static Web Apps
================================================ */
async function checkAuth() {
  // Dev mode: always bypass auth when not on an Azure-hosted domain
  // This allows the app to work when opened via file:// or localhost
  const isDevOrLocal = location.protocol === 'file:' ||
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.hostname === '';

  if (isDevOrLocal) {
    state.user = { userId: 'dev-user', userDetails: 'Developer', identityProvider: 'local' };
    $('auth-gate').classList.add('hidden');
    $('app').classList.remove('hidden');
    $('userName').textContent = 'Developer';
    $('userAvatar').textContent = 'D';
    return true;
  }

  // Production: check Azure SWA auth
  try {
    const res = await fetch('/.auth/me');
    if (!res.ok) throw new Error('Not authenticated');
    const data = await res.json();
    if (data.clientPrincipal) {
      state.user = data.clientPrincipal;
      $('auth-gate').classList.add('hidden');
      $('app').classList.remove('hidden');
      $('userName').textContent = state.user.userDetails || 'User';
      $('userAvatar').textContent = (state.user.userDetails || 'U')[0].toUpperCase();
      return true;
    }
  } catch {
    // Network error or not authenticated
  }

  // Show auth gate for unauthenticated Azure users
  $('auth-gate').classList.remove('hidden');
  $('app').classList.add('hidden');
  return false;
}

/* ================================================
   API LAYER — Azure Functions
   Falls back to localStorage in dev/offline mode
================================================ */
const isOfflineMode = () => location.hostname === 'localhost' || location.hostname === '127.0.0.1';

// LocalStorage dev store
const devStore = {
  getAll: () => JSON.parse(localStorage.getItem('sw_expenses') || '[]'),
  save: (expenses) => localStorage.setItem('sw_expenses', JSON.stringify(expenses)),
};

async function apiGetExpenses(year, month) {
  if (isOfflineMode()) {
    const all = devStore.getAll();
    return all.filter(e => {
      const d = new Date(e.date + 'T00:00:00');
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
  }
  const res = await fetch(`${API_BASE}/get-expenses?year=${year}&month=${month}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP ${res.status}: Failed to fetch expenses`);
  }
  return await res.json();
}

async function apiAddExpense(expense) {
  if (isOfflineMode()) {
    const all = devStore.getAll();
    const newExp = { ...expense, id: crypto.randomUUID(), userId: state.user?.userId || 'dev' };
    all.push(newExp);
    devStore.save(all);
    return newExp;
  }
  const res = await fetch(`${API_BASE}/add-expense`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(expense)
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP ${res.status}: Failed to add expense`);
  }
  return await res.json();
}

async function apiUpdateExpense(id, expense) {
  if (isOfflineMode()) {
    const all = devStore.getAll();
    const idx = all.findIndex(e => e.id === id);
    if (idx !== -1) all[idx] = { ...all[idx], ...expense };
    devStore.save(all);
    return all[idx];
  }
  const res = await fetch(`${API_BASE}/update-expense/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(expense)
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP ${res.status}: Failed to update expense`);
  }
  return await res.json();
}

async function apiDeleteExpense(id) {
  if (isOfflineMode()) {
    const all = devStore.getAll().filter(e => e.id !== id);
    devStore.save(all);
    return true;
  }
  const res = await fetch(`${API_BASE}/delete-expense/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP ${res.status}: Failed to delete expense`);
  }
  return true;
}

async function apiUploadReceipt(file, expenseId) {
  if (isOfflineMode()) {
    return URL.createObjectURL(file);
  }
  const base64Data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result;
      const base64 = typeof res === 'string' && res.includes(',') ? res.split(',')[1] : res;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const res = await fetch(`${API_BASE}/upload-receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || 'image/jpeg',
      data: base64Data,
      expenseId: expenseId || crypto.randomUUID()
    })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP ${res.status}: Failed to upload receipt`);
  }
  const { url } = await res.json();
  return url;
}

/* ================================================
   DATA LOADING
================================================ */
async function loadExpenses() {
  setLoader(true);
  try {
    const expenses = await apiGetExpenses(state.currentYear, state.currentMonth);
    state.expenses = expenses || [];
    renderAll();
  } catch (err) {
    showToast(`Error loading expenses: ${err.message}`, 'error');
  } finally {
    setLoader(false);
  }
}

/* ================================================
   RENDERING
================================================ */
function renderAll() {
  renderDashboard();
  renderExpenseTable();
  renderAnalytics();
  renderReceipts();
  updateMonthDisplay();
}

/* ---- Dashboard ---- */
function renderDashboard() {
  const expenses = state.expenses;
  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const txCount = expenses.length;
  const days = new Date().getMonth() + 1 === state.currentMonth && new Date().getFullYear() === state.currentYear
    ? new Date().getDate() : daysInMonth(state.currentYear, state.currentMonth);
  const dailyAvg = days > 0 ? total / days : 0;

  // Category totals
  const catTotals = {};
  expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + (e.amount || 0); });
  const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

  $('statTotalSpent').textContent = fmt(total);
  $('statTransactions').textContent = txCount;
  $('statDailyAvg').textContent = fmt(dailyAvg);
  $('statTopCategory').textContent = topCat ? topCat[0] : '—';
  $('statTopCatAmount').textContent = topCat ? `${fmt(topCat[1])} spent` : 'No expenses yet';
  $('dashMonthLabel').textContent = monthName(state.currentYear, state.currentMonth);

  renderRecentTransactions();
  renderTrendChart();
  renderCategoryChart(catTotals);
}

function renderRecentTransactions() {
  const container = $('recentTransactions');
  const empty = $('recentEmpty');
  const sorted = [...state.expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);
  if (sorted.length === 0) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  // Remove old items
  container.querySelectorAll('.transaction-item').forEach(el => el.remove());
  sorted.forEach(e => {
    const meta = getCatMeta(e.category);
    const div = document.createElement('div');
    div.className = 'transaction-item';
    div.innerHTML = `
      <div class="tx-icon" style="background:${meta.color}20">${meta.emoji}</div>
      <div class="tx-details">
        <div class="tx-description">${e.description}</div>
        <div class="tx-meta">${fmtDate(e.date)} · <span class="tx-category-badge">${e.category}</span></div>
      </div>
      <div class="tx-amount">-${fmt(e.amount)}</div>`;
    container.appendChild(div);
  });
  lucide.createIcons({ nodes: [container] });
}

/* ---- Expense Table ---- */
function renderExpenseTable() {
  const tbody = $('expenseTableBody');
  const empty = $('expensesEmpty');

  // Populate category filter
  const filterSel = $('filterCategory');
  const existing = new Set([...filterSel.options].map(o => o.value));
  const cats = [...new Set(state.expenses.map(e => e.category))];
  cats.forEach(cat => {
    if (!existing.has(cat)) {
      const opt = document.createElement('option');
      opt.value = cat; opt.textContent = cat;
      filterSel.appendChild(opt);
    }
  });

  let filtered = [...state.expenses];
  if (state.filterCategory) filtered = filtered.filter(e => e.category === state.filterCategory);
  if (state.searchQuery) filtered = filtered.filter(e => e.description.toLowerCase().includes(state.searchQuery.toLowerCase()));
  filtered = sortExpenses(filtered);

  tbody.querySelectorAll('tr:not(.empty-row)').forEach(r => r.remove());
  if (filtered.length === 0) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  filtered.forEach(e => {
    const meta = getCatMeta(e.category);
    const tr = document.createElement('tr');
    tr.dataset.id = e.id;
    tr.innerHTML = `
      <td><span style="display:inline-flex;align-items:center;gap:8px"><span>${meta.emoji}</span><span>${e.description}</span></span></td>
      <td><span class="tx-category-badge">${e.category}</span></td>
      <td>${fmtDate(e.date)}</td>
      <td class="table-amount">${fmt(e.amount)}</td>
      <td>${e.receiptUrl ? `<a href="${e.receiptUrl}" target="_blank" class="table-receipt-link"><i data-lucide="external-link"></i> View</a>` : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td>
        <div class="table-actions">
          <button class="btn-edit" data-id="${e.id}" title="Edit"><i data-lucide="pencil"></i></button>
          <button class="btn-delete-row" data-id="${e.id}" title="Delete"><i data-lucide="trash-2"></i></button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });

  // Attach row actions
  tbody.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', () => startEdit(btn.dataset.id)));
  tbody.querySelectorAll('.btn-delete-row').forEach(btn => btn.addEventListener('click', () => openDeleteModal(btn.dataset.id)));
  lucide.createIcons({ nodes: [tbody] });
}

function sortExpenses(arr) {
  return arr.sort((a, b) => {
    switch (state.sortMode) {
      case 'date-asc':    return new Date(a.date) - new Date(b.date);
      case 'date-desc':   return new Date(b.date) - new Date(a.date);
      case 'amount-asc':  return a.amount - b.amount;
      case 'amount-desc': return b.amount - a.amount;
      default:            return 0;
    }
  });
}

/* ---- Charts ---- */
const chartDefaults = {
  color: 'rgba(148,163,184,0.7)',
  borderColor: 'rgba(255,255,255,0.05)',
  responsive: true, maintainAspectRatio: true,
};

function buildChart(id, type, data, options = {}) {
  if (state.charts[id]) state.charts[id].destroy();
  const ctx = $(id)?.getContext('2d');
  if (!ctx) return;
  state.charts[id] = new Chart(ctx, { type, data, options: { ...chartDefaults, ...options } });
}

function renderTrendChart() {
  const days = daysInMonth(state.currentYear, state.currentMonth);
  const dailyTotals = Array(days).fill(0);
  state.expenses.forEach(e => {
    const day = new Date(e.date + 'T00:00:00').getDate() - 1;
    if (day >= 0 && day < days) dailyTotals[day] += e.amount || 0;
  });

  // Running cumulative
  const cumulative = [];
  let sum = 0;
  dailyTotals.forEach(v => { sum += v; cumulative.push(sum); });

  const labels = Array.from({ length: days }, (_, i) => i + 1);
  buildChart('trendChart', 'line', {
    labels,
    datasets: [
      {
        label: 'Daily Spend',
        data: dailyTotals,
        backgroundColor: 'rgba(124,111,247,0.08)',
        borderColor: 'rgba(124,111,247,0.6)',
        borderWidth: 2, tension: 0.4, fill: true, pointRadius: 3,
        pointBackgroundColor: '#7c6ff7',
      },
      {
        label: 'Cumulative',
        data: cumulative,
        backgroundColor: 'transparent',
        borderColor: 'rgba(94,234,212,0.7)',
        borderWidth: 2, tension: 0.4, borderDash: [5, 3], pointRadius: 0,
      }
    ]
  }, {
    plugins: { legend: { display: false }, tooltip: {
      backgroundColor: 'rgba(15,17,32,0.95)',
      titleColor: '#f1f5f9', bodyColor: '#94a3b8',
      borderColor: 'rgba(124,111,247,0.3)', borderWidth: 1,
      callbacks: { label: ctx => ` ${fmt(ctx.raw)}` }
    }},
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#475569', maxTicksLimit: 10 } },
      y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#475569', callback: v => fmt(v) } }
    }
  });
}

function renderCategoryChart(catTotals) {
  const cats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  if (cats.length === 0) return;
  const labels = cats.map(([c]) => c);
  const values = cats.map(([, v]) => v);
  const colors = cats.map(([c]) => getCatMeta(c).color);

  buildChart('categoryChart', 'doughnut', {
    labels,
    datasets: [{ data: values, backgroundColor: colors, borderColor: 'rgba(10,11,20,0.8)', borderWidth: 2, hoverOffset: 6 }]
  }, {
    cutout: '68%',
    plugins: { legend: { display: false }, tooltip: {
      backgroundColor: 'rgba(15,17,32,0.95)',
      titleColor: '#f1f5f9', bodyColor: '#94a3b8',
      borderColor: 'rgba(124,111,247,0.3)', borderWidth: 1,
      callbacks: { label: ctx => ` ${fmt(ctx.raw)}` }
    }}
  });

  // Custom legend
  const legendEl = $('donutLegend');
  legendEl.innerHTML = '';
  const top4 = cats.slice(0, 5);
  top4.forEach(([cat, val]) => {
    const meta = getCatMeta(cat);
    const item = document.createElement('div');
    item.className = 'donut-legend-item';
    item.innerHTML = `<div class="donut-legend-label"><div class="donut-legend-dot" style="background:${meta.color}"></div><span>${cat}</span></div><span class="donut-legend-amount">${fmt(val)}</span>`;
    legendEl.appendChild(item);
  });
}

/* ---- Analytics ---- */
function renderAnalytics() {
  renderMonthlyBarChart();
  renderCategoryBarChart();
  renderTopSpends();
  renderHeatmap();
}

function renderMonthlyBarChart() {
  // Use all localStorage data for monthly comparison
  let allExpenses = isOfflineMode() ? devStore.getAll() : state.expenses;
  const months = [];
  const totals = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(state.currentYear, state.currentMonth - 1 - i, 1);
    months.push(d.toLocaleString('en-US', { month: 'short' }));
    const y = d.getFullYear(), m = d.getMonth() + 1;
    const total = allExpenses.filter(e => {
      const ed = new Date(e.date + 'T00:00:00');
      return ed.getFullYear() === y && ed.getMonth() + 1 === m;
    }).reduce((s, e) => s + (e.amount || 0), 0);
    totals.push(total);
  }

  buildChart('monthlyBarChart', 'bar', {
    labels: months,
    datasets: [{ label: 'Total Spent', data: totals, backgroundColor: totals.map((_, i) => i === 5 ? '#7c6ff7' : 'rgba(124,111,247,0.35)'), borderRadius: 6, borderSkipped: false }]
  }, {
    plugins: { legend: { display: false }, tooltip: {
      backgroundColor: 'rgba(15,17,32,0.95)',
      callbacks: { label: ctx => ` ${fmt(ctx.raw)}` }
    }},
    scales: {
      x: { grid: { display: false }, ticks: { color: '#475569' } },
      y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#475569', callback: v => fmt(v) } }
    }
  });
}

function renderCategoryBarChart() {
  const catTotals = {};
  state.expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + (e.amount || 0); });
  const cats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  if (cats.length === 0) return;

  buildChart('categoryBarChart', 'bar', {
    labels: cats.map(([c]) => c),
    datasets: [{ label: 'Spent', data: cats.map(([, v]) => v), backgroundColor: cats.map(([c]) => getCatMeta(c).color + 'cc'), borderRadius: 6, borderSkipped: false }]
  }, {
    indexAxis: 'y',
    plugins: { legend: { display: false }, tooltip: {
      backgroundColor: 'rgba(15,17,32,0.95)',
      callbacks: { label: ctx => ` ${fmt(ctx.raw)}` }
    }},
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#475569', callback: v => fmt(v) } },
      y: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 12 } } }
    }
  });
}

function renderTopSpends() {
  const list = $('topSpendsList');
  list.innerHTML = '';
  const sorted = [...state.expenses].sort((a, b) => b.amount - a.amount).slice(0, 5);
  if (sorted.length === 0) { list.innerHTML = '<li style="color:var(--text-muted);font-size:.88rem">No data for this month.</li>'; return; }
  sorted.forEach((e, i) => {
    const li = document.createElement('li');
    li.className = 'top-spend-item';
    const meta = getCatMeta(e.category);
    li.innerHTML = `<span class="top-spend-rank">#${i + 1}</span><div style="width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:${meta.color}20;font-size:1rem">${meta.emoji}</div><div class="top-spend-details"><div class="top-spend-desc">${e.description}</div><div class="top-spend-cat">${e.category}</div></div><span class="top-spend-amount">${fmt(e.amount)}</span>`;
    list.appendChild(li);
  });
}

function renderHeatmap() {
  const wrapper = $('heatmapWrapper');
  wrapper.innerHTML = '';
  const days = daysInMonth(state.currentYear, state.currentMonth);
  const dailyTotals = {};
  state.expenses.forEach(e => {
    const d = new Date(e.date + 'T00:00:00').getDate();
    dailyTotals[d] = (dailyTotals[d] || 0) + (e.amount || 0);
  });
  const max = Math.max(...Object.values(dailyTotals), 1);
  for (let d = 1; d <= days; d++) {
    const val = dailyTotals[d] || 0;
    const level = val === 0 ? 0 : val < max * 0.25 ? 1 : val < max * 0.5 ? 2 : val < max * 0.75 ? 3 : 4;
    const div = document.createElement('div');
    div.className = 'heatmap-day';
    div.dataset.level = level;
    div.title = `Day ${d}: ${fmt(val)}`;
    wrapper.appendChild(div);
  }
}

/* ---- Receipts ---- */
function renderReceipts() {
  const grid = $('receiptsGrid');
  const empty = $('receiptsEmpty');
  const withReceipts = state.expenses.filter(e => e.receiptUrl);
  grid.querySelectorAll('.receipt-card').forEach(el => el.remove());
  if (withReceipts.length === 0) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  withReceipts.forEach(e => {
    const card = document.createElement('div');
    card.className = 'receipt-card';
    card.innerHTML = `<img src="${e.receiptUrl}" alt="Receipt for ${e.description}" class="receipt-thumb" loading="lazy" /><div class="receipt-info"><div class="receipt-desc">${e.description}</div><div class="receipt-date">${fmtDate(e.date)} · ${fmt(e.amount)}</div></div>`;
    grid.appendChild(card);
  });
}

/* ================================================
   ROUTING — Page Navigation
================================================ */
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const target = $(`page-${page}`);
  if (target) target.classList.add('active');
  document.querySelectorAll(`[data-page="${page}"]`).forEach(el => el.classList.add('active'));
  // Close sidebar on mobile
  if (window.innerWidth <= 768) $('sidebar').classList.remove('open');
}

/* ================================================
   ADD / EDIT FORM
================================================ */
function resetForm() {
  $('expenseForm').reset();
  $('editExpenseId').value = '';
  $('addPageTitle').textContent = 'Add Expense';
  $('submitLabel').textContent = 'Save Expense';
  $('cancelEdit').style.display = 'none';
  $('uploadContent').classList.remove('hidden');
  $('uploadPreview').classList.add('hidden');
  $('uploadProgress').classList.add('hidden');
  state.editingId = null;
  // Set today's date by default
  $('expDate').value = today();
}

function startEdit(id) {
  const e = state.expenses.find(x => x.id === id);
  if (!e) return;
  state.editingId = id;
  navigateTo('add');
  $('editExpenseId').value = id;
  $('addPageTitle').textContent = 'Edit Expense';
  $('submitLabel').textContent = 'Update Expense';
  $('cancelEdit').style.display = 'inline-flex';
  $('expAmount').value = e.amount;
  $('expDate').value = e.date;
  $('expDescription').value = e.description;
  $('expCategory').value = e.category;
  $('expPayment').value = e.paymentMethod || 'Card';
  $('expNotes').value = e.notes || '';
  if (e.receiptUrl) {
    $('previewImg').src = e.receiptUrl;
    $('uploadContent').classList.add('hidden');
    $('uploadPreview').classList.remove('hidden');
  }
}

/* ================================================
   FORM SUBMIT
================================================ */
$('expenseForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const submitBtn = $('submitExpense');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<div class="loader-spinner" style="width:18px;height:18px;border-width:2px;margin:0 auto"></div>';

  try {
    const formData = {
      amount: parseFloat($('expAmount').value),
      date: $('expDate').value,
      description: $('expDescription').value.trim(),
      category: $('expCategory').value,
      paymentMethod: $('expPayment').value,
      notes: $('expNotes').value.trim(),
      receiptUrl: null,
    };

    // Upload receipt if file selected
    const file = $('receiptFile').files[0];
    if (file) {
      $('uploadProgress').classList.remove('hidden');
      let tempId = state.editingId || 'new';
      // Simulate progress in dev mode
      animateProgress();
      const url = await apiUploadReceipt(file, tempId);
      formData.receiptUrl = url;
      $('progressFill').style.width = '100%';
      $('uploadStatus').textContent = 'Upload complete!';
    }

    let result;
    if (state.editingId) {
      result = await apiUpdateExpense(state.editingId, formData);
      showToast('Expense updated successfully!', 'success');
    } else {
      result = await apiAddExpense(formData);
      showToast('Expense added successfully!', 'success');
    }

    resetForm();
    await loadExpenses();
    navigateTo('dashboard');

  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i data-lucide="save"></i><span id="submitLabel">${state.editingId ? 'Update Expense' : 'Save Expense'}</span>`;
    lucide.createIcons({ nodes: [submitBtn] });
  }
});

function animateProgress() {
  const fill = $('progressFill');
  $('uploadStatus').textContent = 'Uploading...';
  let w = 0;
  const interval = setInterval(() => {
    w = Math.min(w + Math.random() * 15, 90);
    fill.style.width = w + '%';
    if (w >= 90) clearInterval(interval);
  }, 200);
}

/* ================================================
   DELETE MODAL
================================================ */
function openDeleteModal(id) {
  state.deleteTargetId = id;
  $('deleteModal').classList.remove('hidden');
}
$('cancelDelete').addEventListener('click', () => { $('deleteModal').classList.add('hidden'); state.deleteTargetId = null; });
$('confirmDelete').addEventListener('click', async () => {
  if (!state.deleteTargetId) return;
  $('deleteModal').classList.add('hidden');
  try {
    await apiDeleteExpense(state.deleteTargetId);
    showToast('Expense deleted.', 'success');
    state.deleteTargetId = null;
    await loadExpenses();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
});

/* ================================================
   RECEIPT UPLOAD — Drag & Drop
================================================ */
const dropZone = $('receiptDropZone');
const fileInput = $('receiptFile');

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) showReceiptPreview(file);
});
fileInput.addEventListener('change', () => { if (fileInput.files[0]) showReceiptPreview(fileInput.files[0]); });

function showReceiptPreview(file) {
  if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
    showToast('Only image or PDF files are supported.', 'warning'); return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('File size must be under 5 MB.', 'warning'); return;
  }
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = (e) => {
      $('previewImg').src = e.target.result;
      $('uploadContent').classList.add('hidden');
      $('uploadPreview').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  } else {
    $('uploadContent').classList.add('hidden');
    $('uploadPreview').classList.remove('hidden');
    $('previewImg').src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="%237c6ff7" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';
  }
}

$('removeReceipt').addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.value = '';
  $('uploadContent').classList.remove('hidden');
  $('uploadPreview').classList.add('hidden');
  $('uploadProgress').classList.add('hidden');
  $('progressFill').style.width = '0%';
});

/* ================================================
   MONTH SELECTOR
================================================ */
function updateMonthDisplay() {
  $('currentMonth').textContent = monthName(state.currentYear, state.currentMonth);
}

$('prevMonth').addEventListener('click', () => {
  if (state.currentMonth === 1) { state.currentMonth = 12; state.currentYear--; }
  else state.currentMonth--;
  loadExpenses();
});
$('nextMonth').addEventListener('click', () => {
  if (state.currentMonth === 12) { state.currentMonth = 1; state.currentYear++; }
  else state.currentMonth++;
  loadExpenses();
});

/* ================================================
   EVENT DELEGATION — Navigation
================================================ */
document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-page]');
  if (link) {
    e.preventDefault();
    const page = link.dataset.page;
    navigateTo(page);
    if (page === 'add' && !state.editingId) resetForm();
  }
});

// Sidebar
$('menuToggle').addEventListener('click', () => $('sidebar').classList.add('open'));
$('sidebarClose').addEventListener('click', () => $('sidebar').classList.remove('open'));

// Quick add button
$('quickAddBtn').addEventListener('click', () => { navigateTo('add'); resetForm(); });

// Refresh
$('refreshBtn').addEventListener('click', () => { loadExpenses(); showToast('Data refreshed', 'info'); });
$('cancelEdit').addEventListener('click', () => { resetForm(); navigateTo('dashboard'); });

// Expense table filters
$('searchExpenses').addEventListener('input', (e) => { state.searchQuery = e.target.value; renderExpenseTable(); });
$('filterCategory').addEventListener('change', (e) => { state.filterCategory = e.target.value; renderExpenseTable(); });
$('sortExpenses').addEventListener('change', (e) => { state.sortMode = e.target.value; renderExpenseTable(); });

// Close modal on backdrop click
$('deleteModal').addEventListener('click', (e) => { if (e.target === $('deleteModal')) { $('deleteModal').classList.add('hidden'); state.deleteTargetId = null; } });

/* ================================================
   INIT
================================================ */
async function init() {
  // Init Lucide icons
  lucide.createIcons();

  // Check authentication
  const authed = await checkAuth();
  if (!authed) return;

  // Set default date on add form
  $('expDate').value = today();

  // Load data
  await loadExpenses();

  // Re-render icons after dynamic content
  lucide.createIcons();
}

init();
