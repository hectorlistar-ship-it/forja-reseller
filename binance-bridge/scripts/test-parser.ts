import { parseBinanceEmail } from '../src/parser.js';

const body = `Pago recibido correctamente
Recibiste una transferencia:
Fecha y hora:
2026-09-15 12:35:23(UTC)
Remitente:
Gabo_AMR
Monto:
374.1 USDT
Ver Histórico de Transações do Binance PayVer historial de transacciones de Pay`;

const parsed = parseBinanceEmail(body);
console.log('PARSED:', JSON.stringify(parsed, null, 2));

// Sanity checks
if (!parsed) { console.error('FAIL: parser returned null'); process.exit(1); }
if (parsed.binanceUser !== 'Gabo_AMR') { console.error('FAIL: binanceUser =', parsed.binanceUser); process.exit(1); }
if (parsed.amount !== 374.1) { console.error('FAIL: amount =', parsed.amount); process.exit(1); }
console.log('OK: binanceUser=Gabo_AMR amount=374.1');