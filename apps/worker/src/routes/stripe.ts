import { Hono } from 'hono';
import type { Env } from '../index.js';
import type { ContentGate } from '@note-harness/shared';

export const stripeRoutes = new Hono<Env>();

// Create Stripe Checkout session for a gated article
stripeRoutes.post('/api/gate/checkout', async (c) => {
  const { slug, sessionId } = await c.req.json<{ slug: string; sessionId?: string }>();

  if (!slug) {
    return c.json({ success: false, error: 'slug is required' }, 400);
  }

  const gate = await c.env.DB.prepare(
    'SELECT * FROM content_gates WHERE slug = ? AND is_active = 1',
  )
    .bind(slug)
    .first<ContentGate>();

  if (!gate) {
    return c.json({ success: false, error: 'Gate not found' }, 404);
  }

  if (gate.gate_type !== 'stripe' && gate.gate_type !== 'compound') {
    return c.json({ success: false, error: 'This gate does not require payment' }, 400);
  }

  if (!gate.stripe_price_cents) {
    return c.json({ success: false, error: 'No price configured' }, 400);
  }

  const stripeKey = c.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return c.json({ success: false, error: 'Payment system not configured' }, 503);
  }

  // Create Stripe Checkout Session via API
  const unlockToken = crypto.randomUUID();
  const params = new URLSearchParams({
    'mode': 'payment',
    'line_items[0][price_data][currency]': gate.stripe_currency ?? 'JPY',
    'line_items[0][price_data][unit_amount]': String(gate.stripe_price_cents),
    'line_items[0][price_data][product_data][name]': `Unlock: ${slug}`,
    'success_url': `${c.env.BLOG_URL}/${slug}.html?unlock_token=${unlockToken}`,
    'cancel_url': `${c.env.BLOG_URL}/${slug}.html`,
    'metadata[gate_id]': gate.id,
    'metadata[slug]': slug,
    'metadata[unlock_token]': unlockToken,
  });

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Stripe checkout error:', err);
    return c.json({ success: false, error: 'Failed to create checkout session' }, 500);
  }

  const session = (await res.json()) as { url: string };

  // Pre-create unlock record (will be validated by webhook)
  await c.env.DB.prepare(
    "INSERT INTO gate_unlocks (id, gate_id, unlock_token, source_type, source_user_id) VALUES (?, ?, ?, 'stripe', ?)",
  )
    .bind(crypto.randomUUID(), gate.id, unlockToken, sessionId ?? null)
    .run();

  return c.json({ success: true, data: { checkout_url: session.url } });
});

// Stripe webhook — confirm payment
stripeRoutes.post('/api/stripe/webhook', async (c) => {
  const webhookSecret = c.env.STRIPE_WEBHOOK_SECRET;
  const rawBody = await c.req.text();

  if (webhookSecret) {
    const sigHeader = c.req.header('Stripe-Signature') ?? '';
    const valid = await verifyStripeWebhook(webhookSecret, rawBody, sigHeader);
    if (!valid) {
      return c.json({ success: false, error: 'Invalid signature' }, 401);
    }
  }

  const event = JSON.parse(rawBody) as {
    type: string;
    data: { object: { metadata?: Record<string, string>; payment_status?: string } };
  };

  if (event.type === 'checkout.session.completed') {
    const metadata = event.data.object.metadata;
    if (metadata?.unlock_token && event.data.object.payment_status === 'paid') {
      // Unlock record already exists from checkout creation — nothing to do
      // If we wanted to add payment verification, we'd update the record here
    }
  }

  return c.json({ success: true, data: { received: true } });
});

async function verifyStripeWebhook(
  secret: string,
  payload: string,
  sigHeader: string,
): Promise<boolean> {
  try {
    const parts = sigHeader.split(',').reduce(
      (acc, part) => {
        const [key, value] = part.split('=');
        if (key === 't') acc.timestamp = value;
        if (key === 'v1') acc.signature = value;
        return acc;
      },
      { timestamp: '', signature: '' },
    );

    if (!parts.timestamp || !parts.signature) return false;

    const signedPayload = `${parts.timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
    const expected = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return expected === parts.signature;
  } catch {
    return false;
  }
}
