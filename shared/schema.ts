import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
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
