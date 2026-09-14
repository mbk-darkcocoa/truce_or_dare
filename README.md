# Truce or Dare

Truce or Dare is a small MVP for starting lightweight social game sessions and consent-based connection invites.

## What this app does

- creates a demo profile with a display name, handle, and optional email
- starts Truce, Dare, or mixed game sessions
- sends connection invites to a handle or email address
- requires explicit consent before an invite can be created
- lets matching signed-in users accept pending invites

This MVP does **not** send real emails or contact third parties automatically. It stores pending invites locally so the flow can be reviewed safely before any real integration work.

## Requirements

- Node.js 22+

## Run locally

```bash
cd /home/runner/work/truce_or_dare/truce_or_dare
npm install
npm start
```

Open `http://localhost:3000`.

## Development

```bash
npm test
npm run dev
```

## Project structure

- `/home/runner/work/truce_or_dare/truce_or_dare/server.js` - HTTP server and API routing
- `/home/runner/work/truce_or_dare/truce_or_dare/lib/app.js` - core domain logic
- `/home/runner/work/truce_or_dare/truce_or_dare/lib/store.js` - JSON persistence
- `/home/runner/work/truce_or_dare/truce_or_dare/public/` - frontend assets
- `/home/runner/work/truce_or_dare/truce_or_dare/tests/` - unit tests

## Notes

- Data is stored in `/home/runner/work/truce_or_dare/truce_or_dare/data/store.json`
- This repo intentionally avoids real outbound messaging until consent and delivery integrations are fully designed
