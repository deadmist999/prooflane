import test from 'node:test';
import assert from 'node:assert/strict';
import { createContract, attachAuthorization, recordAssessment, releaseDecision } from '../src/proof-engine.js';

function contract() {
  return createContract({ title: 'Deliver tested export', amount: 100, acceptanceChecks: ['Tests pass', 'Export is documented'] });
}

test('cannot release without a PayPal authorization', () => {
  const item = contract();
  recordAssessment(item, {
    confidence: 0.99,
    checks: item.acceptanceChecks.map(({ id }) => ({ id, passed: true })),
  });
  assert.deepEqual(releaseDecision(item), { allowed: false, reason: 'not_authorized' });
});

test('cannot release when an acceptance check failed', () => {
  const item = contract();
  attachAuthorization(item, { orderId: 'ORDER-1', authorizationId: 'AUTH-1' });
  recordAssessment(item, {
    confidence: 0.99,
    checks: item.acceptanceChecks.map(({ id }, index) => ({ id, passed: index === 0 })),
  });
  assert.deepEqual(releaseDecision(item), { allowed: false, reason: 'acceptance_check_failed' });
});

test('allows one high-confidence verified release', () => {
  const item = contract();
  attachAuthorization(item, { orderId: 'ORDER-1', authorizationId: 'AUTH-1' });
  recordAssessment(item, {
    confidence: 0.94,
    checks: item.acceptanceChecks.map(({ id }) => ({ id, passed: true })),
  });
  assert.deepEqual(releaseDecision(item), { allowed: true, reason: 'verified' });
  item.releasedAt = new Date().toISOString();
  assert.deepEqual(releaseDecision(item), { allowed: false, reason: 'already_released' });
});
