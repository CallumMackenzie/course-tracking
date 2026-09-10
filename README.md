# Course Tracker

A local React + TypeScript dashboard backed by SQLite. Assessment JSON files in this directory are imported whenever the server starts; completion state is preserved in `course-tracking.db`.

Items whose official date is still TBD may include a `sort_date`. This controls their estimated timeline position without replacing the official `null` date; the dashboard labels these placements as estimates.

Participation items are kept out of the dated timeline and displayed in the bottom **Course-long** subsection.

## Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:5173>.

## Production build

```bash
npm run build
npm start
```

Open <http://localhost:3001>.
