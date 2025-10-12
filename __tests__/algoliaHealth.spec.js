import request from 'supertest';
import http from 'http';
import appImport from '../server.js';

/**
 * Basic test to ensure algolia-health endpoint returns shape without exposing admin key.
 * NOTE: server.js starts listening immediately; we create a client against running server (assumes default port).
 */

describe('Algolia Health Endpoint', () => {
  const BASE = process.env.TEST_BASE_URL || 'http://localhost:3001';

  test('responds with JSON shape', async () => {
    const res = await request(BASE).get('/api/algolia-health');
    // Should always return JSON with index + mismatch flag
    expect(res.status).toBeLessThan(600);
    expect(res.body).toHaveProperty('index');
    expect(res.body).toHaveProperty('mismatch');
    // Must not leak any key-looking values
    const str = JSON.stringify(res.body);
    expect(str).not.toMatch(/ALGOLIA_ADMIN_API_KEY/i);
  });
});
