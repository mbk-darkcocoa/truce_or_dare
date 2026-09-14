'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { createSeedData } = require('./seed');

class JsonFileStore {
  constructor(filePath = resolveDefaultDataPath()) {
    this.filePath = filePath;
  }

  async read() {
    await this.#ensureFile();
    const raw = await fs.readFile(this.filePath, 'utf8');
    return JSON.parse(raw);
  }

  async write(data) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2));
    return data;
  }

  async update(mutator) {
    const data = await this.read();
    const nextData = await mutator(data);
    await this.write(nextData);
    return nextData;
  }

  async #ensureFile() {
    try {
      await fs.access(this.filePath);
    } catch {
      await this.write(createSeedData());
    }
  }
}

function resolveDefaultDataPath() {
  return process.env.TRUCE_OR_DARE_DATA_PATH || path.join(process.cwd(), 'data', 'store.json');
}

module.exports = {
  JsonFileStore,
  resolveDefaultDataPath
};
