# Note Harness

Self-hosted static blog platform with content gating. Part of [The Harness OSS](https://github.com/Shudesu/the-harness-oss) ecosystem.

Gate blog content behind X engagement, LINE friend-adds, or access tokens. Deploy on Cloudflare (Workers + Pages + D1).

## Architecture

- **`apps/worker/`** — Hono API on Cloudflare Workers (gate management, unlock verification, analytics)
- **`apps/blog/`** — Static site builder (Markdown + frontmatter -> gated HTML)
- **`packages/db/`** — D1 schema
- **`packages/shared/`** — TypeScript types

## Quick Start

```bash
pnpm install
pnpm db:migrate:local
pnpm dev:worker
pnpm build:blog
```

## Content Gating

Add `<!-- gate -->` in your Markdown to split free preview from gated content:

```markdown
---
title: "My Article"
gate: x_engagement
---

Free preview content here...

<!-- gate -->

This content requires unlocking.
```

## Gate Types

| Type | Description |
|------|-------------|
| `x_engagement` | Unlock via X Harness engagement gate (like/RT/reply) |
| `line_friend` | Unlock via LINE Harness friend-add |
| `token` | Unlock via pre-created access token |

---

# Note Harness

セルフホスト型ブログ＋コンテンツゲーティング。[The Harness OSS](https://github.com/Shudesu/the-harness-oss) エコシステムの一部。

X エンゲージメント、LINE 友だち追加、アクセストークンでブログ記事をゲート。Cloudflare（Workers + Pages + D1）にデプロイ。

## License

MIT
