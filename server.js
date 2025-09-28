// Minimal dev server for qiq-chat (ESM): serves /public and wires /api endpoints
// Usage: set env vars if needed then: node server.js [port]

/* eslint-disable no-console */
import path from 'path';
import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { fileURLToPath, pathToFileURL } from 'url';

try { dotenv.config(); } catch {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const AUTO_APPROVE = /^(1|true|yes)$/i.test(String(process.env.AUTO_APPROVE || ''));
// Allow override via CLI arg: node server.js 3005
const argPort = Number(process.argv[2]);
const PORT = process.env.PORT || (Number.isFinite(argPort) && argPort > 0 ? argPort : 3001);

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));
app.use(cors({ origin: true, credentials: true }));

// Body parsing
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Static site
app.use(express.static(path.join(__dirname, 'public')));

// Simple in-memory rate limiter for /api/users/* (per IP) – disabled in AUTO_APPROVE mode
if (!AUTO_APPROVE) {
  const rateBuckets = new Map();
  const RATE_LIMIT = Number(process.env.RATE_LIMIT || 60); // requests
  const RATE_WINDOW_MS = Number(process.env.RATE_WINDOW_MS || 60_000); // per minute
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api/users/')) return next();
    try {
      const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress || 'local';
      const now = Date.now();
      let b = rateBuckets.get(ip);
      if (!b || now - b.ts > RATE_WINDOW_MS) {
        b = { n: 0, ts: now };
        rateBuckets.set(ip, b);
      }
      b.n++;
      if (b.n > RATE_LIMIT) {
        res.status(429).json({ error: 'Too many requests, please try again later.' });
        return;
      }
    } catch {}
    next();
  });
}

// Generic rate limiters for sensitive endpoints
const sensitiveLimiter = rateLimit({ windowMs: Number(process.env.RATE_WINDOW_MS || 60_000), max: Number(process.env.ADMIN_RATE_LIMIT || 120) });
app.use(['/api/admin', '/api/pdf-ai', '/api/boq/parse'], sensitiveLimiter);

async function loadHandler(rel) {
  const modPath = path.join(__dirname, 'api', rel);
  const url = pathToFileURL(modPath).href;
  const mod = await import(url);
  const fn = (typeof mod === 'function') ? mod : (mod && (mod.default || mod.handler));
  if (typeof fn !== 'function') {
    throw new Error(`API module ${rel} does not export a function`);
  }
  return fn;
}

function route(method, routePath, relFile) {
  app[method](routePath, async (req, res) => {
    try {
      const handler = await loadHandler(relFile);
      return handler(req, res);
    } catch (e) {
      console.error('Handler error for', routePath, e);
      res.status(500).json({ error: 'Server error' });
    }
  });
}

// APIs
route('post', '/api/search', 'search.js');
route('get',  '/api/search/health', 'search-health.js');
route('post', '/api/chat', 'chat.js');
route('post', '/api/special-quote', 'special-quote.js');
route('post', '/api/quote', 'quote.js');
route('post', '/api/agent', 'agent.js');
route('post', '/api/compare', 'compare.js');
route('post', '/api/maintenance', 'maintenance.js');
route('post', '/api/pdf-ai', 'pdf-ai.js');
route('post', '/api/hello-leads', 'hello-leads.js');
route('post', '/api/quote-email', 'quote-email.js');
// Bundles alignment (Algolia-constrained)
route('post', '/api/bundles/align', 'bundles-align.js');
// Media/spec enrichment via Gemini
route('post', '/api/media/enrich', 'media-enrich.js');
// V0 UI generator bridge
route('post', '/api/v0/ui', 'v0-ui.js');
// BOQ parse endpoint (upload-less; accepts base64 or text rows)
route('post', '/api/boq/parse', 'boq-parse.js');
// Admin config endpoints
route('get',  '/api/admin/config', 'admin/config.js');
route('post', '/api/admin/config', 'admin/config.js');
// Admin auth and dashboard endpoints
route('post', '/api/admin/login', 'admin/login.js');
route('get',  '/api/admin/users', 'admin/users.js');
route('get',  '/api/admin/quotations', 'admin/quotations.js');
route('get',  '/api/admin/activity', 'admin/activity.js');
route('get',  '/api/admin/stats', 'admin/stats.js');
route('delete','/api/admin/delete-user', 'admin/delete-user.js');
route('delete','/api/admin/delete-quotation', 'admin/delete-quotation.js');
// Admin quotation detail and actions
route('get',  '/api/admin/quotation/:id', 'admin/quotation-details.js');
route('post', '/api/admin/quotation/:id/notes', 'admin/quotation-notes.js');
route('post', '/api/admin/quotation/:id/resend-email', 'admin/quotation-resend.js');
// Users/auth/dev endpoints
route('post', '/api/users/register', 'users/register.js');
route('post', '/api/users/login', 'users/login.js');
route('get',  '/api/users/me', 'users/me.js');
route('post', '/api/users/logout', 'users/logout.js');
route('get',  '/api/users/quotations', 'users/quotations.js');
route('post', '/api/users/quotations', 'users/quotations.js');
route('post', '/api/users/send-verification', 'users/send-verification.js');
route('get',  '/api/users/verify', 'users/verify.js');

// Fallback to index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Simple health endpoint
app.get('/health', (req, res) => {
  const hasAlgolia = Boolean(process.env.ALGOLIA_APP_ID && process.env.ALGOLIA_API_KEY);
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
  const hasGemini = Boolean(
    process.env.Gemini_API || process.env.GEMINI_API || process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_IMAGE_SPECS_API || process.env.Google_Image_Specs_API
  );
  const hasResend = Boolean(process.env.RESEND_API_KEY);
  const hasV0 = Boolean(process.env.V0_API_KEY);
  const emailFrom = process.env.EMAIL_FROM || null;
  const hasHelloLeads = Boolean(
    (process.env.HELLOLEADS_API_KEY || process.env.HELLO_LEADS_API_KEY || process.env.Heallo_Leads_API_Key_Token)
    && (process.env.HELLOLEADS_LIST_KEY || process.env.HELLO_LEADS_LIST_KEY || process.env.Heallo_Leads_QuickITQuote_List_Key)
  );
  const fastMode = /^(1|true|yes)$/i.test(String(process.env.FAST_MODE || ''));
  const autoApprove = /^(1|true|yes)$/i.test(String(process.env.AUTO_APPROVE || ''));
  res.json({
    ok: true,
    uptime: process.uptime(),
    ts: Date.now(),
    env: {
      fastMode,
      autoApprove,
      hasAlgolia,
      hasOpenAI,
      hasGemini,
  hasResend,
  hasV0,
      emailFrom,
      hasHelloLeads,
      algoliaIndex: process.env.ALGOLIA_INDEX || null
    }
  });
});

app.listen(PORT, () => {
  console.log(`qiq-chat dev server running at http://localhost:${PORT}`);
});
