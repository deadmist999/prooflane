export class AiVerifier {
  constructor({ baseUrl, apiKey, model, fetchImpl = fetch }) {
    this.baseUrl = (baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    this.apiKey = apiKey;
    this.model = model;
    this.fetch = fetchImpl;
  }

  configured() {
    return Boolean(this.apiKey && this.model);
  }

  async assess(contract, evidence) {
    if (!this.configured()) throw new Error('AI verifier is not configured');
    const response = await this.fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
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
              'Cover every supplied check exactly once. Treat links and claims as unverified unless the evidence includes concrete results.',
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
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`AI verifier failed (${response.status}): ${body.error?.message ?? response.statusText}`);
    const raw = body.choices?.[0]?.message?.content;
    if (!raw) throw new Error('AI verifier returned no structured content');
    const assessment = JSON.parse(raw);
    return { ...assessment, provider: this.model };
  }
}
