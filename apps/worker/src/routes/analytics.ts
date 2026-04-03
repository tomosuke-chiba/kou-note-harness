import { Hono } from 'hono';
import type { Env } from '../index.js';

export const analytics = new Hono<Env>();

// Record pageview (public, rate limited by slug)
analytics.post('/api/analytics/pageview', async (c) => {
  const body = await c.req.json();
  const { slug } = body;

  if (!slug) {
    return c.json({ success: false, error: 'slug is required' }, 400);
  }

  const id = crypto.randomUUID();
  const referrer = c.req.header('Referer') ?? body.referrer ?? null;
  const userAgent = c.req.header('User-Agent') ?? null;
  const country = c.req.header('CF-IPCountry') ?? null;

  await c.env.DB.prepare(
    'INSERT INTO page_views (id, slug, referrer, user_agent, country) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(id, slug, referrer, userAgent, country)
    .run();

  return c.json({ success: true, data: { recorded: true } });
});

// Analytics summary (auth required)
analytics.get('/api/analytics/summary', async (c) => {
  const today = new Date().toISOString().slice(0, 10);

  const [totalViews, totalUnlocks, viewsToday, unlocksToday] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) as count FROM page_views').first<{ count: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM gate_unlocks').first<{ count: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM page_views WHERE created_at >= ?')
      .bind(today)
      .first<{ count: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM gate_unlocks WHERE created_at >= ?')
      .bind(today)
      .first<{ count: number }>(),
  ]);

  return c.json({
    success: true,
    data: {
      total_views: totalViews?.count ?? 0,
      total_unlocks: totalUnlocks?.count ?? 0,
      views_today: viewsToday?.count ?? 0,
      unlocks_today: unlocksToday?.count ?? 0,
    },
  });
});

// Per-article stats (auth required)
analytics.get('/api/analytics/articles', async (c) => {
  const views = await c.env.DB.prepare(
    `SELECT slug, COUNT(*) as views FROM page_views GROUP BY slug ORDER BY views DESC`,
  ).all<{ slug: string; views: number }>();

  const unlocks = await c.env.DB.prepare(
    `SELECT cg.slug, COUNT(gu.id) as unlocks
     FROM gate_unlocks gu
     JOIN content_gates cg ON gu.gate_id = cg.id
     GROUP BY cg.slug`,
  ).all<{ slug: string; unlocks: number }>();

  const unlockMap = new Map(unlocks.results.map((u) => [u.slug, u.unlocks]));

  const articles = views.results.map((v) => ({
    slug: v.slug,
    views: v.views,
    unlocks: unlockMap.get(v.slug) ?? 0,
  }));

  return c.json({ success: true, data: articles });
});
