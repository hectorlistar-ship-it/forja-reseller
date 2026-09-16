export interface ParsedPayment {
  binanceUser: string;
  amount: number;
  currency: string;
  timestamp: string;
}

const AMOUNT_REGEX = /([\d,]+\.?\d*)\s*USDT/i;
const USER_REGEX = /@(\w+)/;

export function parseBinanceEmail(body: string): ParsedPayment | null {
  // Check if it's a Binance payment received email
  const isPaymentEmail = /pago recibido correctamente|payment received successfully|pago completado|payment completed/i.test(body);
  
  if (!isPaymentEmail) {
    return null;
  }
  
  // Extract amount
  const amountMatch = body.match(AMOUNT_REGEX);
  if (!amountMatch) {
    console.warn('[parser] No amount found in email');
    return null;
  }
  const amount = parseFloat(amountMatch[1].replace(',', ''));
  
  // Extract binance user - try multiple patterns
  let binanceUser: string | null = null;

  // Pattern 0: "Remitente:" / "Sender:" label (real Binance Pay format, no @)
  const senderMatch = body.match(/remitente\s*:\s*([^\r\n]+)|sender\s*:\s*([^\r\n]+)/i);
  if (senderMatch) {
    binanceUser = (senderMatch[1] || senderMatch[2] || '').trim();
  }

  // Pattern 1: @username in email
  if (!binanceUser) {
    const userMatch = body.match(USER_REGEX);
    if (userMatch) {
      binanceUser = userMatch[1];
    }
  }
  
  // Pattern 2: "Usuario: username" or "User: username"
  if (!binanceUser) {
    const userLabelMatch = body.match(/usuario[:\s]+(\w+)|user[:\s]+(\w+)/i);
    if (userLabelMatch) {
      binanceUser = userLabelMatch[1] || userLabelMatch[2];
    }
  }
  
  // Pattern 3: "De: username" or "From: username"
  if (!binanceUser) {
    const fromMatch = body.match(/(?:de|from)[:\s]+(\w+)/i);
    if (fromMatch) {
      binanceUser = fromMatch[1];
    }
  }
  
  if (!binanceUser) {
    console.warn('[parser] No binance user found in email');
    return null;
  }

  // Normalize: strip a leading @ and surrounding whitespace
  binanceUser = binanceUser.replace(/^@/, '').trim();
  if (!binanceUser) {
    console.warn('[parser] Empty binance user after normalization');
    return null;
  }
  
  // Extract timestamp (ISO format used by Binance: 2026-09-15 12:35:23, or DD/MM/YYYY)
  const timestampMatch = body.match(/(\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}:\d{2})|(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2})/);
  const timestamp = timestampMatch ? (timestampMatch[1] || timestampMatch[2]) : new Date().toISOString();
  
  return {
    binanceUser,
    amount,
    currency: 'USDT',
    timestamp
  };
}

export function extractAllPayments(body: string): ParsedPayment[] {
  const payments: ParsedPayment[] = [];
  
  // Split by potential email separators
  const sections = body.split(/(?=Pago recibido|Payment received|Pago completado|Payment completed)/i);
  
  for (const section of sections) {
    const parsed = parseBinanceEmail(section);
    if (parsed) {
      payments.push(parsed);
    }
  }
  
  return payments;
}