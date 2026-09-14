'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { JsonFileStore } = require('../shared/store');
const { createServer } = require('../backend/app');

test('public endpoints and admin workflows are available', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tod-test-'));
  const store = new JsonFileStore(path.join(tempDir, 'store.json'));
  const server = createServer({
    store,
    frontendDir: path.join(process.cwd(), 'frontend'),
    adminCode: 'test-admin'
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const healthResponse = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthResponse.status, 200);

    const catalogResponse = await fetch(`${baseUrl}/api/catalog`);
    const catalog = await catalogResponse.json();
    assert.equal(catalog.items.length, 3);

    const memberSessionResponse = await fetch(`${baseUrl}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Member One',
        accessMode: 'member'
      })
    });
    const memberSession = await memberSessionResponse.json();
    assert.equal(memberSessionResponse.status, 201);

    const ticketResponse = await fetch(`${baseUrl}/api/support/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': memberSession.sessionToken
      },
      body: JSON.stringify({
        category: 'support',
        contactEmail: 'member@example.com',
        subject: 'Need launch checklist',
        message: 'Please share the launch-day support handoff checklist for browser fallback.'
      })
    });
    const ticketPayload = await ticketResponse.json();
    assert.equal(ticketResponse.status, 201);
    assert.equal(ticketPayload.ticket.status, 'open');

    const forbiddenAdminResponse = await fetch(`${baseUrl}/api/admin/summary`, {
      headers: {
        'X-Session-Token': memberSession.sessionToken
      }
    });
    assert.equal(forbiddenAdminResponse.status, 403);

    const adminSessionResponse = await fetch(`${baseUrl}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Admin One',
        accessMode: 'admin',
        adminCode: 'test-admin'
      })
    });
    const adminSession = await adminSessionResponse.json();
    assert.equal(adminSessionResponse.status, 201);

    const summaryResponse = await fetch(`${baseUrl}/api/admin/summary`, {
      headers: {
        'X-Session-Token': adminSession.sessionToken
      }
    });
    const summary = await summaryResponse.json();
    assert.equal(summaryResponse.status, 200);
    assert.equal(summary.metrics.openTickets, 1);

    const resolveTicketResponse = await fetch(`${baseUrl}/api/admin/tickets/${ticketPayload.ticket.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': adminSession.sessionToken
      },
      body: JSON.stringify({ status: 'resolved' })
    });
    const resolvedTicket = await resolveTicketResponse.json();
    assert.equal(resolveTicketResponse.status, 200);
    assert.equal(resolvedTicket.ticket.status, 'resolved');

    const moderationResponse = await fetch(`${baseUrl}/api/admin/moderation`, {
      headers: {
        'X-Session-Token': adminSession.sessionToken
      }
    });
    const moderation = await moderationResponse.json();
    assert.equal(moderationResponse.status, 200);
    assert.equal(moderation.items.length, 2);

    const staticResponse = await fetch(`${baseUrl}/`);
    const html = await staticResponse.text();
    assert.equal(staticResponse.status, 200);
    assert.match(html, /VR storefront \+ operations MVP/);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
