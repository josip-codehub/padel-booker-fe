# Padel Auto-Booker — Frontend

Angular 20 (standalone, signals) app for browsing live court availability and managing queued
midnight bookings. Talks to the backend under `/api`.

## Develop

```bash
npm install
npm start        # ng serve on http://localhost:4200, proxies /api -> localhost:8080 (proxy.conf.json)
```

Run the backend (and Postgres) separately, e.g. via the infra `docker compose`.

## Build

```bash
npm run build    # outputs dist/padel-booker-fe/browser
```

In Docker the build is served by nginx, which also proxies `/api` to the `be` container
(see `nginx.conf`).

## Pages

- **Availability** — live week grid per court; click a free slot to queue it. Days >1 week out are
  marked ✦ (auto-booked at midnight); nearer days book immediately.
- **Queue** — queued/past bookings with status; cancel pending ones.
- **History** — every fire attempt with outcome and raw response.
- **Settings** — Sporty Plus email/password; token status.
