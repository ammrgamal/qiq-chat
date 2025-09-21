// Minimal dev server for qiq-chat (ESM): serves /public and wires /api endpoints
// Usage: set env vars if needed then: node server.js [port]

/* eslint-disable no-console */
import path from 'path';
import express from 'express';
import dotenv from 'dotenv';
import { fileURLToPath, pathToFileURL } from 'url';

try { dotenv.config(); } catch {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const AUTO_APPROVE = /^(1|true|yes)$/i.test(String(process.env.AUTO_APPROVE || ''));
// Allow override via CLI arg: node server.js 3005
const argPort = Number(process.argv[2]);
const PORT = process.env.PORT || (Number.isFinite(argPort) && argPort > 0 ? argPort : 3001);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

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
route('post', '/api/chat', 'chat.js');
route('post', '/api/special-quote', 'special-quote.js');
route('post', '/api/quote', 'quote.js');
route('post', '/api/agent', 'agent.js');
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
  res.json({ ok: true, uptime: process.uptime(), ts: Date.now() });
});

app.listen(PORT, () => {
  console.log(`qiq-chat dev server running at http://localhost:${PORT}`);
});
