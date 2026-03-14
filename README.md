# PodClip

Save and organize your favorite moments from Spotify podcasts. Bookmark specific timestamps, capture transcripts, and jump back to any moment instantly.

## Features

- **Clip bookmarks** — Save any moment from a podcast episode with a timestamp and personal note
- **AI transcription** — Automatically transcribes your saved clips using speech-to-text
- **Full episode transcripts** — Generate a full searchable transcript for any episode
- **Highlight to clip** — Select any text in a transcript to save it as a bookmark
- **Now Playing widget** — Capture clips in real time while listening in Spotify
- **Spotify integration** — Search episodes, browse your saved shows, and control playback
- **User accounts** — Each user has their own private dashboard of clips and transcripts
- **Replit OAuth** — Sign in with your Replit account (supports Google via Replit)

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Wouter
- **Backend**: Express.js, TypeScript, Drizzle ORM, PostgreSQL
- **Auth**: Passport.js (local + Replit OIDC)
- **AI**: OpenAI speech-to-text via Replit AI Integrations
- **Audio**: ffmpeg for audio extraction and chunking
- **Build**: Vite (frontend), esbuild (server)

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database (`DATABASE_URL` env var)
- Spotify app credentials (via Replit Spotify connector)
- OpenAI API key (via Replit AI Integrations)
- `SESSION_SECRET` env var for session encryption

### Development

```bash
npm install
npm run db:push
npm run dev
```

The app runs on port 5000 with the Express API and Vite dev server combined.

### Production build

```bash
npm run build
npm start
```

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Secret key for session signing |
| `REPL_ID` | Set automatically by Replit (used for OAuth) |
| `REPLIT_DOMAINS` | Set automatically by Replit (used for OAuth callback URL) |

## Project Structure

```
client/        React frontend
server/        Express backend
shared/        Shared TypeScript types and Drizzle schema
```
