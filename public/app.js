const state = { contract: null, order: null };

const $ = (selector) => document.querySelector(selector);
const stages = {
  contract: $('#contract-form'),
  order: $('#order-stage'),
  evidence: $('#evidence-stage'),
  release: $('#release-stage'),
};

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body;
}

function showError(error) {
  const element = $('#error');
  element.textContent = error.message;
  element.classList.remove('is-hidden');
}

function clearError() {
  $('#error').classList.add('is-hidden');
}

function setBusy(button, busy, label) {
  button.disabled = busy;
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = label;
  } else if (button.dataset.label) {
    button.textContent = button.dataset.label;
  }
}

const titles = {
  contract: ['New milestone', 'Define what “done” means'],
  order: ['Payment', 'Reserve the funds first'],
  evidence: ['Delivery', 'Prove the work is done'],
  release: ['Decision', 'Policy has the final word'],
};

function activate(name) {
  const [kicker, title] = titles[name];
  $('.panel-head .kicker').textContent = kicker;
  $('#panel-title').textContent = title;
  $('#retry-evidence').classList.toggle('is-hidden', !(name === 'release' && state.contract?.status === 'needs_review'));
  Object.entries(stages).forEach(([key, element]) => element.classList.toggle('is-active', key === name));
  const items = [...document.querySelectorAll('[data-step]')];
  const current = items.findIndex((item) => item.dataset.step === name);
  items.forEach((item, index) => {
    item.classList.toggle('is-current', index === current);
    item.classList.toggle('is-complete', index < current);
  });
}

const grid = window.agGrid?.createGrid(document.querySelector('#ledger-grid'), {
  rowData: [],
  domLayout: 'autoHeight',
  overlayNoRowsTemplate: '<span class="ledger-empty">Contracts you create appear here.</span>',
  defaultColDef: { sortable: true, resizable: true, filter: true, flex: 1, minWidth: 110 },
  columnDefs: [
    { field: 'title', headerName: 'Milestone', flex: 2, minWidth: 220, tooltipValueGetter: (p) => p.data.assessment?.summary || p.value },
    { headerName: 'Amount', valueGetter: (p) => Number(p.data.amount), valueFormatter: (p) => `${p.data.currency} ${p.data.amount}`, filter: 'agNumberColumnFilter' },
    { field: 'status', cellRenderer: (p) => `<span class="pill pill-${p.value}">${p.value.replace('_', ' ')}</span>` },
    {
      headerName: 'Checks',
      valueGetter: (p) => (p.data.assessment ? `${p.data.assessment.checks.filter((c) => c.passed).length}/${p.data.assessment.checks.length}` : `0/${p.data.acceptanceChecks.length}`),
    },
    {
      headerName: 'Confidence',
      valueGetter: (p) => (p.data.assessment ? Math.round(p.data.assessment.confidence * 100) : null),
      cellRenderer: (p) => (p.value == null ? '—' : `<span class="meter"><i style="width:${p.value}%"></i></span>${p.value}%`),
      filter: 'agNumberColumnFilter',
    },
    { headerName: 'Verifier', valueGetter: (p) => p.data.assessment?.provider ?? '—' },
    { headerName: 'PayPal order', valueGetter: (p) => p.data.payment?.orderId ?? '—', minWidth: 170 },
    { headerName: 'Capture', valueGetter: (p) => p.data.payment?.captureId ?? '—', minWidth: 170 },
  ],
});

async function refreshLedger() {
  if (!grid) return;
  try {
    grid.setGridOption('rowData', await request('/contracts'));
  } catch {
    // The ledger is a view; the workflow keeps working without it.
  }
}

function updateResult(contract) {
  state.contract = contract;
  refreshLedger();
  $('#result').classList.remove('is-hidden');
  $('#result-status').textContent = contract.status.replace('_', ' ');
  const fields = [
    ['Contract', contract.id],
    ['Amount', `${contract.currency} ${contract.amount}`],
    ['Order', contract.payment?.orderId],
    ['Authorization', contract.payment?.authorizationId],
    ['Capture', contract.payment?.captureId],
    ['Confidence', contract.assessment ? `${Math.round(contract.assessment.confidence * 100)}%` : null],
  ].filter(([, value]) => value);
  const metadata = $('#result-meta');
  metadata.replaceChildren(...fields.map(([label, value]) => {
    const row = document.createElement('div');
    const term = document.createElement('dt');
    const detail = document.createElement('dd');
    term.textContent = label;
    detail.textContent = value;
    row.append(term, detail);
    return row;
  }));
}

function renderDecision(assessment) {
  const createCheck = (passed, title, reason) => {
    const row = document.createElement('div');
    row.className = `check ${passed ? 'is-pass' : 'is-fail'}`;
    const mark = document.createElement('span');
    mark.className = 'check-mark';
    mark.textContent = passed ? '✓' : '×';
    const copy = document.createElement('div');
    const heading = document.createElement('strong');
    const explanation = document.createElement('p');
    heading.textContent = title;
    explanation.textContent = reason;
    copy.append(heading, explanation);
    row.append(mark, copy);
    return row;
  };
  const texts = new Map(state.contract.acceptanceChecks.map((c) => [c.id, c.text]));
  const rows = assessment.checks.map((check) => createCheck(check.passed, texts.get(check.id) ?? check.id, check.reason));
  rows.push(createCheck(
    assessment.confidence >= 0.9,
    `Confidence ${Math.round(assessment.confidence * 100)}%`,
    'Automatic release threshold: 90%',
  ));
  $('#decision').replaceChildren(...rows);
}

$('#contract-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();
  const button = event.submitter;
  setBusy(button, true, 'Creating…');
  try {
    const contract = await request('/contracts', {
      method: 'POST',
      body: JSON.stringify({
        title: $('#title').value,
        amount: Number($('#amount').value),
        currency: $('#currency').value,
        acceptanceChecks: $('#checks').value.split('\n').map((value) => value.trim()).filter(Boolean),
      }),
    });
    updateResult(contract);
    activate('order');
  } catch (error) {
    showError(error);
  } finally {
    setBusy(button, false);
  }
});

$('#create-order').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  clearError();
  setBusy(button, true, 'Contacting PayPal…');
  try {
    state.order = await request(`/contracts/${state.contract.id}/order`, { method: 'POST' });
    const link = $('#approval-link');
    link.href = state.order.approveUrl;
    link.classList.remove('is-hidden');
    $('#authorize-order').classList.remove('is-hidden');
    button.classList.add('is-hidden');
  } catch (error) {
    showError(error);
    setBusy(button, false);
  }
});

$('#authorize-order').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  clearError();
  setBusy(button, true, 'Authorizing…');
  try {
    const contract = await request(`/contracts/${state.contract.id}/authorize`, {
      method: 'POST',
      body: JSON.stringify({ orderId: state.order.orderId }),
    });
    updateResult(contract);
    activate('evidence');
  } catch (error) {
    showError(error);
    setBusy(button, false);
  }
});

$('#verify-evidence').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  clearError();
  setBusy(button, true, 'Reviewing evidence…');
  try {
    const contract = await request(`/contracts/${state.contract.id}/evidence`, {
      method: 'POST',
      body: JSON.stringify({ description: $('#evidence').value }),
    });
    updateResult(contract);
    renderDecision(contract.assessment);
    activate('release');
    $('#release-payment').disabled = contract.status !== 'verified';
  } catch (error) {
    showError(error);
  } finally {
    setBusy(button, false);
  }
});

$('#release-payment').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  clearError();
  setBusy(button, true, 'Capturing…');
  try {
    const contract = await request(`/contracts/${state.contract.id}/release`, { method: 'POST' });
    updateResult(contract);
    button.textContent = 'Payment captured ✓';
    button.disabled = true;
  } catch (error) {
    showError(error);
    setBusy(button, false);
  }
});

$('#retry-evidence').addEventListener('click', () => {
  clearError();
  activate('evidence');
  $('#evidence').focus();
});

async function resumeFromPayPal() {
  const params = new URLSearchParams(location.search);
  const id = params.get('contract');
  if (!id) return;
  history.replaceState(null, '', '/');
  try {
    const contract = await request(`/contracts/${id}`);
    updateResult(contract);
    if (params.get('cancelled')) {
      activate('order');
      throw new Error('The PayPal approval was cancelled. Create a new order to try again.');
    }
    if (contract.status !== 'draft' || !contract.pendingOrderId) return;
    state.order = { orderId: contract.pendingOrderId };
    activate('order');
    $('#create-order').classList.add('is-hidden');
    const button = $('#authorize-order');
    button.classList.remove('is-hidden');
    button.click();
  } catch (error) {
    showError(error);
  }
}

refreshLedger();
resumeFromPayPal();

request('/health')
  .then((health) => {
    $('#verifier-mode').textContent = health.aiConfigured ? `AI verifier · ${health.aiModel}` : 'Deterministic demo verifier';
  })
  .catch(() => {
    $('#verifier-mode').textContent = 'Server unavailable';
  });
