import { Hono } from 'hono';
import type { Env } from '../index.js';
import type { ContentGate } from '@note-harness/shared';

export const gates = new Hono<Env>();

// Create gate
gates.post('/api/gates', async (c) => {
  const body = await c.req.json();
  const { slug, gate_type } = body;

  if (!slug || !gate_type) {
    return c.json({ success: false, error: 'slug and gate_type are required' }, 400);
  }

  if (!['x_engagement', 'line_friend', 'token', 'stripe', 'compound'].includes(gate_type)) {
    return c.json({ success: false, error: 'Invalid gate_type' }, 400);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO content_gates (id, slug, gate_type, x_harness_url, x_harness_api_key, x_gate_id,
      line_harness_url, line_harness_api_key, line_tracked_link_id,
      stripe_price_cents, stripe_currency, compound_steps,
      preview_paragraphs, cta_text, cta_url, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      slug,
      gate_type,
      body.x_harness_url ?? null,
      body.x_harness_api_key ?? null,
      body.x_gate_id ?? null,
      body.line_harness_url ?? null,
      body.line_harness_api_key ?? null,
      body.line_tracked_link_id ?? null,
      body.stripe_price_cents ?? null,
      body.stripe_currency ?? 'JPY',
      body.compound_steps ? JSON.stringify(body.compound_steps) : null,
      body.preview_paragraphs ?? 3,
      body.cta_text ?? 'Unlock full article',
      body.cta_url ?? null,
      body.is_active ?? 1,
      now,
      now,
    )
    .run();

  const gate = await c.env.DB.prepare('SELECT * FROM content_gates WHERE id = ?').bind(id).first<ContentGate>();
  return c.json({ success: true, data: gate }, 201);
});

// List gates
gates.get('/api/gates', async (c) => {
  const result = await c.env.DB.prepare('SELECT * FROM content_gates ORDER BY created_at DESC').all<ContentGate>();
  return c.json({ success: true, data: result.results });
});

// Get gate
gates.get('/api/gates/:id', async (c) => {
  const gate = await c.env.DB.prepare('SELECT * FROM content_gates WHERE id = ?')
    .bind(c.req.param('id'))
    .first<ContentGate>();

  if (!gate) {
    return c.json({ success: false, error: 'Gate not found' }, 404);
  }
  return c.json({ success: true, data: gate });
});

// Update gate
gates.put('/api/gates/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT * FROM content_gates WHERE id = ?').bind(id).first<ContentGate>();

  if (!existing) {
    return c.json({ success: false, error: 'Gate not found' }, 404);
  }

  const body = await c.req.json();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `UPDATE content_gates SET
      slug = ?, gate_type = ?, x_harness_url = ?, x_harness_api_key = ?, x_gate_id = ?,
      line_harness_url = ?, line_harness_api_key = ?, line_tracked_link_id = ?,
      stripe_price_cents = ?, stripe_currency = ?, compound_steps = ?,
      preview_paragraphs = ?, cta_text = ?, cta_url = ?, is_active = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      body.slug ?? existing.slug,
      body.gate_type ?? existing.gate_type,
      'x_harness_url' in body ? body.x_harness_url : existing.x_harness_url,
      'x_harness_api_key' in body ? body.x_harness_api_key : existing.x_harness_api_key,
      'x_gate_id' in body ? body.x_gate_id : existing.x_gate_id,
      'line_harness_url' in body ? body.line_harness_url : existing.line_harness_url,
      'line_harness_api_key' in body ? body.line_harness_api_key : existing.line_harness_api_key,
      'line_tracked_link_id' in body ? body.line_tracked_link_id : existing.line_tracked_link_id,
      'stripe_price_cents' in body ? body.stripe_price_cents : existing.stripe_price_cents,
      body.stripe_currency ?? existing.stripe_currency,
      'compound_steps' in body ? (body.compound_steps ? JSON.stringify(body.compound_steps) : null) : existing.compound_steps,
      body.preview_paragraphs ?? existing.preview_paragraphs,
      body.cta_text ?? existing.cta_text,
      'cta_url' in body ? body.cta_url : existing.cta_url,
      body.is_active ?? existing.is_active,
      now,
      id,
    )
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM content_gates WHERE id = ?').bind(id).first<ContentGate>();
  return c.json({ success: true, data: updated });
});

// Delete gate
gates.delete('/api/gates/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT * FROM content_gates WHERE id = ?').bind(id).first<ContentGate>();

  if (!existing) {
    return c.json({ success: false, error: 'Gate not found' }, 404);
  }

  await c.env.DB.prepare('DELETE FROM content_gates WHERE id = ?').bind(id).run();
  return c.json({ success: true, data: { deleted: true } });
});

// List unlocks for a gate
gates.get('/api/gates/:id/unlocks', async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT * FROM content_gates WHERE id = ?').bind(id).first<ContentGate>();

  if (!existing) {
    return c.json({ success: false, error: 'Gate not found' }, 404);
  }

  const result = await c.env.DB.prepare(
    'SELECT * FROM gate_unlocks WHERE gate_id = ? ORDER BY created_at DESC',
  )
    .bind(id)
    .all();

  return c.json({ success: true, data: result.results });
});
