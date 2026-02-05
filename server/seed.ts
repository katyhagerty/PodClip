import { db } from "./db";
import { bookmarks } from "@shared/schema";
import { sql } from "drizzle-orm";

export async function seedDatabase() {
  const existingBookmarks = await db.select().from(bookmarks).limit(1);
  
  if (existingBookmarks.length > 0) {
    console.log("Database already seeded, skipping...");
    return;
  }

  console.log("Seeding database with sample bookmarks...");

  const sampleBookmarks = [
    {
      episodeId: "itunes-sample-1",
      episodeName: "The Power of Deep Work in the Age of Distraction",
      showName: "The Knowledge Project with Shane Parrish",
      showImageUrl: "https://i.scdn.co/image/ab6765630000ba8a8d2b5e2e5a0a8e7c47b6d2d9",
      timestampMs: 1245000,
      durationMs: 180000,
      note: "Great insights on focused work and eliminating distractions. Cal Newport's framework for productivity.",
    },
    {
      episodeId: "itunes-sample-2",
      episodeName: "How to Build Products Users Love",
      showName: "How I Built This with Guy Raz",
      showImageUrl: "https://i.scdn.co/image/ab6765630000ba8a22a9f3c6b7bb0dc14a4b3b5c",
      timestampMs: 2580000,
      durationMs: 120000,
      note: "Key takeaways on product-market fit and early customer feedback loops.",
    },
    {
      episodeId: "itunes-sample-3",
      episodeName: "The Science of Habits and Behavior Change",
      showName: "Huberman Lab",
      showImageUrl: "https://i.scdn.co/image/ab6765630000ba8a4e7e15f3c5f19a8e4b6c2d8f",
      timestampMs: 4320000,
      durationMs: 240000,
      note: "Neuroscience behind habit formation. Dopamine reward prediction error explanation.",
    },
    {
      episodeId: "itunes-sample-4",
      episodeName: "Mastering the Art of Negotiation",
      showName: "The Tim Ferriss Show",
      showImageUrl: "https://i.scdn.co/image/ab6765630000ba8a1e2c8a5d9f3e4b7c6a8d2e5f",
      timestampMs: 890000,
      durationMs: 90000,
      note: "Chris Voss on tactical empathy and mirroring techniques.",
    },
  ];

  await db.insert(bookmarks).values(sampleBookmarks);
  console.log("Seeded database with sample bookmarks");
}
