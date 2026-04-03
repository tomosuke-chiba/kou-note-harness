import { Hono } from 'hono';
import type { Env } from '../index.js';
import type { ContentGate, GateUnlock } from '@note-harness/shared';

export const content = new Hono<Env>();

// Serve gated content only to verified unlock tokens
content.get('/api/gate/content', async (c) => {
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
    return c.json({ success: false, error: 'Gate not found' }, 404);
  }

  // Verify the unlock token
  const unlock = await c.env.DB.prepare(
    'SELECT * FROM gate_unlocks WHERE gate_id = ? AND unlock_token = ?',
  )
    .bind(gate.id, token)
    .first<GateUnlock>();

  if (!unlock) {
    return c.json({ success: false, error: 'Invalid or expired unlock token' }, 403);
  }

  // Fetch gated HTML from KV/R2 or return stored content
  // For MVP, gated content is stored in a simple table
  const gatedContent = await c.env.DB.prepare(
    'SELECT html FROM gated_content WHERE slug = ?',
  )
    .bind(slug)
    .first<{ html: string }>();

  if (!gatedContent) {
    return c.json({ success: false, error: 'Gated content not found' }, 404);
  }

  return c.json({ success: true, data: { html: gatedContent.html } });
});

// Admin: upload gated content — single or batch
content.post('/api/gate/content', async (c) => {
  const body = await c.req.json();

  // Batch upload: array of { slug, html }
  const items: { slug: string; html: string }[] = Array.isArray(body) ? body : [body];

  // Validate all items before writing any
  for (const item of items) {
    if (!item.slug || !item.html) {
      return c.json({ success: false, error: `slug and html are required (invalid item: ${JSON.stringify(item).slice(0, 100)})` }, 400);
    }
  }

  for (const item of items) {
    await c.env.DB.prepare(
      `INSERT INTO gated_content (id, slug, html, updated_at)
       VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%f', 'now'))
       ON CONFLICT(slug) DO UPDATE SET html = excluded.html, updated_at = excluded.updated_at`,
    )
      .bind(crypto.randomUUID(), item.slug, item.html)
      .run();
  }

  return c.json({ success: true, data: { uploaded: items.length } });
});
