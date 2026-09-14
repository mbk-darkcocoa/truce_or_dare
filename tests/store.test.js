const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const store = require("../lib/store");

test("store path can be overridden for Linux deployments", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "truce-or-dare-store-"));
  const customStorePath = path.join(tempDir, "state", "store.json");
  const originalStorePath = process.env.TRUCE_OR_DARE_DATA_PATH;

  process.env.TRUCE_OR_DARE_DATA_PATH = customStorePath;

  try {
    store.saveState({
      users: [],
      invites: [],
      connections: [],
      gameSessions: [],
      chatMessages: [],
      ironcladEvents: [],
    });

    assert.equal(store.getStorePath(), customStorePath);
    assert.equal(fs.existsSync(customStorePath), true);
    assert.deepEqual(store.loadState(), {
      users: [],
      invites: [],
      connections: [],
      gameSessions: [],
      chatMessages: [],
      ironcladEvents: [],
    });
  } finally {
    if (originalStorePath === undefined) {
      delete process.env.TRUCE_OR_DARE_DATA_PATH;
    } else {
      process.env.TRUCE_OR_DARE_DATA_PATH = originalStorePath;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
