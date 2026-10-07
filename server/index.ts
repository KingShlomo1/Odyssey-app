import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import Anthropic from '@anthropic-ai/sdk';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { openDb } from './db';
import { pruneSessions } from './auth';
import { createApp } from './app';

const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
const PRODUCTION = process.env.NODE_ENV === 'production';
const CLIENT_DIR = path.resolve(process.env.CLIENT_DIR || './dist');

mkdirSync(DATA_DIR, { recursive: true });
const db = openDb(path.join(DATA_DIR, 'odyssey.db'));
pruneSessions(db);
setInterval(() => pruneSessions(db), 6 * 3600_000).unref();

const hasKey = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
if (!hasKey) console.warn('No ANTHROPIC_API_KEY set: Odyssey (the AI tutor) is turned off.');

const app = createApp({
  db,
  uploadDir: path.join(DATA_DIR, 'uploads'),
  ai: hasKey ? new Anthropic() : null,
  secureCookies: PRODUCTION,
  dailyMessageLimit: Number(process.env.ODYSSEY_DAILY_LIMIT || 60),
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean),
});

// In production the server also serves the built client, with a fallback to index.html for app routes.
if (existsSync(path.join(CLIENT_DIR, 'index.html'))) {
  const indexHtml = readFileSync(path.join(CLIENT_DIR, 'index.html'), 'utf8');
  app.use('/*', serveStatic({ root: path.relative(process.cwd(), CLIENT_DIR) }));
  app.get('*', (c) => (c.req.path.startsWith('/api/') ? c.notFound() : c.html(indexHtml)));
}

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Odyssey server listening on http://localhost:${info.port}`);
});
