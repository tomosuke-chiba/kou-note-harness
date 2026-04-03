import { Hono } from 'hono';
import type { Env } from '../index.js';
import type { ContentGate, GateUnlock } from '@note-harness/shared';
import { verifyXHarnessUnlock, verifyLineHarnessUnlock } from '../services/unlock.js';

export const gatePublic = new Hono<Env>();

// Check unlock status
gatePublic.get('/api/gate/check', async (c) => {
  const slug = c.req.query('slug');
  const token = c.req.query('token');

  if (!slug || !token) {
    return c.json({ success: false, error: 'slug and token are required' }, 400);
  }

  const gate = await c.env.DB.prepare(
    'SELECT * FROM content_gates WHERE slug = ? AND is_active = 1',
  )
    .bind(slug)
    .first<ContentGate>();

  if (!gate) {
    return c.json({ success: true, data: { unlocked: false, reason: 'no_gate' } });
  }

  const unlock = await c.env.DB.prepare(
    'SELECT * FROM gate_unlocks WHERE gate_id = ? AND unlock_token = ?',
  )
    .bind(gate.id, token)
    .first<GateUnlock>();

  return c.json({ success: true, data: { unlocked: !!unlock } });
});

// Get gate config for frontend
gatePublic.get('/api/gate/config', async (c) => {
  const slug = c.req.query('slug');

  if (!slug) {
    return c.json({ success: false, error: 'slug is required' }, 400);
  }

  const gate = await c.env.DB.prepare(
    'SELECT slug, gate_type, cta_text, cta_url, preview_paragraphs, stripe_price_cents, stripe_currency, compound_steps FROM content_gates WHERE slug = ? AND is_active = 1',
  )
    .bind(slug)
    .first();

  if (!gate) {
    return c.json({ success: true, data: null });
  }

  return c.json({ success: true, data: gate });
});

// Unlock gate
gatePublic.post('/api/gate/unlock', async (c) => {
  const body = await c.req.json();
  const { slug } = body;

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

  // For compound gates, individual steps are unlocked with step + sessionId
  const sessionId = body.sessionId as string | undefined;
  const step = body.step as string | undefined;
  const effectiveGateType = (gate.gate_type === 'compound' && step) ? step : gate.gate_type;

  let sourceType: string;
  let sourceUserId: string | null = sessionId ?? null;
  let sourceUsername: string | null = null;

  switch (effectiveGateType) {
    case 'x_engagement': {
      const { xHarnessToken } = body;
      if (!xHarnessToken || !gate.x_harness_url || !gate.x_gate_id) {
        return c.json({ success: false, error: 'X Harness token required' }, 400);
      }
      const result = await verifyXHarnessUnlock(
        gate.x_harness_url,
        gate.x_harness_api_key,
        gate.x_gate_id,
        xHarnessToken,
      );
      if (!result.verified) {
        return c.json({ success: false, error: 'X engagement not verified' }, 403);
      }
      sourceType = 'x_harness';
      sourceUsername = result.username ?? null;
      break;
    }
    case 'line_friend': {
      const { lineUnlockToken } = body;
      if (!lineUnlockToken) {
        return c.json({ success: false, error: 'LINE unlock token required' }, 400);
      }
      const result = await verifyLineHarnessUnlock(lineUnlockToken, gate);
      if (!result.verified) {
        return c.json({ success: false, error: 'LINE friend verification failed' }, 403);
      }
      sourceType = 'line_harness';
      sourceUserId = result.userId ?? null;
      break;
    }
    case 'token': {
      const { accessToken } = body;
      if (!accessToken) {
        return c.json({ success: false, error: 'Access token required' }, 400);
      }
      // Check if token exists as a pre-created unlock
      const existing = await c.env.DB.prepare(
        'SELECT * FROM gate_unlocks WHERE gate_id = ? AND unlock_token = ? AND source_type = ?',
      )
        .bind(gate.id, accessToken, 'token')
        .first();
      if (!existing) {
        return c.json({ success: false, error: 'Invalid access token' }, 403);
      }
      return c.json({ success: true, data: { unlock_token: accessToken } });
    }
    case 'stripe': {
      // Stripe unlocks are handled via /api/gate/checkout → Stripe Checkout → redirect with unlock_token
      // This endpoint just verifies an existing stripe unlock token
      const { stripeUnlockToken } = body;
      if (!stripeUnlockToken) {
        return c.json({ success: false, error: 'Use /api/gate/checkout to initiate payment' }, 400);
      }
      const stripeUnlock = await c.env.DB.prepare(
        "SELECT * FROM gate_unlocks WHERE gate_id = ? AND unlock_token = ? AND source_type = 'stripe'",
      )
        .bind(gate.id, stripeUnlockToken)
        .first();
      if (!stripeUnlock) {
        return c.json({ success: false, error: 'Invalid stripe unlock token' }, 403);
      }
      return c.json({ success: true, data: { unlock_token: stripeUnlockToken } });
    }
    case 'compound': {
      // Compound gate: check steps completed by THIS reader (identified by session_id)
      const { sessionId } = body;
      if (!sessionId) {
        return c.json({ success: false, error: 'sessionId is required for compound gates' }, 400);
      }

      const steps = gate.compound_steps ? (JSON.parse(gate.compound_steps) as string[]) : [];
      const completedSources = await c.env.DB.prepare(
        'SELECT DISTINCT source_type FROM gate_unlocks WHERE gate_id = ? AND source_user_id = ?',
      )
        .bind(gate.id, sessionId)
        .all<{ source_type: string }>();
      const completedTypes = new Set(completedSources.results.map((r) => r.source_type));

      const stepToSource: Record<string, string> = {
        x_engagement: 'x_harness',
        line_friend: 'line_harness',
        stripe: 'stripe',
        token: 'token',
      };

      const allComplete = steps.every((step) => completedTypes.has(stepToSource[step] ?? step));
      if (!allComplete) {
        const remaining = steps.filter((step) => !completedTypes.has(stepToSource[step] ?? step));
        return c.json({
          success: false,
          error: 'Not all steps completed',
          data: { remaining, completed: Array.from(completedTypes) },
        }, 403);
      }

      const compoundToken = crypto.randomUUID();
      await c.env.DB.prepare(
        "INSERT INTO gate_unlocks (id, gate_id, unlock_token, source_type, source_user_id) VALUES (?, ?, ?, 'manual', ?)",
      )
        .bind(crypto.randomUUID(), gate.id, compoundToken, sessionId)
        .run();

      return c.json({ success: true, data: { unlock_token: compoundToken } });
    }
    default:
      return c.json({ success: false, error: 'Unknown gate type' }, 400);
  }

  // Create unlock record
  const unlockToken = crypto.randomUUID();
  const id = crypto.randomUUID();

  await c.env.DB.prepare(
    'INSERT INTO gate_unlocks (id, gate_id, unlock_token, source_type, source_user_id, source_username) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(id, gate.id, unlockToken, sourceType, sourceUserId, sourceUsername)
    .run();

  return c.json({ success: true, data: { unlock_token: unlockToken } });
});
