'use strict';

/**
 * hub_client.js -- outbound link from Solar Explorer to the federation hub.
 *
 * Turns this service from a pull-only federated member (it exposes an audit
 * chain the hub can read) into an active one: on startup it registers its
 * manifest with the hub, and it pushes activity events (e.g. telemetry) onto
 * the hub's event bus as they happen.
 *
 * Opt-in via the FEDERATION_HUB_URL env var and fails soft: if the hub is
 * unset or unreachable, every call is a safe no-op returning false, so the
 * game server never depends on the hub being up. The `fetch` implementation is
 * injectable so this is testable without network.
 */

function hubUrl() {
  return (process.env.FEDERATION_HUB_URL || '').trim().replace(/\/+$/, '');
}

function enabled() {
  return Boolean(hubUrl());
}

async function _post(path, { params, body, fetchImpl, timeoutMs = 3000 } = {}) {
  if (!enabled()) {
    return false;
  }
  const doFetch = fetchImpl || globalThis.fetch;
  let url = hubUrl() + path;
  if (params) {
    url += '?' + new URLSearchParams(params).toString();
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await doFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal: controller.signal,
    });
    return Boolean(resp && resp.ok);
  } catch (e) {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function register(manifest, opts = {}) {
  return _post('/federation/register', { body: manifest, ...opts });
}

async function emit(topic, eventType, payload, source, opts = {}) {
  return _post('/federation/bus/publish', {
    params: { topic, event_type: eventType, source },
    body: payload,
    ...opts,
  });
}

module.exports = { hubUrl, enabled, register, emit };
