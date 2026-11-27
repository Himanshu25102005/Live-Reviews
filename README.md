# Live Reviews

## Problem Statement

Live Reviews is a review manager for the full-stack practical assignment. Users can create, read, edit, and delete reviews stored in MongoDB. The reviews table shows the newest entries first and updates across open browser tabs through WebSockets.

## Getting Started

Install Node.js 22.12 or later with npm, and have MongoDB Community Server available locally. If you installed MongoDB as a Windows service, start it if needed with `Start-Service MongoDB` from an elevated PowerShell. See the [MongoDB installation instructions](https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-windows/) for setup details.

From the repository root, open two PowerShell terminals.

**Terminal 1 — Backend**

```powershell
cd backend
npm.cmd ci
Copy-Item .env.example .env
npm.cmd start
```

The backend `.env` sets `MONGODB_URI` to `mongodb://127.0.0.1:27017/live_reviews` and `PORT` to `3000` by default. If you already have a backend `.env` file, skip the copy step and use your existing settings.

**Terminal 2 — Frontend**

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Open [http://127.0.0.1:5173/](http://127.0.0.1:5173/). The frontend proxies `/api` and `/ws` to `http://127.0.0.1:3000`. If the backend uses a different port, copy `frontend/.env.example` to `frontend/.env` and set `BACKEND_URL` to the backend origin. On macOS or Linux, use `npm` in place of `npm.cmd` and `cp` in place of `Copy-Item`.

To check the production build, run `npm run build` in `frontend`. With the backend running, `npm run preview` serves the build at [http://127.0.0.1:4173/](http://127.0.0.1:4173/).

## Completed

- Verified all five REST endpoints against MongoDB, including input trimming, required fields, timestamps, invalid and missing IDs, newest-first ordering, and persistence across an API restart.
- Verified all three React Router pages, the shared create/edit form, form validation, Reset and Cancel, and deletion from both the table and the edit page.
- Verified create, update, and delete broadcasts with two WebSocket clients. Repeated the workflow in two browser tabs against the production build and confirmed the second tab updated without a refresh.
- Added case-insensitive title and content search and four sort options. The table defaults to newest first and keeps the selected search and sort across live updates and form navigation.
- Verified three-second green, blue, and red highlights in two tabs. A deleted row remains visible for three seconds while the actual review is already gone from MongoDB.
- Verified five-second Undo notifications from both deletion controls, including overlapping deletions. Undo restores the original record, including its ID and timestamps, and updates other tabs.
- Verified that an open tab catches up after a forced WebSocket outage and receives new events after reconnecting.

## Tests

Run `npm test` separately in `backend` and `frontend`. The backend suite uses local HTTP and WebSocket connections with mocked storage. The frontend suite uses fake timers to check highlight and Undo deadlines. Neither suite requires a running MongoDB instance.

## API

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/api/reviews` | `200` with the newest-first list |
| `GET` | `/api/reviews/:id` | `200` with one review |
| `POST` | `/api/reviews` | `201` with the created review |
| `PUT` | `/api/reviews/:id` | `200` with the updated review |
| `DELETE` | `/api/reviews/:id` | `204` |
| `POST` | `/api/reviews/:id/restore` | `201` with the restored review |

Create and update requests take JSON with `title` and `content`. JSON successes use `{ "data": ... }` and errors use `{ "error": "..." }`.

Successful deletion returns a single-use receipt in `X-Review-Undo-Token`. Restore takes `{ "token": "..." }`. The browser offers Undo for five seconds. Receipts stay in server memory for 30 seconds to allow for network delay, and a server restart clears them.

The `/ws` endpoint broadcasts `review:created` and `review:updated` with a `review` object, and `review:deleted` with an `id` and the deleted review snapshot. A restore broadcasts `review:created` with `restored: true`, which shows the row normally. The list reconciles with MongoDB after events and reconnects.

## AI Assistance

Codex used the supplied master specification to implement the API, database model, WebSocket server, React UI, and setup documentation. It ran HTTP and WebSocket checks against an isolated local MongoDB database and exercised the production build in two browser tabs.
