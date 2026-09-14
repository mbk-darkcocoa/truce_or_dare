# Truce or Dare

Truce or Dare is a small MVP for starting lightweight social game sessions and consent-based connection invites.

## What this app does

- creates a demo profile with a display name, handle, and optional email
- starts Truce, Dare, or mixed game sessions
- sends connection invites to a handle or email address
- requires explicit consent before an invite can be created
- lets matching signed-in users accept pending invites
- shows online tester presence through background sync
- prepares copyable GitHub-ready nudges for handle-based invites
- includes an ops chat surface for live coordination
- includes an Ironclad command center with telemetry and beacons
- includes Terraform deployment metadata under `/home/runner/work/truce_or_dare/truce_or_dare/terraform`
- includes installable PWA assets for a faster “Instaweb” experience
- includes a Dockerfile for simple web deployment

This MVP does **not** send real emails or contact third parties automatically. It stores pending invites locally so the flow can be reviewed safely before any real integration work.

## Requirements

- Node.js 22+
- Terraform 1.5+ (optional, only for deployment metadata validation)

## Kali Linux setup

Use Kali as a normal Linux host for this app. Truce or Dare stays in user space and does not require kernel hooks or privileged security tooling. These instructions are for a real Linux deployment target and do not depend on VMware, Citrix, or a simulation-only workflow.

1. Install Node.js 22+ with your preferred package source for Kali.
2. Clone the repo to the host.
3. Run:

```bash
cd /home/runner/work/truce_or_dare/truce_or_dare
npm install
npm test
npm start
```

Optional environment variables for Kali or other Linux hosts:

- `PORT` - HTTP port for the app server
- `TRUCE_OR_DARE_DATA_PATH` - absolute path to the JSON state file

Example:

```bash
cd /home/runner/work/truce_or_dare/truce_or_dare
PORT=3100 TRUCE_OR_DARE_DATA_PATH=/var/lib/truce-or-dare/store.json npm start
```

## Run locally

```bash
cd /home/runner/work/truce_or_dare/truce_or_dare
npm install
npm start
```

Open `http://localhost:3000`.

## PWA

The web app now includes:

- `/home/runner/work/truce_or_dare/truce_or_dare/public/manifest.webmanifest`
- `/home/runner/work/truce_or_dare/truce_or_dare/public/service-worker.js`
- `/home/runner/work/truce_or_dare/truce_or_dare/public/icon.svg`

Supported browsers can install the app for a standalone experience.

## Development

```bash
npm test
npm run dev
```

## Terraform

```bash
cd /home/runner/work/truce_or_dare/truce_or_dare/terraform
terraform init
terraform validate
terraform plan -var="public_url=http://localhost:3000"
```

The Terraform files expose deployment metadata and Ironclad configuration for handoff into a fuller infrastructure stack.

## Deploy on the web

For a simple containerized deployment:

```bash
cd /home/runner/work/truce_or_dare/truce_or_dare
docker build -t truce-or-dare .
docker run -p 3000:3000 truce-or-dare
```

## Running as a service on Kali

A sample systemd unit is included at `/home/runner/work/truce_or_dare/truce_or_dare/deploy/systemd/truce-or-dare.service`.

Typical setup flow:

```bash
sudo mkdir -p /opt/truce_or_dare /var/lib/truce-or-dare
sudo cp -R /home/runner/work/truce_or_dare/truce_or_dare/* /opt/truce_or_dare/
sudo cp /home/runner/work/truce_or_dare/truce_or_dare/deploy/systemd/truce-or-dare.service /etc/systemd/system/truce-or-dare.service
sudo systemctl daemon-reload
sudo systemctl enable --now truce-or-dare
curl http://127.0.0.1:3000/health
```

## Project structure

- `/home/runner/work/truce_or_dare/truce_or_dare/server.js` - HTTP server and API routing
- `/home/runner/work/truce_or_dare/truce_or_dare/deploy/systemd/` - sample Linux service unit
- `/home/runner/work/truce_or_dare/truce_or_dare/lib/app.js` - core domain logic
- `/home/runner/work/truce_or_dare/truce_or_dare/lib/store.js` - JSON persistence
- `/home/runner/work/truce_or_dare/truce_or_dare/public/` - frontend assets
- `/home/runner/work/truce_or_dare/truce_or_dare/public/service-worker.js` - offline caching
- `/home/runner/work/truce_or_dare/truce_or_dare/public/manifest.webmanifest` - installable PWA metadata
- `/home/runner/work/truce_or_dare/truce_or_dare/terraform/` - Terraform deployment metadata
- `/home/runner/work/truce_or_dare/truce_or_dare/tests/` - unit tests

## Notes

- Data defaults to `/home/runner/work/truce_or_dare/truce_or_dare/data/store.json`
- Set `TRUCE_OR_DARE_DATA_PATH` to move the state file on Kali or other Linux hosts
- This repo intentionally avoids real outbound messaging until consent and delivery integrations are fully designed
- This app does not add kernel hooks, privileged login automation, or offensive security behavior
