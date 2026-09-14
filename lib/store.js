const fs = require("node:fs");
const path = require("node:path");

const STORE_PATH = path.join(__dirname, "..", "data", "store.json");

function ensureStoreFile() {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(
      STORE_PATH,
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
  return JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
}

function saveState(state) {
  ensureStoreFile();
  fs.writeFileSync(STORE_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

function mutateState(mutator) {
  const state = loadState();
  const result = mutator(state);
  saveState(state);
  return result;
}

module.exports = {
  STORE_PATH,
  loadState,
  saveState,
  mutateState,
};
