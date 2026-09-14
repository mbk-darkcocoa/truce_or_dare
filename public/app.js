const summaryEl = document.querySelector("#summary");
const flashEl = document.querySelector("#flash");
const currentUserEl = document.querySelector("#current-user");
const liveStatusEl = document.querySelector("#live-status");
const ironcladStatusEl = document.querySelector("#ironclad-status");
const ironcladTelemetryEl = document.querySelector("#ironclad-telemetry");
const ironcladEventsEl = document.querySelector("#ironclad-events");
const chatFeedEl = document.querySelector("#chat-feed");
const knownUsersEl = document.querySelector("#known-users");
const receivedInvitesEl = document.querySelector("#received-invites");
const sentInvitesEl = document.querySelector("#sent-invites");
const connectionsEl = document.querySelector("#connections");
const recentSessionsEl = document.querySelector("#recent-sessions");

const loginForm = document.querySelector("#login-form");
const profileForm = document.querySelector("#profile-form");
const ironcladForm = document.querySelector("#ironclad-form");
const chatForm = document.querySelector("#chat-form");
const sessionForm = document.querySelector("#session-form");
const targetUserForm = document.querySelector("#target-user-form");
const inviteForm = document.querySelector("#invite-form");
const LIVE_REFRESH_MS = 15000;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setFlash(message, isError = false) {
  flashEl.textContent = message;
  flashEl.classList.remove("hidden");
  flashEl.classList.toggle("error", isError);
}

function clearFlash() {
  flashEl.textContent = "";
  flashEl.classList.add("hidden");
  flashEl.classList.remove("error");
}

function formatLastSeen(value) {
  if (!value) {
    return "offline";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "offline";
  }

  return `last active ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload;
}

function renderSummary(summary) {
  summaryEl.innerHTML = `
    <article class="stat card"><strong>${summary.users}</strong><span>profiles</span></article>
    <article class="stat card"><strong>${summary.openSessions}</strong><span>open sessions</span></article>
    <article class="stat card"><strong>${summary.pendingInvites}</strong><span>pending invites</span></article>
    <article class="stat card"><strong>${summary.connections}</strong><span>connections</span></article>
  `;
}

function renderIronclad(ironclad) {
  if (!ironclad) {
    ironcladStatusEl.textContent = "Standby";
    ironcladStatusEl.classList.remove("online");
    ironcladTelemetryEl.innerHTML = "";
    ironcladEventsEl.classList.add("muted");
    ironcladEventsEl.textContent = "No Ironclad activity yet.";
    return;
  }

  ironcladStatusEl.textContent = ironclad.systemStatus;
  ironcladStatusEl.classList.toggle("online", ironclad.systemStatus === "active");
  ironcladTelemetryEl.innerHTML = `
    <article class="stat card"><strong>${ironclad.telemetry.users}</strong><span>users</span></article>
    <article class="stat card"><strong>${ironclad.telemetry.onlineUsers}</strong><span>online</span></article>
    <article class="stat card"><strong>${ironclad.telemetry.openSessions}</strong><span>sessions</span></article>
    <article class="stat card"><strong>${ironclad.telemetry.chatMessages}</strong><span>chat lines</span></article>
  `;

  if (!ironclad.recentEvents.length) {
    ironcladEventsEl.classList.add("muted");
    ironcladEventsEl.textContent = "No Ironclad activity yet.";
    return;
  }

  ironcladEventsEl.classList.remove("muted");
  ironcladEventsEl.innerHTML = ironclad.recentEvents
    .map(
      (event) => `
        <div class="item">
          <div>
            <strong>${escapeHtml(event.actorHandle)}</strong>
            <p>${escapeHtml(event.summary)}</p>
            <p class="muted">${escapeHtml(event.type)}</p>
          </div>
        </div>
      `,
    )
    .join("");
}

function renderChatMessages(messages) {
  if (!messages.length) {
    chatFeedEl.classList.add("muted");
    chatFeedEl.textContent = "No chat messages yet.";
    return;
  }

  chatFeedEl.classList.remove("muted");
  chatFeedEl.innerHTML = messages
    .map(
      (message) => `
        <div class="item">
          <div>
            <strong>${escapeHtml(message.user?.handle || "unknown")}</strong>
            <p>${escapeHtml(message.body)}</p>
          </div>
        </div>
      `,
    )
    .join("");
}

function renderCurrentUser(user) {
  if (!user) {
    currentUserEl.classList.add("hidden");
    currentUserEl.innerHTML = "";
    profileForm.reset();
    liveStatusEl.textContent = "Signed out";
    liveStatusEl.classList.remove("online");
    return;
  }

  currentUserEl.classList.remove("hidden");
  currentUserEl.innerHTML = `
    <h3>${escapeHtml(user.displayName)} <span class="muted">${escapeHtml(user.handle)}</span></h3>
    <p>${escapeHtml(user.bio || "No bio yet.")}</p>
    <p class="muted">${escapeHtml(user.email || "No email connected.")}</p>
    <p class="muted">${user.isOnline ? "Online now" : escapeHtml(formatLastSeen(user.lastActiveAt))}</p>
    <button type="button" id="logout-button" class="secondary">Log out</button>
  `;
  liveStatusEl.textContent = "Live sync on";
  liveStatusEl.classList.add("online");

  profileForm.displayName.value = user.displayName;
  profileForm.handle.value = user.handle;
  profileForm.email.value = user.email || "";
  profileForm.bio.value = user.bio || "";

  document.querySelector("#logout-button").addEventListener("click", async () => {
    await api("/api/logout", { method: "POST" });
    await refresh("Signed out.");
  });
}

function renderKnownUsers(users) {
  if (!users.length) {
    knownUsersEl.classList.add("muted");
    knownUsersEl.textContent = "No users yet.";
    return;
  }

  knownUsersEl.classList.remove("muted");
  knownUsersEl.innerHTML = users
    .map(
      (user) => `
        <div class="item">
          <div>
            <strong>${escapeHtml(user.displayName)}</strong>
            <p>${escapeHtml(user.handle)}</p>
            <p class="muted">${escapeHtml(user.email || "No email")}</p>
            <p class="muted">${user.isOnline ? "Online now" : escapeHtml(formatLastSeen(user.lastActiveAt))}</p>
          </div>
          <span class="status-dot${user.isOnline ? " online" : ""}" aria-hidden="true"></span>
        </div>
      `,
    )
    .join("");
}

function renderInvites(container, invites, emptyMessage, actionLabel) {
  if (!invites.length) {
    container.classList.add("muted");
    container.textContent = emptyMessage;
    return;
  }

  container.classList.remove("muted");
  container.innerHTML = invites
    .map((invite) => {
      const title = invite.senderHandle || invite.recipientValue;
      const githubNudge = invite.githubNudge
        ? `<button type="button" class="secondary" data-nudge-text="${escapeHtml(invite.githubNudge.text)}">Copy GitHub nudge</button>`
        : "";
      const actionButton = actionLabel
        ? `<button type="button" data-invite-id="${escapeHtml(invite.id)}">${escapeHtml(actionLabel)}</button>`
        : "";
      return `
        <div class="item">
          <div>
            <strong>${escapeHtml(title)}</strong>
            <p>${escapeHtml(invite.recipientType)} · ${escapeHtml(invite.recipientValue)}</p>
            <p>${escapeHtml(invite.message || "No message.")}</p>
            ${
              invite.matchedUser
                ? `<p class="muted">${escapeHtml(invite.matchedUser.handle)} · ${invite.recipientOnline ? "online now" : escapeHtml(formatLastSeen(invite.matchedUser.lastActiveAt))}</p>`
                : ""
            }
            <p class="muted">${escapeHtml(invite.status)}</p>
          </div>
          <div class="actions">${actionButton}${githubNudge}</div>
        </div>
      `;
    })
    .join("");
}

function renderConnections(connections) {
  if (!connections.length) {
    connectionsEl.classList.add("muted");
    connectionsEl.textContent = "No connections yet.";
    return;
  }

  connectionsEl.classList.remove("muted");
  connectionsEl.innerHTML = connections
    .map(
      (connection) => `
        <div class="item">
          <div>
            <strong>${escapeHtml(connection.otherUser?.handle || "unknown")}</strong>
            <p>${escapeHtml(connection.otherUser?.displayName || "Unknown player")}</p>
          </div>
        </div>
      `,
    )
    .join("");
}

function renderSessions(sessions) {
  if (!sessions.length) {
    recentSessionsEl.classList.add("muted");
    recentSessionsEl.textContent = "No sessions yet.";
    return;
  }

  recentSessionsEl.classList.remove("muted");
  recentSessionsEl.innerHTML = sessions
    .map(
      (session) => `
        <div class="item">
          <div>
            <strong>${escapeHtml(session.title)}</strong>
            <p>${escapeHtml(session.mode)} · host ${escapeHtml(session.host)}</p>
            <p>${escapeHtml(session.stakes)}</p>
          </div>
        </div>
      `,
    )
    .join("");
}

function attachInviteActions() {
  receivedInvitesEl.querySelectorAll("[data-invite-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      clearFlash();
      try {
        const state = await api(`/api/invites/${button.dataset.inviteId}/accept`, {
          method: "POST",
        });
        render(state);
        setFlash("Invite accepted.");
      } catch (error) {
        setFlash(error.message, true);
      }
    });
  });

  sentInvitesEl.querySelectorAll("[data-nudge-text]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.nudgeText);
        setFlash("GitHub-ready nudge copied.");
      } catch (error) {
        setFlash(error.message || "Unable to copy nudge.", true);
      }
    });
  });
}

function render(state) {
  renderSummary(state.summary);
  renderIronclad(state.ironclad);
  renderChatMessages(state.chatMessages || []);
  renderCurrentUser(state.currentUser);
  renderKnownUsers(state.knownUsers || []);
  renderInvites(receivedInvitesEl, state.receivedInvites || [], "No received invites.", "Accept");
  renderInvites(sentInvitesEl, state.sentInvites || [], "No sent invites.");
  renderConnections(state.connections || []);
  renderSessions(state.recentSessions || []);
  attachInviteActions();
}

async function refresh(message) {
  const state = await api("/api/state");
  render(state);
  if (message) {
    setFlash(message);
  } else {
    clearFlash();
  }
}

async function syncPresence() {
  try {
    const state = await api("/api/presence", { method: "POST" });
    render(state);
  } catch (error) {
    if (error.message === "Sign in first.") {
      return;
    }
    liveStatusEl.textContent = "Sync delayed";
    liveStatusEl.classList.remove("online");
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFlash();
  try {
    const formData = new FormData(loginForm);
    const state = await api("/api/auth/login", {
      method: "POST",
      body: Object.fromEntries(formData.entries()),
    });
    render(state);
    setFlash("Profile ready.");
  } catch (error) {
    setFlash(error.message, true);
  }
});

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFlash();
  try {
    const formData = new FormData(profileForm);
    const state = await api("/api/profile", {
      method: "POST",
      body: Object.fromEntries(formData.entries()),
    });
    render(state);
    setFlash("Profile updated.");
  } catch (error) {
    setFlash(error.message, true);
  }
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFlash();
  try {
    const formData = new FormData(chatForm);
    const state = await api("/api/chat-messages", {
      method: "POST",
      body: Object.fromEntries(formData.entries()),
    });
    render(state);
    chatForm.reset();
    setFlash("Chat message sent.");
  } catch (error) {
    setFlash(error.message, true);
  }
});

ironcladForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFlash();
  try {
    const formData = new FormData(ironcladForm);
    const state = await api("/api/ironclad/beacons", {
      method: "POST",
      body: Object.fromEntries(formData.entries()),
    });
    render(state);
    ironcladForm.reset();
    setFlash("Ironclad beacon raised.");
  } catch (error) {
    setFlash(error.message, true);
  }
});

sessionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFlash();
  try {
    const formData = new FormData(sessionForm);
    const state = await api("/api/game-sessions", {
      method: "POST",
      body: Object.fromEntries(formData.entries()),
    });
    render(state);
    sessionForm.reset();
    setFlash("Session created.");
  } catch (error) {
    setFlash(error.message, true);
  }
});

targetUserForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFlash();
  try {
    const formData = new FormData(targetUserForm);
    const body = Object.fromEntries(formData.entries());
    body.attemptConnection = targetUserForm.attemptConnection.checked;
    const state = await api("/api/target-connections", {
      method: "POST",
      body,
    });
    render(state);
    targetUserForm.reset();
    setFlash("Target user saved.");
  } catch (error) {
    setFlash(error.message, true);
  }
});

inviteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFlash();
  try {
    const formData = new FormData(inviteForm);
    const body = Object.fromEntries(formData.entries());
    body.consentConfirmed = inviteForm.consentConfirmed.checked;
    const state = await api("/api/invites", {
      method: "POST",
      body,
    });
    render(state);
    inviteForm.reset();
    setFlash("Pending invite created.");
  } catch (error) {
    setFlash(error.message, true);
  }
});

refresh().catch((error) => setFlash(error.message, true));
setInterval(() => {
  if (document.visibilityState === "visible") {
    syncPresence();
  }
}, LIVE_REFRESH_MS);
