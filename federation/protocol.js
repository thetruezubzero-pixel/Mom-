'use strict';

/**
 * protocol.js -- the JavaScript side of the language-agnostic federation
 * wire format. This is the byte-for-byte counterpart of the Python
 * federation/protocol.py in the jfjf, Jit-, and map repos.
 *
 * The single rule that keeps hashes identical across languages is the
 * canonicalization: recursively key-sorted JSON with compact separators and
 * NO escaping of non-ASCII (matching Python's
 *   json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
 * ). Keep payloads JSON-primitive and avoid floats -- Python renders 1.0 as
 * "1.0" while JS renders it as "1", which would diverge the hash. Integers,
 * strings, booleans, null, arrays and objects all serialize identically.
 *
 * The audit chain is tamper-evident (each record commits to the previous
 * one's hash) and each record is HMAC-signed with a shared federation secret.
 * It is deliberately LOCAL -- no on-chain / IPFS infrastructure.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const FEDERATION_VERSION = '1.0';
const GENESIS_PREV_HASH = '0'.repeat(64);
const DEV_SECRET = 'federation-dev-insecure-secret-change-me';

function federationSecret() {
  const value = (process.env.FEDERATION_SECRET || '').trim();
  return value || DEV_SECRET;
}

function secretIsInsecure(secret) {
  const s = secret === undefined ? federationSecret() : secret;
  return !s || s === DEV_SECRET;
}

function utcnowIso() {
  // Second precision, timezone-aware UTC, matching the Python adapter's
  // "+00:00" suffix (not the "Z" that toISOString() would produce).
  return new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00');
}

/**
 * Deterministic JSON used for hashing. Must match the Python `canonical`.
 */
function canonical(value) {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonical).join(',') + ']';
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return (
      '{' +
      keys.map((k) => JSON.stringify(k) + ':' + canonical(value[k])).join(',') +
      '}'
    );
  }
  // Strings, numbers, booleans: JSON.stringify matches Python's json for
  // these primitives (given the no-float caveat documented above).
  return JSON.stringify(value);
}

function recordHash(seq, ts, service, action, actor, payload, prevHash) {
  const body = canonical({
    seq: seq,
    ts: ts,
    service: service,
    action: action,
    actor: actor,
    payload: payload,
    prev_hash: prevHash,
  });
  return crypto.createHash('sha256').update(body, 'utf8').digest('hex');
}

function sign(recordHashHex, secret) {
  const s = secret === undefined ? federationSecret() : secret;
  return crypto.createHmac('sha256', s).update(recordHashHex, 'utf8').digest('hex');
}

/**
 * A file-backed, hash-chained, append-only audit ledger.
 */
class AuditLedger {
  constructor(serviceId, filePath) {
    this.serviceId = serviceId;
    this.path =
      filePath || path.join(__dirname, '..', '.federation_ledger.json');
    this.records = [];
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.path)) {
        this.records = JSON.parse(fs.readFileSync(this.path, 'utf8'));
      }
    } catch (e) {
      // A corrupt ledger is itself a forensic signal; start fresh but do not
      // crash the host server on boot.
      this.records = [];
    }
  }

  _save() {
    const tmp = this.path + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.records, null, 2));
    fs.renameSync(tmp, this.path);
    try {
      fs.chmodSync(this.path, 0o600);
    } catch (e) {
      /* best effort */
    }
  }

  append(action, payload, actor) {
    const seq = this.records.length;
    const prevHash = seq > 0 ? this.records[seq - 1].hash : GENESIS_PREV_HASH;
    const ts = utcnowIso();
    const who = actor || this.serviceId;
    const h = recordHash(seq, ts, this.serviceId, action, who, payload, prevHash);
    const rec = {
      seq: seq,
      ts: ts,
      service: this.serviceId,
      action: action,
      actor: who,
      payload: payload,
      prev_hash: prevHash,
      hash: h,
      sig: sign(h),
    };
    this.records.push(rec);
    this._save();
    return rec;
  }

  head() {
    return this.records.length
      ? this.records[this.records.length - 1].hash
      : GENESIS_PREV_HASH;
  }

  tail(limit) {
    if (!limit) {
      return this.records.slice();
    }
    return this.records.slice(-limit);
  }

  get length() {
    return this.records.length;
  }
}

/**
 * Verify a chain of record objects (from any service, any language). Mirrors
 * the Python `verify_chain` return shape so the hub treats both identically.
 */
function verifyChain(records, secret) {
  const s = secret === undefined ? federationSecret() : secret;
  let prevHash = GENESIS_PREV_HASH;
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (r.seq !== i) {
      return breakAt(i, 'seq_out_of_order', `expected seq ${i}, got ${r.seq}`);
    }
    if (r.prev_hash !== prevHash) {
      return breakAt(i, 'broken_link', 'prev_hash does not match prior record hash');
    }
    const expected = recordHash(
      r.seq, r.ts, r.service, r.action, r.actor, r.payload, r.prev_hash
    );
    if (r.hash !== expected) {
      return breakAt(i, 'hash_mismatch', 'record content was altered after signing');
    }
    const expectedSig = sign(expected, s);
    const actualSig = r.sig || '';
    const good =
      actualSig.length === expectedSig.length &&
      crypto.timingSafeEqual(
        Buffer.from(actualSig, 'utf8'),
        Buffer.from(expectedSig, 'utf8')
      );
    if (!good) {
      return breakAt(i, 'bad_signature', 'signature invalid for the federation secret');
    }
    prevHash = r.hash;
  }
  return { intact: true, length: records.length, head: prevHash, first_break: null };
}

function breakAt(index, reason, detail) {
  return { intact: false, first_break: { seq: index, reason: reason, detail: detail } };
}

module.exports = {
  FEDERATION_VERSION,
  GENESIS_PREV_HASH,
  federationSecret,
  secretIsInsecure,
  canonical,
  recordHash,
  sign,
  AuditLedger,
  verifyChain,
  utcnowIso,
};
