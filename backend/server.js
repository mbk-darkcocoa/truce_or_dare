'use strict';

const path = require('node:path');
const { JsonFileStore, resolveDefaultDataPath } = require('../shared/store');
const { createServer } = require('./app');

const port = Number(process.env.PORT || 3000);
const store = new JsonFileStore(resolveDefaultDataPath());
const frontendDir = path.join(process.cwd(), 'frontend');
const server = createServer({ store, frontendDir });

server.listen(port, () => {
  process.stdout.write(`truce_or_dare listening on http://127.0.0.1:${port}\n`);
});
