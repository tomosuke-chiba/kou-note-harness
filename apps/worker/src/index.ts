import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware } from './middleware/auth.js';
import { health } from './routes/health.js';
import { gates } from './routes/gates.js';
import { gatePublic } from './routes/gate-public.js';
import { stripeRoutes } from './routes/stripe.js';
import { content } from './routes/content.js';
import { analytics } from './routes/analytics.js';

export type Env = {
  Bindings: {
    DB: D1Database;
    API_KEY: string;
    BLOG_URL: string;
    STRIPE_SECRET_KEY?: string;
    STRIPE_WEBHOOK_SECRET?: string;
  };
};

const app = new Hono<Env>();

app.use('*', cors({ origin: '*' }));
app.use('*', authMiddleware);

app.route('/', health);
app.route('/', gates);
app.route('/', gatePublic);
app.route('/', stripeRoutes);
app.route('/', content);
app.route('/', analytics);

app.notFound((c) => c.json({ success: false, error: 'Not found' }, 404));

export default {
  fetch: app.fetch,
};
