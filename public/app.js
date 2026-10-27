const state = { contract: null, order: null, threshold: 0.9 };

const $ = (selector) => document.querySelector(selector);
const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((c) => c != null));
  return node;
};
const money = (c) => `${new Intl.NumberFormat('en-US', { style: 'currency', currency: c.currency }).format(Number(c.amount))}`;
const short = (id) => (id ? `${id.slice(0, 8)}…` : '');
const time = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour12: false });
const STATUS = { draft: 'Awaiting funds', authorized: 'Funds held', needs_review: 'Needs review', verified: 'Verified', released: 'Paid' };

async function request(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? body.reason ?? `Request failed (${response.status})`);
  return body;
}

function showError(error) {
  $('#error').textContent = error.message;
  $('#error').classList.remove('is-hidden');
}
const clearError = () => $('#error').classList.add('is-hidden');

async function busy(button, label, task) {
  const original = button.textContent;
  button.disabled = true;
  button.classList.add('is-busy');
  button.textContent = label;
  try {
    return await task();
  } finally {
    button.disabled = false;
    button.classList.remove('is-busy');
    button.textContent = original;
  }
}

// --- rendering -------------------------------------------------------------

function renderChecks(c) {
  const results = new Map((c.assessment?.checks ?? []).map((r) => [r.id, r]));
  $('#m-checks').replaceChildren(...c.acceptanceChecks.map((check) => {
    const r = results.get(check.id);
    const mark = el('span', { className: `mark ${r ? (r.passed ? 'pass' : 'fail') : ''}`, textContent: r ? (r.passed ? '✓' : '✕') : '' });
    return el('li', {}, mark, el('div', {}, el('div', { className: 'text', textContent: check.text }), r ? el('div', { className: 'reason', textContent: r.reason }) : null));
  }));
  const conf = $('#m-confidence');
  if (c.assessment) {
    const passed = c.assessment.checks.filter((r) => r.passed).length;
    conf.replaceChildren(
      `${passed} of ${c.assessment.checks.length} checks passed · confidence `,
      el('b', { textContent: `${Math.round(c.assessment.confidence * 100)}%` }),
      ` · reviewed by ${c.assessment.provider}`,
    );
  }
  conf.classList.toggle('is-hidden', !c.assessment);
}

function renderPolicy(c) {
  const a = c.assessment;
  const rules = [
    ['Funds held in PayPal', Boolean(c.payment?.authorizationId)],
    ['Every acceptance check passed', Boolean(a?.checks.every((r) => r.passed))],
    [`Confidence at least ${Math.round(state.threshold * 100)}%`, Boolean(a && a.confidence >= state.threshold)],
    ['Not released before', !c.releasedAt],
  ];
  $('#policy').replaceChildren(...rules.map(([text, ok]) => el('li', { className: ok ? '' : 'no', textContent: text })));
}

const EVENTS = {
  created: () => ['Milestone created', 'info'],
  order_created: (e) => ['PayPal order created', 'info', e.orderId],
  authorized: (e) => ['Funds held', 'good', e.authorizationId],
  assessed: (e) => [e.passed === e.total ? 'Evidence accepted' : 'Evidence rejected', e.passed === e.total ? 'good' : 'bad', `${e.passed}/${e.total} checks · ${Math.round(e.confidence * 100)}%`],
  captured: (e) => ['Payment released', 'good', e.captureId],
};

function renderTimeline(c) {
  $('#timeline').replaceChildren(...[...(c.events ?? [])].reverse().map((e) => {
    const [label, tone, detail] = (EVENTS[e.type] ?? (() => [e.type, '']))(e);
    return el('li', { className: tone },
      el('div', { className: 't-row' }, el('span', { className: 't-label', textContent: label }), el('time', { textContent: time(e.at) })),
      detail ? el('div', { className: 't-detail' }, /^[A-Z0-9]{10,}$/.test(detail) ? el('code', { textContent: detail }) : detail) : null);
  }));
}

function render(c) {
  state.contract = c;
  $('#create-form').classList.add('is-hidden');
  $('#milestone').classList.remove('is-hidden');
  $('#m-id').textContent = `MS-${c.id.slice(0, 6).toUpperCase()}`;
  $('#m-title').textContent = c.title;
  $('#m-amount').textContent = money(c);
  const pill = $('#m-status');
  pill.className = `pill ${c.status}`;
  pill.textContent = STATUS[c.status] ?? c.status;
  renderChecks(c);
  renderTimeline(c);

  const step = c.status === 'draft' ? 'fund'
    : c.status === 'released' ? 'done'
    : c.status === 'verified' ? 'release'
    : 'evidence';
  for (const name of ['fund', 'evidence', 'release', 'done']) $(`#step-${name}`).classList.toggle('is-hidden', name !== step);
  if (step === 'release') {
    renderPolicy(c);
    $('#release').textContent = `Release ${money(c)}`;
  }
  if (step === 'evidence') $('#submit-evidence').textContent = c.status === 'needs_review' ? 'Resubmit for review' : 'Submit for review';
  if (step === 'done') {
    $('#paid-amount').textContent = `${money(c)} paid out`;
    $('#paid-detail').textContent = `PayPal capture ${c.payment.captureId}`;
  }
  if (step === 'fund') $('#hold-funds').textContent = `Hold ${money(c)} with PayPal`;
  refreshLedger();
}

function reset() {
  state.contract = null;
  state.order = null;
  clearError();
  $('#milestone').classList.add('is-hidden');
  $('#create-form').classList.remove('is-hidden');
  $('#approval-link').classList.add('is-hidden');
  $('#hold-funds').classList.remove('is-hidden');
  $('#timeline').replaceChildren(el('li', { className: 'empty', textContent: 'Create a milestone to start.' }));
  $('#title').focus();
}

// --- ledger ----------------------------------------------------------------

const grid = window.agGrid?.createGrid($('#ledger-grid'), {
  rowData: [],
  domLayout: 'autoHeight',
  rowHeight: 44,
  suppressCellFocus: true,
  overlayNoRowsTemplate: '<span class="ledger-empty">No milestones yet.</span>',
  defaultColDef: { sortable: true, resizable: true, filter: true, flex: 1, minWidth: 110 },
  columnDefs: [
    { field: 'title', headerName: 'Milestone', flex: 2.2, minWidth: 240, tooltipValueGetter: (p) => p.data.assessment?.summary || p.value },
    { headerName: 'Amount', valueGetter: (p) => Number(p.data.amount), valueFormatter: (p) => money(p.data), filter: 'agNumberColumnFilter', maxWidth: 130 },
    { headerName: 'Status', field: 'status', cellRenderer: (p) => `<span class="pill ${p.value}">${STATUS[p.value] ?? p.value}</span>`, maxWidth: 150 },
    {
      headerName: 'Checks',
      maxWidth: 110,
      valueGetter: (p) => (p.data.assessment ? `${p.data.assessment.checks.filter((c) => c.passed).length}/${p.data.assessment.checks.length}` : '—'),
    },
    {
      headerName: 'Confidence',
      maxWidth: 130,
      valueGetter: (p) => (p.data.assessment ? Math.round(p.data.assessment.confidence * 100) : null),
      valueFormatter: (p) => (p.value == null ? '—' : `${p.value}%`),
      filter: 'agNumberColumnFilter',
    },
    { headerName: 'PayPal order', valueGetter: (p) => p.data.payment?.orderId ?? p.data.pendingOrderId ?? '—', cellClass: 'mono' },
    { headerName: 'Capture', valueGetter: (p) => p.data.payment?.captureId ?? '—', cellClass: 'mono' },
    { headerName: 'Updated', valueGetter: (p) => p.data.events?.at(-1)?.at, valueFormatter: (p) => (p.value ? time(p.value) : ''), sort: 'desc', maxWidth: 120, cellClass: 'mono' },
  ],
  onRowClicked: (e) => {
    clearError();
    render(e.data);
  },
});

async function refreshLedger() {
  if (!grid) return;
  try {
    const rows = await request('/contracts');
    grid.setGridOption('rowData', rows);
    $('#ledger-count').textContent = rows.length ? `${rows.length}` : '';
  } catch {
    // The ledger is a view; the workflow keeps working without it.
  }
}

// --- actions ---------------------------------------------------------------

$('#new-milestone').addEventListener('click', reset);

$('#create-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();
  await busy(event.submitter, 'Creating…', async () => {
    try {
      render(await request('/contracts', {
        method: 'POST',
        body: JSON.stringify({
          title: $('#title').value,
          amount: Number($('#amount').value),
          currency: $('#currency').value,
          acceptanceChecks: $('#checks').value.split('\n').map((v) => v.trim()).filter(Boolean),
        }),
      }));
    } catch (error) {
      showError(error);
    }
  });
});

$('#hold-funds').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  clearError();
  await busy(button, 'Creating PayPal order…', async () => {
    try {
      state.order = await request(`/contracts/${state.contract.id}/order`, { method: 'POST' });
      $('#approval-link').href = state.order.approveUrl;
      $('#approval-link').classList.remove('is-hidden');
      render(await request(`/contracts/${state.contract.id}`));
    } catch (error) {
      showError(error);
    }
  });
  if (state.order) button.classList.add('is-hidden');
});

$('#submit-evidence').addEventListener('click', async (event) => {
  clearError();
  await busy(event.currentTarget, 'Reviewing evidence…', async () => {
    try {
      render(await request(`/contracts/${state.contract.id}/evidence`, {
        method: 'POST',
        body: JSON.stringify({ description: $('#evidence').value }),
      }));
    } catch (error) {
      showError(error);
    }
  });
});

$('#release').addEventListener('click', async (event) => {
  clearError();
  await busy(event.currentTarget, 'Capturing…', async () => {
    try {
      render(await request(`/contracts/${state.contract.id}/release`, { method: 'POST' }));
    } catch (error) {
      showError(error);
    }
  });
});

async function resumeFromPayPal() {
  const params = new URLSearchParams(location.search);
  const id = params.get('contract');
  if (!id) return;
  history.replaceState(null, '', '/');
  try {
    let contract = await request(`/contracts/${id}`);
    render(contract);
    if (params.get('cancelled')) throw new Error('The PayPal approval was cancelled. Hold the funds again to retry.');
    if (contract.status !== 'draft' || !contract.pendingOrderId) return;
    $('#hold-funds').classList.add('is-hidden');
    $('#authorizing').classList.remove('is-hidden');
    contract = await request(`/contracts/${id}/authorize`, { method: 'POST', body: JSON.stringify({ orderId: contract.pendingOrderId }) });
    $('#authorizing').classList.add('is-hidden');
    render(contract);
  } catch (error) {
    $('#authorizing').classList.add('is-hidden');
    showError(error);
  }
}

refreshLedger();
resumeFromPayPal();

request('/health')
  .then((health) => {
    state.threshold = health.threshold ?? state.threshold;
    $('#verifier').textContent = health.aiConfigured ? `Verifier: ${health.aiModel}` : 'Verifier: deterministic demo';
  })
  .catch(() => {
    $('#verifier').textContent = 'Server unavailable';
  });
