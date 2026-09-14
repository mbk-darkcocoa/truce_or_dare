'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const MAX_BODY_BYTES = 1024 * 1024;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const TICKET_RATE_LIMIT_MS = 15 * 1000;

function createServer({ store, frontendDir, adminCode = process.env.TRUCE_OR_DARE_ADMIN_CODE || 'admin-demo-code' }) {
  const sessions = new Map();
  const ticketSubmissions = new Map();
  const staticDir = frontendDir || path.join(process.cwd(), 'frontend');

  async function handler(req, res) {
    try {
      pruneSessions(sessions);
      const requestUrl = new URL(req.url, 'http://127.0.0.1');

      if (requestUrl.pathname.startsWith('/api/')) {
        return await handleApiRequest(req, res, requestUrl);
      }

      return await serveStatic(req, res, requestUrl, staticDir);
    } catch (error) {
      return sendJson(res, 500, {
        error: 'internal_error',
        message: error.message
      });
    }
  }

  async function handleApiRequest(req, res, requestUrl) {
    if (req.method === 'GET' && requestUrl.pathname === '/api/health') {
      return sendJson(res, 200, {
        status: 'ok',
        service: 'truce_or_dare',
        surfaces: ['storefront', 'lobby', 'support', 'admin', 'workbook']
      });
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/session') {
      const body = await parseJsonBody(req);
      const displayName = sanitizeText(body.displayName, 2, 60);
      const accessMode = body.accessMode;
      const allowedModes = new Set(['guest', 'member', 'admin']);

      if (!displayName || !allowedModes.has(accessMode)) {
        return sendJson(res, 400, {
          error: 'invalid_session',
          message: 'displayName and accessMode are required.'
        });
      }

      if (accessMode === 'admin' && body.adminCode !== adminCode) {
        return sendJson(res, 403, {
          error: 'admin_code_required',
          message: 'A valid admin code is required for admin access.'
        });
      }

      const token = randomUUID();
      const profile = {
        displayName,
        accessMode,
        issuedAt: new Date().toISOString()
      };

      sessions.set(token, {
        ...profile,
        expiresAt: Date.now() + SESSION_TTL_MS
      });

      return sendJson(res, 201, {
        sessionToken: token,
        profile
      });
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/catalog') {
      const data = await store.read();
      return sendJson(res, 200, {
        items: data.catalog
      });
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/lobby') {
      const data = await store.read();
      return sendJson(res, 200, data.lobby);
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/support/articles') {
      const data = await store.read();
      return sendJson(res, 200, {
        articles: data.support.knowledgeBase
      });
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/support/tickets') {
      const session = requireSession(req, sessions);
      if (!session) {
        return sendJson(res, 401, {
          error: 'authentication_required',
          message: 'Create a session before submitting a ticket.'
        });
      }

      const lastSubmittedAt = ticketSubmissions.get(session.displayName) || 0;
      if (Date.now() - lastSubmittedAt < TICKET_RATE_LIMIT_MS) {
        return sendJson(res, 429, {
          error: 'rate_limited',
          message: 'Please wait before submitting another ticket.'
        });
      }

      const body = await parseJsonBody(req);
      const subject = sanitizeText(body.subject, 4, 120);
      const message = sanitizeText(body.message, 10, 1200);
      const category = sanitizeCategory(body.category, ['account', 'catalog', 'support', 'compliance']);

      if (!subject || !message || !category) {
        return sendJson(res, 400, {
          error: 'invalid_ticket',
          message: 'subject, message, and category are required.'
        });
      }

      const contactEmail = body.contactEmail === undefined || body.contactEmail === null || body.contactEmail === ''
        ? null
        : sanitizeEmail(body.contactEmail);

      if (body.contactEmail && !contactEmail) {
        return sendJson(res, 400, {
          error: 'invalid_ticket',
          message: 'contactEmail must be a valid email when provided.'
        });
      }

      const ticket = {
        id: `ticket-${randomUUID().slice(0, 8)}`,
        subject,
        message,
        category,
        contactEmail,
        requester: session.displayName,
        status: 'open',
        createdAt: new Date().toISOString()
      };

      await store.update((data) => {
        data.support.tickets.unshift(ticket);
        return data;
      });

      ticketSubmissions.set(session.displayName, Date.now());

      return sendJson(res, 201, {
        ticket
      });
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/workbook') {
      const data = await store.read();
      return sendJson(res, 200, {
        sections: data.workbook
      });
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/admin/summary') {
      const session = requireAdminSession(req, sessions);
      if (!session) {
        return sendJson(res, 403, {
          error: 'admin_required',
          message: 'Admin access is required.'
        });
      }

      const data = await store.read();
      return sendJson(res, 200, {
        operator: session.displayName,
        metrics: {
          activeSessions: sessions.size,
          featuredProducts: data.catalog.filter((item) => item.featured).length,
          openTickets: data.support.tickets.filter((ticket) => ticket.status !== 'resolved').length,
          moderationBacklog: data.lobby.moderationQueue.filter((item) => item.status === 'pending').length
        }
      });
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/admin/users') {
      const session = requireAdminSession(req, sessions);
      if (!session) {
        return sendJson(res, 403, {
          error: 'admin_required',
          message: 'Admin access is required.'
        });
      }

      const users = Array.from(sessions.values()).map((entry) => ({
        displayName: entry.displayName,
        accessMode: entry.accessMode,
        issuedAt: entry.issuedAt
      }));
      return sendJson(res, 200, { users });
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/admin/tickets') {
      const session = requireAdminSession(req, sessions);
      if (!session) {
        return sendJson(res, 403, {
          error: 'admin_required',
          message: 'Admin access is required.'
        });
      }

      const data = await store.read();
      return sendJson(res, 200, {
        tickets: data.support.tickets
      });
    }

    if (req.method === 'POST' && requestUrl.pathname.startsWith('/api/admin/tickets/')) {
      const session = requireAdminSession(req, sessions);
      if (!session) {
        return sendJson(res, 403, {
          error: 'admin_required',
          message: 'Admin access is required.'
        });
      }

      const ticketId = requestUrl.pathname.split('/').pop();
      const body = await parseJsonBody(req);
      const nextStatus = sanitizeCategory(body.status, ['open', 'triaged', 'resolved']);

      if (!nextStatus) {
        return sendJson(res, 400, {
          error: 'invalid_status',
          message: 'status must be open, triaged, or resolved.'
        });
      }

      const updated = await store.update((data) => {
        const ticket = data.support.tickets.find((item) => item.id === ticketId);
        if (!ticket) {
          return data;
        }
        ticket.status = nextStatus;
        ticket.updatedAt = new Date().toISOString();
        ticket.updatedBy = session.displayName;
        return data;
      });

      const ticket = updated.support.tickets.find((item) => item.id === ticketId);
      if (!ticket) {
        return sendJson(res, 404, {
          error: 'not_found',
          message: 'Ticket not found.'
        });
      }

      return sendJson(res, 200, { ticket });
    }

    if (req.method === 'POST' && requestUrl.pathname.startsWith('/api/admin/catalog/')) {
      const session = requireAdminSession(req, sessions);
      if (!session) {
        return sendJson(res, 403, {
          error: 'admin_required',
          message: 'Admin access is required.'
        });
      }

      const productId = requestUrl.pathname.split('/').pop();
      const updated = await store.update((data) => {
        const product = data.catalog.find((item) => item.id === productId);
        if (!product) {
          return data;
        }
        product.featured = !product.featured;
        product.updatedAt = new Date().toISOString();
        return data;
      });

      const product = updated.catalog.find((item) => item.id === productId);
      if (!product) {
        return sendJson(res, 404, {
          error: 'not_found',
          message: 'Product not found.'
        });
      }

      return sendJson(res, 200, { product });
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/admin/moderation') {
      const session = requireAdminSession(req, sessions);
      if (!session) {
        return sendJson(res, 403, {
          error: 'admin_required',
          message: 'Admin access is required.'
        });
      }

      const data = await store.read();
      return sendJson(res, 200, {
        items: data.lobby.moderationQueue
      });
    }

    if (req.method === 'POST' && requestUrl.pathname.startsWith('/api/admin/moderation/')) {
      const session = requireAdminSession(req, sessions);
      if (!session) {
        return sendJson(res, 403, {
          error: 'admin_required',
          message: 'Admin access is required.'
        });
      }

      const moderationId = requestUrl.pathname.split('/').pop();
      const body = await parseJsonBody(req);
      const nextStatus = sanitizeCategory(body.status, ['pending', 'approved', 'escalated']);

      if (!nextStatus) {
        return sendJson(res, 400, {
          error: 'invalid_status',
          message: 'status must be pending, approved, or escalated.'
        });
      }

      const updated = await store.update((data) => {
        const entry = data.lobby.moderationQueue.find((item) => item.id === moderationId);
        if (!entry) {
          return data;
        }
        entry.status = nextStatus;
        entry.updatedAt = new Date().toISOString();
        entry.updatedBy = session.displayName;
        return data;
      });

      const item = updated.lobby.moderationQueue.find((entry) => entry.id === moderationId);
      if (!item) {
        return sendJson(res, 404, {
          error: 'not_found',
          message: 'Moderation item not found.'
        });
      }

      return sendJson(res, 200, { item });
    }

    return sendJson(res, 404, {
      error: 'not_found',
      message: 'Route not found.'
    });
  }

  return http.createServer(handler);
}

async function serveStatic(req, res, requestUrl, staticDir) {
  if (!['GET', 'HEAD'].includes(req.method)) {
    return sendJson(res, 405, {
      error: 'method_not_allowed',
      message: 'Only GET and HEAD are supported for static assets.'
    });
  }

  const requestedPath = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
  const resolvedPath = path.resolve(staticDir, `.${requestedPath}`);

  if (!resolvedPath.startsWith(path.resolve(staticDir))) {
    return sendJson(res, 403, {
      error: 'forbidden',
      message: 'Path is outside the static directory.'
    });
  }

  try {
    const content = await fs.readFile(resolvedPath);
    res.writeHead(200, {
      'Content-Type': getContentType(resolvedPath),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch {
    sendJson(res, 404, {
      error: 'not_found',
      message: 'Static asset not found.'
    });
  }
}

function requireSession(req, sessions) {
  const token = getBearerToken(req);
  if (!token) {
    return null;
  }
  return sessions.get(token) || null;
}

function requireAdminSession(req, sessions) {
  const session = requireSession(req, sessions);
  if (!session || session.accessMode !== 'admin') {
    return null;
  }
  return session;
}

function pruneSessions(sessions) {
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= Date.now()) {
      sessions.delete(token);
    }
  }
}

function getBearerToken(req) {
  const sessionHeader = req.headers['x-session-token'];
  if (typeof sessionHeader === 'string' && sessionHeader.trim()) {
    return sessionHeader.trim();
  }

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice('Bearer '.length);
}

function getContentType(filePath) {
  switch (path.extname(filePath)) {
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.html':
    default:
      return 'text/html; charset=utf-8';
  }
}

async function parseJsonBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error('Request body too large.');
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function sanitizeText(value, minLength, maxLength) {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < minLength || normalized.length > maxLength) {
    return null;
  }
  return normalized;
}

function sanitizeCategory(value, allowedValues) {
  if (typeof value !== 'string') {
    return null;
  }
  return allowedValues.includes(value) ? value : null;
}

function sanitizeEmail(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(normalized) ? normalized : null;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(payload));
}

module.exports = {
  createServer
};
