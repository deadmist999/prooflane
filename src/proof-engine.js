import { randomUUID } from 'node:crypto';

export function createContract({ title, amount, currency = 'USD', acceptanceChecks }) {
  if (!title?.trim()) throw new Error('title is required');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('amount must be positive');
  if (!Array.isArray(acceptanceChecks) || acceptanceChecks.length === 0) {
    throw new Error('at least one acceptance check is required');
  }

  return {
    id: randomUUID(),
    title: title.trim(),
    amount: amount.toFixed(2),
    currency,
    acceptanceChecks: acceptanceChecks.map((text, index) => ({
      id: `check-${index + 1}`,
      text: String(text).trim(),
    })),
    status: 'draft',
    payment: null,
    assessment: null,
    releasedAt: null,
  };
}

export function attachAuthorization(contract, payment) {
  if (!payment?.orderId || !payment?.authorizationId) {
    throw new Error('PayPal order and authorization ids are required');
  }
  if (contract.payment?.authorizationId && contract.payment.authorizationId !== payment.authorizationId) {
    throw new Error('contract already has a different authorization');
  }
  contract.payment = { ...payment };
  contract.status = 'authorized';
  return contract;
}

export function recordAssessment(contract, assessment) {
  const known = new Set(contract.acceptanceChecks.map((check) => check.id));
  if (!assessment || !Array.isArray(assessment.checks)) throw new Error('invalid assessment');
  if (assessment.checks.length !== known.size) throw new Error('assessment must cover every check');
  for (const result of assessment.checks) {
    if (!known.has(result.id)) throw new Error(`unknown check: ${result.id}`);
  }
  contract.assessment = assessment;
  contract.status = assessment.checks.every((check) => check.passed) ? 'verified' : 'needs_review';
  return contract;
}

export function releaseDecision(contract, threshold = 0.9) {
  if (contract.releasedAt) return { allowed: false, reason: 'already_released' };
  if (!contract.payment?.authorizationId) return { allowed: false, reason: 'not_authorized' };
  if (!contract.assessment) return { allowed: false, reason: 'not_assessed' };
  if (!contract.assessment.checks.every((check) => check.passed)) {
    return { allowed: false, reason: 'acceptance_check_failed' };
  }
  if (contract.assessment.confidence < threshold) {
    return { allowed: false, reason: 'confidence_below_threshold' };
  }
  return { allowed: true, reason: 'verified' };
}

export function demoAssess(contract, evidence) {
  const normalized = String(evidence?.description ?? '').toLowerCase();
  const checks = contract.acceptanceChecks.map((check) => {
    const meaningfulWords = check.text.toLowerCase().split(/\W+/).filter((word) => word.length >= 5);
    const matches = meaningfulWords.filter((word) => normalized.includes(word));
    const passed = meaningfulWords.length > 0 && matches.length / meaningfulWords.length >= 0.5;
    return {
      id: check.id,
      passed,
      reason: passed ? `Evidence mentions: ${matches.join(', ')}` : 'Evidence does not substantiate this check.',
    };
  });
  const passRatio = checks.filter((check) => check.passed).length / checks.length;
  return {
    provider: 'demo-verifier',
    checks,
    confidence: Number((0.55 + passRatio * 0.4).toFixed(2)),
    summary: checks.every((check) => check.passed) ? 'All checks have supporting evidence.' : 'Human review is required.',
  };
}
