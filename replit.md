# PodClip - Podcast Bookmark Application

## Overview

PodClip is a web application that allows users to save and organize clips from their favorite Spotify podcasts. Users can bookmark specific moments in podcast episodes with timestamps, notes, and quickly jump back to those moments via Spotify. It includes a Now Playing companion widget for real-time clip capture while listening.

The application follows a full-stack TypeScript architecture with a React frontend and Express backend, using PostgreSQL for data persistence.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom theme configuration supporting light/dark modes
- **Build Tool**: Vite with hot module replacement

The frontend is organized under `client/src/` with:
- `pages/` - Route-level components (Home, NowPlaying, NotFound)
- `components/` - Reusable UI components including bookmark cards and dialogs
- `components/ui/` - shadcn/ui primitive components
- `hooks/` - Custom React hooks (toast notifications, mobile detection)
- `lib/` - Utilities and query client configuration

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **API Design**: RESTful JSON API under `/api/` prefix
- **External Integration**: Spotify Web API via Replit Connectors for OAuth

Key server modules:
- `server/routes.ts` - API endpoint definitions for bookmarks, Spotify search, playback, and transcription
- `server/storage.ts` - Database access layer implementing storage interface
- `server/spotify.ts` - Spotify API client using Replit's connector system (search, playback, saved shows)
- `server/transcribe.ts` - Audio clip transcription using ffmpeg + OpenAI speech-to-text
- `server/db.ts` - Drizzle database connection pool

### Data Storage
- **Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: `shared/schema.ts` (shared between frontend and backend)
- **Tables**:
  - `users` - User accounts with username/password
  - `bookmarks` - Podcast clip bookmarks with episode metadata, timestamps, notes, transcripts, and audio URLs
  - `episode_transcripts` - Full episode transcripts with segments (text + timestamps), status tracking, and progress
- **Validation**: Zod schemas generated from Drizzle schemas via drizzle-zod
  - `insertBookmarkSchema` - Full bookmark creation/update validation
  - `patchBookmarkSchema` - Partial update validation (transcript, note, durationMs only)

### API Structure
All API routes are prefixed with `/api/`:
- `GET /api/bookmarks` - List all bookmarks
- `GET /api/bookmarks/:id` - Get single bookmark
- `POST /api/bookmarks` - Create bookmark
- `PUT /api/bookmarks/:id` - Full update bookmark
- `PATCH /api/bookmarks/:id` - Partial update bookmark (transcript, note, durationMs)
- `DELETE /api/bookmarks/:id` - Delete bookmark
- `GET /api/spotify/search?q=query` - Search podcast episodes (Spotify with iTunes fallback)
- `GET /api/spotify/shows` - Get user's saved podcast shows
- `GET /api/spotify/recent` - Get recently played episodes (falls back to saved shows)
- `GET /api/spotify/player` - Get current Spotify playback state
- `PUT /api/spotify/player/play` - Resume Spotify playback
- `PUT /api/spotify/player/pause` - Pause Spotify playback
- `PUT /api/spotify/player/seek` - Seek to position in current track
- `POST /api/transcribe` - Transcribe a podcast clip (takes audioUrl, timestampMs, durationMs; returns transcript text)
- `POST /api/episode-transcripts` - Start full episode transcription (takes episodeId, episodeName, showName, showImageUrl, audioUrl)
- `GET /api/episode-transcripts/by-episode/:episodeId` - Get transcript by episode ID
- `GET /api/episode-transcripts/:id` - Get transcript by transcript ID (includes progress/status)

### Pages
- `/` - Home page with bookmark list, search, and add clip flow
- `/now-playing` - Now Playing companion widget for real-time clip capture from Spotify
- `/transcript` - Full episode transcript viewer with search and highlight-to-clip functionality

### Build System
- Development: Vite dev server with Express API middleware
- Production: Combined build using esbuild for server and Vite for client
- Output: `dist/` directory with `index.cjs` (server) and `public/` (client assets)

## External Dependencies

### Spotify Integration
The application integrates with Spotify using `@spotify/web-api-ts-sdk` and Replit's connector system for OAuth authentication. This enables:
- Searching podcast episodes (with iTunes/Apple Podcasts API fallback when Spotify API is unavailable)
- Fetching user's saved shows and recently played episodes
- Reading current playback state (Now Playing widget)
- Controlling playback (play/pause/seek)
- Deep linking to specific timestamps in Spotify

**Spotify Connector Permissions**: playlist-read-private, playlist-read-collaborative, playlist-modify-private, user-read-email, user-read-private, app-remote-control, streaming, user-modify-playback-state, user-library-read, user-library-modify, playlist-modify-public, user-read-playback-state, user-read-currently-playing, user-read-recently-played, user-top-read

**Important**: The Spotify connector app may be in development mode, which can cause 403 errors. The search function automatically falls back to the iTunes Search API when this happens. The Now Playing widget shows a clear error message when playback APIs are unavailable.

### AI Transcription
The application uses Replit AI Integrations (OpenAI-compatible) for speech-to-text transcription:
- `server/transcribe.ts` downloads podcast audio via ffmpeg, extracts a clip at a given timestamp/duration, and sends it to OpenAI's `gpt-4o-mini-transcribe` model
- The `/api/transcribe` endpoint has a URL allowlist to prevent SSRF attacks (only known podcast CDN hosts are allowed)
- Transcripts are auto-generated after saving a new clip (no manual Generate step needed in create mode)
- In edit mode, a "Regenerate" button allows re-generating transcripts with updated timestamps
- Audio URLs come from iTunes (`episodeUrl` field) or Spotify (`audio_preview_url` field)

### Full Episode Transcription
The `/transcript` page allows users to generate full episode transcripts:
1. User searches for and selects an episode
2. Clicks "Generate Full Transcript" to start background transcription
3. `server/transcribe-episode.ts` downloads audio, splits into 2-minute chunks via ffmpeg, transcribes each chunk
4. Progress is stored in the `episode_transcripts` table (status, progress, totalChunks)
5. Frontend polls for updates every 3 seconds during processing
6. Once complete, the full transcript displays with timestamps per segment
7. Users can search within the transcript and highlight text to save as clips
8. Highlighted text maps to segment timestamps for accurate clip boundaries

### Transcript Auto-Generation Flow
1. User saves a new clip (via Add Clip dialog or Now Playing widget)
2. The clip is saved to the database immediately (without transcript)
3. In the background, the frontend calls POST /api/transcribe
4. Once transcript is generated, it's saved via PATCH /api/bookmarks/:id
5. The bookmark list refreshes to show the transcript

### Database
- PostgreSQL database (requires `DATABASE_URL` environment variable)
- Connection managed via `pg` package with connection pooling
- Schema migrations via `drizzle-kit push`

### Key NPM Dependencies
- `drizzle-orm` / `drizzle-zod` - Database ORM and validation
- `@tanstack/react-query` - Data fetching and caching
- `@radix-ui/*` - Accessible UI primitives
- `tailwindcss` - Utility-first CSS
- `zod` - Runtime type validation
- `react-hook-form` - Form handling with Zod integration
