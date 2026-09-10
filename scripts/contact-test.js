// Uses a PostgreSQL TEMP table on one connection. No real leads or SMTP traffic.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
require('../backend/node_modules/dotenv').config({ path: path.join(__dirname, '../backend/.env'), quiet: true });
const { createPool } = require('../backend/database');
const express = require('../backend/node_modules/express');
const nodemailer = require('../backend/node_modules/nodemailer');
const { createAdminSession, getAdminUsername } = require('../backend/middleware/admin-auth');
const { services } = require('../js/service-catalog');
const createContactRoutes = require('../backend/routes/contact-routes');
const createLeadsRoutes = require('../backend/routes/leads-routes');
const { createLeadsWorkbook } = require('../backend/services/excel-service');
const ExcelJS = require('../backend/node_modules/exceljs');

test('contact submission and email recovery with isolated PostgreSQL data', async (t) => {
  const pool = createPool();
  const client = await pool.connect();
  const originalTransport = nodemailer.createTransport;
  let deliveries = [], failCustomer = false, failAdmin = false, pauseMail = null;
  nodemailer.createTransport = () => ({ sendMail: async (options) => {
    deliveries.push(options);
    if (pauseMail) await pauseMail;
    if ((options.to === 'customer@example.test' && failCustomer) || (options.to === 'admin@example.test' && failAdmin)) throw new Error('Simulated SMTP failure');
    return { messageId: 'test-only' };
  } });
  process.env.SMTP_HOST = 'test.invalid';
  process.env.SMTP_FROM = 'sender@example.test';
  process.env.ADMIN_EMAIL = 'admin@example.test';
  process.env.ADMIN_SESSION_SECRET = 'isolated-test-session-secret-not-used-outside-this-process';
  const cookie = `nht_admin_session=${createAdminSession(getAdminUsername())}`;
  const schema = fs.readFileSync(path.join(__dirname, '../backend/data/schema.sql'), 'utf8');
  const table = schema.match(/CREATE TABLE IF NOT EXISTS contact_leads \([\s\S]*?\n\);/)[0];
  try {
    await client.query(table.replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE'));
    // Exercise the same additive migration as application startup, twice.
    const startup = fs.readFileSync(path.join(__dirname, '../backend/database.js'), 'utf8');
    const migration = startup.match(/ALTER TABLE contact_leads ADD COLUMN IF NOT EXISTS request_key[\s\S]*?CREATE UNIQUE INDEX[^;]+;/)[0];
    await client.query(migration);
    await client.query(migration);
    async function run(name, check, queryOverride) {
      await t.test(name, async () => {
        await client.query('TRUNCATE pg_temp.contact_leads');
        deliveries = []; failCustomer = false; failAdmin = false; pauseMail = null;
        process.env.SMTP_HOST = 'test.invalid';
        const db = { query: (...args) => queryOverride ? queryOverride(client, ...args) : client.query(...args) };
        const app = express(); app.use(express.json());
        app.use('/api/contact', createContactRoutes(db)); app.use('/api/leads', createLeadsRoutes(db));
        app.use((error, req, res, next) => res.status(500).json({ ok: false }));
        const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
        const base = `http://127.0.0.1:${server.address().port}`;
        const payload = { name: 'Test customer', email: 'customer@example.test', phone: '0900000000', company: '', taxCode: '', service: services[4].id, message: 'Test only', requestId: crypto.randomUUID() };
        const post = async (url, body, admin = false) => {
          const response = await fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(admin ? { cookie } : {}) }, body: JSON.stringify(body) });
          return { status: response.status, data: await response.json() };
        };
        const leads = async () => (await client.query('SELECT * FROM pg_temp.contact_leads')).rows;
        try { await check({ post, payload, leads }); } finally { await new Promise(resolve => server.close(resolve)); }
      });
    }
    await run('blank tax code accepted; new service names reach admin email and Excel', async ({ post, payload, leads }) => {
      assert.equal((await post('/api/contact', payload)).data.ok, true);
      assert.equal((await leads()).length, 1);
      assert.match(deliveries.find(x => x.to === 'admin@example.test').html, /Kế toán nội bộ &amp; tài chính/);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await createLeadsWorkbook([payload]));
      assert.equal(workbook.worksheets[0].getCell('H2').value, services[4].name);
    });
    await run('malformed tax code, unknown service and malformed request ID rejected', async ({ post, payload, leads }) => {
      for (const change of [{ taxCode: '123' }, { service: 'unknown' }, { requestId: 'bad' }]) assert.equal((await post('/api/contact', { ...payload, ...change })).status, 400);
      assert.equal((await leads()).length, 0); assert.equal(deliveries.length, 0);
    });
    await run('all six services remain accepted, including legacy IDs', async ({ post, payload, leads }) => {
      // Split across fresh limiters below; here verify four legacy IDs.
      for (const service of services.slice(0, 4)) assert.equal((await post('/api/contact', { ...payload, service: service.id, requestId: crypto.randomUUID() })).data.ok, true);
      assert.equal((await leads()).length, 4);
    });
    await run('digital service accepted with valid optional tax code', async ({ post, payload }) => {
      assert.equal((await post('/api/contact', { ...payload, service: services[5].id, taxCode: '0123456789-001' })).data.ok, true);
    });
    await run('concurrent duplicate submissions create one lead and one pair of emails', async ({ post, payload, leads }) => {
      const responses = await Promise.all([post('/api/contact', payload), post('/api/contact', payload)]);
      assert.ok(responses.every(x => x.data.ok)); assert.equal((await leads()).length, 1); assert.equal(deliveries.length, 2);
      assert.equal((await post('/api/contact', { ...payload, message: 'Changed' })).status, 409);
    });
    await run('SMTP failure is a saved success; retry does not create a second lead', async ({ post, payload, leads }) => {
      failCustomer = true; failAdmin = true;
      const first = await post('/api/contact', payload);
      assert.equal(first.status, 200); assert.equal(first.data.ok, true);
      assert.equal((await leads())[0].customer_mail_status, 'failed');
      assert.equal((await post('/api/contact', payload)).data.duplicate, true);
      assert.equal((await leads()).length, 1); assert.equal(deliveries.length, 2);
      failCustomer = false; failAdmin = false;
      const id = (await leads())[0].id;
      assert.equal((await post(`/api/leads/${id}/retry-email`, {}, false)).status, 401);
      assert.equal((await post(`/api/leads/${id}/retry-email`, {}, true)).data.ok, true);
      assert.equal((await leads())[0].admin_mail_status, 'sent'); assert.equal((await leads()).length, 1);
    });
    await run('admin retry sends only the failed recipient and serializes overlapping retries', async ({ post, payload, leads }) => {
      failAdmin = true; await post('/api/contact', payload); failAdmin = false;
      const id = (await leads())[0].id;
      const responses = await Promise.all([post(`/api/leads/${id}/retry-email`, {}, true), post(`/api/leads/${id}/retry-email`, {}, true)]);
      assert.ok(responses.every(x => x.data.ok));
      assert.equal(deliveries.filter(x => x.to === 'customer@example.test').length, 1);
      assert.equal(deliveries.filter(x => x.to === 'admin@example.test').length, 2);
    });
    await run('missing SMTP configuration preserves the lead for later retry', async ({ post, payload, leads }) => {
      process.env.SMTP_HOST = '';
      assert.equal((await post('/api/contact', payload)).data.ok, true);
      assert.equal((await leads())[0].customer_mail_status, 'not_configured'); assert.equal(deliveries.length, 0);
    });
    await run('email status storage failure never reports the saved lead as failed', async ({ post, payload, leads }) => {
      const response = await post('/api/contact', payload);
      assert.equal(response.data.ok, true); assert.equal(response.data.warning, 'mail_pending'); assert.equal((await leads()).length, 1);
    }, (db, sql, params) => {
      if (sql.includes('SET customer_mail_status')) throw new Error('Simulated status storage failure');
      return db.query(sql, params);
    });
    await run('database insert failure remains a failed submission', async ({ post, payload, leads }) => {
      assert.equal((await post('/api/contact', payload)).status, 500); assert.equal((await leads()).length, 0); assert.equal(deliveries.length, 0);
    }, (db, sql, params) => { if (sql.includes('INSERT INTO')) throw new Error('Simulated insert failure'); return db.query(sql, params); });
  } finally {
    nodemailer.createTransport = originalTransport;
    client.release(); await pool.end();
  }
});
