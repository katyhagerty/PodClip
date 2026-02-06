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
  Loader2,
  Bookmark,
  Check,
  X,
  Search,
  Timer,
  ExternalLink,
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

interface ManualEpisode {
  id: string;
  name: string;
  showName: string;
  showImageUrl: string | null;
  audioUrl: string | null;
}

type Mode = "loading" | "live" | "manual";

function TimeInput({ valueMs, onChange }: { valueMs: number; onChange: (ms: number) => void }) {
  const totalSeconds = Math.floor(valueMs / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));

  const update = (newH: number, newM: number, newS: number) => {
    onChange(((newH * 3600) + (newM * 60) + newS) * 1000);
  };

  const fieldClass =
    "w-16 text-center text-4xl font-mono font-bold bg-transparent border-b-2 border-muted-foreground/30 focus:border-primary focus:outline-none tabular-nums py-1";

  return (
    <div className="flex items-end gap-1">
      <div className="flex flex-col items-center">
        <span className="text-[10px] text-muted-foreground mb-1">HR</span>
        <input
          type="number"
          min={0}
          max={23}
          value={h}
          onChange={(e) => update(clamp(parseInt(e.target.value) || 0, 23), m, s)}
          className={fieldClass}
          data-testid="input-time-hours"
        />
      </div>
      <span className="text-4xl font-mono font-bold text-muted-foreground pb-1">:</span>
      <div className="flex flex-col items-center">
        <span className="text-[10px] text-muted-foreground mb-1">MIN</span>
        <input
          type="number"
          min={0}
          max={59}
          value={m.toString().padStart(2, "0")}
          onChange={(e) => update(h, clamp(parseInt(e.target.value) || 0, 59), s)}
          className={fieldClass}
          data-testid="input-time-minutes"
        />
      </div>
      <span className="text-4xl font-mono font-bold text-muted-foreground pb-1">:</span>
      <div className="flex flex-col items-center">
        <span className="text-[10px] text-muted-foreground mb-1">SEC</span>
        <input
          type="number"
          min={0}
          max={59}
          value={s.toString().padStart(2, "0")}
          onChange={(e) => update(h, m, clamp(parseInt(e.target.value) || 0, 59))}
          className={fieldClass}
          data-testid="input-time-seconds"
        />
      </div>
    </div>
  );
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

  const [manualEpisode, setManualEpisode] = useState<ManualEpisode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [stopwatchMs, setStopwatchMs] = useState(0);
  const stopwatchStartRef = useRef<number>(0);
  const stopwatchOffsetRef = useRef<number>(0);

  const [spotifyFailed, setSpotifyFailed] = useState(false);

  const { data: playback, isLoading, isError } = useQuery<PlaybackState | null>({
    queryKey: ["/api/spotify/player"],
    refetchInterval: spotifyFailed ? false : 3000,
    retry: 0,
    enabled: !spotifyFailed,
  });

  useEffect(() => {
    if (isError) {
      setSpotifyFailed(true);
    }
  }, [isError]);

  const mode: Mode = isLoading && !spotifyFailed
    ? "loading"
    : spotifyFailed || isError || !playback?.episode
    ? "manual"
    : "live";

  const { data: sessionBookmarks } = useQuery<BookmarkType[]>({
    queryKey: ["/api/bookmarks"],
  });

  useEffect(() => {
    if (playback && mode === "live") {
      lastFetchTime.current = Date.now();
      lastProgressMs.current = playback.progressMs;
      isPlayingRef.current = playback.isPlaying;
      setLocalProgressMs(playback.progressMs);
    }
  }, [playback, mode]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (mode === "live" && isPlayingRef.current) {
        const elapsed = Date.now() - lastFetchTime.current;
        setLocalProgressMs(lastProgressMs.current + elapsed);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [mode]);

  useEffect(() => {
    let animFrame: number;
    const tick = () => {
      if (stopwatchRunning) {
        setStopwatchMs(stopwatchOffsetRef.current + (Date.now() - stopwatchStartRef.current));
        animFrame = requestAnimationFrame(tick);
      }
    };
    if (stopwatchRunning) {
      animFrame = requestAnimationFrame(tick);
    }
    return () => {
      if (animFrame) cancelAnimationFrame(animFrame);
    };
  }, [stopwatchRunning]);

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

  const handleStartClipLive = useCallback(() => {
    if (playback?.episode) {
      setClipStartMs(localProgressMs);
      toast({
        title: "Clip started",
        description: `Marking start at ${formatTime(localProgressMs)}`,
      });
    }
  }, [playback, localProgressMs, toast]);

  const handleEndClipLive = useCallback(() => {
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

  const handleStartClipManual = useCallback(() => {
    if (manualEpisode) {
      setClipStartMs(stopwatchMs);
      toast({
        title: "Clip started",
        description: `Marking start at ${formatTime(stopwatchMs)}`,
      });
    }
  }, [manualEpisode, stopwatchMs, toast]);

  const handleEndClipManual = useCallback(() => {
    if (manualEpisode && clipStartMs !== null) {
      const endMs = stopwatchMs;
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
        episodeId: manualEpisode.id,
        episodeName: manualEpisode.name,
        showName: manualEpisode.showName,
        showImageUrl: manualEpisode.showImageUrl,
        audioUrl: manualEpisode.audioUrl,
      });
      setClipStartMs(null);
    }
  }, [manualEpisode, clipStartMs, stopwatchMs, toast]);

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (capturedClip) return;

      if (e.code === "KeyS" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        if (mode === "live") {
          if (clipStartMs === null) handleStartClipLive();
          else handleEndClipLive();
        } else if (mode === "manual") {
          if (clipStartMs === null) handleStartClipManual();
          else handleEndClipManual();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, clipStartMs, capturedClip, handleStartClipLive, handleEndClipLive, handleStartClipManual, handleEndClipManual]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(searchQuery.trim())}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setSearchResults(data);
    } catch {
      toast({ title: "Search failed", description: "Could not search episodes.", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectEpisode = (ep: any) => {
    setManualEpisode({
      id: ep.id,
      name: ep.name,
      showName: ep.showName,
      showImageUrl: ep.showImageUrl,
      audioUrl: ep.audioUrl || null,
    });
    setSearchResults(null);
    setSearchQuery("");
    setStopwatchMs(0);
    setStopwatchRunning(false);
    stopwatchOffsetRef.current = 0;
    setClipStartMs(null);
    setCapturedClip(null);
    setClipNote("");
  };

  const handleToggleStopwatch = () => {
    if (stopwatchRunning) {
      stopwatchOffsetRef.current = stopwatchMs;
      setStopwatchRunning(false);
    } else {
      stopwatchStartRef.current = Date.now();
      setStopwatchRunning(true);
    }
  };

  const handleResetStopwatch = () => {
    setStopwatchRunning(false);
    setStopwatchMs(0);
    stopwatchOffsetRef.current = 0;
    stopwatchStartRef.current = 0;
    setClipStartMs(null);
  };

  const isRecording = clipStartMs !== null;
  const episode = playback?.episode;
  const progressPercent = episode ? (localProgressMs / episode.durationMs) * 100 : 0;

  const currentEpisodeId = mode === "live" ? episode?.id : manualEpisode?.id;
  const recentSessionClips = sessionBookmarks
    ?.filter((b) => currentEpisodeId && b.episodeId === currentEpisodeId)
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
              {mode === "live" ? (
                <Radio className="w-3 h-3 text-primary" />
              ) : (
                <Timer className="w-3 h-3 text-primary" />
              )}
              {mode === "live" ? "Now Playing" : "Manual Mode"}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50 text-muted-foreground text-xs">
              <SiSpotify className="w-3 h-3 text-[#1DB954]" />
              <span className="hidden sm:inline">{mode === "live" ? "Live" : "Manual"}</span>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="flex-1 container max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">
        {mode === "loading" ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Connecting to Spotify...</p>
            </div>
          </div>
        ) : mode === "live" && episode ? (
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
              <ClipSaveForm
                capturedClip={capturedClip}
                clipNote={clipNote}
                setClipNote={setClipNote}
                onSave={handleSaveClip}
                onCancel={handleCancelClip}
                isPending={createMutation.isPending}
              />
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
                      onClick={handleEndClipLive}
                      className="gap-2 px-8"
                      data-testid="button-end-clip"
                    >
                      <Square className="w-5 h-5" />
                      End Clip
                    </Button>
                    <kbd className="mt-1 text-[10px] text-muted-foreground/60">press S</kbd>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Button
                      size="lg"
                      onClick={handleStartClipLive}
                      className="gap-2 px-8"
                      data-testid="button-start-clip"
                    >
                      <Circle className="w-5 h-5" />
                      Start Clip
                    </Button>
                    <kbd className="text-[10px] text-muted-foreground/60">press S</kbd>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {!manualEpisode ? (
              <div className="flex flex-col items-center gap-6 pt-4">
                <div className="text-center max-w-sm">
                  <Timer className="w-12 h-12 text-primary/60 mx-auto mb-4" />
                  <h3 className="font-semibold text-foreground mb-2" data-testid="text-manual-mode-title">Clip Capture</h3>
                  <p className="text-sm text-muted-foreground mb-1">
                    Search for the episode you're listening to, then use the timer to mark clip boundaries while you play it in Spotify.
                  </p>
                  <p className="text-xs text-muted-foreground/70 mb-6">
                    Start the timer when you press play in Spotify, then mark clips as you listen.
                  </p>
                </div>

                <div className="w-full max-w-md space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search for a podcast episode..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      data-testid="input-manual-episode-search"
                    />
                    <Button
                      onClick={handleSearch}
                      disabled={isSearching || !searchQuery.trim()}
                      data-testid="button-manual-search"
                    >
                      {isSearching ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </Button>
                  </div>

                  {searchResults && searchResults.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No episodes found. Try a different search.
                    </p>
                  )}

                  {searchResults && searchResults.length > 0 && (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {searchResults.map((ep: any) => (
                        <Card
                          key={ep.id}
                          className="hover-elevate cursor-pointer overflow-visible"
                          onClick={() => handleSelectEpisode(ep)}
                          data-testid={`manual-episode-result-${ep.id}`}
                        >
                          <CardContent className="p-3 flex items-center gap-3">
                            {ep.showImageUrl ? (
                              <img
                                src={ep.showImageUrl}
                                alt={ep.showName}
                                className="w-10 h-10 rounded-md object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                                <Headphones className="w-5 h-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground line-clamp-1">
                                {ep.name}
                              </p>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {ep.showName}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center gap-4" data-testid="manual-episode-info">
                  {manualEpisode.showImageUrl ? (
                    <img
                      src={manualEpisode.showImageUrl}
                      alt={manualEpisode.showName}
                      className="w-48 h-48 sm:w-56 sm:h-56 rounded-lg object-cover shadow-lg"
                      data-testid="img-manual-cover"
                    />
                  ) : (
                    <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                      <Headphones className="w-16 h-16 text-primary" />
                    </div>
                  )}
                  <div className="text-center max-w-full">
                    <h2 className="font-bold text-lg text-foreground line-clamp-2" data-testid="text-manual-episode-name">
                      {manualEpisode.name}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1" data-testid="text-manual-show-name">
                      {manualEpisode.showName}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs text-muted-foreground"
                    onClick={() => {
                      setManualEpisode(null);
                      setStopwatchRunning(false);
                      setStopwatchMs(0);
                      stopwatchOffsetRef.current = 0;
                      setClipStartMs(null);
                      setCapturedClip(null);
                    }}
                    data-testid="button-change-episode"
                  >
                    <Search className="w-3 h-3" />
                    Change Episode
                  </Button>
                </div>

                <Card data-testid="stopwatch-card">
                  <CardContent className="p-4 flex flex-col items-center gap-4">
                    <p className="text-xs text-muted-foreground">
                      {stopwatchRunning
                        ? "Timer running — tracking your position"
                        : "Set your current position, then press play"}
                    </p>
                    {stopwatchRunning ? (
                      <div className="text-4xl font-mono font-bold text-foreground tabular-nums" data-testid="text-stopwatch-time">
                        {formatTime(stopwatchMs)}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5" data-testid="text-stopwatch-time">
                        <TimeInput
                          valueMs={stopwatchMs}
                          onChange={(ms) => {
                            setStopwatchMs(ms);
                            stopwatchOffsetRef.current = ms;
                          }}
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <Button
                        size="icon"
                        className="w-14 h-14 rounded-full"
                        onClick={handleToggleStopwatch}
                        data-testid="button-stopwatch-toggle"
                      >
                        {stopwatchRunning ? (
                          <Pause className="w-6 h-6" />
                        ) : (
                          <Play className="w-6 h-6 ml-0.5" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResetStopwatch}
                        disabled={stopwatchMs === 0 && !stopwatchRunning}
                        data-testid="button-stopwatch-reset"
                      >
                        Reset
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground text-center max-w-xs">
                      {stopwatchRunning
                        ? "Pause anytime. Your position is saved."
                        : "Enter the timestamp from Spotify, then press play to start tracking."}
                    </p>
                  </CardContent>
                </Card>

                {capturedClip ? (
                  <ClipSaveForm
                    capturedClip={capturedClip}
                    clipNote={clipNote}
                    setClipNote={setClipNote}
                    onSave={handleSaveClip}
                    onCancel={handleCancelClip}
                    isPending={createMutation.isPending}
                  />
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
                          <Badge variant="secondary" className="gap-1 ml-2">
                            <Clock className="w-3 h-3" />
                            {formatTime(stopwatchMs - clipStartMs!)}
                          </Badge>
                        </div>
                        <Button
                          size="lg"
                          variant="destructive"
                          onClick={handleEndClipManual}
                          className="gap-2 px-8"
                          data-testid="button-end-clip"
                        >
                          <Square className="w-5 h-5" />
                          End Clip
                        </Button>
                        <kbd className="mt-1 text-[10px] text-muted-foreground/60">press S</kbd>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <Button
                          size="lg"
                          onClick={handleStartClipManual}
                          className="gap-2 px-8"
                          disabled={!stopwatchRunning && stopwatchMs === 0}
                          data-testid="button-start-clip"
                        >
                          <Circle className="w-5 h-5" />
                          Start Clip
                        </Button>
                        <kbd className="text-[10px] text-muted-foreground/60">press S</kbd>
                      </div>
                    )}
                  </div>
                )}

                {!manualEpisode.id.startsWith("itunes-") && (
                  <div className="flex justify-center">
                    <a
                      href={`https://open.spotify.com/episode/${manualEpisode.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-open-in-spotify">
                        <SiSpotify className="w-3.5 h-3.5 text-[#1DB954]" />
                        Open in Spotify
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </a>
                  </div>
                )}
              </>
            )}
          </>
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
                    <div className="flex items-center justify-between gap-2 flex-wrap">
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
      </div>
    </div>
  );
}

function ClipSaveForm({
  capturedClip,
  clipNote,
  setClipNote,
  onSave,
  onCancel,
  isPending,
}: {
  capturedClip: CapturedClip;
  clipNote: string;
  setClipNote: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <Card data-testid="captured-clip-form">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
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
            onClick={onCancel}
            data-testid="button-cancel-clip"
          >
            <X className="w-4 h-4 mr-1" />
            Discard
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={isPending}
            data-testid="button-save-clip"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-1" />
            )}
            {isPending ? "Saving..." : "Save Clip"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
