import { SpotifyApi } from "@spotify/web-api-ts-sdk";

let connectionSettings: any;

interface TokenData {
  accessToken: string;
  clientId: string;
  refreshToken: string;
  expiresIn: number;
}

async function getAccessToken(): Promise<TokenData> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=spotify',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const refreshToken =
    connectionSettings?.settings?.oauth?.credentials?.refresh_token;
  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;
  const clientId = connectionSettings?.settings?.oauth?.credentials?.client_id;
  const expiresIn = connectionSettings.settings?.oauth?.credentials?.expires_in;

  if (!connectionSettings || !accessToken || !clientId || !refreshToken) {
    throw new Error('Spotify not connected');
  }

  return { accessToken, clientId, refreshToken, expiresIn: expiresIn || 3600 };
}

export async function getUncachableSpotifyClient() {
  const { accessToken, clientId, refreshToken, expiresIn } = await getAccessToken();

  const spotify = SpotifyApi.withAccessToken(clientId, {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: expiresIn,
    refresh_token: refreshToken,
  });

  return spotify;
}

export interface SpotifyEpisode {
  id: string;
  name: string;
  showName: string;
  showImageUrl: string | null;
  description: string;
  durationMs: number;
}

export async function searchEpisodes(query: string): Promise<SpotifyEpisode[]> {
  try {
    const spotify = await getUncachableSpotifyClient();
    const results = await spotify.search(query, ["episode"], undefined, 20);
    
    return results.episodes.items.map((episode) => ({
      id: episode.id,
      name: episode.name,
      showName: episode.show.name,
      showImageUrl: episode.images?.[0]?.url || episode.show.images?.[0]?.url || null,
      description: episode.description,
      durationMs: episode.duration_ms,
    }));
  } catch (error) {
    console.error("Error searching Spotify episodes:", error);
    throw error;
  }
}

export async function getSavedShows(): Promise<SpotifyEpisode[]> {
  try {
    const spotify = await getUncachableSpotifyClient();
    const shows = await spotify.currentUser.shows.savedShows(10);
    
    const episodes: SpotifyEpisode[] = [];
    
    for (const item of shows.items) {
      const showEpisodes = await spotify.shows.episodes(item.show.id, undefined, 5);
      
      for (const episode of showEpisodes.items) {
        episodes.push({
          id: episode.id,
          name: episode.name,
          showName: item.show.name,
          showImageUrl: episode.images?.[0]?.url || item.show.images?.[0]?.url || null,
          description: episode.description,
          durationMs: episode.duration_ms,
        });
      }
    }
    
    return episodes;
  } catch (error) {
    console.error("Error getting saved shows:", error);
    throw error;
  }
}
