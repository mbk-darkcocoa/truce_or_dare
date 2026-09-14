const test = require("node:test");
const assert = require("node:assert/strict");

const {
  acceptInvite,
  buildDashboard,
  createChatMessage,
  createGameSession,
  createIroncladBeacon,
  createInvite,
  createTargetUser,
  ensureState,
  isUserOnline,
  normalizeHandle,
  touchUser,
  upsertUser,
  updateProfile,
} = require("../lib/app");

function createState() {
  return ensureState({
    users: [],
    invites: [],
    connections: [],
    gameSessions: [],
    chatMessages: [],
    ironcladEvents: [],
  });
}

test("normalizeHandle lowercases and adds prefix", () => {
  assert.equal(normalizeHandle("Ting_Player"), "@ting_player");
});

test("upsertUser creates and updates by handle", () => {
  const state = createState();
  const user = upsertUser(state, {
    displayName: "Ting",
    handle: "ting",
    email: "ting@example.com",
  });

  const updated = upsertUser(state, {
    displayName: "Ting Prime",
    handle: "@ting",
    email: "ting@example.com",
  });

  assert.equal(state.users.length, 1);
  assert.equal(user.id, updated.id);
  assert.equal(updated.displayName, "Ting Prime");
});

test("updateProfile rejects duplicate email", () => {
  const state = createState();
  const first = upsertUser(state, {
    displayName: "Ting",
    handle: "ting",
    email: "ting@example.com",
  });
  upsertUser(state, {
    displayName: "Glenn",
    handle: "glenn",
    email: "glenn@example.com",
  });

  assert.throws(
    () =>
      updateProfile(state, first.id, {
        displayName: "Ting",
        handle: "ting",
        email: "glenn@example.com",
      }),
    /already connected/,
  );
});

test("createInvite requires consent and blocks duplicates", () => {
  const state = createState();
  const sender = upsertUser(state, { displayName: "Ting", handle: "ting", email: "" });

  assert.throws(
    () =>
      createInvite(state, sender.id, {
        recipientType: "handle",
        recipientValue: "@glenn",
        consentConfirmed: false,
      }),
    /must confirm consent/,
  );

  createInvite(state, sender.id, {
    recipientType: "handle",
    recipientValue: "glenn",
    consentConfirmed: true,
    message: "Join the round",
  });

  assert.throws(
    () =>
      createInvite(state, sender.id, {
        recipientType: "handle",
        recipientValue: "@glenn",
        consentConfirmed: true,
      }),
    /already a pending invite/,
  );
});

test("createTargetUser can also attempt a connection", () => {
  const state = createState();
  const sender = upsertUser(state, { displayName: "Ting", handle: "ting", email: "" });

  const target = createTargetUser(state, sender.id, {
    displayName: "Glenn",
    handle: "glenn",
    email: "glenn@example.com",
    attemptConnection: true,
    connectionMessage: "Join my Truce or Dare circle.",
  });

  assert.equal(target.handle, "@glenn");
  assert.equal(state.users.length, 2);
  assert.equal(target.lastActiveAt, null);
  assert.equal(state.invites.length, 1);
  assert.equal(state.invites[0].recipientType, "email");
});

test("createTargetUser rejects self-targeting", () => {
  const state = createState();
  const sender = upsertUser(state, { displayName: "Ting", handle: "ting", email: "" });

  assert.throws(
    () =>
      createTargetUser(state, sender.id, {
        displayName: "Still Ting",
        handle: "@ting",
        attemptConnection: false,
      }),
    /cannot add yourself/,
  );
});

test("touchUser marks a user online and dashboard exposes a GitHub-ready nudge", () => {
  const state = createState();
  const sender = upsertUser(state, { displayName: "Ting", handle: "ting", email: "" });
  const recipient = upsertUser(state, { displayName: "Glenn", handle: "glenn", email: "" });

  createInvite(state, sender.id, {
    recipientType: "handle",
    recipientValue: "@glenn",
    consentConfirmed: true,
    message: "Please test the local flow.",
  });
  touchUser(state, recipient.id);

  const dashboard = buildDashboard(state, sender.id);

  assert.equal(isUserOnline(recipient), true);
  assert.equal(dashboard.knownUsers[0].isOnline, true);
  assert.match(dashboard.sentInvites[0].githubNudge.text, /@glenn/);
});

test("acceptInvite creates a connection for a matching recipient", () => {
  const state = createState();
  const sender = upsertUser(state, { displayName: "Ting", handle: "ting", email: "" });
  const recipient = upsertUser(state, {
    displayName: "Glenn",
    handle: "glenn",
    email: "glenn@example.com",
  });

  const invite = createInvite(state, sender.id, {
    recipientType: "handle",
    recipientValue: "@glenn",
    consentConfirmed: true,
  });

  acceptInvite(state, recipient.id, invite.id);

  assert.equal(state.invites[0].status, "accepted");
  assert.equal(state.connections.length, 1);
  assert.deepEqual(new Set(state.connections[0].userIds), new Set([sender.id, recipient.id]));
});

test("createGameSession validates the minimal session shape", () => {
  const state = createState();
  const user = upsertUser(state, { displayName: "Ting", handle: "ting", email: "" });
  const session = createGameSession(state, user.id, {
    title: "Friday reset",
    mode: "both",
    stakes: "Loser records the next dare.",
  });

  assert.equal(state.gameSessions.length, 1);
  assert.equal(session.hostUserId, user.id);
});

test("createChatMessage and createIroncladBeacon update dashboard telemetry", () => {
  const state = createState();
  const user = upsertUser(state, { displayName: "Ting", handle: "ting", email: "" });

  createChatMessage(state, user.id, { body: "Ironclad chat is online." });
  createIroncladBeacon(state, user.id, { label: "Ops pulse", detail: "All systems green." });

  const dashboard = buildDashboard(state, user.id);

  assert.equal(state.chatMessages.length, 1);
  assert.equal(dashboard.chatMessages[0].body, "Ironclad chat is online.");
  assert.equal(dashboard.ironclad.name, "Ironclad");
  assert.equal(dashboard.ironclad.telemetry.chatMessages, 1);
  assert.equal(dashboard.ironclad.recentEvents[0].type, "ironclad.beacon");
});
