# PodClip - Podcast Bookmark Application

## Overview

PodClip is a web application that allows users to save and organize clips from their favorite Spotify podcasts. Users can bookmark specific moments in podcast episodes with timestamps, notes, and quickly jump back to those moments via Spotify.

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
- `pages/` - Route-level components (Home, NotFound)
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
- `server/routes.ts` - API endpoint definitions for bookmarks, Spotify search, and transcription
- `server/storage.ts` - Database access layer implementing storage interface
- `server/spotify.ts` - Spotify API client using Replit's connector system
- `server/transcribe.ts` - Audio clip transcription using ffmpeg + OpenAI speech-to-text
- `server/db.ts` - Drizzle database connection pool

### Data Storage
- **Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: `shared/schema.ts` (shared between frontend and backend)
- **Tables**:
  - `users` - User accounts with username/password
  - `bookmarks` - Podcast clip bookmarks with episode metadata, timestamps, and notes
- **Validation**: Zod schemas generated from Drizzle schemas via drizzle-zod

### API Structure
All API routes are prefixed with `/api/`:
- `GET /api/bookmarks` - List all bookmarks
- `GET /api/bookmarks/:id` - Get single bookmark
- `POST /api/bookmarks` - Create bookmark
- `PUT /api/bookmarks/:id` - Update bookmark
- `DELETE /api/bookmarks/:id` - Delete bookmark
- `GET /api/spotify/search?q=query` - Search podcast episodes (Spotify with iTunes fallback)
- `GET /api/spotify/shows` - Get user's saved podcast shows
- `GET /api/spotify/recent` - Get recently played episodes (falls back to saved shows)
- `POST /api/transcribe` - Transcribe a podcast clip (takes audioUrl, timestampMs, durationMs; returns transcript text)

### Build System
- Development: Vite dev server with Express API middleware
- Production: Combined build using esbuild for server and Vite for client
- Output: `dist/` directory with `index.cjs` (server) and `public/` (client assets)

## External Dependencies

### Spotify Integration
The application integrates with Spotify using `@spotify/web-api-ts-sdk` and Replit's connector system for OAuth authentication. This enables:
- Searching podcast episodes (with iTunes/Apple Podcasts API fallback when Spotify API is unavailable)
- Fetching user's saved shows and recently played episodes
- Deep linking to specific timestamps in Spotify

**Important**: The Spotify connector app may be in development mode, which can cause 403 errors. The search function automatically falls back to the iTunes Search API when this happens, ensuring podcast search always works.

### AI Transcription
The application uses Replit AI Integrations (OpenAI-compatible) for speech-to-text transcription:
- `server/transcribe.ts` downloads podcast audio via ffmpeg, extracts a clip at a given timestamp/duration, and sends it to OpenAI's `gpt-4o-mini-transcribe` model
- The `/api/transcribe` endpoint has a URL allowlist to prevent SSRF attacks (only known podcast CDN hosts are allowed)
- The bookmark dialog includes a "Generate" button that triggers transcription when an audio URL is available from the episode search results
- Audio URLs come from iTunes (`episodeUrl` field) or Spotify (`audio_preview_url` field)

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