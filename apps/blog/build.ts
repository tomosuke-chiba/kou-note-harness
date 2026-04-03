import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';
import type { ArticleFrontmatter } from '@note-harness/shared';

const CONTENT_DIR = path.join(import.meta.dirname, 'content');
const TEMPLATE_DIR = path.join(import.meta.dirname, 'templates');
const PUBLIC_DIR = path.join(import.meta.dirname, 'public');
const DIST_DIR = path.join(import.meta.dirname, 'dist');

const GATE_MARKER = '<!-- gate -->';

// Inline gate script (~2KB minified equivalent)
const GATE_SCRIPT = `
<script>
(function() {
  var slug = document.body.dataset.slug;
  var apiBase = document.body.dataset.apiBase || '';
  var gatedEl = document.getElementById('gated-content');
  var ctaEl = document.getElementById('gate-cta');
  if (!gatedEl) return;

  var tokenKey = 'note_harness_token_' + slug;
  var token = localStorage.getItem(tokenKey);

  function loadGatedContent(t) {
    fetch(apiBase + '/api/gate/content?slug=' + encodeURIComponent(slug) + '&token=' + encodeURIComponent(t))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success && data.data && data.data.html) {
          gatedEl.innerHTML = data.data.html;
          gatedEl.style.display = 'block';
          if (ctaEl) ctaEl.style.display = 'none';
        }
      })
      .catch(function() {});
  }

  if (token) {
    loadGatedContent(token);
  }

  // Handle unlock callback (from URL param)
  var params = new URLSearchParams(window.location.search);
  var unlockToken = params.get('unlock_token');
  if (unlockToken) {
    localStorage.setItem(tokenKey, unlockToken);
    loadGatedContent(unlockToken);
    // Clean URL
    var url = new URL(window.location.href);
    url.searchParams.delete('unlock_token');
    window.history.replaceState({}, '', url.toString());
  }

  // Load gate config and wire up unlock flows
  var ctaEl = document.getElementById('gate-cta');
  if (ctaEl && apiBase) {
    fetch(apiBase + '/api/gate/config?slug=' + encodeURIComponent(slug))
      .then(function(r) { return r.json(); })
      .then(function(cfg) {
        if (!cfg.success || !cfg.data) return;
        var gate = cfg.data;

        // X engagement verify button
        var xBtn = document.getElementById('gate-x-verify');
        if (xBtn) {
          xBtn.addEventListener('click', function() {
            var input = document.getElementById('gate-x-username');
            var username = input ? input.value.replace('@', '').trim() : '';
            if (!username) return;
            fetch(apiBase + '/api/gate/unlock', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ slug: slug, xHarnessToken: username })
            }).then(function(r) { return r.json(); }).then(function(d) {
              if (d.success && d.data && d.data.unlock_token) {
                localStorage.setItem(tokenKey, d.data.unlock_token);
                loadGatedContent(d.data.unlock_token);
              } else {
                alert(d.error || 'Verification failed. Complete the engagement first.');
              }
            });
          });
        }

        // LINE friend link
        var lineLink = document.getElementById('gate-line-link');
        if (lineLink && gate.cta_url) {
          lineLink.href = gate.cta_url;
        }

        // Stripe buy button
        var stripeBtn = document.getElementById('gate-stripe-buy');
        if (stripeBtn) {
          stripeBtn.addEventListener('click', function() {
            fetch(apiBase + '/api/gate/checkout', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ slug: slug })
            }).then(function(r) { return r.json(); }).then(function(d) {
              if (d.success && d.data && d.data.checkout_url) {
                window.location.href = d.data.checkout_url;
              } else {
                alert(d.error || 'Failed to start checkout.');
              }
            });
          });
        }

        // Compound gate steps display
        var compoundEl = document.getElementById('gate-compound-steps');
        if (compoundEl && gate.compound_steps) {
          var steps = JSON.parse(gate.compound_steps);
          var html = '<ul class="compound-steps">';
          steps.forEach(function(step) {
            var label = { x_engagement: 'Engage on X', line_friend: 'Add on LINE', stripe: 'Purchase', token: 'Enter token' }[step] || step;
            html += '<li class="compound-step" data-step="' + step + '">' + label + '</li>';
          });
          html += '</ul>';
          compoundEl.innerHTML = html;
        }

        // Token input
        var tokenBtn = document.getElementById('gate-token-verify');
        if (tokenBtn) {
          tokenBtn.addEventListener('click', function() {
            var input = document.getElementById('gate-token-input');
            var t = input ? input.value.trim() : '';
            if (!t) return;
            fetch(apiBase + '/api/gate/unlock', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ slug: slug, accessToken: t })
            }).then(function(r) { return r.json(); }).then(function(d) {
              if (d.success && d.data && d.data.unlock_token) {
                localStorage.setItem(tokenKey, d.data.unlock_token);
                loadGatedContent(d.data.unlock_token);
              } else {
                alert(d.error || 'Invalid token.');
              }
            });
          });
        }
      }).catch(function() {});
  }

  // Record pageview
  if (apiBase) {
    fetch(apiBase + '/api/analytics/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: slug })
    }).catch(function() {});
  }
})();
</script>`;

function readTemplate(name: string): string {
  return fs.readFileSync(path.join(TEMPLATE_DIR, name), 'utf-8');
}

interface Article {
  slug: string;
  frontmatter: ArticleFrontmatter;
  previewHtml: string;
  gatedHtml: string | null;
}

function buildArticle(filename: string): Article {
  const raw = fs.readFileSync(path.join(CONTENT_DIR, filename), 'utf-8');
  const { data, content } = matter(raw);
  const fm = data as ArticleFrontmatter;
  const slug = filename.replace(/\.md$/, '');

  let previewMd: string;
  let gatedMd: string | null = null;

  if (content.includes(GATE_MARKER)) {
    const [preview, gated] = content.split(GATE_MARKER);
    previewMd = preview.trim();
    gatedMd = gated.trim();
  } else {
    previewMd = content;
  }

  const previewHtml = marked.parse(previewMd) as string;
  const gatedHtml = gatedMd ? (marked.parse(gatedMd) as string) : null;

  return { slug, frontmatter: fm, previewHtml, gatedHtml };
}

function renderArticle(article: Article, layoutTpl: string, articleTpl: string, apiBase: string): string {
  const { slug, frontmatter, previewHtml, gatedHtml } = article;

  let gateSection = '';
  if (gatedHtml && frontmatter.gate) {
    const gateType = frontmatter.gate as string;
    let ctaHtml = '';
    if (gateType === 'x_engagement') {
      ctaHtml = `
        <p class="gate-message">Unlock the full article by engaging with the post on X.</p>
        <div id="gate-x-flow">
          <input type="text" id="gate-x-username" placeholder="Your X username (without @)" class="gate-input" />
          <button id="gate-x-verify" class="gate-button">Verify &amp; Unlock</button>
        </div>`;
    } else if (gateType === 'line_friend') {
      ctaHtml = `
        <p class="gate-message">Add us on LINE to unlock the full article.</p>
        <a id="gate-line-link" href="#" class="gate-button">Add on LINE</a>`;
    } else if (gateType === 'stripe') {
      ctaHtml = `
        <p class="gate-message">Purchase to unlock the full article.</p>
        <button id="gate-stripe-buy" class="gate-button">Buy &amp; Unlock</button>`;
    } else if (gateType === 'compound') {
      ctaHtml = `
        <p class="gate-message">Complete all steps to unlock the full article.</p>
        <div id="gate-compound-steps"></div>`;
    } else {
      ctaHtml = `
        <p class="gate-message">Enter your access token to unlock the full article.</p>
        <div id="gate-token-flow">
          <input type="text" id="gate-token-input" placeholder="Access token" class="gate-input" />
          <button id="gate-token-verify" class="gate-button">Unlock</button>
        </div>`;
    }
    gateSection = `
      <div id="gate-cta" class="gate-cta" data-gate-type="${escapeHtml(gateType)}">
        ${ctaHtml}
      </div>
      <div id="gated-content" style="display:none;"></div>`;
  }

  const tags = (frontmatter.tags ?? []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join(' ');

  let body = articleTpl
    .replace('{{title}}', escapeHtml(frontmatter.title))
    .replace('{{date}}', escapeHtml(frontmatter.date))
    .replace('{{description}}', escapeHtml(frontmatter.description ?? ''))
    .replace('{{tags}}', tags)
    .replace('{{preview}}', previewHtml)
    .replace('{{gate_section}}', gateSection);

  const dataAttrs = `data-slug="${escapeHtml(slug)}" data-api-base="${escapeHtml(apiBase)}"`;

  return layoutTpl
    .replace('{{title}}', escapeHtml(frontmatter.title))
    .replace('{{description}}', escapeHtml(frontmatter.description ?? ''))
    .replace('{{body_attrs}}', dataAttrs)
    .replace('{{content}}', body)
    .replace('{{scripts}}', gatedHtml ? GATE_SCRIPT : '');
}

function renderIndex(articles: Article[], layoutTpl: string, indexTpl: string): string {
  const items = articles
    .sort((a, b) => (b.frontmatter.date > a.frontmatter.date ? 1 : -1))
    .map(
      (a) => `
      <article class="article-card">
        <a href="/${a.slug}.html">
          <h2>${escapeHtml(a.frontmatter.title)}</h2>
          <time>${escapeHtml(a.frontmatter.date)}</time>
          <p>${escapeHtml(a.frontmatter.description ?? '')}</p>
          ${a.frontmatter.gate ? '<span class="gate-badge">Gated</span>' : ''}
        </a>
      </article>`,
    )
    .join('\n');

  const body = indexTpl.replace('{{articles}}', items);

  return layoutTpl
    .replace('{{title}}', 'Blog')
    .replace('{{description}}', 'Articles')
    .replace('{{body_attrs}}', '')
    .replace('{{content}}', body)
    .replace('{{scripts}}', '');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --- Main ---

const API_BASE = process.env.NOTE_HARNESS_API_URL ?? '';

// Clean dist
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });

// Copy public assets
if (fs.existsSync(PUBLIC_DIR)) {
  for (const file of fs.readdirSync(PUBLIC_DIR)) {
    fs.copyFileSync(path.join(PUBLIC_DIR, file), path.join(DIST_DIR, file));
  }
}

// Read templates
const layoutTpl = readTemplate('layout.html');
const articleTpl = readTemplate('article.html');
const indexTpl = readTemplate('index.html');

// Build articles
const mdFiles = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md'));
const articles: Article[] = [];

for (const file of mdFiles) {
  const article = buildArticle(file);
  articles.push(article);

  const html = renderArticle(article, layoutTpl, articleTpl, API_BASE);
  fs.writeFileSync(path.join(DIST_DIR, `${article.slug}.html`), html);
  console.log(`Built: ${article.slug}.html`);
}

// Export gated content as JSON for upload to worker API
const gatedArticles = articles.filter((a) => a.gatedHtml);
if (gatedArticles.length > 0) {
  const gatedData = gatedArticles.map((a) => ({
    slug: a.slug,
    html: a.gatedHtml,
  }));
  fs.writeFileSync(path.join(DIST_DIR, '_gated.json'), JSON.stringify(gatedData, null, 2));
  console.log(`Exported: _gated.json (${gatedArticles.length} gated articles)`);
  console.log('Upload gated content: curl -X POST $WORKER_URL/api/gate/content -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" -d @dist/_gated.json');
}

// Build index
const indexHtml = renderIndex(articles, layoutTpl, indexTpl);
fs.writeFileSync(path.join(DIST_DIR, 'index.html'), indexHtml);
console.log(`Built: index.html (${articles.length} articles)`);
