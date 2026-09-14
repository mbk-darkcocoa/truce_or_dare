const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");

const {
  buildDashboard,
  createGameSession,
  createInvite,
  createTargetUser,
  ensureState,
  findUserById,
  listPublicSummary,
  upsertUser,
  updateProfile,
  acceptInvite,
} = require("./lib/app");
const { loadState, mutateState } = require("./lib/store");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, "public");
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};
const authSessions = new Map();

function sendJson(res, statusCode, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
}

function sendText(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
}

function sendFile(res, filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const body = fs.readFileSync(filePath);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Content-Length": body.length,
    });
    res.end(body);
  } catch {
    sendText(res, 404, "Not found");
  }
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

async function parseJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

function getCurrentUser(req) {
  const cookies = parseCookies(req);
  const sessionId = cookies.sid;
  if (!sessionId) {
    return null;
  }

  const userId = authSessions.get(sessionId);
  if (!userId) {
    return null;
  }

  const state = ensureState(loadState());
  return findUserById(state, userId) || null;
}

function requireUser(req, res) {
  const user = getCurrentUser(req);
  if (!user) {
    sendJson(res, 401, { error: "Sign in first." });
    return null;
  }
  return user;
}

function issueSession(userId) {
  const sessionId = crypto.randomUUID();
  authSessions.set(sessionId, userId);
  return sessionId;
}

function clearSession(req) {
  const cookies = parseCookies(req);
  if (cookies.sid) {
    authSessions.delete(cookies.sid);
  }
}

function stateResponse(currentUser) {
  const state = ensureState(loadState());
  if (!currentUser) {
    return listPublicSummary(state);
  }

  const refreshedUser = findUserById(state, currentUser.id);
  if (!refreshedUser) {
    return listPublicSummary(state);
  }

  return buildDashboard(state, refreshedUser.id);
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/state") {
    sendJson(res, 200, stateResponse(getCurrentUser(req)));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const payload = await parseJsonBody(req);
    const { dashboard, user } = mutateState((state) => {
      const nextUser = upsertUser(state, payload);
      return {
        user: nextUser,
        dashboard: buildDashboard(state, nextUser.id),
      };
    });
    const sessionId = issueSession(user.id);
    sendJson(
      res,
      200,
      dashboard,
      { "Set-Cookie": `sid=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax` },
    );
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/logout") {
    clearSession(req);
    sendJson(
      res,
      200,
      { ok: true },
      { "Set-Cookie": "sid=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax" },
    );
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/profile") {
    const user = requireUser(req, res);
    if (!user) {
      return true;
    }

    const payload = await parseJsonBody(req);
    const dashboard = mutateState((state) => {
      updateProfile(state, user.id, payload);
      return buildDashboard(state, user.id);
    });
    sendJson(res, 200, dashboard);
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/game-sessions") {
    const user = requireUser(req, res);
    if (!user) {
      return true;
    }

    const payload = await parseJsonBody(req);
    const dashboard = mutateState((state) => {
      createGameSession(state, user.id, payload);
      return buildDashboard(state, user.id);
    });
    sendJson(res, 201, dashboard);
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/invites") {
    const user = requireUser(req, res);
    if (!user) {
      return true;
    }

    const payload = await parseJsonBody(req);
    const dashboard = mutateState((state) => {
      createInvite(state, user.id, payload);
      return buildDashboard(state, user.id);
    });
    sendJson(res, 201, dashboard);
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/target-connections") {
    const user = requireUser(req, res);
    if (!user) {
      return true;
    }

    const payload = await parseJsonBody(req);
    const dashboard = mutateState((state) => {
      createTargetUser(state, user.id, payload);
      return buildDashboard(state, user.id);
    });
    sendJson(res, 201, dashboard);
    return true;
  }

  const inviteAcceptMatch = url.pathname.match(/^\/api\/invites\/([^/]+)\/accept$/);
  if (req.method === "POST" && inviteAcceptMatch) {
    const user = requireUser(req, res);
    if (!user) {
      return true;
    }

    const inviteId = inviteAcceptMatch[1];
    const dashboard = mutateState((state) => {
      acceptInvite(state, user.id, inviteId);
      return buildDashboard(state, user.id);
    });
    sendJson(res, 200, dashboard);
    return true;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  try {
    const handled = await handleApi(req, res, url);
    if (handled) {
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      sendText(res, 405, "Method not allowed");
      return;
    }

    if (url.pathname === "/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    const relativePath = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = path.normalize(path.join(PUBLIC_DIR, relativePath));
    if (!filePath.startsWith(PUBLIC_DIR)) {
      sendText(res, 403, "Forbidden");
      return;
    }

    sendFile(res, filePath);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    sendJson(res, statusCode, {
      error: statusCode === 500 ? "Internal server error." : error.message,
    });
  }
});

server.listen(PORT, () => {
  console.log(`Truce or Dare running at http://localhost:${PORT}`);
});
