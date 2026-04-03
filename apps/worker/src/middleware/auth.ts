import type { Context, Next } from 'hono';
import type { Env } from '../index.js';

const PUBLIC_PATHS = [
  '/api/health',
  '/api/gate/check',
  '/api/gate/unlock',
  '/api/gate/checkout',
  '/api/gate/config',
  '/api/stripe/webhook',
  '/api/analytics/pageview',
];

// GET-only public paths (POST requires auth)
const PUBLIC_GET_PATHS = [
  '/api/gate/content',
];

export async function authMiddleware(c: Context<Env>, next: Next): Promise<Response | void> {
  const path = new URL(c.req.url).pathname;

  if (PUBLIC_PATHS.some((p) => path.startsWith(p))) {
    return next();
  }

  if (c.req.method === 'GET' && PUBLIC_GET_PATHS.some((p) => path.startsWith(p))) {
    return next();
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice('Bearer '.length);
  if (token !== c.env.API_KEY) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  return next();
}
