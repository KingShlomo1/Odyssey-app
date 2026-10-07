# אודיסאה – העוזר האישי

A full-stack Hebrew (RTL) app for students in the Future Scientists Center's **Odyssey** program (מרכז מדעני העתיד – תוכנית אודיסאה). It runs on phones and desktops and can be installed to the home screen as a PWA.

## Features
- **Odyssey, the AI tutor (אודיסאה):** a Hebrew chat tutor built on the Claude API.
  - Students upload a photo or PDF of their homework. Odyssey points to the exact step with the mistake and explains why, without writing out the full solution. It explains concepts, gives one hint at a time, and runs exam practice.
  - Replies stream in live and render Markdown with LaTeX math (KaTeX).
  - Chats can be linked to a task, and they know the student's grade and university.
- **Homework uploads:** attach photos or PDFs to any task, then send them to Odyssey with one tap.
- **Schedule (מערכת שעות):** weekly campus sessions, the next campus day, and when to leave school. Exports to the phone's calendar (`.ics`) with alarms.
- **Credits (נק״ז):** courses by grade, credits earned and in progress, a credit-weighted average and totals per track. 9th-grade courses earn no credit.
- **Tasks and exams:** Odyssey and school work together, with overdue items and a warning when work piles up.
- **Accounts:** each student signs in with email and password, and their data lives on the server, so it syncs across devices.

## Architecture
| Part | Stack |
|---|---|
| Client | React 19, React Router, Vite, PWA (`src/`) |
| Server | Hono on Node 22, built-in `node:sqlite`, `@anthropic-ai/sdk` (`server/`) |
| Shared | zod schemas and types used by both sides (`shared/schema.ts`) |

- **Auth:** scrypt password hashes. The session token goes in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` in production), and only its SHA-256 is stored. Login and registration are rate-limited, and cross-site state changes are rejected.
- **Uploads:** images (JPEG/PNG/WebP/GIF) and PDFs up to 10MB. The type is checked from the file's bytes, not the browser's claim. Files live under `DATA_DIR/uploads/<user>/`, and only their owner can read them.
- **Odyssey:**
  - Uses `claude-opus-5-5` with adaptive thinking, and streams to the browser over SSE.
  - Prompt caching is turned on for the conversation prefix.
  - Server-side refusal fallbacks are turned on (`fallbacks: "default"`).
  - A per-student daily message cap (`ODYSSEY_DAILY_LIMIT`) keeps costs predictable.
  - The tutoring rules are in the system prompt in `server/odyssey.ts`.

## Development
```bash
npm install
cp .env.example .env      # add your ANTHROPIC_API_KEY, then export it in your shell
npm run dev               # API on :8787 and the client on :5173 (proxied)
npm test                  # unit + API tests (Odyssey is tested with a fake Claude client)
npm run typecheck
```

## Deploying
```bash
npm run build
ANTHROPIC_API_KEY=... DATA_DIR=/var/lib/odyssey npm start   # serves the API and the built client on PORT
```
Or use Docker: `docker build -t odyssey . && docker run -p 8787:8787 -v odyssey-data:/data -e ANTHROPIC_API_KEY=... odyssey`.

Run it behind HTTPS (for example on Render, Railway or Fly.io) and keep `DATA_DIR` on a persistent volume.

## Notes
- There's no email service yet, so there's no password reset by email.
- Users are minors. Student data and uploaded homework are stored on your server and sent to the Claude API only when a student messages Odyssey.
