import { 
  type User, 
  type InsertUser, 
  type Bookmark, 
  type InsertBookmark, 
  users, 
  bookmarks 
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
  deleteBookmark(id: string): Promise<boolean>;
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

  async deleteBookmark(id: string): Promise<boolean> {
    const result = await db.delete(bookmarks).where(eq(bookmarks.id, id)).returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
