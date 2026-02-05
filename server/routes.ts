import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBookmarkSchema } from "@shared/schema";
import { searchEpisodes, getSavedShows } from "./spotify";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Get all bookmarks
  app.get("/api/bookmarks", async (req, res) => {
    try {
      const bookmarks = await storage.getBookmarks();
      res.json(bookmarks);
    } catch (error) {
      console.error("Error fetching bookmarks:", error);
      res.status(500).json({ error: "Failed to fetch bookmarks" });
    }
  });

  // Get single bookmark
  app.get("/api/bookmarks/:id", async (req, res) => {
    try {
      const bookmark = await storage.getBookmark(req.params.id);
      if (!bookmark) {
        return res.status(404).json({ error: "Bookmark not found" });
      }
      res.json(bookmark);
    } catch (error) {
      console.error("Error fetching bookmark:", error);
      res.status(500).json({ error: "Failed to fetch bookmark" });
    }
  });

  // Create bookmark
  app.post("/api/bookmarks", async (req, res) => {
    try {
      const parsed = insertBookmarkSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const bookmark = await storage.createBookmark(parsed.data);
      res.status(201).json(bookmark);
    } catch (error) {
      console.error("Error creating bookmark:", error);
      res.status(500).json({ error: "Failed to create bookmark" });
    }
  });

  // Update bookmark
  app.put("/api/bookmarks/:id", async (req, res) => {
    try {
      const parsed = insertBookmarkSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const bookmark = await storage.updateBookmark(req.params.id, parsed.data);
      if (!bookmark) {
        return res.status(404).json({ error: "Bookmark not found" });
      }
      res.json(bookmark);
    } catch (error) {
      console.error("Error updating bookmark:", error);
      res.status(500).json({ error: "Failed to update bookmark" });
    }
  });

  // Delete bookmark
  app.delete("/api/bookmarks/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteBookmark(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Bookmark not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting bookmark:", error);
      res.status(500).json({ error: "Failed to delete bookmark" });
    }
  });

  // Search Spotify episodes
  app.get("/api/spotify/search", async (req, res) => {
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
  app.get("/api/spotify/shows", async (req, res) => {
    try {
      const episodes = await getSavedShows();
      res.json(episodes);
    } catch (error) {
      console.error("Error fetching shows:", error);
      res.status(500).json({ error: "Failed to fetch shows" });
    }
  });

  return httpServer;
}
