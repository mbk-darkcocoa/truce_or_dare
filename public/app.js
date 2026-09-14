const summaryEl = document.querySelector("#summary");
const flashEl = document.querySelector("#flash");
const currentUserEl = document.querySelector("#current-user");
const knownUsersEl = document.querySelector("#known-users");
const receivedInvitesEl = document.querySelector("#received-invites");
const sentInvitesEl = document.querySelector("#sent-invites");
const connectionsEl = document.querySelector("#connections");
const recentSessionsEl = document.querySelector("#recent-sessions");

const loginForm = document.querySelector("#login-form");
const profileForm = document.querySelector("#profile-form");
const sessionForm = document.querySelector("#session-form");
const targetUserForm = document.querySelector("#target-user-form");
const inviteForm = document.querySelector("#invite-form");

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

function renderCurrentUser(user) {
  if (!user) {
    currentUserEl.classList.add("hidden");
    currentUserEl.innerHTML = "";
    profileForm.reset();
    return;
  }

  currentUserEl.classList.remove("hidden");
  currentUserEl.innerHTML = `
    <h3>${escapeHtml(user.displayName)} <span class="muted">${escapeHtml(user.handle)}</span></h3>
    <p>${escapeHtml(user.bio || "No bio yet.")}</p>
    <p class="muted">${escapeHtml(user.email || "No email connected.")}</p>
    <button type="button" id="logout-button" class="secondary">Log out</button>
  `;

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
          </div>
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
      const actionButton = actionLabel
        ? `<button type="button" data-invite-id="${escapeHtml(invite.id)}">${escapeHtml(actionLabel)}</button>`
        : "";
      return `
        <div class="item">
          <div>
            <strong>${escapeHtml(title)}</strong>
            <p>${escapeHtml(invite.recipientType)} · ${escapeHtml(invite.recipientValue)}</p>
            <p>${escapeHtml(invite.message || "No message.")}</p>
            <p class="muted">${escapeHtml(invite.status)}</p>
          </div>
          ${actionButton}
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
}

function render(state) {
  renderSummary(state.summary);
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
