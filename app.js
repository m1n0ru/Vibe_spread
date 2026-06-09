'use strict';

const STORAGE_KEY = 'inv_generator_state';

// ── State ────────────────────────────────────────────────────────────────────
let state = {
  invoiceNumber: '',
  issueDate: '',
  dueDate: '',
  issuerName: '',
  issuerAddress: '',
  issuerPhone: '',
  issuerEmail: '',
  bankInfo: '',
  recipientName: '',
  recipientAddress: '',
  taxRate: 10,
  notes: '',
  items: [],
};

// ── Utilities ────────────────────────────────────────────────────────────────
function today() {
  return new Date().toISOString().slice(0, 10);
}

function addMonths(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

function formatDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${y}年${parseInt(m)}月${parseInt(d)}日`;
}

function formatMoney(n) {
  return '¥' + Math.round(n).toLocaleString('ja-JP');
}

function itemAmount(item) {
  return Math.round((parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0));
}

function calcTotals() {
  const subtotal = state.items.reduce((s, i) => s + itemAmount(i), 0);
  const tax = Math.floor(subtotal * Number(state.taxRate) / 100);
  return { subtotal, tax, total: subtotal + tax };
}

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function newItem() {
  return { id: Date.now() + Math.random(), name: '', qty: 1, unit: '式', price: 0 };
}

function genInvoiceNumber() {
  const seq = parseInt(localStorage.getItem('inv_seq') || '0') + 1;
  localStorage.setItem('inv_seq', String(seq));
  const ym = today().replace(/-/g, '').slice(0, 6);
  return `INV-${ym}-${String(seq).padStart(3, '0')}`;
}

// ── Persistence ──────────────────────────────────────────────────────────────
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

// ── DOM helpers ──────────────────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }

function syncFormFromState() {
  const textFields = [
    'invoiceNumber', 'issueDate', 'dueDate',
    'issuerName', 'issuerAddress', 'issuerPhone', 'issuerEmail', 'bankInfo',
    'recipientName', 'recipientAddress', 'notes',
  ];
  textFields.forEach(key => { $(key).value = state[key] ?? ''; });
  $('taxRate').value = state.taxRate;
}

function bindFormEvents() {
  const textFields = [
    'invoiceNumber', 'issueDate', 'dueDate',
    'issuerName', 'issuerAddress', 'issuerPhone', 'issuerEmail', 'bankInfo',
    'recipientName', 'recipientAddress', 'notes',
  ];

  textFields.forEach(key => {
    $(key).addEventListener('input', e => {
      state[key] = e.target.value;
      saveState();
      updatePreview();
    });
  });

  $('taxRate').addEventListener('change', e => {
    state.taxRate = e.target.value;
    saveState();
    updateTotalsDisplay();
    updatePreview();
  });

  $('addItemBtn').addEventListener('click', () => {
    state.items.push(newItem());
    renderItems();
    saveState();
    updatePreview();
  });

  $('excelBtn').addEventListener('click', exportExcel);
  $('pdfBtn').addEventListener('click', exportPdf);
  $('clearBtn').addEventListener('click', clearAll);
}

// ── Items Table ──────────────────────────────────────────────────────────────
function renderItems() {
  const tbody = $('itemsBody');
  tbody.innerHTML = '';

  state.items.forEach((item, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="min-width:110px">
        <input type="text" placeholder="品目名"
          value="${escHtml(item.name)}" data-field="name" data-idx="${idx}">
      </td>
      <td style="width:54px">
        <input type="number" min="0" step="any" style="text-align:right"
          value="${item.qty}" data-field="qty" data-idx="${idx}">
      </td>
      <td style="width:46px">
        <input type="text" style="text-align:center"
          value="${escHtml(item.unit)}" data-field="unit" data-idx="${idx}">
      </td>
      <td style="width:88px">
        <input type="number" min="0" step="any" style="text-align:right"
          value="${item.price}" data-field="price" data-idx="${idx}">
      </td>
      <td class="amount-cell">${formatMoney(itemAmount(item))}</td>
      <td style="width:30px; text-align:center">
        <button class="delete-btn" data-idx="${idx}" title="削除"
          ${state.items.length <= 1 ? 'disabled' : ''}>×</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('input[data-field]').forEach(el => {
    el.addEventListener('input', e => {
      const idx = parseInt(e.target.dataset.idx);
      const field = e.target.dataset.field;
      state.items[idx][field] = (field === 'qty' || field === 'price')
        ? parseFloat(e.target.value) || 0
        : e.target.value;
      e.target.closest('tr').querySelector('.amount-cell').textContent
        = formatMoney(itemAmount(state.items[idx]));
      updateTotalsDisplay();
      saveState();
      updatePreview();
    });
  });

  tbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = parseInt(e.target.dataset.idx);
      state.items.splice(idx, 1);
      renderItems();
      saveState();
      updatePreview();
    });
  });

  updateTotalsDisplay();
}

function updateTotalsDisplay() {
  const { subtotal, tax, total } = calcTotals();
  $('displaySubtotal').textContent = formatMoney(subtotal);
  $('displayTax').textContent = formatMoney(tax);
  $('displayTotal').textContent = formatMoney(total);
}

// ── Preview Rendering ────────────────────────────────────────────────────────
function updatePreview() {
  const s = state;
  const { subtotal, tax, total } = calcTotals();

  const itemRows = s.items.map(item => `
    <tr>
      <td>${escHtml(item.name) || '&nbsp;'}</td>
      <td class="td-right">${parseFloat(item.qty) || 0}</td>
      <td class="td-center">${escHtml(item.unit)}</td>
      <td class="td-right">${formatMoney(parseFloat(item.price) || 0)}</td>
      <td class="td-right">${formatMoney(itemAmount(item))}</td>
    </tr>
  `).join('');

  const bankSection = s.bankInfo ? `
    <div class="inv-block">
      <div class="inv-block-title">振込先</div>
      <div class="inv-block-body">${escHtml(s.bankInfo)}</div>
    </div>` : '';

  const notesSection = s.notes ? `
    <div class="inv-block">
      <div class="inv-block-title">備考</div>
      <div class="inv-block-body">${escHtml(s.notes).replace(/\n/g, '<br>')}</div>
    </div>` : '';

  $('invoicePreview').innerHTML = `
    <div class="inv-header">
      <div class="inv-title-col">
        <h1 class="inv-title">請 求 書</h1>
        <div class="inv-meta-list">
          <div>請求書番号：${escHtml(s.invoiceNumber)}</div>
          <div>発行日：${formatDate(s.issueDate)}</div>
          ${s.dueDate ? `<div>支払期限：${formatDate(s.dueDate)}</div>` : ''}
        </div>
      </div>
      <div class="inv-issuer">
        <div class="inv-issuer-name">${escHtml(s.issuerName) || '（会社名）'}</div>
        ${s.issuerAddress ? `<div class="inv-issuer-detail">${escHtml(s.issuerAddress)}</div>` : ''}
        ${s.issuerPhone ? `<div class="inv-issuer-detail">TEL：${escHtml(s.issuerPhone)}</div>` : ''}
        ${s.issuerEmail ? `<div class="inv-issuer-detail">${escHtml(s.issuerEmail)}</div>` : ''}
      </div>
    </div>

    <div class="inv-recipient-block">
      <div class="inv-recipient-line">
        <span class="inv-recipient-name">${escHtml(s.recipientName) || '（請求先）'}</span>
        <span class="inv-honorific">御中</span>
      </div>
      ${s.recipientAddress
        ? `<div class="inv-recipient-addr">${escHtml(s.recipientAddress)}</div>`
        : ''}
    </div>

    <div class="inv-amount-box">
      <div class="inv-amount-label">ご請求金額</div>
      <div class="inv-amount-value">
        ${formatMoney(total)}
        <span class="inv-amount-note">（税込）</span>
      </div>
    </div>

    <table class="inv-table">
      <thead>
        <tr>
          <th class="th-name th-wide">品目</th>
          <th class="th-narrow">数量</th>
          <th class="th-narrow">単位</th>
          <th class="th-mid">単価</th>
          <th class="th-mid">金額</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <div class="inv-totals-block">
      <div class="inv-total-row"><span>小計</span><span>${formatMoney(subtotal)}</span></div>
      <div class="inv-total-row">
        <span>消費税（${s.taxRate}%）</span>
        <span>${formatMoney(tax)}</span>
      </div>
      <div class="inv-total-row inv-total-grand">
        <span>合計</span><span>${formatMoney(total)}</span>
      </div>
    </div>

    ${bankSection}
    ${notesSection}
  `;
}

// ── Clear ────────────────────────────────────────────────────────────────────
function clearAll() {
  if (!confirm('入力内容をすべてクリアします。よろしいですか？')) return;
  localStorage.removeItem(STORAGE_KEY);
  const t = today();
  state = {
    invoiceNumber: genInvoiceNumber(),
    issueDate: t,
    dueDate: addMonths(t, 1),
    issuerName: '', issuerAddress: '', issuerPhone: '', issuerEmail: '',
    bankInfo: '', recipientName: '', recipientAddress: '',
    taxRate: 10, notes: '',
    items: [newItem()],
  };
  syncFormFromState();
  renderItems();
  updatePreview();
}

// ── Init ─────────────────────────────────────────────────────────────────────
function init() {
  const saved = loadState();
  if (saved && Array.isArray(saved.items) && saved.items.length > 0) {
    Object.assign(state, saved);
  } else {
    const t = today();
    state.invoiceNumber = genInvoiceNumber();
    state.issueDate = t;
    state.dueDate = addMonths(t, 1);
    state.items = [newItem()];
  }

  syncFormFromState();
  bindFormEvents();
  renderItems();
  updatePreview();
}

document.addEventListener('DOMContentLoaded', init);
