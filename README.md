# truce_or_dare

Platform scaffold for a staged VR/web rollout with:
- a public storefront
- a community lobby
- a support desk
- an admin console
- workbook documentation for delivery and operations

## MVP surfaces
- **Storefront:** browse starter products and platform bundles
- **Forum & lobby:** review initial community spaces and moderation backlog
- **Support desk:** submit support tickets and browse support articles
- **Admin console:** inspect active sessions, resolve tickets, and process moderation items
- **Workbook:** track scope, architecture, and operations guidance

## Getting started
```bash
npm install --package-lock-only
npm start
```

Then open `http://127.0.0.1:3000`.

Use the default admin code below only for local demos:

```bash
TRUCE_OR_DARE_ADMIN_CODE=admin-demo-code
```

## Scripts
- `npm start` - run the server
- `npm run dev` - run the server in watch mode
- `npm test` - run the API and static-asset tests

## Configuration
Copy `/home/runner/work/truce_or_dare/truce_or_dare/infra/.env.example` into your deployment environment and set:
- `PORT`
- `TRUCE_OR_DARE_ADMIN_CODE`
- `TRUCE_OR_DARE_DATA_PATH`

## Repository structure
- `/home/runner/work/truce_or_dare/truce_or_dare/backend` - HTTP server and API routes
- `/home/runner/work/truce_or_dare/truce_or_dare/frontend` - static frontend assets
- `/home/runner/work/truce_or_dare/truce_or_dare/shared` - seed data and persistence helpers
- `/home/runner/work/truce_or_dare/truce_or_dare/tests` - Node test suite
- `/home/runner/work/truce_or_dare/truce_or_dare/infra` - environment and service deployment examples
- `/home/runner/work/truce_or_dare/truce_or_dare/workbook` - product and operations workbook material
