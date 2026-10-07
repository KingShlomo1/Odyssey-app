# אודיסאה – העוזר האישי

A Hebrew (RTL) progressive web app for students in the Future Scientists Center's **Odyssey** program (מרכז מדעני העתיד – תוכנית אודיסאה).

## Features
- **Schedule (מערכת שעות):** weekly campus sessions, the next campus day, and when to leave school based on travel time.
- **Reminders:** export to the phone's calendar (`.ics`). Sessions come in as weekly events with a "time to leave" alarm, and tasks come in with an alarm the evening before. There's also an optional in-app notification, which only works while the app is open.
- **Credits (נק״ז):** courses by grade, credits earned and in progress, a credit-weighted average, and totals per track. 9th-grade courses are preparatory and earn no credit.
- **Tasks & exams:** Odyssey and school work side by side, with overdue items and a warning when work piles up (3+ items, or 2+ tests, within 3 days).
- **Private by default:** all data stays in the browser's `localStorage`. There's JSON backup and restore in Settings.

## Development
```bash
npm install
npm run dev        # dev server
npm test           # unit tests (vitest)
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build
```

`dist/` is a static site and can be deployed to any static host (Netlify, Vercel, GitHub Pages, Cloudflare Pages).
