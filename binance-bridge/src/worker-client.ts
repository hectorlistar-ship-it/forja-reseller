import 'dotenv/config';

export interface MailBox {
  store_id: number;
  gmail_user: string;
  gmail_app_password: string;
}

// Reads the list of vendor mailboxes the bridge should poll. Credentials are
// decrypted server-side by the worker (only on this authenticated request).
export async function fetchMailboxes(
  workerUrl: string,
  bridgeToken: string
): Promise<MailBox[]> {
  const base = workerUrl.replace(/\/$/, '').replace(/\/api\/binance\/callback$/, '');
  try {
    const res = await fetch(`${base}/api/binance/mailboxes`, {
      headers: { 'Authorization': `Bearer ${bridgeToken}` }
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[worker-client] Fetch mailboxes failed:', res.status, err);
      return [];
    }
    const data = await res.json() as { mailboxes: MailBox[] };
    return data.mailboxes || [];
  } catch (err) {
    console.error('[worker-client] Fetch mailboxes network error:', err);
    return [];
  }
}

export interface CallbackPayload {
  store_id: string;
  client_id: string;
  binance_user: string;
  usdt_amount: number;
  status: 'verified' | 'failed';
  raw_email?: string;
}

export async function sendCallback(
  workerUrl: string,
  bridgeToken: string,
  payload: CallbackPayload
): Promise<{ ok: boolean; error?: string }> {
  try {
    // WORKER_CALLBACK_URL may or may not already include the /api/binance/callback
    // path (it's set in Render with the full path). Avoid double-appending it.
    const base = workerUrl.replace(/\/$/, '');
    const endpoint = base.endsWith('/api/binance/callback')
      ? base
      : `${base}/api/binance/callback`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bridgeToken}`
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const err = await response.text();
      console.error('[worker-client] Callback failed:', response.status, err);
      return { ok: false, error: `HTTP ${response.status}: ${err}` };
    }
    
    const result = await response.json();
    console.log('[worker-client] Callback sent:', payload.binance_user, payload.usdt_amount, 'USDT');
    return { ok: true };
  } catch (err) {
    console.error('[worker-client] Network error:', err);
    return { ok: false, error: String(err) };
  }
}