const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_STORE_PATH = path.join(__dirname, "..", "data", "store.json");

function getStorePath() {
  return path.resolve(process.env.TRUCE_OR_DARE_DATA_PATH || DEFAULT_STORE_PATH);
}

function ensureStoreFile() {
  const storePath = getStorePath();
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(
      storePath,
      JSON.stringify(
        { users: [], invites: [], connections: [], gameSessions: [], chatMessages: [], ironcladEvents: [] },
        null,
        2,
      ),
    );
  }
}

function loadState() {
  ensureStoreFile();
  return JSON.parse(fs.readFileSync(getStorePath(), "utf8"));
}

function saveState(state) {
  ensureStoreFile();
  fs.writeFileSync(getStorePath(), `${JSON.stringify(state, null, 2)}\n`);
}

function mutateState(mutator) {
  const state = loadState();
  const result = mutator(state);
  saveState(state);
  return result;
}

module.exports = {
  DEFAULT_STORE_PATH,
  getStorePath,
  loadState,
  saveState,
  mutateState,
};
