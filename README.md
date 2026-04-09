# KOU Note Harness

KOU Corporation の歯科採用コンサルティング向けSEOブログ。
[Note Harness OSS](https://github.com/Shudesu/note-harness-oss)（MIT）ベース。

## 概要

- 歯科院長向けの採用ノウハウ記事を公開
- 記事途中まで無料閲覧 → 全文はLINE友達登録でゲート解除
- SEO流入 → LINE登録 → ステップ配信 → セミナー → 契約 のファネル入口

## 技術スタック

- Cloudflare Workers + D1（API）
- Static Blog Builder（Markdown → HTML）
- LINE gate（LINE友達登録でコンテンツ解放）

## セットアップ

```bash
pnpm install

# D1データベース作成
npx wrangler d1 create kou-note-harness
# → database_id を apps/worker/wrangler.toml に記入

# スキーマ適用
npx wrangler d1 execute kou-note-harness --file=packages/db/schema.sql

# ローカル開発
pnpm dev:worker    # API (port 8787)
pnpm build:blog    # ブログビルド
```

## コンテンツ追加

`apps/blog/content/` に Markdown ファイルを追加:

```markdown
---
title: "記事タイトル"
description: "SEO用の説明文"
date: "2026-04-10"
gate: line_friend
---

無料プレビュー部分...

<!-- gate -->

LINE登録後に読める部分...
```

## 関連

- [line-marketing-automation](https://github.com/tomosuke-chiba/line-marketing-automation) — LINE配信基盤
- [kou-marketing](https://github.com/tomosuke-chiba/kou-marketing) — マーケティング戦略管理
