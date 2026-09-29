# Course Tracker

A React + TypeScript dashboard deployed on Firebase:

- **Firebase Hosting** serves the Vite client.
- **Cloud Functions for Firebase** runs the Express API.
- **Cloud Firestore** stores deliverables and completion state.
- Assessment and course-content JSON files remain the source-controlled source data.

Assessment JSON is synchronized into Firestore on the first API request after its content
changes. Stable document IDs preserve completion state across deploys. Direct browser access to
Firestore is denied; the client uses the `/api` Hosting rewrite.

Items whose official date is still TBD may include a `sort_date`. This controls their estimated
timeline position without replacing the official `null` date. Participation items remain in the
bottom **Course-long** subsection.

## Firebase setup

Requirements:

- Node.js 22
- A Firebase project on the Blaze plan (required for Cloud Functions deployment)
- A Firestore database in Native mode

Log in and associate this checkout with the Firebase project:

```bash
npx firebase login
npx firebase use --add
```

`firebase use --add` creates `.firebaserc`. The file is project-specific and intentionally ignored.
An example is included at `.firebaserc.example`.

Deploy Hosting, the API function, Firestore rules, and indexes:

```bash
npm install
npm run deploy
```

The first request to `/api/deliverables` seeds the `deliverables` collection. No separate database
migration command is required. The old local `course-tracking.db` is not read or deployed.

## Access control

The tracker is protected by the `COURSE_TRACKER_ACCESS_TOKEN` Firebase Secret Manager secret.
The browser verifies an entered token through `/api/auth`, retains it in `localStorage` until the
user clicks **Lock** or clears site data, and sends it as a Bearer token to the API. Firestore remains
inaccessible directly from the browser.

Token files must stay outside the repository; matching filenames are also ignored defensively.
Redeploy the Function after rotating the secret so the new secret version is attached.

## MCP access

Agents can read assessment and daily course information through a stateless Streamable HTTP MCP
endpoint at `/api/mcp`. It uses the separate `COURSE_TRACKER_MCP_TOKEN` Firebase Secret Manager
secret; this token does not authorize the browser API or completion updates. The MCP server exposes
read-only tools for listing and fetching assessments, retrieving a daily schedule, and listing
upcoming assessments. Every assessment and course-content item includes its course webpage and
any course files hosted by this tracker.

Configure MCP clients to send the scoped token as a Bearer token using their protected credential
storage. Do not place the token in a repository file, URL, or command-line argument.

## Local development

The Firestore emulator requires Java 11 or newer. Start Vite, the Functions emulator, and the
Firestore emulator together:

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. Emulator data is temporary unless Firebase emulator import/export is
configured separately.

## Validation

```bash
npm run typecheck
npm run build
```

## Project structure

```text
data/assessments/      Assessment source data imported into Firestore
data/course-content/   Dated course-content source data read by the API
public/                Static web assets
server/                Express API, Firestore sync, and Cloud Function export
src/                   React client
firebase.json          Hosting, Functions, Firestore, and emulator configuration
firestore.rules        Denies direct client access to Firestore
```
