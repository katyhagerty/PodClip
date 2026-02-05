import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Podcast, Plus } from "lucide-react";

interface Episode {
  id: string;
  name: string;
  showName: string;
  showImageUrl: string | null;
  description: string;
  durationMs: number;
}

interface EpisodeSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectEpisode: (episode: {
    episodeId: string;
    episodeName: string;
    showName: string;
    showImageUrl?: string;
  }) => void;
}

export function EpisodeSearchDialog({
  open,
  onOpenChange,
  onSelectEpisode,
}: EpisodeSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const { data: episodes, isLoading } = useQuery<Episode[]>({
    queryKey: ["/api/spotify/search", { q: debouncedQuery }],
    enabled: debouncedQuery.length >= 2,
  });

  const handleSearch = () => {
    setDebouncedQuery(searchQuery);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleSelectEpisode = (episode: Episode) => {
    onSelectEpisode({
      episodeId: episode.id,
      episodeName: episode.name,
      showName: episode.showName,
      showImageUrl: episode.showImageUrl || undefined,
    });
    onOpenChange(false);
    setSearchQuery("");
    setDebouncedQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-episode-search">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Podcast className="w-5 h-5 text-primary" />
            Search Episodes
          </DialogTitle>
          <DialogDescription>
            Search for podcast episodes from your Spotify library.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search podcasts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9"
              data-testid="input-episode-search"
            />
          </div>
          <Button onClick={handleSearch} data-testid="button-search">
            Search
          </Button>
        </div>

        <ScrollArea className="h-[400px] mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex gap-3 p-3 rounded-md">
                  <Skeleton className="w-16 h-16 rounded-md flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : episodes && episodes.length > 0 ? (
            <div className="space-y-2">
              {episodes.map((episode) => (
                <div
                  key={episode.id}
                  className="flex gap-3 p-3 rounded-md hover-elevate cursor-pointer"
                  onClick={() => handleSelectEpisode(episode)}
                  data-testid={`episode-result-${episode.id}`}
                >
                  {episode.showImageUrl ? (
                    <img
                      src={episode.showImageUrl}
                      alt={episode.showName}
                      className="w-16 h-16 rounded-md object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                      <Podcast className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{episode.name}</h4>
                    <p className="text-xs text-muted-foreground truncate">
                      {episode.showName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {episode.description}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0 self-center"
                    data-testid={`button-add-episode-${episode.id}`}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : debouncedQuery.length >= 2 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <Podcast className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No episodes found</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Try a different search term
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <Search className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Search for episodes</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Enter at least 2 characters to search
              </p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
