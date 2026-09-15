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
    const response = await fetch(`${workerUrl.replace(/\/$/, '')}/api/binance/callback`, {
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