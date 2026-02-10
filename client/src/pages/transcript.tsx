import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { formatTime } from "@/lib/utils";
import {
  Search,
  FileText,
  Bookmark,
  Headphones,
  Loader2,
  ArrowLeft,
  ChevronUp,
  ChevronDown,
  Clock,
  Podcast,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { SiSpotify } from "react-icons/si";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "wouter";
import type { EpisodeTranscript, TranscriptSegment, Bookmark as BookmarkType } from "@shared/schema";

interface ClippedRange {
  startMs: number;
  endMs: number;
}

interface Episode {
  id: string;
  name: string;
  showName: string;
  showImageUrl: string | null;
  description: string;
  durationMs: number;
  audioUrl: string | null;
}

export default function TranscriptPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [episodeSearchQuery, setEpisodeSearchQuery] = useState("");
  const [debouncedEpisodeSearch, setDebouncedEpisodeSearch] = useState("");
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [transcriptId, setTranscriptId] = useState<string | null>(null);
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const [selectedText, setSelectedText] = useState<{
    text: string;
    startMs: number;
    endMs: number;
  } | null>(null);
  const [selectionPosition, setSelectionPosition] = useState<{ top: number; left: number } | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const { data: bookmarks } = useQuery<BookmarkType[]>({
    queryKey: ["/api/bookmarks"],
  });

  const clippedRanges: ClippedRange[] = (bookmarks || [])
    .filter((b) => selectedEpisode && b.episodeId === selectedEpisode.id)
    .map((b) => ({
      startMs: b.timestampMs,
      endMs: b.timestampMs + (b.durationMs || 0),
    }));

  const isSegmentClipped = (segment: TranscriptSegment): boolean => {
    return clippedRanges.some(
      (range) => segment.startMs < range.endMs && segment.endMs > range.startMs
    );
  };

  const { data: searchResults, isLoading: searchLoading } = useQuery<Episode[]>({
    queryKey: ["/api/spotify/search", { q: debouncedEpisodeSearch }],
    enabled: debouncedEpisodeSearch.length >= 2,
    retry: false,
  });

  const { data: transcriptData, isLoading: transcriptLoading } = useQuery<EpisodeTranscript>({
    queryKey: ["/api/episode-transcripts", transcriptId],
    enabled: !!transcriptId,
    refetchInterval: (query) => {
      const data = query.state.data as EpisodeTranscript | undefined;
      if (data && (data.status === "pending" || data.status === "processing")) {
        return 3000;
      }
      return false;
    },
  });

  const segments: TranscriptSegment[] = (() => {
    if (!transcriptData?.segments) return [];
    try {
      return JSON.parse(transcriptData.segments);
    } catch {
      return [];
    }
  })();

  const startTranscriptionMutation = useMutation({
    mutationFn: (episode: Episode) =>
      apiRequest("POST", "/api/episode-transcripts", {
        episodeId: episode.id,
        episodeName: episode.name,
        showName: episode.showName,
        showImageUrl: episode.showImageUrl,
        audioUrl: episode.audioUrl,
      }),
    onSuccess: async (response) => {
      const data = await response.json();
      setTranscriptId(data.id);
      toast({
        title: "Transcription started",
        description: "This may take a few minutes depending on episode length.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start transcription. Please try again.",
        variant: "destructive",
      });
    },
  });

  const saveClipMutation = useMutation({
    mutationFn: (data: {
      episodeId: string;
      episodeName: string;
      showName: string;
      showImageUrl?: string;
      audioUrl?: string;
      timestampMs: number;
      durationMs: number;
      note: string;
    }) => apiRequest("POST", "/api/bookmarks", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
      setSelectedText(null);
      setSelectionPosition(null);
      toast({
        title: "Clip saved!",
        description: "The highlighted text has been saved to Your Clips.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save clip. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEpisodeSearch = () => {
    setDebouncedEpisodeSearch(episodeSearchQuery);
  };

  const handleSelectEpisode = (episode: Episode) => {
    setSelectedEpisode(episode);
    setEpisodeSearchQuery("");
    setDebouncedEpisodeSearch("");
  };

  const handleGenerateTranscript = () => {
    if (!selectedEpisode) return;
    if (!selectedEpisode.audioUrl) {
      toast({
        title: "No audio available",
        description: "This episode doesn't have a direct audio URL for transcription.",
        variant: "destructive",
      });
      return;
    }
    startTranscriptionMutation.mutate(selectedEpisode);
  };

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !transcriptRef.current) {
      return;
    }

    const text = selection.toString().trim();
    if (!text || text.length < 3) return;

    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;
    if (!anchorNode || !focusNode) return;

    const findSegmentElement = (node: Node): HTMLElement | null => {
      let el = node instanceof HTMLElement ? node : node.parentElement;
      while (el && !el.dataset.segmentIndex) {
        el = el.parentElement;
      }
      return el;
    };

    const startEl = findSegmentElement(anchorNode);
    const endEl = findSegmentElement(focusNode);
    if (!startEl || !endEl) return;

    const startIdx = parseInt(startEl.dataset.segmentIndex || "0");
    const endIdx = parseInt(endEl.dataset.segmentIndex || "0");
    const minIdx = Math.min(startIdx, endIdx);
    const maxIdx = Math.max(startIdx, endIdx);

    if (segments[minIdx] && segments[maxIdx]) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = transcriptRef.current.getBoundingClientRect();

      setSelectedText({
        text,
        startMs: segments[minIdx].startMs,
        endMs: segments[maxIdx].endMs,
      });
      setSelectionPosition({
        top: rect.top - containerRect.top + rect.height + 8,
        left: Math.max(0, Math.min(rect.left - containerRect.left, containerRect.width - 200)),
      });
    }
  }, [segments]);

  useEffect(() => {
    document.addEventListener("mouseup", handleTextSelection);
    return () => document.removeEventListener("mouseup", handleTextSelection);
  }, [handleTextSelection]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-save-clip-popup]")) {
        const selection = window.getSelection();
        if (selection && selection.isCollapsed) {
          setSelectedText(null);
          setSelectionPosition(null);
        }
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSaveClip = () => {
    if (!selectedText || !selectedEpisode) return;
    saveClipMutation.mutate({
      episodeId: selectedEpisode.id,
      episodeName: selectedEpisode.name,
      showName: selectedEpisode.showName,
      showImageUrl: selectedEpisode.showImageUrl || undefined,
      audioUrl: selectedEpisode.audioUrl || undefined,
      timestampMs: selectedText.startMs,
      durationMs: selectedText.endMs - selectedText.startMs,
      note: selectedText.text.slice(0, 500),
    });
  };

  const filteredSegments = transcriptSearch.trim()
    ? segments.filter((s) =>
        s.text.toLowerCase().includes(transcriptSearch.toLowerCase())
      )
    : segments;

  const searchMatches = transcriptSearch.trim()
    ? segments
        .map((s, i) => ({ index: i, match: s.text.toLowerCase().includes(transcriptSearch.toLowerCase()) }))
        .filter((s) => s.match)
    : [];

  const handleNextMatch = () => {
    if (searchMatches.length === 0) return;
    const next = (searchMatchIndex + 1) % searchMatches.length;
    setSearchMatchIndex(next);
    scrollToSegment(searchMatches[next].index);
  };

  const handlePrevMatch = () => {
    if (searchMatches.length === 0) return;
    const prev = (searchMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setSearchMatchIndex(prev);
    scrollToSegment(searchMatches[prev].index);
  };

  const scrollToSegment = (index: number) => {
    const el = document.querySelector(`[data-segment-index="${index}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  useEffect(() => {
    if (searchMatches.length > 0) {
      setSearchMatchIndex(0);
      scrollToSegment(searchMatches[0].index);
    }
  }, [transcriptSearch]);

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-300 dark:bg-yellow-600 text-foreground rounded-sm px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const progressPercent =
    transcriptData && transcriptData.totalChunks > 0
      ? (transcriptData.progress / transcriptData.totalChunks) * 100
      : 0;

  const isProcessing = transcriptData?.status === "pending" || transcriptData?.status === "processing";
  const isCompleted = transcriptData?.status === "completed";
  const hasError = transcriptData?.status === "error";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="container max-w-4xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back-home">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary">
              <FileText className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Transcript</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Full episode transcription</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-my-clips">
                <Bookmark className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">My Clips</span>
              </Button>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-8">
        {!selectedEpisode ? (
          <div className="flex flex-col items-center text-center max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-2" data-testid="text-transcript-title">Episode Transcript</h2>
            <p className="text-muted-foreground mb-2">
              Search for a podcast episode to generate its full transcript.
            </p>
            <p className="text-sm text-muted-foreground/70 mb-6">
              Once generated, you can search the transcript and highlight text to save clips.
            </p>

            <div className="w-full flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search for a podcast episode..."
                  value={episodeSearchQuery}
                  onChange={(e) => setEpisodeSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleEpisodeSearch()}
                  className="pl-9"
                  data-testid="input-transcript-episode-search"
                />
              </div>
              <Button onClick={handleEpisodeSearch} data-testid="button-transcript-search">
                <Search className="w-4 h-4" />
              </Button>
            </div>

            {searchLoading && (
              <div className="w-full mt-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-md">
                    <Skeleton className="w-14 h-14 rounded-md flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchResults && searchResults.length > 0 && (
              <div className="w-full mt-6 space-y-2">
                {searchResults.map((episode) => (
                  <Card
                    key={episode.id}
                    className="hover-elevate cursor-pointer"
                    onClick={() => handleSelectEpisode(episode)}
                    data-testid={`transcript-episode-${episode.id}`}
                  >
                    <CardContent className="flex gap-3 p-3">
                      {episode.showImageUrl ? (
                        <img
                          src={episode.showImageUrl}
                          alt={episode.showName}
                          className="w-14 h-14 rounded-md object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                          <Podcast className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 text-left">
                        <h4 className="font-medium text-sm truncate">{episode.name}</h4>
                        <p className="text-xs text-muted-foreground truncate">{episode.showName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {episode.durationMs > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {formatTime(episode.durationMs)}
                            </Badge>
                          )}
                          {episode.audioUrl ? (
                            <Badge variant="secondary" className="text-xs">Audio available</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">No audio</Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {searchResults && searchResults.length === 0 && (
              <div className="mt-8">
                <Podcast className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No episodes found. Try a different search.</p>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-start gap-4 mb-6">
              {selectedEpisode.showImageUrl ? (
                <img
                  src={selectedEpisode.showImageUrl}
                  alt={selectedEpisode.showName}
                  className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Podcast className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold truncate" data-testid="text-selected-episode-name">
                  {selectedEpisode.name}
                </h2>
                <p className="text-sm text-muted-foreground">{selectedEpisode.showName}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedEpisode(null);
                      setTranscriptId(null);
                      setTranscriptSearch("");
                    }}
                    data-testid="button-change-episode"
                  >
                    <Search className="w-3.5 h-3.5 mr-1.5" />
                    Change Episode
                  </Button>
                  {selectedEpisode.id && !selectedEpisode.id.startsWith("itunes-") && (
                    <a
                      href={`https://open.spotify.com/episode/${selectedEpisode.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="ghost" size="sm" className="gap-1.5">
                        <SiSpotify className="w-3.5 h-3.5 text-[#1DB954]" />
                        Open in Spotify
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </div>

            {!transcriptId && !isProcessing && !isCompleted ? (
              <Card className="text-center py-12">
                <CardContent className="space-y-4">
                  <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto" />
                  <div>
                    <h3 className="font-semibold text-lg">Generate Full Transcript</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                      This will transcribe the entire episode using AI. It may take a few minutes depending on the episode length.
                    </p>
                  </div>
                  <Button
                    onClick={handleGenerateTranscript}
                    disabled={startTranscriptionMutation.isPending || !selectedEpisode.audioUrl}
                    data-testid="button-generate-transcript"
                  >
                    {startTranscriptionMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4 mr-2" />
                    )}
                    Generate Transcript
                  </Button>
                  {!selectedEpisode.audioUrl && (
                    <p className="text-sm text-destructive">
                      This episode doesn't have a direct audio URL available for transcription.
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : isProcessing ? (
              <Card>
                <CardContent className="py-8 space-y-4">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="font-medium">Transcribing episode...</span>
                  </div>
                  <Progress value={progressPercent} className="max-w-md mx-auto" data-testid="progress-transcription" />
                  <p className="text-sm text-muted-foreground text-center">
                    {transcriptData?.progress || 0} of {transcriptData?.totalChunks || "?"} segments processed
                  </p>
                  {segments.length > 0 && (
                    <p className="text-xs text-muted-foreground text-center">
                      Partial transcript available below while processing...
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : hasError ? (
              <Card>
                <CardContent className="py-8 text-center space-y-3">
                  <AlertCircle className="w-10 h-10 text-destructive/50 mx-auto" />
                  <h3 className="font-semibold">Transcription Failed</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    {transcriptData?.errorMessage || "An error occurred during transcription."}
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setTranscriptId(null);
                    }}
                    data-testid="button-retry-transcript"
                  >
                    Try Again
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {segments.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search transcript..."
                      value={transcriptSearch}
                      onChange={(e) => setTranscriptSearch(e.target.value)}
                      className="pl-9"
                      data-testid="input-transcript-search"
                    />
                  </div>
                  {searchMatches.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {searchMatchIndex + 1} / {searchMatches.length}
                      </Badge>
                      <Button variant="ghost" size="icon" onClick={handlePrevMatch} data-testid="button-search-prev">
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={handleNextMatch} data-testid="button-search-next">
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="mb-3 flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="gap-1">
                    <FileText className="w-3 h-3" />
                    {segments.length} segments
                  </Badge>
                  {isCompleted && (
                    <Badge variant="secondary" className="gap-1">
                      Completed
                    </Badge>
                  )}
                  {clippedRanges.length > 0 && (
                    <Badge variant="outline" className="gap-1 text-green-600 dark:text-green-400 border-green-500/30">
                      <Bookmark className="w-3 h-3" />
                      {clippedRanges.length} clip{clippedRanges.length !== 1 ? "s" : ""} saved
                    </Badge>
                  )}
                  <p className="text-xs text-muted-foreground ml-auto">
                    Highlight text to save as a clip
                  </p>
                </div>

                <div className="relative" ref={transcriptRef}>
                  <div className="space-y-1" data-testid="transcript-segments">
                    {segments.map((segment, index) => {
                      const isMatch = transcriptSearch.trim() &&
                        segment.text.toLowerCase().includes(transcriptSearch.toLowerCase());
                      const isCurrentMatch = searchMatches.length > 0 && searchMatches[searchMatchIndex]?.index === index;
                      const clipped = isSegmentClipped(segment);

                      return (
                        <div
                          key={index}
                          data-segment-index={index}
                          className={`group flex gap-3 p-3 rounded-md transition-colors ${
                            isCurrentMatch
                              ? "bg-primary/10 ring-1 ring-primary/30"
                              : isMatch
                              ? "bg-muted/50"
                              : clipped
                              ? "bg-green-500/10 dark:bg-green-400/10 border-l-2 border-green-500/40 dark:border-green-400/40"
                              : ""
                          }`}
                          data-testid={`segment-${index}`}
                        >
                          {clipped && (
                            <Bookmark className="w-3.5 h-3.5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                          )}
                          <button
                            className="flex-shrink-0 text-xs text-muted-foreground font-mono w-16 text-right pt-0.5 hover:text-primary transition-colors"
                            onClick={() => {
                              const spotifyUrl = selectedEpisode.id.startsWith("itunes-")
                                ? null
                                : `https://open.spotify.com/episode/${selectedEpisode.id}`;
                              if (spotifyUrl) {
                                window.open(spotifyUrl, "_blank");
                              }
                            }}
                            data-testid={`timestamp-${index}`}
                          >
                            {formatTime(segment.startMs)}
                          </button>
                          <p className="text-sm leading-relaxed flex-1 select-text">
                            {highlightText(segment.text, transcriptSearch)}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {selectedText && selectionPosition && (
                    <div
                      data-save-clip-popup
                      className="absolute z-50 bg-card border rounded-lg shadow-lg p-3 min-w-[200px]"
                      style={{
                        top: selectionPosition.top,
                        left: selectionPosition.left,
                      }}
                      data-testid="save-clip-popup"
                    >
                      <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {formatTime(selectedText.startMs)} - {formatTime(selectedText.endMs)}
                      </div>
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                        "{selectedText.text.slice(0, 100)}{selectedText.text.length > 100 ? "..." : ""}"
                      </p>
                      <Button
                        size="sm"
                        onClick={handleSaveClip}
                        disabled={saveClipMutation.isPending}
                        className="w-full"
                        data-testid="button-save-highlighted-clip"
                      >
                        {saveClipMutation.isPending ? (
                          <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                        ) : (
                          <Bookmark className="w-3 h-3 mr-1.5" />
                        )}
                        Save Clip
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
