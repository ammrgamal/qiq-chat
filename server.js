// Minimal dev server for qiq-chat: serves /public and wires /api endpoints
// Usage: set env vars (ALGOLIA_APP_ID, ALGOLIA_API_KEY, ALGOLIA_INDEX, OPENAI_API_KEY, ENABLE_GPT5_ALL) then: npm start

/* eslint-disable no-console */
const path = require('path');
const express = require('express');

try { require('dotenv').config(); } catch {}

const app = express();
// Allow override via CLI arg: node server.js 3005
const argPort = Number(process.argv[2]);
const PORT = process.env.PORT || (Number.isFinite(argPort) && argPort > 0 ? argPort : 3001);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Static site
app.use(express.static(path.join(__dirname, 'public')));

function loadHandler(rel) {
  const modPath = path.join(__dirname, 'api', rel);
  // Support both CommonJS and ESM default exports
  // eslint-disable-next-line import/no-dynamic-require, global-require
  const mod = require(modPath);
  const fn = (typeof mod === 'function') ? mod : (mod && (mod.default || mod.handler));
  if (typeof fn !== 'function') {
    throw new Error(`API module ${rel} does not export a function`);
  }
  return fn;
}

function route(method, routePath, relFile) {
  const handler = loadHandler(relFile);
  app[method](routePath, (req, res) => handler(req, res));
}

// APIs
route('post', '/api/search', 'search.js');
route('post', '/api/chat', 'chat.js');
route('post', '/api/special-quote', 'special-quote.js');
route('post', '/api/quote', 'quote.js');
route('post', '/api/agent', 'agent.js');

// Fallback to index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`qiq-chat dev server running at http://localhost:${PORT}`);
});
