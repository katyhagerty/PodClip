import { db } from "./db";
import { bookmarks } from "@shared/schema";
import { eq, like } from "drizzle-orm";
import { resolveSpotifyEpisodeId } from "./spotify";

export async function seedDatabase() {
  // No-op: users manage their own data
}

export async function migrateUnresolvedEpisodeIds() {
  try {
    const allBookmarks = await db.select().from(bookmarks);
    const unresolvedBookmarks = allBookmarks.filter(b => 
      b.episodeId.startsWith('itunes-') || b.episodeId.startsWith('placeholder-')
    );

    if (unresolvedBookmarks.length === 0) {
      return;
    }

    console.log(`Resolving ${unresolvedBookmarks.length} episode IDs to Spotify IDs...`);

    for (const bookmark of unresolvedBookmarks) {
      const spotifyId = await resolveSpotifyEpisodeId(bookmark.episodeName, bookmark.showName);
      if (spotifyId) {
        await db.update(bookmarks)
          .set({ episodeId: spotifyId })
          .where(eq(bookmarks.id, bookmark.id));
        console.log(`Resolved "${bookmark.episodeName}" -> ${spotifyId}`);
      } else {
        console.log(`Could not resolve "${bookmark.episodeName}" to a Spotify ID`);
      }
    }
  } catch (error) {
    console.log("Episode ID migration skipped:", (error as Error).message);
  }
}
