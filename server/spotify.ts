import { SpotifyApi } from "@spotify/web-api-ts-sdk";

let connectionSettings: any = null;

interface TokenData {
  accessToken: string;
  clientId: string;
  refreshToken: string;
  expiresIn: number;
}

async function getAccessToken(): Promise<TokenData> {
  if (connectionSettings && connectionSettings.settings?.expires_at && 
      new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    const accessToken = connectionSettings.settings?.access_token || 
                        connectionSettings.settings?.oauth?.credentials?.access_token;
    const clientId = connectionSettings.settings?.oauth?.credentials?.client_id;
    const refreshToken = connectionSettings.settings?.oauth?.credentials?.refresh_token;
    const expiresIn = connectionSettings.settings?.oauth?.credentials?.expires_in;
    
    if (accessToken && clientId && refreshToken) {
      return { accessToken, clientId, refreshToken, expiresIn: expiresIn || 3600 };
    }
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  const connResponse = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=spotify',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );
  
  const connData = await connResponse.json();
  connectionSettings = connData.items?.[0];
  
  if (!connectionSettings) {
    throw new Error('Spotify not connected. No connection found.');
  }
  
  const refreshToken =
    connectionSettings?.settings?.oauth?.credentials?.refresh_token;
  const accessToken = connectionSettings?.settings?.access_token || 
                      connectionSettings?.settings?.oauth?.credentials?.access_token;
  const clientId = connectionSettings?.settings?.oauth?.credentials?.client_id;
  const expiresIn = connectionSettings?.settings?.oauth?.credentials?.expires_in;

  if (!accessToken || !clientId || !refreshToken) {
    throw new Error('Spotify not connected. Please reconnect your Spotify account.');
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

async function searchSpotifyDirect(query: string): Promise<SpotifyEpisode[]> {
  const { accessToken } = await getAccessToken();
  
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=episode&limit=20`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      }
    }
  );
  
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Spotify API error: ${response.status} - ${errorBody}`);
  }
  
  const data = await response.json();
  const episodes = data.episodes?.items || [];
  
  return episodes.map((episode: any) => ({
    id: episode.id,
    name: episode.name,
    showName: episode.show?.name || 'Unknown Show',
    showImageUrl: episode.images?.[0]?.url || episode.show?.images?.[0]?.url || null,
    description: episode.description || '',
    durationMs: episode.duration_ms,
  }));
}

async function searchiTunesFallback(query: string): Promise<SpotifyEpisode[]> {
  const response = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=podcast&entity=podcastEpisode&limit=20`
  );
  
  if (!response.ok) {
    throw new Error(`iTunes API error: ${response.status}`);
  }
  
  const data = await response.json();
  const results = data.results || [];
  
  return results.map((item: any) => ({
    id: `itunes-${item.trackId}`,
    name: item.trackName || 'Unknown Episode',
    showName: item.collectionName || 'Unknown Show',
    showImageUrl: item.artworkUrl600 || item.artworkUrl100 || null,
    description: item.description || item.shortDescription || '',
    durationMs: item.trackTimeMillis || 0,
  }));
}

export async function searchEpisodes(query: string): Promise<SpotifyEpisode[]> {
  try {
    return await searchSpotifyDirect(query);
  } catch (spotifyError) {
    console.log("Spotify search failed, falling back to iTunes:", (spotifyError as Error).message);
    try {
      return await searchiTunesFallback(query);
    } catch (itunesError) {
      console.error("iTunes fallback also failed:", itunesError);
      throw spotifyError;
    }
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

export async function getRecentlyPlayedEpisodes(): Promise<SpotifyEpisode[]> {
  try {
    const { accessToken } = await getAccessToken();
    
    const response = await fetch(
      'https://api.spotify.com/v1/me/player/recently-played?limit=50',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status}`);
    }
    
    const data = await response.json();
    const episodes: SpotifyEpisode[] = [];
    const seenIds = new Set<string>();
    
    for (const item of data.items || []) {
      if (item.track?.type === 'episode' && !seenIds.has(item.track.id)) {
        seenIds.add(item.track.id);
        const episode = item.track;
        episodes.push({
          id: episode.id,
          name: episode.name,
          showName: episode.show?.name || 'Unknown Show',
          showImageUrl: episode.images?.[0]?.url || episode.show?.images?.[0]?.url || null,
          description: episode.description || '',
          durationMs: episode.duration_ms,
        });
      }
    }
    
    return episodes;
  } catch (error) {
    console.error("Error getting recently played episodes:", error);
    throw error;
  }
}
