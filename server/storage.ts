import { 
  type User, 
  type InsertUser, 
  type Bookmark, 
  type InsertBookmark, 
  type PatchBookmark,
  type EpisodeTranscript,
  type InsertEpisodeTranscript,
  users, 
  bookmarks,
  episodeTranscripts,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getBookmarks(): Promise<Bookmark[]>;
  getBookmark(id: string): Promise<Bookmark | undefined>;
  createBookmark(bookmark: InsertBookmark): Promise<Bookmark>;
  updateBookmark(id: string, bookmark: InsertBookmark): Promise<Bookmark | undefined>;
  patchBookmark(id: string, fields: PatchBookmark): Promise<Bookmark | undefined>;
  deleteBookmark(id: string): Promise<boolean>;
  
  getEpisodeTranscript(id: string): Promise<EpisodeTranscript | undefined>;
  getEpisodeTranscriptByEpisodeId(episodeId: string): Promise<EpisodeTranscript | undefined>;
  getAllEpisodeTranscriptStatuses(): Promise<Pick<EpisodeTranscript, "episodeId" | "status" | "progress">[]>;
  getCompletedEpisodeTranscripts(): Promise<Pick<EpisodeTranscript, "id" | "episodeId" | "episodeName" | "showName" | "showImageUrl" | "status" | "createdAt">[]>;
  createEpisodeTranscript(transcript: InsertEpisodeTranscript): Promise<EpisodeTranscript>;
  updateEpisodeTranscript(id: string, fields: Partial<InsertEpisodeTranscript>): Promise<EpisodeTranscript | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getBookmarks(): Promise<Bookmark[]> {
    return db.select().from(bookmarks).orderBy(desc(bookmarks.createdAt));
  }

  async getBookmark(id: string): Promise<Bookmark | undefined> {
    const [bookmark] = await db.select().from(bookmarks).where(eq(bookmarks.id, id));
    return bookmark;
  }

  async createBookmark(bookmark: InsertBookmark): Promise<Bookmark> {
    const [created] = await db.insert(bookmarks).values(bookmark).returning();
    return created;
  }

  async updateBookmark(id: string, bookmark: InsertBookmark): Promise<Bookmark | undefined> {
    const [updated] = await db
      .update(bookmarks)
      .set(bookmark)
      .where(eq(bookmarks.id, id))
      .returning();
    return updated;
  }

  async patchBookmark(id: string, fields: PatchBookmark): Promise<Bookmark | undefined> {
    const [updated] = await db
      .update(bookmarks)
      .set(fields)
      .where(eq(bookmarks.id, id))
      .returning();
    return updated;
  }

  async deleteBookmark(id: string): Promise<boolean> {
    const result = await db.delete(bookmarks).where(eq(bookmarks.id, id)).returning();
    return result.length > 0;
  }

  async getCompletedEpisodeTranscripts(): Promise<Pick<EpisodeTranscript, "id" | "episodeId" | "episodeName" | "showName" | "showImageUrl" | "status" | "createdAt">[]> {
    return db
      .select({
        id: episodeTranscripts.id,
        episodeId: episodeTranscripts.episodeId,
        episodeName: episodeTranscripts.episodeName,
        showName: episodeTranscripts.showName,
        showImageUrl: episodeTranscripts.showImageUrl,
        status: episodeTranscripts.status,
        createdAt: episodeTranscripts.createdAt,
      })
      .from(episodeTranscripts)
      .where(eq(episodeTranscripts.status, "completed"))
      .orderBy(desc(episodeTranscripts.createdAt));
  }

  async getAllEpisodeTranscriptStatuses(): Promise<Pick<EpisodeTranscript, "episodeId" | "status" | "progress">[]> {
    return db
      .select({
        episodeId: episodeTranscripts.episodeId,
        status: episodeTranscripts.status,
        progress: episodeTranscripts.progress,
      })
      .from(episodeTranscripts);
  }

  async getEpisodeTranscript(id: string): Promise<EpisodeTranscript | undefined> {
    const [transcript] = await db.select().from(episodeTranscripts).where(eq(episodeTranscripts.id, id));
    return transcript;
  }

  async getEpisodeTranscriptByEpisodeId(episodeId: string): Promise<EpisodeTranscript | undefined> {
    const [transcript] = await db
      .select()
      .from(episodeTranscripts)
      .where(eq(episodeTranscripts.episodeId, episodeId))
      .orderBy(desc(episodeTranscripts.createdAt))
      .limit(1);
    return transcript;
  }

  async createEpisodeTranscript(transcript: InsertEpisodeTranscript): Promise<EpisodeTranscript> {
    const [created] = await db.insert(episodeTranscripts).values(transcript).returning();
    return created;
  }

  async updateEpisodeTranscript(id: string, fields: Partial<InsertEpisodeTranscript>): Promise<EpisodeTranscript | undefined> {
    const [updated] = await db
      .update(episodeTranscripts)
      .set(fields)
      .where(eq(episodeTranscripts.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
