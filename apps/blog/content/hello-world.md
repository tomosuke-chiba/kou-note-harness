---
title: "Hello World"
date: "2026-04-02"
description: "Welcome to Note Harness — a self-hosted blog with content gating."
gate: x_engagement
tags: [introduction, note-harness]
---

## Welcome to Note Harness

Note Harness is a self-hosted static blog platform with built-in content gating. It's part of The Harness OSS ecosystem.

You can write articles in Markdown and gate premium content behind:

- **X Engagement** — readers must like, retweet, or reply to unlock
- **LINE Friend Add** — readers must add your LINE account
- **Access Tokens** — distribute tokens to select readers

This preview section is visible to everyone.

<!-- gate -->

## The Full Article

Congratulations! You've unlocked the gated content.

This section was hidden behind a content gate. In a real deployment, the reader would need to complete an action (like engaging with a post on X) before seeing this content.

### How It Works

1. Write your article in Markdown
2. Add `<!-- gate -->` where you want to split free/premium content
3. Set the `gate` type in frontmatter
4. Build and deploy

The static blog builder generates HTML with an inline script that checks unlock status via the Note Harness API.

### Next Steps

- Set up your Cloudflare Worker with D1
- Configure content gates via the API
- Deploy your blog to Cloudflare Pages

Happy writing!
