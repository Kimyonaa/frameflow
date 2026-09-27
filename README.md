# FrameFlow

**Good feedback. Great follow-through.**

A MERN application for visual design review and requirement traceability. Move from a client brief to pinned feedback, evidence-linked tasks and version-specific approval. The demo includes an original, code-rendered Forma studio design; it is synthetic sample content, not a real client engagement.

## Run locally

Requires Node.js 22.13+ and Docker Desktop (running).

```bash
npm ci
npm run db:up
cp .env.example .env
npm run dev
```

Open **http://127.0.0.1:5173** and choose **Explore the live demo**, or create an account. Each demo session gets a separate MongoDB workspace. An HttpOnly cookie remembers the session for seven days. Demo data persists in MongoDB across restarts; clearing cookies or signing out creates a new demo next time. Account sign-in restores its existing workspace. There is no password reset/email service yet.

Database: `mongodb://127.0.0.1:27017/frameflow`. MongoDB uses the `frameflow-data` Docker volume. `npm run db:down` stops MongoDB without deleting data. Keep ports 27017, 4310 and 5173 private during local development.

## What works

- Private workspaces, registration, password hashing, login and logout.
- Project creation and editing with a client brief and dated deliverable.
- Requirements and acceptance criteria.
- Uploads of PNG, JPEG, WebP and PDF up to 10 MB. Images are validated and re-encoded; PDFs render in a canvas with per-page annotations.
- Version comparison slider, normalized pin coordinates and version-specific comments.
- Comment-to-task conversion with duplicate protection and requirement/evidence links.
- Task board (drag and drop plus accessible status selectors), list, due-date timeline and assignees as text labels.
- Resolve/reopen feedback; reopen a task to invalidate the related approval.
- Approvals blocked by unresolved version feedback, unfinished linked tasks or stale revision numbers.
- Seven-day, revocable client review links limited to one version. Reviewers can leave named comments and approve; they cannot edit the workspace, resolve feedback, or see other versions.
- Live workspace refresh across authenticated sessions using Socket.IO; client links poll every 15 seconds.
- Activity history, project JSON export and keyboard search (Cmd/Ctrl+K).
- Assistant proposals with source citations, editable previews and explicit apply; applying a proposal is idempotent.

## AI configuration

Without credentials the **local evidence assistant** extracts proposed requirements from brief sentences, drafts tasks from comments and retrieves project evidence. It is deterministic and explicitly labelled; it is not a language model or simulated AI output.

For actual model-backed assistance, set these only in the server `.env` and restart:

```dotenv
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=your_responses_compatible_model
```

The server calls the OpenAI Responses API with a strict output schema, bounded project context, `store: false`, a timeout and rate limits. Provider errors do not silently become fabricated answers. Model citations are checked against project evidence. A model can still give incorrect advice; users must review the proposal. No API key is exposed to the browser. AI API costs are separate from Codex usage. The repository does not include a key; the live provider has not been exercised in this build.

Reference: https://developers.openai.com/api/docs/guides/structured-outputs

## Verify

```bash
npm test                 # uses a temporary frameflow_test_<pid> MongoDB database
npm run build
npm run test:e2e         # start npm run dev first; uses installed Google Chrome
npm run check:format
```

For CI or another machine, install Chrome with `npx playwright install chrome` or configure the Playwright channel appropriately. Integration tests drop only their own generated test database. Browser tests create isolated demo workspaces in the running app. Test screenshots/traces are ignored by Git.

## Production build

```bash
npm run build
NODE_ENV=production npm start
```

Express serves the built React application on port 4310. Put it behind HTTPS, set `COOKIE_SECURE=true`, configure `ALLOWED_ORIGINS` and `HOST`, and use a secured MongoDB URI. No cloud deployment is included. The supplied Compose database is local-only and is not a production database configuration.

## Deliberate boundaries

This release has owner workspaces and client reviewers—not full team invitations/editor roles. Assignee names are labels, not user invitations. Project-wide writes use MongoDB optimistic concurrency; assets live in separate MongoDB documents. The current upload size and project limits make this practical for a portfolio deployment; S3/GridFS and background workers would be the next scaling step. The activity feed is useful history, not a tamper-proof compliance audit. JSON is the available report export; PDF report generation is not implemented. The app does not send email, charge payments, or modify external project tools.

The repository contains JavaScript, React and CSS; it has not been migrated to TypeScript. It does not include Redis/BullMQ or Python services simply to pad the technology list.

See [ARCHITECTURE.md](ARCHITECTURE.md), [DEMO.md](DEMO.md).
