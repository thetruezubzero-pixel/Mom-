const path = require('path');
const express = require('express');

const logger = require('./middleware/logger');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(logger);
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/vendor/three.module.js', express.static(path.join(__dirname, '..', 'node_modules', 'three', 'build', 'three.module.js')));

app.listen(PORT, () => {
  console.log(`solar-explorer listening on http://localhost:${PORT}`);
});
