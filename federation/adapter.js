'use strict';

/**
 * adapter.js -- the Solar Explorer (Mom-) side of the federation protocol.
 *
 * Exports an Express Router mounted by server/index.js and a shared audit
 * ledger. This makes the game server a *federated service*: it self-describes
 * its capabilities, keeps a tamper-evident audit chain, and exposes the
 * /federation/* surface the Neural Swarm hub (jfjf) uses to register,
 * health-check, and forensically verify it -- without merging codebases.
 */

const path = require('path');
const express = require('express');

const protocol = require('./protocol');
const hubClient = require('./hub_client');

const SERVICE_ID = 'solar-explorer';

// Ledger file at the repo root (gitignored). One ledger per process.
const LEDGER_PATH = path.join(__dirname, '..', '.federation_ledger.json');
const ledger = new protocol.AuditLedger(SERVICE_ID, LEDGER_PATH);

function buildManifest(baseUrl) {
  return {
    federation_version: protocol.FEDERATION_VERSION,
    service_id: SERVICE_ID,
    display_name: 'Solar Explorer -- 3D Flight Sim',
    kind: 'service',
    language: 'node',
    base_url: baseUrl || 'http://localhost:3000',
    health_path: '/federation/health',
    audit_path: '/federation/audit',
    allowed_origins: [],
    allow_credentials: true,
    capabilities: [
      {
        name: 'solar.leaderboard',
        method: 'GET',
        path: '/federation/leaderboard',
        description: 'Scan-mission leaderboard snapshot.',
        equivalence: 'game-state',
        auth_required: false,
      },
      {
        name: 'solar.telemetry',
        method: 'POST',
        path: '/federation/telemetry',
        description: 'Record a flight/scan telemetry event to the audit chain.',
        equivalence: 'game-state',
        auth_required: false,
      },
    ],
  };
}

/** Append a federation audit event, and forward it to the hub if configured. */
function record(action, payload, actor) {
  const rec = ledger.append(action, payload || {}, actor);
  if (hubClient.enabled()) {
    // Fire-and-forget: never block the request or crash on hub downtime.
    hubClient
      .emit(`service.${SERVICE_ID}`, action, payload || {}, SERVICE_ID)
      .catch(() => {});
  }
  return rec;
}

/**
 * Register with the hub and emit a 'service.online' event, if configured.
 * Called on server startup. No-ops (returns {enabled:false}) unless
 * FEDERATION_HUB_URL is set, so default runs are unaffected.
 */
async function announce() {
  if (!hubClient.enabled()) {
    return { enabled: false };
  }
  const registered = await hubClient.register(buildManifest());
  const emitted = await hubClient.emit(
    `service.${SERVICE_ID}`,
    'service.online',
    { service_id: SERVICE_ID },
    SERVICE_ID
  );
  return { enabled: true, registered, emitted };
}

const router = express.Router();
router.use(express.json());

router.get('/federation/health', (req, res) => {
  res.json({
    status: 'ok',
    service_id: SERVICE_ID,
    federation_version: protocol.FEDERATION_VERSION,
    audit_records: ledger.length,
    secret_secure: !protocol.secretIsInsecure(),
  });
});

router.get('/federation/manifest', (req, res) => {
  res.json(buildManifest());
});

router.get('/federation/audit', (req, res) => {
  let limit = parseInt(req.query.limit, 10);
  if (!Number.isFinite(limit) || limit < 1) {
    limit = 200;
  }
  limit = Math.min(limit, 5000);
  res.json({
    service: SERVICE_ID,
    head: ledger.head(),
    records: ledger.tail(limit),
  });
});

// A tiny in-memory leaderboard so the advertised capability is real.
const leaderboard = [];

router.get('/federation/leaderboard', (req, res) => {
  res.json({ service: SERVICE_ID, entries: leaderboard.slice(0, 20) });
});

router.post('/federation/telemetry', (req, res) => {
  const body = req.body || {};
  const pilot = String(body.pilot || 'anon').slice(0, 40);
  // Score is coerced to an integer on purpose: the audit chain's cross-language
  // hash must avoid floats (see protocol.js).
  const score = Math.trunc(Number(body.score) || 0);
  leaderboard.push({ pilot: pilot, score: score });
  leaderboard.sort((a, b) => b.score - a.score);
  if (leaderboard.length > 100) {
    leaderboard.length = 100;
  }
  const rec = record('solar.telemetry', { pilot: pilot, score: score });
  res.json({ recorded: true, seq: rec.seq });
});

module.exports = { router, ledger, record, buildManifest, announce, SERVICE_ID };
