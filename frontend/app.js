'use strict';

const state = {
  sessionToken: window.localStorage.getItem('tod-session-token') || '',
  profile: JSON.parse(window.localStorage.getItem('tod-session-profile') || 'null')
};

const nodes = {
  sessionForm: document.querySelector('#session-form'),
  sessionStatus: document.querySelector('#session-status'),
  catalogList: document.querySelector('#catalog-list'),
  lobbyList: document.querySelector('#lobby-list'),
  articleList: document.querySelector('#article-list'),
  ticketForm: document.querySelector('#ticket-form'),
  ticketStatus: document.querySelector('#ticket-status'),
  adminSummary: document.querySelector('#admin-summary'),
  workbookList: document.querySelector('#workbook-list'),
  deviceFacts: document.querySelector('#device-facts')
};

async function initialize() {
  renderSession();
  renderDeviceFacts();
  wireEvents();
  await Promise.all([
    loadCatalog(),
    loadLobby(),
    loadSupportArticles(),
    loadWorkbook(),
    loadAdminSummary()
  ]);
}

function wireEvents() {
  nodes.sessionForm.addEventListener('submit', handleSessionSubmit);
  nodes.ticketForm.addEventListener('submit', handleTicketSubmit);
}

async function handleSessionSubmit(event) {
  event.preventDefault();
  const formData = new FormData(nodes.sessionForm);

  const payload = {
    displayName: formData.get('displayName'),
    accessMode: formData.get('accessMode'),
    adminCode: formData.get('adminCode')
  };

  const result = await apiFetch('/api/session', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!result.ok) {
    nodes.sessionStatus.textContent = result.data.message || 'Unable to create session.';
    return;
  }

  state.sessionToken = result.data.sessionToken;
  state.profile = result.data.profile;
  persistSession();
  renderSession();
  nodes.sessionStatus.textContent = `Session ready for ${state.profile.displayName} (${state.profile.accessMode}).`;
  await loadAdminSummary();
}

async function handleTicketSubmit(event) {
  event.preventDefault();
  if (!state.sessionToken) {
    nodes.ticketStatus.textContent = 'Create a session before submitting a ticket.';
    return;
  }

  const formData = new FormData(nodes.ticketForm);
  const payload = {
    category: formData.get('category'),
    contactEmail: formData.get('contactEmail'),
    subject: formData.get('subject'),
    message: formData.get('message')
  };

  const result = await apiFetch('/api/support/tickets', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!result.ok) {
    nodes.ticketStatus.textContent = result.data.message || 'Ticket submission failed.';
    return;
  }

  nodes.ticketForm.reset();
  nodes.ticketStatus.textContent = `Ticket ${result.data.ticket.id} created and ready for triage.`;
  await loadAdminSummary();
}

async function loadCatalog() {
  const result = await apiFetch('/api/catalog');
  if (!result.ok) {
    nodes.catalogList.innerHTML = '<p class="status">Catalog unavailable.</p>';
    return;
  }

  nodes.catalogList.innerHTML = result.data.items
    .map(
      (item) => `
        <section class="tile">
          <h3>${escapeHtml(item.name)}</h3>
          <p class="meta">${escapeHtml(item.platform)} · ${escapeHtml(item.category)} · $${item.price}</p>
          <p>${escapeHtml(item.description)}</p>
          <p class="meta">Availability: ${escapeHtml(item.availability)} · Featured: ${item.featured ? 'Yes' : 'No'}</p>
          ${state.profile?.accessMode === 'admin' ? `<div class="tile-actions"><button data-action="feature" data-id="${item.id}">${item.featured ? 'Remove from featured' : 'Mark featured'}</button></div>` : ''}
        </section>
      `
    )
    .join('');

  nodes.catalogList.querySelectorAll('button[data-action="feature"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const response = await apiFetch(`/api/admin/catalog/${button.dataset.id}`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      if (response.ok) {
        await loadCatalog();
        await loadAdminSummary();
      }
    });
  });
}

async function loadLobby() {
  const result = await apiFetch('/api/lobby');
  if (!result.ok) {
    nodes.lobbyList.innerHTML = '<p class="status">Lobby unavailable.</p>';
    return;
  }

  nodes.lobbyList.innerHTML = result.data.forums
    .map(
      (forum) => `
        <section class="tile">
          <h3>${escapeHtml(forum.title)}</h3>
          <p class="meta">${escapeHtml(forum.audience)} · ${forum.threads} threads</p>
          <p>${escapeHtml(forum.summary)}</p>
        </section>
      `
    )
    .join('');
}

async function loadSupportArticles() {
  const result = await apiFetch('/api/support/articles');
  if (!result.ok) {
    nodes.articleList.innerHTML = '<p class="status">Support articles unavailable.</p>';
    return;
  }

  nodes.articleList.innerHTML = result.data.articles
    .map(
      (article) => `
        <section class="tile">
          <h3>${escapeHtml(article.title)}</h3>
          <p>${escapeHtml(article.summary)}</p>
        </section>
      `
    )
    .join('');
}

async function loadWorkbook() {
  const result = await apiFetch('/api/workbook');
  if (!result.ok) {
    nodes.workbookList.innerHTML = '<p class="status">Workbook unavailable.</p>';
    return;
  }

  nodes.workbookList.innerHTML = result.data.sections
    .map(
      (section) => `
        <section class="tile">
          <h3>${escapeHtml(section.title)}</h3>
          <p>${escapeHtml(section.outcome)}</p>
          <p class="meta">Doc: ${escapeHtml(section.docPath)}</p>
        </section>
      `
    )
    .join('');
}

async function loadAdminSummary() {
  if (state.profile?.accessMode !== 'admin') {
    nodes.adminSummary.innerHTML = '<p class="status">Create an admin session to access restricted workflows.</p>';
    await loadCatalog();
    return;
  }

  const [summaryResult, usersResult, ticketsResult, moderationResult] = await Promise.all([
    apiFetch('/api/admin/summary'),
    apiFetch('/api/admin/users'),
    apiFetch('/api/admin/tickets'),
    apiFetch('/api/admin/moderation')
  ]);

  if (!summaryResult.ok) {
    nodes.adminSummary.innerHTML = `<p class="status">${escapeHtml(summaryResult.data.message || 'Admin summary unavailable.')}</p>`;
    return;
  }

  const metrics = summaryResult.data.metrics;
  const tickets = ticketsResult.ok ? ticketsResult.data.tickets : [];
  const moderationItems = moderationResult.ok ? moderationResult.data.items : [];
  const users = usersResult.ok ? usersResult.data.users : [];

  nodes.adminSummary.innerHTML = `
    <section class="tile">
      <h3>Operator ${escapeHtml(summaryResult.data.operator)}</h3>
      <ul class="item-list">
        <li>Active sessions: ${metrics.activeSessions}</li>
        <li>Featured products: ${metrics.featuredProducts}</li>
        <li>Open tickets: ${metrics.openTickets}</li>
        <li>Moderation backlog: ${metrics.moderationBacklog}</li>
      </ul>
    </section>
    <section class="tile">
      <h3>Support tickets</h3>
      ${
        tickets.length
          ? tickets
              .map(
                (ticket) => `
                  <div class="tile-actions">
                    <span>${escapeHtml(ticket.subject)} · ${escapeHtml(ticket.status)} · ${escapeHtml(ticket.requester)}</span>
                    <button data-action="resolve-ticket" data-id="${ticket.id}">Resolve</button>
                  </div>
                `
              )
              .join('')
          : '<p>No tickets yet.</p>'
      }
    </section>
    <section class="tile">
      <h3>Moderation queue</h3>
      ${
        moderationItems.length
          ? moderationItems
              .map(
                (item) => `
                  <div class="tile-actions">
                    <span>${escapeHtml(item.forum)} · ${escapeHtml(item.reason)} · ${escapeHtml(item.status)}</span>
                    <button data-action="approve-moderation" data-id="${item.id}">Approve</button>
                  </div>
                `
              )
              .join('')
          : '<p>No moderation items pending.</p>'
      }
    </section>
    <section class="tile">
      <h3>Access roster</h3>
      ${
        users.length
          ? users.map((user) => `<p>${escapeHtml(user.displayName)} · ${escapeHtml(user.accessMode)} · ${escapeHtml(user.issuedAt)}</p>`).join('')
          : '<p>No sessions yet.</p>'
      }
    </section>
  `;

  nodes.adminSummary.querySelectorAll('button[data-action="resolve-ticket"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const response = await apiFetch(`/api/admin/tickets/${button.dataset.id}`, {
        method: 'POST',
        body: JSON.stringify({ status: 'resolved' })
      });
      if (response.ok) {
        await loadAdminSummary();
      }
    });
  });

  nodes.adminSummary.querySelectorAll('button[data-action="approve-moderation"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const response = await apiFetch(`/api/admin/moderation/${button.dataset.id}`, {
        method: 'POST',
        body: JSON.stringify({ status: 'approved' })
      });
      if (response.ok) {
        await loadAdminSummary();
      }
    });
  });

  await loadCatalog();
}

function renderDeviceFacts() {
  const facts = [
    navigator.userAgent.includes('Quest') ? 'Quest-class headset detected through user agent.' : 'No Quest-specific user agent detected.',
    'xr' in navigator ? 'Browser exposes WebXR entry points.' : 'WebXR APIs are not exposed in this browser.',
    window.isSecureContext ? 'Secure context is available for auth and device APIs.' : 'Use HTTPS in production for auth and device APIs.',
    'Fallback browser workflows remain available for unsupported devices.'
  ];

  nodes.deviceFacts.innerHTML = facts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join('');
}

function renderSession() {
  if (!state.profile) {
    nodes.sessionStatus.textContent = 'No session yet.';
    return;
  }

  nodes.sessionStatus.textContent = `Signed in as ${state.profile.displayName} (${state.profile.accessMode}).`;
}

function persistSession() {
  window.localStorage.setItem('tod-session-token', state.sessionToken);
  window.localStorage.setItem('tod-session-profile', JSON.stringify(state.profile));
}

async function apiFetch(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (state.sessionToken) {
    headers['X-Session-Token'] = state.sessionToken;
  }

  const response = await fetch(url, { ...options, headers });
  let data = {};
  try {
    data = await response.json();
  } catch {}
  return { ok: response.ok, status: response.status, data };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

initialize().catch((error) => {
  nodes.sessionStatus.textContent = error.message;
});
