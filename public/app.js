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

function activate(name) {
  Object.entries(stages).forEach(([key, element]) => element.classList.toggle('is-active', key === name));
  const items = [...document.querySelectorAll('[data-step]')];
  const current = items.findIndex((item) => item.dataset.step === name);
  items.forEach((item, index) => {
    item.classList.toggle('is-current', index === current);
    item.classList.toggle('is-complete', index < current);
  });
}

function updateResult(contract) {
  state.contract = contract;
  $('#result').classList.remove('is-hidden');
  $('#result-status').textContent = contract.status;
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
    row.className = 'check';
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
  const rows = assessment.checks.map((check) => createCheck(check.passed, check.id, check.reason));
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
  clearError();
  setBusy(event.currentTarget, true, 'Contacting PayPal…');
  try {
    state.order = await request(`/contracts/${state.contract.id}/order`, { method: 'POST' });
    const link = $('#approval-link');
    link.href = state.order.approveUrl;
    link.classList.remove('is-hidden');
    $('#authorize-order').classList.remove('is-hidden');
    event.currentTarget.classList.add('is-hidden');
  } catch (error) {
    showError(error);
    setBusy(event.currentTarget, false);
  }
});

$('#authorize-order').addEventListener('click', async (event) => {
  clearError();
  setBusy(event.currentTarget, true, 'Authorizing…');
  try {
    const contract = await request(`/contracts/${state.contract.id}/authorize`, {
      method: 'POST',
      body: JSON.stringify({ orderId: state.order.orderId }),
    });
    updateResult(contract);
    activate('evidence');
  } catch (error) {
    showError(error);
    setBusy(event.currentTarget, false);
  }
});

$('#verify-evidence').addEventListener('click', async (event) => {
  clearError();
  setBusy(event.currentTarget, true, 'Reviewing evidence…');
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
    setBusy(event.currentTarget, false);
  }
});

$('#release-payment').addEventListener('click', async (event) => {
  clearError();
  setBusy(event.currentTarget, true, 'Capturing…');
  try {
    const contract = await request(`/contracts/${state.contract.id}/release`, { method: 'POST' });
    updateResult(contract);
    event.currentTarget.textContent = 'Payment captured ✓';
    event.currentTarget.disabled = true;
  } catch (error) {
    showError(error);
    setBusy(event.currentTarget, false);
  }
});

request('/health')
  .then((health) => {
    $('#verifier-mode').textContent = health.aiConfigured ? 'Structured AI verifier' : 'Deterministic demo verifier';
  })
  .catch(() => {
    $('#verifier-mode').textContent = 'Server unavailable';
  });
