import { chromium, Browser, BrowserContext, Page } from 'playwright-core';
import fs from 'fs/promises';

let browser: Browser | null = null;
let context: BrowserContext | null = null;

const GMAIL_USER = process.env.GMAIL_USER!;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD!;
const STORAGE_STATE_PATH = '/tmp/storage_state.json';

const SELECTORS = {
  emailInput: 'input[type="email"]',
  nextButton: 'button:has-text("Siguiente"), button:has-text("Next")',
  passwordInput: 'input[type="password"]',
  signInButton: 'button:has-text("Iniciar sesión"), button:has-text("Sign in")',
  inbox: 'table[role="grid"], div[role="main"]',
  unreadEmail: 'tr.zA, tr[role="row"]:has(span.zF)',
  emailBody: 'div.ii, div[role="region"]',
  closeButton: 'button[aria-label="Cerrar"], button[aria-label="Close"]'
};

async function getBrowser(): Promise<Browser> {
  if (browser) return browser;
  browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-component-extensions-with-background-pages',
      '--disable-features=TranslateUI,BlinkGenPropertyTrees',
      '--disable-ipc-flooding-protection',
      '--disable-renderer-backgrounding',
      '--enable-features=NetworkService,NetworkServiceInProcess',
      '--force-color-profile=srgb',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-first-run',
      '--no-default-browser-check',
      '--no-pings',
      '--password-store=basic',
      '--use-gl=swiftshader',
      '--use-mock-keychain'
    ]
  });
  return browser;
}

async function getContext(): Promise<BrowserContext> {
  const b = await getBrowser();
  
  // Try to load saved storage state
  let storageState: any = undefined;
  try {
    const saved = await fs.readFile(STORAGE_STATE_PATH, 'utf-8');
    storageState = JSON.parse(saved);
  } catch {
    // No saved state, will login
  }
  
  context = await b.newContext({
    storageState,
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  return context;
}

async function loginIfNeeded(page: Page): Promise<void> {
  // Check if already logged in
  try {
    await page.waitForSelector(SELECTORS.inbox, { timeout: 5000 });
    console.log('[gmail] Already logged in');
    return;
  } catch {
    // Need to login
  }
  
  console.log('[gmail] Logging in...');
  await page.goto('https://mail.google.com', { waitUntil: 'networkidle', timeout: 60000 });
  
  // Email input
  await page.waitForSelector(SELECTORS.emailInput, { timeout: 30000 });
  await page.fill(SELECTORS.emailInput, GMAIL_USER);
  await page.click(SELECTORS.nextButton);
  
  // Password input
  await page.waitForSelector(SELECTORS.passwordInput, { timeout: 30000 });
  await page.fill(SELECTORS.passwordInput, GMAIL_APP_PASSWORD);
  await page.click(SELECTORS.signInButton);
  
  // Wait for inbox
  await page.waitForSelector(SELECTORS.inbox, { timeout: 60000 });
  console.log('[gmail] Login successful');
  
  // Save storage state
  await saveStorageState();
}

async function saveStorageState(): Promise<void> {
  if (!context) return;
  try {
    const state = await context.storageState();
    await fs.writeFile(STORAGE_STATE_PATH, JSON.stringify(state));
    console.log('[gmail] Storage state saved');
  } catch (err) {
    console.error('[gmail] Failed to save storage state:', err);
  }
}

async function searchUnreadBinanceEmails(page: Page): Promise<string[]> {
  // Search for Binance emails
  const searchUrl = 'https://mail.google.com/mail/u/0/#search/from%3Anoreply%40binance.com+is%3Aunread';
  await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 });
  
  // Wait for emails to load
  await page.waitForTimeout(3000);
  
  const emails: string[] = [];
  const emailElements = await page.$$(SELECTORS.unreadEmail);
  
  for (const el of emailElements) {
    try {
      await el.click();
      await page.waitForTimeout(1000);
      
      // Get email body
      const bodyEl = await page.$(SELECTORS.emailBody);
      if (bodyEl) {
        const body = await bodyEl.innerText();
        emails.push(body);
      }
      
      // Go back to list
      await page.goBack({ waitUntil: 'networkidle', timeout: 10000 });
      await page.waitForTimeout(500);
    } catch (err) {
      console.error('[gmail] Error reading email:', err);
      try { await page.goBack({ waitUntil: 'networkidle', timeout: 10000 }); } catch {}
    }
  }
  
  return emails;
}

export interface UnreadEmail {
  storeId: string;
  clientId: string;
  body: string;
}

export async function verifyPayments(): Promise<UnreadEmail[]> {
  const ctx = await getContext();
  const page = await ctx.newPage();
  
  try {
    await loginIfNeeded(page);
    const emails = await searchUnreadBinanceEmails(page);
    
    // For now return all emails - in production we'd filter by store/client
    // The mapping storeId/clientId would come from a mapping table
    return emails.map(body => ({
      storeId: 'default', // TODO: map from email or tracking
      clientId: 'default',
      body
    }));
  } finally {
    await page.close();
  }
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    context = null;
  }
}

// Handle shutdown
process.on('SIGINT', async () => {
  await closeBrowser();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await closeBrowser();
  process.exit(0);
});