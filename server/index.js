const path = require('path');
const express = require('express');

const logger = require('./middleware/logger');
const federation = require('../federation/adapter');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(logger);
// Federation adapter (/federation/*): makes this game server a federated
// service the Neural Swarm hub can register, health-check, and forensically
// verify via a tamper-evident audit chain.
app.use(federation.router);
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/vendor/three.module.js', express.static(path.join(__dirname, '..', 'node_modules', 'three', 'build', 'three.module.js')));

app.listen(PORT, () => {
  console.log(`solar-explorer listening on http://localhost:${PORT}`);
  // Announce to the federation hub if FEDERATION_HUB_URL is set (no-op
  // otherwise; fails soft so hub downtime never affects the game server).
  federation
    .announce()
    .then((r) => {
      if (r.enabled) {
        console.log('federation: announced to hub', r);
      }
    })
    .catch(() => {});
});
