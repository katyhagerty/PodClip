import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatTime } from "@/lib/utils";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Circle,
  Square,
  Clock,
  Headphones,
  Radio,
  AlertCircle,
  Loader2,
  Bookmark,
  Check,
  X,
} from "lucide-react";
import { SiSpotify } from "react-icons/si";
import type { Bookmark as BookmarkType, InsertBookmark } from "@shared/schema";
import { Link } from "wouter";
import { ThemeToggle } from "@/components/theme-toggle";

interface PlaybackState {
  isPlaying: boolean;
  progressMs: number;
  episode: {
    id: string;
    name: string;
    showName: string;
    showImageUrl: string | null;
    durationMs: number;
    audioUrl: string | null;
  } | null;
}

interface CapturedClip {
  startMs: number;
  endMs: number;
  episodeId: string;
  episodeName: string;
  showName: string;
  showImageUrl: string | null;
  audioUrl: string | null;
}

export default function NowPlaying() {
  const { toast } = useToast();
  const [clipStartMs, setClipStartMs] = useState<number | null>(null);
  const [capturedClip, setCapturedClip] = useState<CapturedClip | null>(null);
  const [clipNote, setClipNote] = useState("");
  const [localProgressMs, setLocalProgressMs] = useState(0);
  const lastFetchTime = useRef<number>(Date.now());
  const lastProgressMs = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);

  const { data: playback, isLoading, isError, error } = useQuery<PlaybackState | null>({
    queryKey: ["/api/spotify/player"],
    refetchInterval: 3000,
  });

  const { data: sessionBookmarks } = useQuery<BookmarkType[]>({
    queryKey: ["/api/bookmarks"],
  });

  useEffect(() => {
    if (playback) {
      lastFetchTime.current = Date.now();
      lastProgressMs.current = playback.progressMs;
      isPlayingRef.current = playback.isPlaying;
      setLocalProgressMs(playback.progressMs);
    }
  }, [playback]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isPlayingRef.current) {
        const elapsed = Date.now() - lastFetchTime.current;
        setLocalProgressMs(lastProgressMs.current + elapsed);
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const pauseMutation = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/spotify/player/pause"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spotify/player"] });
    },
  });

  const playMutation = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/spotify/player/play"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spotify/player"] });
    },
  });

  const seekMutation = useMutation({
    mutationFn: (positionMs: number) =>
      apiRequest("PUT", "/api/spotify/player/seek", { positionMs }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spotify/player"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertBookmark) => apiRequest("POST", "/api/bookmarks", data),
    onSuccess: async (response) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
      const bookmark = await response.json();
      setCapturedClip(null);
      setClipNote("");
      toast({
        title: "Clip saved!",
        description: "Your podcast moment has been bookmarked. Transcript is generating...",
      });
      if (bookmark.audioUrl && bookmark.id) {
        triggerTranscription(bookmark.id, bookmark.audioUrl, bookmark.timestampMs, bookmark.durationMs || 60000);
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save the clip. Please try again.",
        variant: "destructive",
      });
    },
  });

  const triggerTranscription = async (bookmarkId: string, audioUrl: string, timestampMs: number, durationMs: number) => {
    try {
      const response = await apiRequest("POST", "/api/transcribe", {
        audioUrl,
        timestampMs,
        durationMs,
      });
      const data = await response.json();
      if (data.transcript) {
        await apiRequest("PATCH", `/api/bookmarks/${bookmarkId}`, {
          transcript: data.transcript,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
      }
    } catch {
    }
  };

  const handleStartClip = useCallback(() => {
    if (playback?.episode) {
      setClipStartMs(localProgressMs);
      toast({
        title: "Clip started",
        description: `Marking start at ${formatTime(localProgressMs)}`,
      });
    }
  }, [playback, localProgressMs, toast]);

  const handleEndClip = useCallback(() => {
    if (playback?.episode && clipStartMs !== null) {
      const endMs = localProgressMs;
      const durationMs = endMs - clipStartMs;
      
      if (durationMs < 1000) {
        toast({
          title: "Clip too short",
          description: "The clip must be at least 1 second long.",
          variant: "destructive",
        });
        return;
      }

      setCapturedClip({
        startMs: clipStartMs,
        endMs,
        episodeId: playback.episode.id,
        episodeName: playback.episode.name,
        showName: playback.episode.showName,
        showImageUrl: playback.episode.showImageUrl,
        audioUrl: playback.episode.audioUrl,
      });
      setClipStartMs(null);
    }
  }, [playback, clipStartMs, localProgressMs, toast]);

  const handleSaveClip = () => {
    if (!capturedClip) return;
    const data: InsertBookmark = {
      episodeId: capturedClip.episodeId,
      episodeName: capturedClip.episodeName,
      showName: capturedClip.showName,
      showImageUrl: capturedClip.showImageUrl || null,
      timestampMs: capturedClip.startMs,
      durationMs: capturedClip.endMs - capturedClip.startMs,
      note: clipNote || null,
      transcript: null,
      audioUrl: capturedClip.audioUrl || null,
    };
    createMutation.mutate(data);
  };

  const handleCancelClip = () => {
    setCapturedClip(null);
    setClipNote("");
    setClipStartMs(null);
  };

  const handleSkipBack = () => {
    const newPosition = Math.max(0, localProgressMs - 15000);
    seekMutation.mutate(newPosition);
  };

  const handleSkipForward = () => {
    seekMutation.mutate(localProgressMs + 30000);
  };

  const isRecording = clipStartMs !== null;
  const episode = playback?.episode;
  const progressPercent = episode ? (localProgressMs / episode.durationMs) * 100 : 0;

  const recentSessionClips = sessionBookmarks
    ?.filter((b) => episode && b.episodeId === episode.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="container max-w-2xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-1.5" data-testid="button-back-to-clips">
                <Bookmark className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">My Clips</span>
              </Button>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 text-xs">
              <Radio className="w-3 h-3 text-primary" />
              Now Playing
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50 text-muted-foreground text-xs">
              <SiSpotify className="w-3 h-3 text-[#1DB954]" />
              <span className="hidden sm:inline">Connected</span>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="flex-1 container max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Connecting to Spotify...</p>
            </div>
          </div>
        ) : isError ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-sm">
              <AlertCircle className="w-12 h-12 text-destructive/60 mx-auto mb-4" />
              <h3 className="font-semibold text-foreground mb-2">Spotify Connection Issue</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {(error as Error)?.message?.includes("403")
                  ? "The Spotify app is in development mode. Playback features require an approved Spotify app."
                  : "Could not connect to Spotify. Make sure Spotify is open and playing on one of your devices."}
              </p>
              <Link href="/">
                <Button variant="outline" data-testid="button-back-home">
                  Back to Clips
                </Button>
              </Link>
            </div>
          </div>
        ) : !episode ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-sm">
              <Radio className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
              <h3 className="font-semibold text-foreground mb-2">Nothing Playing</h3>
              <p className="text-sm text-muted-foreground mb-1">
                Open Spotify and start playing a podcast episode.
              </p>
              <p className="text-xs text-muted-foreground/70 mb-6">
                Make sure you're playing a podcast, not music.
              </p>
              <Link href="/">
                <Button variant="outline" data-testid="button-back-home-empty">
                  Back to Clips
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-4" data-testid="now-playing-info">
              {episode.showImageUrl ? (
                <img
                  src={episode.showImageUrl}
                  alt={episode.showName}
                  className="w-48 h-48 sm:w-56 sm:h-56 rounded-lg object-cover shadow-lg"
                  data-testid="img-now-playing-cover"
                />
              ) : (
                <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                  <Headphones className="w-16 h-16 text-primary" />
                </div>
              )}

              <div className="text-center max-w-full">
                <h2 className="font-bold text-lg text-foreground line-clamp-2" data-testid="text-now-playing-episode">
                  {episode.name}
                </h2>
                <p className="text-sm text-muted-foreground mt-1" data-testid="text-now-playing-show">
                  {episode.showName}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="relative w-full h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-200"
                  style={{ width: `${Math.min(progressPercent, 100)}%` }}
                  data-testid="progress-bar"
                />
                {isRecording && clipStartMs !== null && (
                  <div
                    className="absolute inset-y-0 bg-destructive/40 rounded-full"
                    style={{
                      left: `${(clipStartMs / episode.durationMs) * 100}%`,
                      width: `${((localProgressMs - clipStartMs) / episode.durationMs) * 100}%`,
                    }}
                    data-testid="clip-range-indicator"
                  />
                )}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span data-testid="text-current-time">{formatTime(localProgressMs)}</span>
                <span data-testid="text-total-time">{formatTime(episode.durationMs)}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSkipBack}
                disabled={seekMutation.isPending}
                data-testid="button-skip-back"
              >
                <SkipBack className="w-5 h-5" />
              </Button>

              <Button
                size="icon"
                className="w-14 h-14 rounded-full"
                onClick={() =>
                  playback?.isPlaying
                    ? pauseMutation.mutate()
                    : playMutation.mutate()
                }
                disabled={pauseMutation.isPending || playMutation.isPending}
                data-testid="button-play-pause"
              >
                {playback?.isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6 ml-0.5" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleSkipForward}
                disabled={seekMutation.isPending}
                data-testid="button-skip-forward"
              >
                <SkipForward className="w-5 h-5" />
              </Button>
            </div>

            {capturedClip ? (
              <Card data-testid="captured-clip-form">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-sm text-foreground">Save Clip</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(capturedClip.startMs)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">to</span>
                      <Badge variant="secondary" className="gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(capturedClip.endMs)}
                      </Badge>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    Duration: {formatTime(capturedClip.endMs - capturedClip.startMs)}
                  </Badge>
                  <Textarea
                    placeholder="Add a note about this moment..."
                    value={clipNote}
                    onChange={(e) => setClipNote(e.target.value)}
                    className="resize-none"
                    rows={2}
                    data-testid="input-clip-note"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelClip}
                      data-testid="button-cancel-clip"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Discard
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveClip}
                      disabled={createMutation.isPending}
                      data-testid="button-save-clip"
                    >
                      {createMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 mr-1" />
                      )}
                      {createMutation.isPending ? "Saving..." : "Save Clip"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="flex justify-center">
                {isRecording ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
                      </span>
                      Recording from {formatTime(clipStartMs!)}
                    </div>
                    <Button
                      size="lg"
                      variant="destructive"
                      onClick={handleEndClip}
                      className="gap-2 px-8"
                      data-testid="button-end-clip"
                    >
                      <Square className="w-5 h-5" />
                      End Clip
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="lg"
                    onClick={handleStartClip}
                    className="gap-2 px-8"
                    data-testid="button-start-clip"
                  >
                    <Circle className="w-5 h-5" />
                    Start Clip
                  </Button>
                )}
              </div>
            )}

            {recentSessionClips && recentSessionClips.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Bookmark className="w-4 h-4" />
                  Clips from this episode
                </h3>
                <div className="space-y-2">
                  {recentSessionClips.map((clip) => (
                    <Card key={clip.id} className="hover-elevate overflow-visible" data-testid={`session-clip-${clip.id}`}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge variant="secondary" className="gap-1 flex-shrink-0">
                              <Clock className="w-3 h-3" />
                              {formatTime(clip.timestampMs)}
                            </Badge>
                            {clip.durationMs && (
                              <Badge variant="outline" className="text-muted-foreground flex-shrink-0">
                                {formatTime(clip.durationMs)}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {clip.transcript ? (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <Check className="w-3 h-3" />
                                Transcript
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Generating
                              </Badge>
                            )}
                          </div>
                        </div>
                        {clip.note && (
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-1">
                            {clip.note}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
