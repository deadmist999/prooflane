export class PayPalClient {
  constructor({ baseUrl, clientId, clientSecret, fetchImpl = fetch }) {
    this.baseUrl = baseUrl ?? 'https://api-m.sandbox.paypal.com';
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.fetch = fetchImpl;
  }

  configured() {
    return Boolean(this.clientId && this.clientSecret);
  }

  async accessToken() {
    if (!this.configured()) throw new Error('PayPal sandbox credentials are not configured');
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const response = await this.fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    return this.#json(response, 'PayPal OAuth').then((body) => body.access_token);
  }

  async createAuthorizationOrder(contract, { returnUrl, cancelUrl } = {}) {
    const token = await this.accessToken();
    const order = {
      intent: 'AUTHORIZE',
      purchase_units: [{
        reference_id: contract.id,
        description: contract.title,
        amount: { currency_code: contract.currency, value: contract.amount },
      }],
    };
    if (returnUrl) {
      order.payment_source = {
        paypal: {
          experience_context: {
            brand_name: 'Prooflane',
            shipping_preference: 'NO_SHIPPING',
            user_action: 'CONTINUE',
            return_url: returnUrl,
            cancel_url: cancelUrl ?? returnUrl,
          },
        },
      };
    }
    const response = await this.fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: this.#headers(token),
      body: JSON.stringify(order),
    });
    const body = await this.#json(response, 'create PayPal order');
    return {
      orderId: body.id,
      approveUrl: body.links?.find((link) => link.rel === 'approve' || link.rel === 'payer-action')?.href ?? null,
      status: body.status,
    };
  }

  async authorizeOrder(orderId) {
    const token = await this.accessToken();
    const response = await this.fetch(`${this.baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`, {
      method: 'POST',
      headers: this.#headers(token),
      body: '{}',
    });
    const body = await this.#json(response, 'authorize PayPal order');
    const authorizationId = body.purchase_units?.[0]?.payments?.authorizations?.[0]?.id;
    if (!authorizationId) throw new Error('PayPal response did not include an authorization id');
    return { orderId, authorizationId, status: body.status };
  }

  async captureAuthorization(authorizationId) {
    const token = await this.accessToken();
    const response = await this.fetch(`${this.baseUrl}/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/capture`, {
      method: 'POST',
      headers: this.#headers(token),
      body: '{}',
    });
    return this.#json(response, 'capture PayPal authorization');
  }

  #headers(token) {
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  async #json(response, operation) {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = body.message ?? body.error_description ?? response.statusText;
      throw new Error(`${operation} failed (${response.status}): ${detail}`);
    }
    return body;
  }
}
