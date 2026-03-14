import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Local auth fields (nullable for OAuth users)
  username: text("username").unique(),
  password: text("password"),
  // OAuth / Replit Auth fields
  replitId: text("replit_id").unique(),
  email: text("email"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// For local registration, username + password are required
export const registerUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Podcast clip bookmarks
export const bookmarks = pgTable("bookmarks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id"),
  episodeId: text("episode_id").notNull(),
  episodeName: text("episode_name").notNull(),
  showName: text("show_name").notNull(),
  showImageUrl: text("show_image_url"),
  timestampMs: integer("timestamp_ms").notNull(),
  durationMs: integer("duration_ms"),
  note: text("note"),
  transcript: text("transcript"),
  audioUrl: text("audio_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBookmarkSchema = createInsertSchema(bookmarks).omit({
  id: true,
  createdAt: true,
});

export const patchBookmarkSchema = z.object({
  transcript: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  durationMs: z.number().nullable().optional(),
}).strict();

export type InsertBookmark = z.infer<typeof insertBookmarkSchema>;
export type PatchBookmark = z.infer<typeof patchBookmarkSchema>;
export type Bookmark = typeof bookmarks.$inferSelect;

export const episodeTranscripts = pgTable("episode_transcripts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id"),
  episodeId: text("episode_id").notNull(),
  episodeName: text("episode_name").notNull(),
  showName: text("show_name").notNull(),
  showImageUrl: text("show_image_url"),
  audioUrl: text("audio_url").notNull(),
  status: text("status").notNull().default("pending"),
  progress: integer("progress").notNull().default(0),
  totalChunks: integer("total_chunks").notNull().default(0),
  segments: text("segments"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEpisodeTranscriptSchema = createInsertSchema(episodeTranscripts).omit({
  id: true,
  createdAt: true,
});

export type InsertEpisodeTranscript = z.infer<typeof insertEpisodeTranscriptSchema>;
export type EpisodeTranscript = typeof episodeTranscripts.$inferSelect;

export interface TranscriptSegment {
  startMs: number;
  endMs: number;
  text: string;
}
