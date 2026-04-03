import { Hono } from 'hono';
import type { Env } from '../index.js';

export const health = new Hono<Env>();

health.get('/api/health', (c) => {
  return c.json({ success: true, data: { status: 'ok', service: 'note-harness' } });
});
