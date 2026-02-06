import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { BookmarkCard } from "@/components/bookmark-card";
import { BookmarkDialog } from "@/components/bookmark-dialog";
import { EpisodeSearchDialog } from "@/components/episode-search-dialog";
import { EmptyState } from "@/components/empty-state";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Headphones, Bookmark, Radio } from "lucide-react";
import { SiSpotify } from "react-icons/si";
import { Link } from "wouter";
import type { Bookmark as BookmarkType, InsertBookmark } from "@shared/schema";

export default function Home() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [bookmarkDialogOpen, setBookmarkDialogOpen] = useState(false);
  const [episodeSearchOpen, setEpisodeSearchOpen] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<BookmarkType | null>(null);
  const [prefilledEpisode, setPrefilledEpisode] = useState<{
    episodeId: string;
    episodeName: string;
    showName: string;
    showImageUrl?: string;
    audioUrl?: string;
  } | undefined>();

  const { data: bookmarks, isLoading } = useQuery<BookmarkType[]>({
    queryKey: ["/api/bookmarks"],
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

  const createMutation = useMutation({
    mutationFn: (data: InsertBookmark) => apiRequest("POST", "/api/bookmarks", data),
    onSuccess: async (response) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
      setBookmarkDialogOpen(false);
      const bookmark = await response.json();
      toast({
        title: "Clip saved!",
        description: bookmark.audioUrl
          ? "Your clip has been saved. Transcript is generating..."
          : "Your podcast moment has been bookmarked.",
      });
      setPrefilledEpisode(undefined);
      if (bookmark.audioUrl && bookmark.id) {
        triggerTranscription(bookmark.id, bookmark.audioUrl, bookmark.timestampMs, bookmark.durationMs || 60000);
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save the bookmark. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: InsertBookmark }) =>
      apiRequest("PUT", `/api/bookmarks/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
      setBookmarkDialogOpen(false);
      setEditingBookmark(null);
      toast({
        title: "Bookmark updated",
        description: "Your changes have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update the bookmark. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/bookmarks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
      toast({
        title: "Bookmark deleted",
        description: "The clip has been removed from your library.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete the bookmark. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddBookmark = () => {
    setEditingBookmark(null);
    setPrefilledEpisode(undefined);
    setEpisodeSearchOpen(true);
  };

  const handleEditBookmark = (bookmark: BookmarkType) => {
    setEditingBookmark(bookmark);
    setPrefilledEpisode(undefined);
    setBookmarkDialogOpen(true);
  };

  const handleSelectEpisode = (episode: {
    episodeId: string;
    episodeName: string;
    showName: string;
    showImageUrl?: string;
    audioUrl?: string;
  }) => {
    setPrefilledEpisode(episode);
    setBookmarkDialogOpen(true);
  };

  const handleSubmitBookmark = (data: InsertBookmark) => {
    if (editingBookmark) {
      updateMutation.mutate({ id: editingBookmark.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredBookmarks = bookmarks?.filter((bookmark) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      bookmark.episodeName.toLowerCase().includes(query) ||
      bookmark.showName.toLowerCase().includes(query) ||
      bookmark.note?.toLowerCase().includes(query) ||
      bookmark.transcript?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="container max-w-4xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary">
              <Headphones className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">PodClip</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Save your favorite moments</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/now-playing">
              <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-now-playing">
                <Radio className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Now Playing</span>
              </Button>
            </Link>
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50 text-muted-foreground text-xs">
              <SiSpotify className="w-3 h-3 text-[#1DB954]" />
              <span className="hidden sm:inline">Connected</span>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Bookmark className="w-6 h-6 text-primary" />
              Your Clips
            </h2>
            <p className="text-muted-foreground mt-1">
              {bookmarks?.length || 0} saved moment{bookmarks?.length !== 1 ? "s" : ""}
            </p>
          </div>

          <Button onClick={handleAddBookmark} data-testid="button-add-bookmark">
            <Plus className="w-4 h-4 mr-2" />
            Add Clip
          </Button>
        </div>

        {bookmarks && bookmarks.length > 0 && (
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search your clips..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search"
            />
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4 p-4 rounded-lg border">
                <Skeleton className="w-20 h-20 rounded-md flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex gap-2 mt-2">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredBookmarks && filteredBookmarks.length > 0 ? (
          <div className="space-y-4">
            {filteredBookmarks.map((bookmark) => (
              <BookmarkCard
                key={bookmark.id}
                bookmark={bookmark}
                onEdit={handleEditBookmark}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))}
          </div>
        ) : bookmarks && bookmarks.length > 0 && searchQuery ? (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">No clips match your search</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Try a different search term
            </p>
          </div>
        ) : (
          <EmptyState onAddBookmark={handleAddBookmark} />
        )}
      </main>

      <EpisodeSearchDialog
        open={episodeSearchOpen}
        onOpenChange={setEpisodeSearchOpen}
        onSelectEpisode={handleSelectEpisode}
      />

      <BookmarkDialog
        open={bookmarkDialogOpen}
        onOpenChange={(open) => {
          setBookmarkDialogOpen(open);
          if (!open) {
            setEditingBookmark(null);
            setPrefilledEpisode(undefined);
          }
        }}
        bookmark={editingBookmark}
        prefilledEpisode={prefilledEpisode}
        onSubmit={handleSubmitBookmark}
        isPending={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
