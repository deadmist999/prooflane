export class AiVerifier {
  constructor({ baseUrl, apiKey, model, fetchImpl = fetch }) {
    this.baseUrl = (baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    this.apiKey = apiKey;
    this.model = model;
    this.fetch = fetchImpl;
  }

  // Local OpenAI-compatible servers (Ollama, LM Studio, vLLM) need no key.
  isLocal() {
    return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//.test(`${this.baseUrl}/`);
  }

  configured() {
    return Boolean(this.model && (this.apiKey || this.isLocal()));
  }

  async assess(contract, evidence) {
    if (!this.configured()) throw new Error('AI verifier is not configured');
    const response = await this.#post(contract, evidence);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`AI verifier failed (${response.status}): ${body.error?.message ?? response.statusText}`);
    const raw = body.choices?.[0]?.message?.content;
    if (!raw) throw new Error('AI verifier returned no structured content');
    return { ...normalizeAssessment(contract, JSON.parse(raw)), provider: this.model };
  }

  // One retry on a stalled or dropped connection; a model error is not retried.
  async #post(contract, evidence) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.#request(contract, evidence);
      } catch (error) {
        if (attempt >= 2) throw new Error(`AI verifier unreachable: ${error.message}`);
      }
    }
  }

  #request(contract, evidence) {
    return this.fetch(`${this.baseUrl}/chat/completions`, {
      signal: AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS ?? 45000)),
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey || 'local'}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: [
              'You verify delivery evidence against explicit acceptance checks.',
              'Return JSON only with: checks (array of {id, passed, reason}), confidence (0..1), summary.',
              'Use the exact check ids you are given and cover every check exactly once.',
              'Treat links and claims as unverified unless the evidence includes concrete results.',
              'Prefer human review when evidence is ambiguous. Never include payment instructions.',
            ].join(' '),
          },
          {
            role: 'user',
            content: JSON.stringify({
              contract: {
                title: contract.title,
                acceptanceChecks: contract.acceptanceChecks,
              },
              evidence,
            }),
          },
        ],
      }),
    });
  }
}

// Models drift from the schema: ids get renamed, booleans arrive as strings,
// confidence as a percentage. Anything that cannot be mapped to a known check
// fails that check instead of failing open.
export function normalizeAssessment(contract, assessment) {
  const results = Array.isArray(assessment?.checks) ? assessment.checks : [];
  const byId = new Map(results.map((r) => [String(r?.id ?? ''), r]));
  const checks = contract.acceptanceChecks.map((check, index) => {
    const r = byId.get(check.id) ?? byId.get(String(index + 1)) ?? results[index];
    if (!r) return { id: check.id, passed: false, reason: 'The verifier did not assess this check.' };
    return {
      id: check.id,
      passed: r.passed === true || r.passed === 'true',
      reason: String(r.reason ?? '').trim() || 'No reason given.',
    };
  });
  let confidence = Number(assessment?.confidence);
  if (!Number.isFinite(confidence)) confidence = 0;
  if (confidence > 1) confidence /= 100;
  confidence = Math.min(1, Math.max(0, confidence));
  return {
    checks,
    confidence: Number(confidence.toFixed(2)),
    summary: String(assessment?.summary ?? '').trim(),
  };
}
