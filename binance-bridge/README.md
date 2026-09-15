# Binance Bridge (Render Free Tier)

Servicio Node.js + Playwright que corre en Render gratis. Monitorea Gmail buscando correos de Binance "Pago recibido correctamente", extrae monto y usuario, y notifica al Worker de Cloudflare.

## Arquitectura

```
Cliente paga USDT → Binance envía correo a Gmail
                         ↓
          Render (Bridge) cada 2 min:
          1. Playwright abre Chrome headless
          2. Login Gmail (sesión persistida)
          3. Busca correos "Pago recibido correctamente" sin leer
          4. Extrae: monto USDT + @usuario_binance
          5. POST a Worker /api/binance/callback
                         ↓
          Worker verifica monto = precio + usuario coincide
                         ↓
          Orden completada → cuenta asignada → notifica Telegram
```

## Requisitos previos

1. **Cuenta Render** (gratis)
2. **Gmail con App Password** (no password normal)
3. **Worker desplegado** con endpoint `/api/binance/callback`
4. **GitHub repo** con esta carpeta

## Variables de entorno en Render (Configurar en Dashboard)

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `BRIDGE_TOKEN` | Token secreto 32+ chars | `abc123...` (genera con `openssl rand -hex 32`) |
| `WORKER_CALLBACK_URL` | URL completa del Worker | `https://reseller.tudominio.workers.dev/api/binance/callback` |
| `GMAIL_USER` | Tu email Gmail | `tu_email@gmail.com` |
| `GMAIL_APP_PASSWORD` | App Password de Gmail (16 chars) | `abcd efgh ijkl mnop` |
| `POLL_INTERVAL_MS` | Intervalo polling (ms) | `120000` (2 min) |
| `MONGO_URI` | Opcional - logs persistentes | `mongodb+srv://...` |

## Deploy en Render

1. Push a GitHub:
   ```bash
   git add binance-bridge
   git commit -m "Add binance-bridge for Render"
   git push
   ```

2. En Render Dashboard → New → Web Service:
   - Connect GitHub repo
   - Root Directory: `binance-bridge`
   - Build Command: `npm ci && npm run build && npm run playwright:install`
   - Start Command: `node dist/index.js`
   - Plan: Free
   - Add Environment Variables (arriba)

3. Render auto-detecta `render.yaml` y configura todo.

## UptimeRobot (gratis) - Keepalive 24/7

1. Cuenta en uptimerobot.com (gratis)
2. Add Monitor → HTTP(s):
   - URL: `https://binance-bridge.onrender.com/health`
   - Interval: 5 minutes
   - Alert contacts: tu email
2. Add Monitor → HTTP(s):
   - URL: `https://reseller.tudominio.workers.dev/health`
   - Interval: 5 minutes

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/health` | No | Health check para UptimeRobot |
| GET | `/v1/models` | No | Lista modelos (compat OpenAI) |
| POST | `/v1/binance/verify` | Bearer `BRIDGE_TOKEN` | Trigger manual verificación |

## Desarrollo local

```bash
cd binance-bridge
cp .env.example .env
# Edita .env con tus credenciales
npm install
npm run playwright:install
npm run dev
```

## Flujo de prueba

1. Deploy en Render + UptimeRobot activo
2. En Worker: `curl -X POST https://reseller.tudominio.workers.dev/api/binance/callback \
  -H "Authorization: Bearer TU_BRIDGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"store_id":"test","client_id":"test","binance_user":"testuser","usdt_amount":7,"status":"verified"}'`

3. Verificar en Worker: orden marcada pagada, cuenta asignada, notificación Telegram enviada.

## Troubleshooting

| Problema | Solución |
|----------|----------|
| `Error: net::ERR_CONNECTION_REFUSED` | Render duerme → UptimeRobot configurado? |
| `Login failed` | GMAIL_APP_PASSWORD correcto? (no password normal) |
| `No emails found` | Correos de Binance en Spam? Filtro `from:noreply@binance.com is:unread` |
| `Playwright timeout` | Aumentar timeouts en `gmail.ts` |
| `Bridge token invalid` | Verificar `BRIDGE_TOKEN` coincide en Render y Worker |