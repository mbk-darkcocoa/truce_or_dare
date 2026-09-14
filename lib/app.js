const crypto = require("node:crypto");

const HANDLE_RE = /^@?[a-z0-9_]{3,30}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MODES = new Set(["truce", "dare", "both"]);
const ONLINE_WINDOW_MS = 2 * 60 * 1000;

function ensureState(state) {
  if (!state || typeof state !== "object") {
    return { users: [], invites: [], connections: [], gameSessions: [], chatMessages: [], ironcladEvents: [] };
  }

  state.users ||= [];
  state.invites ||= [];
  state.connections ||= [];
  state.gameSessions ||= [];
  state.chatMessages ||= [];
  state.ironcladEvents ||= [];
  return state;
}

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeDisplayName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeHandle(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) {
    return "";
  }
  return raw.startsWith("@") ? raw : `@${raw}`;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isUserOnline(user, now = Date.now()) {
  if (!user?.lastActiveAt) {
    return false;
  }

  const lastActiveAt = Date.parse(user.lastActiveAt);
  if (Number.isNaN(lastActiveAt)) {
    return false;
  }

  return now - lastActiveAt <= ONLINE_WINDOW_MS;
}

function normalizeRecipientValue(type, value) {
  if (type === "handle") {
    return normalizeHandle(value);
  }
  if (type === "email") {
    return normalizeEmail(value);
  }
  throw createError("Invite type must be handle or email.");
}

function findUserById(state, userId) {
  return ensureState(state).users.find((user) => user.id === userId) || null;
}

function recordIroncladEvent(state, type, actorUserId, summary) {
  const nextState = ensureState(state);
  nextState.ironcladEvents.unshift({
    id: crypto.randomUUID(),
    type,
    actorUserId,
    summary,
    createdAt: new Date().toISOString(),
  });
  nextState.ironcladEvents = nextState.ironcladEvents.slice(0, 25);
}

function validateUserInput(state, payload, currentUserId = null) {
  const displayName = normalizeDisplayName(payload.displayName);
  const handle = normalizeHandle(payload.handle);
  const email = normalizeEmail(payload.email);

  if (displayName.length < 2 || displayName.length > 40) {
    throw createError("Display name must be between 2 and 40 characters.");
  }

  if (!HANDLE_RE.test(handle)) {
    throw createError("Handle must be 3-30 letters, numbers, or underscores.");
  }

  if (email && !EMAIL_RE.test(email)) {
    throw createError("Email must be valid.");
  }

  const users = ensureState(state).users;
  const duplicateHandle = users.find((user) => user.handle === handle && user.id !== currentUserId);
  if (duplicateHandle) {
    throw createError("That handle is already taken.");
  }

  if (email) {
    const duplicateEmail = users.find((user) => user.email === email && user.id !== currentUserId);
    if (duplicateEmail) {
      throw createError("That email is already connected to another profile.");
    }
  }

  return { displayName, handle, email };
}

function upsertUser(state, payload, options = {}) {
  const nextState = ensureState(state);
  const requestedHandle = normalizeHandle(payload.handle);
  const existingUser = nextState.users.find((user) => user.handle === requestedHandle) || null;
  const { displayName, handle, email } = validateUserInput(
    nextState,
    payload,
    existingUser?.id || null,
  );

  if (existingUser) {
    existingUser.displayName = displayName;
    existingUser.email = email;
    existingUser.updatedAt = new Date().toISOString();
    if (options.markActive !== false) {
      existingUser.lastActiveAt = existingUser.updatedAt;
    }
    return existingUser;
  }

  const now = new Date().toISOString();
  const user = {
    id: crypto.randomUUID(),
    displayName,
    handle,
    email,
    bio: "",
    createdAt: now,
    updatedAt: now,
    lastActiveAt: options.markActive === false ? null : now,
  };
  nextState.users.push(user);
  return user;
}

function touchUser(state, userId) {
  const user = findUserById(state, userId);
  if (!user) {
    throw createError("User not found.", 404);
  }

  user.lastActiveAt = new Date().toISOString();
  user.updatedAt = user.lastActiveAt;
  return user;
}

function updateProfile(state, userId, payload) {
  const nextState = ensureState(state);
  const user = findUserById(nextState, userId);
  if (!user) {
    throw createError("User not found.", 404);
  }

  const displayName = payload.displayName === undefined ? user.displayName : payload.displayName;
  const handle = payload.handle === undefined ? user.handle : payload.handle;
  const email = payload.email === undefined ? user.email : payload.email;
  const { displayName: safeName, handle: safeHandle, email: safeEmail } = validateUserInput(
    nextState,
    { displayName, handle, email },
    userId,
  );
  const bio = String(payload.bio ?? user.bio ?? "").trim();
  if (bio.length > 280) {
    throw createError("Bio must be 280 characters or fewer.");
  }

  user.displayName = safeName;
  user.handle = safeHandle;
  user.email = safeEmail;
  user.bio = bio;
  user.updatedAt = new Date().toISOString();
  user.lastActiveAt = user.updatedAt;
  return user;
}

function createGameSession(state, userId, payload) {
  const nextState = ensureState(state);
  const user = findUserById(nextState, userId);
  if (!user) {
    throw createError("User not found.", 404);
  }

  const title = String(payload.title || "").trim();
  const mode = String(payload.mode || "").trim().toLowerCase();
  const stakes = String(payload.stakes || "").trim();

  if (title.length < 3 || title.length > 80) {
    throw createError("Session title must be between 3 and 80 characters.");
  }

  if (!MODES.has(mode)) {
    throw createError("Session mode must be truce, dare, or both.");
  }

  if (stakes.length < 3 || stakes.length > 240) {
    throw createError("Stakes must be between 3 and 240 characters.");
  }

  const gameSession = {
    id: crypto.randomUUID(),
    hostUserId: user.id,
    title,
    mode,
    stakes,
    status: "open",
    createdAt: new Date().toISOString(),
  };
  nextState.gameSessions.unshift(gameSession);
  touchUser(nextState, userId);
  recordIroncladEvent(nextState, "session.created", userId, `Opened ${mode} session "${title}"`);
  return gameSession;
}

function createInvite(state, userId, payload) {
  const nextState = ensureState(state);
  const sender = findUserById(nextState, userId);
  if (!sender) {
    throw createError("User not found.", 404);
  }

  const recipientType = String(payload.recipientType || "").trim().toLowerCase();
  const recipientValue = normalizeRecipientValue(recipientType, payload.recipientValue);
  const message = String(payload.message || "").trim();
  const consentConfirmed = payload.consentConfirmed === true;

  if (!consentConfirmed) {
    throw createError("You must confirm consent before sending an invite.");
  }

  if (recipientType === "handle" && !HANDLE_RE.test(recipientValue)) {
    throw createError("Handle invites must target a valid handle.");
  }

  if (recipientType === "email" && !EMAIL_RE.test(recipientValue)) {
    throw createError("Email invites must target a valid email address.");
  }

  if (message.length > 240) {
    throw createError("Invite message must be 240 characters or fewer.");
  }

  if (
    (recipientType === "handle" && sender.handle === recipientValue) ||
    (recipientType === "email" && sender.email && sender.email === recipientValue)
  ) {
    throw createError("You cannot invite yourself.");
  }

  const duplicate = nextState.invites.find(
    (invite) =>
      invite.senderUserId === userId &&
      invite.recipientType === recipientType &&
      invite.recipientValue === recipientValue &&
      invite.status === "pending",
  );
  if (duplicate) {
    throw createError("There is already a pending invite for that target.");
  }

  const invite = {
    id: crypto.randomUUID(),
    senderUserId: userId,
    recipientType,
    recipientValue,
    message,
    consentConfirmed,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  nextState.invites.unshift(invite);
  touchUser(nextState, userId);
  recordIroncladEvent(
    nextState,
    "invite.created",
    userId,
    `Created ${recipientType} invite for ${recipientValue}`,
  );
  return invite;
}

function inviteMatchesUser(invite, user) {
  return (
    (invite.recipientType === "handle" && invite.recipientValue === user.handle) ||
    (invite.recipientType === "email" && user.email && invite.recipientValue === user.email)
  );
}

function createTargetUser(state, actorUserId, payload) {
  const nextState = ensureState(state);
  const actor = findUserById(nextState, actorUserId);
  if (!actor) {
    throw createError("User not found.", 404);
  }

  if (normalizeHandle(payload.handle) === actor.handle) {
    throw createError("You cannot add yourself as a target user.");
  }

  const targetUser = upsertUser(nextState, {
    displayName: payload.displayName,
    handle: payload.handle,
    email: payload.email || "",
  }, { markActive: false });

  if (targetUser.id === actorUserId) {
    throw createError("You are already this user.");
  }

  const shouldAttemptConnection = payload.attemptConnection === true;
  if (shouldAttemptConnection) {
    const recipientType = targetUser.email ? "email" : "handle";
    const recipientValue = recipientType === "email" ? targetUser.email : targetUser.handle;
    createInvite(nextState, actorUserId, {
      recipientType,
      recipientValue,
      message: payload.connectionMessage || `Hi ${targetUser.displayName}, want to join Truce or Dare?`,
      consentConfirmed: true,
    });
  }

  touchUser(nextState, actor.id);
  recordIroncladEvent(nextState, "target.saved", actor.id, `Saved target user ${targetUser.handle}`);
  return targetUser;
}

function acceptInvite(state, userId, inviteId) {
  const nextState = ensureState(state);
  const user = findUserById(nextState, userId);
  if (!user) {
    throw createError("User not found.", 404);
  }

  const invite = nextState.invites.find((entry) => entry.id === inviteId);
  if (!invite) {
    throw createError("Invite not found.", 404);
  }

  if (invite.status !== "pending") {
    throw createError("Only pending invites can be accepted.");
  }

  if (!inviteMatchesUser(invite, user)) {
    throw createError("This invite does not match your profile.", 403);
  }

  const alreadyConnected = nextState.connections.find(
    (connection) =>
      connection.userIds.includes(userId) && connection.userIds.includes(invite.senderUserId),
  );
  if (!alreadyConnected) {
    nextState.connections.unshift({
      id: crypto.randomUUID(),
      userIds: [invite.senderUserId, userId],
      sourceInviteId: invite.id,
      createdAt: new Date().toISOString(),
    });
  }

  invite.status = "accepted";
  invite.acceptedByUserId = userId;
  invite.updatedAt = new Date().toISOString();
  touchUser(nextState, userId);
  recordIroncladEvent(
    nextState,
    "invite.accepted",
    userId,
    `Accepted invite from ${findUserById(nextState, invite.senderUserId)?.handle || "unknown"}`,
  );
  return invite;
}

function createChatMessage(state, userId, payload) {
  const nextState = ensureState(state);
  const user = findUserById(nextState, userId);
  if (!user) {
    throw createError("User not found.", 404);
  }

  const body = String(payload.body || "").trim();
  if (body.length < 1 || body.length > 280) {
    throw createError("Chat messages must be between 1 and 280 characters.");
  }

  const message = {
    id: crypto.randomUUID(),
    userId,
    body,
    createdAt: new Date().toISOString(),
  };
  nextState.chatMessages.unshift(message);
  nextState.chatMessages = nextState.chatMessages.slice(0, 50);
  touchUser(nextState, userId);
  recordIroncladEvent(nextState, "chat.message", userId, `Posted Ironclad chat: ${body.slice(0, 60)}`);
  return message;
}

function createIroncladBeacon(state, userId, payload) {
  const nextState = ensureState(state);
  const user = findUserById(nextState, userId);
  if (!user) {
    throw createError("User not found.", 404);
  }

  const label = String(payload.label || "").trim();
  const detail = String(payload.detail || "").trim();
  if (label.length < 2 || label.length > 40) {
    throw createError("Beacon label must be between 2 and 40 characters.");
  }
  if (detail.length < 2 || detail.length > 240) {
    throw createError("Beacon detail must be between 2 and 240 characters.");
  }

  touchUser(nextState, userId);
  recordIroncladEvent(nextState, "ironclad.beacon", userId, `${label}: ${detail}`);
  return nextState.ironcladEvents[0];
}

function findUserForInvite(state, invite) {
  return (
    state.users.find((user) => inviteMatchesUser(invite, user)) ||
    null
  );
}

function formatInvite(state, invite, currentUserHandle = null) {
  const matchedUser = findUserForInvite(state, invite);
  const githubHandle =
    matchedUser?.handle || (invite.recipientType === "handle" ? invite.recipientValue : "");

  return {
    ...invite,
    senderHandle: currentUserHandle || findUserById(state, invite.senderUserId)?.handle || "unknown",
    recipientOnline: matchedUser ? isUserOnline(matchedUser) : false,
    matchedUser: matchedUser
      ? {
          id: matchedUser.id,
          displayName: matchedUser.displayName,
          handle: matchedUser.handle,
          email: matchedUser.email,
          isOnline: isUserOnline(matchedUser),
          lastActiveAt: matchedUser.lastActiveAt || null,
        }
      : null,
    githubNudge:
      githubHandle
        ? {
            handle: githubHandle,
            text: `${githubHandle} your Truce or Dare invite is ready for local testing. Sign in with that handle to accept the pending connection.`,
          }
        : null,
  };
}

function formatKnownUsers(state, userId = null) {
  return state.users
    .filter((user) => user.id !== userId)
    .slice(0, 10)
    .map((user) => ({
      id: user.id,
      displayName: user.displayName,
      handle: user.handle,
      email: user.email,
      bio: user.bio,
      isOnline: isUserOnline(user),
      lastActiveAt: user.lastActiveAt || null,
    }));
}

function formatChatMessages(state) {
  return state.chatMessages.slice(0, 20).map((message) => ({
    ...message,
    user: findUserById(state, message.userId)
      ? {
          displayName: findUserById(state, message.userId).displayName,
          handle: findUserById(state, message.userId).handle,
        }
      : null,
  }));
}

function buildIronclad(state) {
  const nextState = ensureState(state);
  const onlineUsers = nextState.users.filter((user) => isUserOnline(user)).length;
  return {
    name: "Ironclad",
    systemStatus: onlineUsers > 0 ? "active" : "standby",
    telemetry: {
      users: nextState.users.length,
      onlineUsers,
      pendingInvites: nextState.invites.filter((invite) => invite.status === "pending").length,
      openSessions: nextState.gameSessions.filter((session) => session.status === "open").length,
      chatMessages: nextState.chatMessages.length,
    },
    recentEvents: nextState.ironcladEvents.slice(0, 8).map((event) => ({
      ...event,
      actorHandle: findUserById(nextState, event.actorUserId)?.handle || "system",
    })),
  };
}

function listPublicSummary(state) {
  const nextState = ensureState(state);
  return {
    currentUser: null,
    summary: {
      users: nextState.users.length,
      pendingInvites: nextState.invites.filter((invite) => invite.status === "pending").length,
      openSessions: nextState.gameSessions.filter((session) => session.status === "open").length,
      connections: nextState.connections.length,
    },
    chatMessages: formatChatMessages(nextState),
    ironclad: buildIronclad(nextState),
    knownUsers: formatKnownUsers(nextState),
    recentSessions: nextState.gameSessions.slice(0, 5).map((session) => ({
      ...session,
      host: findUserById(nextState, session.hostUserId)?.handle || "unknown",
    })),
  };
}

function buildDashboard(state, userId) {
  const nextState = ensureState(state);
  const currentUser = findUserById(nextState, userId);
  if (!currentUser) {
    throw createError("User not found.", 404);
  }

  const sentInvites = nextState.invites
    .filter((invite) => invite.senderUserId === userId)
    .map((invite) => formatInvite(nextState, invite, currentUser.handle));

  const receivedInvites = nextState.invites
    .filter((invite) => invite.status === "pending" && inviteMatchesUser(invite, currentUser))
    .map((invite) => formatInvite(nextState, invite));

  const connections = nextState.connections
    .filter((connection) => connection.userIds.includes(userId))
    .map((connection) => {
      const otherUserId = connection.userIds.find((id) => id !== userId);
      return {
        ...connection,
        otherUser: findUserById(nextState, otherUserId),
      };
    });

  const recentSessions = nextState.gameSessions.slice(0, 10).map((session) => ({
    ...session,
    host: findUserById(nextState, session.hostUserId)?.handle || "unknown",
  }));

  return {
    currentUser: {
      ...currentUser,
      isOnline: isUserOnline(currentUser),
    },
    summary: {
      users: nextState.users.length,
      pendingInvites: nextState.invites.filter((invite) => invite.status === "pending").length,
      openSessions: nextState.gameSessions.filter((session) => session.status === "open").length,
      connections: nextState.connections.length,
    },
    chatMessages: formatChatMessages(nextState),
    ironclad: buildIronclad(nextState),
    knownUsers: formatKnownUsers(nextState, userId),
    recentSessions,
    sentInvites,
    receivedInvites,
    connections,
  };
}

module.exports = {
  acceptInvite,
  buildDashboard,
  createGameSession,
  createInvite,
  createIroncladBeacon,
  createChatMessage,
  createTargetUser,
  ensureState,
  findUserById,
  inviteMatchesUser,
  isUserOnline,
  listPublicSummary,
  normalizeHandle,
  touchUser,
  upsertUser,
  updateProfile,
};
