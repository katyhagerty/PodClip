import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBookmarkSchema, patchBookmarkSchema, registerUserSchema } from "@shared/schema";
import { searchEpisodes, searchITunes, getSavedShows, getRecentlyPlayedEpisodes, resolveSpotifyEpisodeId, getCurrentPlayback, pausePlayback, resumePlayback, seekPlayback } from "./spotify";
import { transcribeClip } from "./transcribe";
import { transcribeFullEpisode } from "./transcribe-episode";
import { requireAuth, hashPassword } from "./auth";
import passport from "passport";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const parsed = registerUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
      }

      const existingUser = await storage.getUserByUsername(parsed.data.username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already taken" });
      }

      const hashedPassword = await hashPassword(parsed.data.password);
      const user = await storage.createUser({
        username: parsed.data.username,
        password: hashedPassword,
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json({ id: user.id, username: user.username });
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ error: info?.message || "Invalid username or password" });
      }
      req.login(user, (err) => {
        if (err) return next(err);
        res.json({ id: user.id, username: user.username });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Not logged in" });
    }
    const u = req.user;
    res.json({
      id: u.id,
      username: u.username,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      profileImageUrl: u.profileImageUrl,
      displayName: u.firstName
        ? [u.firstName, u.lastName].filter(Boolean).join(" ")
        : (u.username ?? u.email ?? "User"),
    });
  });

  // Get all bookmarks
  app.get("/api/bookmarks", requireAuth, async (req, res) => {
    try {
      const bookmarks = await storage.getBookmarks(req.user!.id);
      res.json(bookmarks);
    } catch (error) {
      console.error("Error fetching bookmarks:", error);
      res.status(500).json({ error: "Failed to fetch bookmarks" });
    }
  });

  // Get single bookmark
  app.get("/api/bookmarks/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const bookmark = await storage.getBookmark(id);
      if (!bookmark || bookmark.userId !== req.user!.id) {
        return res.status(404).json({ error: "Bookmark not found" });
      }
      res.json(bookmark);
    } catch (error) {
      console.error("Error fetching bookmark:", error);
      res.status(500).json({ error: "Failed to fetch bookmark" });
    }
  });

  // Create bookmark
  app.post("/api/bookmarks", requireAuth, async (req, res) => {
    try {
      const parsed = insertBookmarkSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const data = { ...parsed.data };
      if (data.episodeId.startsWith('itunes-')) {
        const spotifyId = await resolveSpotifyEpisodeId(data.episodeName, data.showName);
        if (spotifyId) {
          data.episodeId = spotifyId;
        }
      }
      const bookmark = await storage.createBookmark({ ...data, userId: req.user!.id });
      res.status(201).json(bookmark);
    } catch (error) {
      console.error("Error creating bookmark:", error);
      res.status(500).json({ error: "Failed to create bookmark" });
    }
  });

  // Update bookmark
  app.put("/api/bookmarks/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const parsed = insertBookmarkSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const bookmark = await storage.updateBookmark(id, parsed.data, req.user!.id);
      if (!bookmark) {
        return res.status(404).json({ error: "Bookmark not found" });
      }
      res.json(bookmark);
    } catch (error) {
      console.error("Error updating bookmark:", error);
      res.status(500).json({ error: "Failed to update bookmark" });
    }
  });

  app.patch("/api/bookmarks/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const parsed = patchBookmarkSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const bookmark = await storage.patchBookmark(id, parsed.data, req.user!.id);
      if (!bookmark) {
        return res.status(404).json({ error: "Bookmark not found" });
      }
      res.json(bookmark);
    } catch (error) {
      console.error("Error patching bookmark:", error);
      res.status(500).json({ error: "Failed to update bookmark" });
    }
  });

  // Delete bookmark
  app.delete("/api/bookmarks/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const deleted = await storage.deleteBookmark(id, req.user!.id);
      if (!deleted) {
        return res.status(404).json({ error: "Bookmark not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting bookmark:", error);
      res.status(500).json({ error: "Failed to delete bookmark" });
    }
  });

  // iTunes-only episode search (used by transcript page — always returns full audio URLs)
  app.get("/api/itunes/search", requireAuth, async (req, res) => {
    try {
      const query = req.query.q as string || req.query["0"] as string;
      if (!query || query.length < 2) {
        return res.json([]);
      }
      const episodes = await searchITunes(query);
      res.json(episodes);
    } catch (error) {
      console.error("Error searching iTunes:", error);
      res.status(500).json({ error: "Failed to search iTunes" });
    }
  });

  // Search Spotify episodes
  app.get("/api/spotify/search", requireAuth, async (req, res) => {
    try {
      const query = req.query.q as string || req.query["0"] as string;
      if (!query || query.length < 2) {
        return res.json([]);
      }
      const episodes = await searchEpisodes(query);
      res.json(episodes);
    } catch (error) {
      console.error("Error searching Spotify:", error);
      res.status(500).json({ error: "Failed to search Spotify" });
    }
  });

  // Get saved shows/episodes
  app.get("/api/spotify/shows", requireAuth, async (req, res) => {
    try {
      const episodes = await getSavedShows();
      res.json(episodes);
    } catch (error) {
      console.error("Error fetching shows:", error);
      res.status(500).json({ error: "Failed to fetch shows" });
    }
  });

  // Get recently played episodes (falls back to saved shows if unavailable)
  app.get("/api/spotify/recent", requireAuth, async (req, res) => {
    try {
      const episodes = await getRecentlyPlayedEpisodes();
      if (episodes.length > 0) {
        res.json(episodes);
      } else {
        const savedEpisodes = await getSavedShows();
        res.json(savedEpisodes);
      }
    } catch (error) {
      console.error("Error fetching recent episodes, trying saved shows:", error);
      try {
        const savedEpisodes = await getSavedShows();
        res.json(savedEpisodes);
      } catch (fallbackError) {
        console.error("Error fetching saved shows fallback:", fallbackError);
        res.status(500).json({ error: "Failed to fetch episodes" });
      }
    }
  });

  app.get("/api/spotify/player", requireAuth, async (req, res) => {
    try {
      const playback = await getCurrentPlayback();
      res.json(playback);
    } catch (error) {
      console.error("Error getting playback state:", error);
      res.status(500).json({ error: "Failed to get playback state" });
    }
  });

  app.put("/api/spotify/player/pause", requireAuth, async (req, res) => {
    try {
      await pausePlayback();
      res.json({ success: true });
    } catch (error) {
      console.error("Error pausing playback:", error);
      res.status(500).json({ error: "Failed to pause playback" });
    }
  });

  app.put("/api/spotify/player/play", requireAuth, async (req, res) => {
    try {
      await resumePlayback();
      res.json({ success: true });
    } catch (error) {
      console.error("Error resuming playback:", error);
      res.status(500).json({ error: "Failed to resume playback" });
    }
  });

  app.put("/api/spotify/player/seek", requireAuth, async (req, res) => {
    try {
      const { positionMs } = req.body;
      if (typeof positionMs !== "number" || positionMs < 0) {
        return res.status(400).json({ error: "Valid positionMs is required" });
      }
      await seekPlayback(positionMs);
      res.json({ success: true });
    } catch (error) {
      console.error("Error seeking playback:", error);
      res.status(500).json({ error: "Failed to seek playback" });
    }
  });

  app.get("/api/episode-transcripts/completed", requireAuth, async (req, res) => {
    try {
      const transcripts = await storage.getCompletedEpisodeTranscripts(req.user!.id);
      res.json(transcripts);
    } catch (error) {
      console.error("Error fetching completed transcripts:", error);
      res.status(500).json({ error: "Failed to fetch completed transcripts" });
    }
  });

  app.get("/api/episode-transcripts/statuses", requireAuth, async (req, res) => {
    try {
      const statuses = await storage.getAllEpisodeTranscriptStatuses(req.user!.id);
      res.json(statuses);
    } catch (error) {
      console.error("Error fetching transcript statuses:", error);
      res.status(500).json({ error: "Failed to fetch transcript statuses" });
    }
  });

  app.post("/api/episode-transcripts", requireAuth, async (req, res) => {
    try {
      const { episodeId, episodeName, showName, showImageUrl, audioUrl } = req.body;
      if (!episodeId || typeof episodeId !== "string" ||
          !episodeName || typeof episodeName !== "string" ||
          !showName || typeof showName !== "string" ||
          !audioUrl || typeof audioUrl !== "string") {
        return res.status(400).json({ error: "episodeId, episodeName, showName, and audioUrl are required and must be strings" });
      }

      let parsed: URL;
      try {
        parsed = new URL(audioUrl);
      } catch {
        return res.status(400).json({ error: "Invalid audio URL" });
      }
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return res.status(400).json({ error: "Only HTTP/HTTPS URLs are allowed" });
      }

      const existing = await storage.getEpisodeTranscriptByEpisodeId(episodeId, req.user!.id);
      if (existing && (existing.status === "processing" || existing.status === "completed")) {
        return res.json(existing);
      }

      const transcript = await storage.createEpisodeTranscript({
        userId: req.user!.id,
        episodeId,
        episodeName,
        showName,
        showImageUrl: showImageUrl || null,
        audioUrl,
        status: "pending",
        progress: 0,
        totalChunks: 0,
        segments: null,
        errorMessage: null,
      });

      transcribeFullEpisode(transcript.id, audioUrl).catch((err) => {
        console.error("Background transcription error:", err);
      });

      res.status(201).json(transcript);
    } catch (error) {
      console.error("Error creating episode transcript:", error);
      res.status(500).json({ error: "Failed to start transcription" });
    }
  });

  app.get("/api/episode-transcripts/by-episode/:episodeId", requireAuth, async (req, res) => {
    try {
      const episodeId = req.params.episodeId as string;
      const transcript = await storage.getEpisodeTranscriptByEpisodeId(episodeId, req.user!.id);
      if (!transcript) {
        return res.status(404).json({ error: "No transcript found for this episode" });
      }
      res.json(transcript);
    } catch (error) {
      console.error("Error fetching transcript by episode:", error);
      res.status(500).json({ error: "Failed to fetch transcript" });
    }
  });

  app.get("/api/episode-transcripts/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const transcript = await storage.getEpisodeTranscript(id);
      if (!transcript || transcript.userId !== req.user!.id) {
        return res.status(404).json({ error: "Transcript not found" });
      }
      res.json(transcript);
    } catch (error) {
      console.error("Error fetching transcript:", error);
      res.status(500).json({ error: "Failed to fetch transcript" });
    }
  });

  app.post("/api/transcribe", requireAuth, async (req, res) => {
    try {
      const { audioUrl, timestampMs, durationMs } = req.body;
      if (!audioUrl || typeof audioUrl !== "string") {
        return res.status(400).json({ error: "audioUrl is required" });
      }

      let parsed: URL;
      try {
        parsed = new URL(audioUrl);
      } catch {
        return res.status(400).json({ error: "Invalid audio URL" });
      }
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return res.status(400).json({ error: "Only HTTP/HTTPS URLs are allowed" });
      }
      const allowedHosts = [
        "audio.itunes.apple.com",
        "podcasts.apple.com",
        "p.scdn.co",
        "podz-content.com",
        "traffic.libsyn.com",
        "traffic.megaphone.fm",
        "cdn.simplecast.com",
        "media.blubrry.com",
        "dts.podtrac.com",
        "chtbl.com",
        "pdst.fm",
        "www.buzzsprout.com",
        "anchor.fm",
        "feeds.soundcloud.com",
        "rss.art19.com",
        "play.podtrac.com",
        "chrt.fm",
        "op3.dev",
      ];
      const hostname = parsed.hostname;
      const isAllowed = allowedHosts.some(h => hostname === h || hostname.endsWith("." + h));
      if (!isAllowed) {
        return res.status(400).json({ error: "Audio URL host is not supported for transcription" });
      }

      if (typeof timestampMs !== "number" || timestampMs < 0) {
        return res.status(400).json({ error: "Valid timestampMs is required" });
      }
      const clipDuration = typeof durationMs === "number" && durationMs > 0 ? durationMs : 60000;
      const transcript = await transcribeClip(audioUrl, timestampMs, clipDuration);
      res.json({ transcript });
    } catch (error) {
      console.error("Error transcribing clip:", error);
      res.status(500).json({ error: "Failed to transcribe the clip. Make sure the timestamp and duration are within the episode length." });
    }
  });

  return httpServer;
}
