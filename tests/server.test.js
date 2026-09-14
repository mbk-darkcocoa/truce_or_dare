const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { STORE_PATH, saveState } = require("../lib/store");

function resetStore() {
  saveState({ users: [], invites: [], connections: [], gameSessions: [] });
}

test("server supports login, presence, target user creation, and invite acceptance", async () => {
  resetStore();
  const serverPath = require.resolve(path.join(__dirname, "..", "server.js"));
  delete require.cache[serverPath];
  const { server } = require(serverPath);

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: "Ting",
        handle: "@ting",
        email: "ting@example.com",
      }),
    });
    assert.equal(loginResponse.status, 200);

    const cookie = loginResponse.headers.get("set-cookie");
    assert.match(cookie, /sid=/);

    const loginState = await loginResponse.json();
    assert.equal(loginState.currentUser.handle, "@ting");
    assert.equal(loginState.currentUser.isOnline, true);

    const createTargetResponse = await fetch(`${baseUrl}/api/target-connections`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        displayName: "Glenn",
        handle: "@glenn",
        email: "glenn@example.com",
        attemptConnection: true,
        connectionMessage: "Please test the local flow.",
      }),
    });
    assert.equal(createTargetResponse.status, 201);
    const targetState = await createTargetResponse.json();
    assert.equal(targetState.knownUsers[0].handle, "@glenn");
    assert.equal(targetState.sentInvites.length, 1);
    assert.match(targetState.sentInvites[0].githubNudge.text, /@glenn/);

    const presenceResponse = await fetch(`${baseUrl}/api/presence`, {
      method: "POST",
      headers: { cookie },
    });
    assert.equal(presenceResponse.status, 200);
    const presenceState = await presenceResponse.json();
    assert.equal(presenceState.currentUser.isOnline, true);
    assert.equal(presenceState.knownUsers[0].isOnline, false);

    const glennLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: "Glenn",
        handle: "@glenn",
        email: "glenn@example.com",
      }),
    });
    const glennCookie = glennLoginResponse.headers.get("set-cookie");
    const glennState = await glennLoginResponse.json();
    assert.equal(glennState.receivedInvites.length, 1);

    const acceptResponse = await fetch(
      `${baseUrl}/api/invites/${glennState.receivedInvites[0].id}/accept`,
      {
        method: "POST",
        headers: { cookie: glennCookie },
      },
    );
    assert.equal(acceptResponse.status, 200);
    const acceptedState = await acceptResponse.json();
    assert.equal(acceptedState.connections.length, 1);

    const storedState = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
    assert.equal(storedState.connections.length, 1);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
