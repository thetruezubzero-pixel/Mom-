'use strict';

/**
 * test_federation.js -- tests for the Solar Explorer federation adapter.
 *
 * Plain Node + assert (no test framework dependency). Run with:
 *     node federation/test_federation.js
 * or  npm test
 *
 * The most important test here is CROSS-LANGUAGE: it pins the record hash and
 * signature to values independently computed by the Python protocol
 * implementation, proving the four repos share one verifiable chain format.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const protocol = require('./protocol');
const hubClient = require('./hub_client');

// Tests register here and run sequentially at the end, so async tests are
// awaited (some hub-client tests are async).
const _tests = [];
function test(name, fn) {
  _tests.push({ name, fn });
}

function tmpLedger(service) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fed-'));
  return new protocol.AuditLedger(service || 'solar-explorer', path.join(dir, 'l.json'));
}

// --- cross-language interop (the load-bearing test) ----------------------
test('record hash matches the Python implementation byte-for-byte', () => {
  const payload = {
    pilot: 'Zoë',
    score: 42,
    nested: { b: true, a: null },
    list: [1, 2, 3],
  };
  const h = protocol.recordHash(
    0,
    '2026-07-25T00:00:00+00:00',
    'solar-explorer',
    'solar.telemetry',
    'solar-explorer',
    payload,
    protocol.GENESIS_PREV_HASH
  );
  // Value produced by app/federation/protocol.py record_hash() for the same input.
  assert.strictEqual(
    h,
    '513aec0f0d75909a3577ac7d719e7d26d99cbaee31f6cfbc8b9bf3dc3d0395c2'
  );
  assert.strictEqual(
    protocol.sign(h, 'test-secret'),
    'fec905c179b995abb77576c4f979f72a78699c3dd7b53fe43ba87903df2a95dd'
  );
});

test('canonical form sorts keys and stays compact', () => {
  const canon = protocol.canonical({
    pilot: 'Zoë',
    score: 42,
    nested: { b: true, a: null },
    list: [1, 2, 3],
  });
  assert.strictEqual(
    canon,
    '{"list":[1,2,3],"nested":{"a":null,"b":true},"pilot":"Zoë","score":42}'
  );
});

// --- ledger behaviour ----------------------------------------------------
test('appends link by previous hash and verify passes', () => {
  const led = tmpLedger();
  const r0 = led.append('boot', { n: 0 });
  const r1 = led.append('telemetry', { n: 1 });
  assert.strictEqual(r0.prev_hash, protocol.GENESIS_PREV_HASH);
  assert.strictEqual(r1.prev_hash, r0.hash);
  assert.strictEqual(protocol.verifyChain(led.tail()).intact, true);
});

test('tampering with a past record is detected', () => {
  const led = tmpLedger();
  led.append('score', { points: 10 });
  led.append('score', { points: 20 });
  const recs = led.tail();
  recs[0].payload.points = 9999;
  const report = protocol.verifyChain(recs);
  assert.strictEqual(report.intact, false);
  assert.strictEqual(report.first_break.seq, 0);
  assert.strictEqual(report.first_break.reason, 'hash_mismatch');
});

test('a wrong secret fails signature verification', () => {
  const led = tmpLedger();
  led.append('boot', {});
  const report = protocol.verifyChain(led.tail(), 'the-wrong-secret');
  assert.strictEqual(report.intact, false);
  assert.strictEqual(report.first_break.reason, 'bad_signature');
});

test('ledger persists across reopen', () => {
  const led = tmpLedger();
  led.append('a', {});
  const reopened = new protocol.AuditLedger(led.serviceId, led.path);
  assert.strictEqual(reopened.length, 1);
});

// --- outbound hub client -------------------------------------------------
test('hub client is a no-op when FEDERATION_HUB_URL is unset', async () => {
  delete process.env.FEDERATION_HUB_URL;
  assert.strictEqual(hubClient.enabled(), false);
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return { ok: true };
  };
  const ok = await hubClient.register({ service_id: 'solar-explorer' }, { fetchImpl });
  assert.strictEqual(ok, false);
  assert.strictEqual(called, false); // never touched the network
});

test('register and emit hit the expected hub endpoints', async () => {
  process.env.FEDERATION_HUB_URL = 'http://hub.local';
  const seen = [];
  const fetchImpl = async (url, opts) => {
    seen.push({ url, body: JSON.parse(opts.body) });
    return { ok: true };
  };
  assert.strictEqual(
    await hubClient.register({ service_id: 'solar-explorer' }, { fetchImpl }),
    true
  );
  assert.strictEqual(
    await hubClient.emit('service.solar-explorer', 't', { n: 1 }, 'solar-explorer', {
      fetchImpl,
    }),
    true
  );
  assert.ok(seen[0].url.endsWith('/federation/register'));
  assert.ok(seen[1].url.includes('/federation/bus/publish'));
  assert.ok(seen[1].url.includes('source=solar-explorer'));
  delete process.env.FEDERATION_HUB_URL;
});

test('announce no-ops when the hub is not configured', async () => {
  delete process.env.FEDERATION_HUB_URL;
  const adapter = require('./adapter');
  const result = await adapter.announce();
  assert.deepStrictEqual(result, { enabled: false });
});

(async () => {
  let passed = 0;
  for (const { name, fn } of _tests) {
    try {
      await fn();
    } catch (e) {
      console.error('FAIL ' + name);
      console.error(e);
      process.exit(1);
    }
    passed += 1;
    console.log('ok  ' + name);
  }
  console.log('\n' + passed + ' passed');
})();
