import type { ContentGate } from '@note-harness/shared';

interface VerifyResult {
  verified: boolean;
  username?: string;
  userId?: string;
}

/**
 * Verify X Harness engagement gate completion.
 * Calls X Harness verify API.
 */
export async function verifyXHarnessUnlock(
  xHarnessUrl: string,
  xHarnessApiKey: string | null,
  xGateId: string,
  username: string,
): Promise<VerifyResult> {
  try {
    const url = `${xHarnessUrl}/api/engagement-gates/${xGateId}/verify?username=${encodeURIComponent(username)}`;
    const headers: Record<string, string> = {};
    if (xHarnessApiKey) {
      headers['Authorization'] = `Bearer ${xHarnessApiKey}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) {
      return { verified: false };
    }

    const data = (await res.json()) as { success: boolean; data?: { eligible?: boolean; verified?: boolean } };
    if (data.success && (data.data?.eligible || data.data?.verified)) {
      return { verified: true, username };
    }
    return { verified: false };
  } catch {
    return { verified: false };
  }
}

/**
 * Verify LINE Harness friend-add unlock.
 * Validates HMAC token structure: base64(userId:timestamp:hmac)
 */
export async function verifyLineHarnessUnlock(
  lineUnlockToken: string,
  gate: ContentGate,
): Promise<VerifyResult> {
  try {
    if (!gate.line_harness_api_key) {
      return { verified: false };
    }

    // Token format: userId:timestamp:hmac (base64 encoded)
    const decoded = atob(lineUnlockToken);
    const parts = decoded.split(':');
    if (parts.length !== 3) {
      return { verified: false };
    }

    const [userId, timestamp, providedHmac] = parts;

    // Verify HMAC
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(gate.line_harness_api_key),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(`${userId}:${timestamp}`),
    );

    const expectedHmac = btoa(String.fromCharCode(...new Uint8Array(signature)));

    if (providedHmac !== expectedHmac) {
      return { verified: false };
    }

    // Check timestamp (valid for 24 hours)
    const ts = parseInt(timestamp, 10);
    const now = Date.now();
    if (now - ts > 24 * 60 * 60 * 1000) {
      return { verified: false };
    }

    return { verified: true, userId };
  } catch {
    return { verified: false };
  }
}
