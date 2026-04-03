// =============================================================================
// Note Harness — Shared Types
// Cloudflare D1: TEXT -> string, INTEGER -> number, NULL -> null
// IDs and dates stored as TEXT (string)
// =============================================================================

// -----------------------------------------------------------------------------
// Gate Types
// -----------------------------------------------------------------------------

export type GateType = 'x_engagement' | 'line_friend' | 'token' | 'stripe' | 'compound';

export type UnlockSourceType = 'x_harness' | 'line_harness' | 'token' | 'stripe' | 'manual';

// -----------------------------------------------------------------------------
// Content Gate
// -----------------------------------------------------------------------------

export interface ContentGate {
  id: string;
  slug: string;
  gate_type: GateType;
  x_harness_url: string | null;
  x_harness_api_key: string | null;
  x_gate_id: string | null;
  line_harness_url: string | null;
  line_harness_api_key: string | null;
  line_tracked_link_id: string | null;
  stripe_price_cents: number | null;
  stripe_currency: string | null;
  compound_steps: string | null;
  preview_paragraphs: number;
  cta_text: string;
  cta_url: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Gate Unlock
// -----------------------------------------------------------------------------

export interface GateUnlock {
  id: string;
  gate_id: string;
  unlock_token: string;
  source_type: UnlockSourceType;
  source_user_id: string | null;
  source_username: string | null;
  created_at: string;
}

// -----------------------------------------------------------------------------
// Page View
// -----------------------------------------------------------------------------

export interface PageView {
  id: string;
  slug: string;
  referrer: string | null;
  user_agent: string | null;
  country: string | null;
  created_at: string;
}

// -----------------------------------------------------------------------------
// Article Frontmatter (used by blog builder)
// -----------------------------------------------------------------------------

export interface ArticleFrontmatter {
  title: string;
  date: string;
  description: string;
  gate?: GateType;
  stripe_price?: number;
  tags?: string[];
}

// -----------------------------------------------------------------------------
// API Response Types
// -----------------------------------------------------------------------------

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface GateConfig {
  slug: string;
  gate_type: GateType;
  cta_text: string;
  cta_url: string | null;
  preview_paragraphs: number;
  stripe_price_cents: number | null;
  stripe_currency: string | null;
  compound_steps: string | null;
}

export interface AnalyticsSummary {
  total_views: number;
  total_unlocks: number;
  views_today: number;
  unlocks_today: number;
}

export interface ArticleStats {
  slug: string;
  views: number;
  unlocks: number;
}
