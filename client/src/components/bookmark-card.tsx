import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Trash2, Edit2, Clock, ExternalLink } from "lucide-react";
import { formatTime, formatRelativeDate } from "@/lib/utils";
import type { Bookmark } from "@shared/schema";

interface BookmarkCardProps {
  bookmark: Bookmark;
  onEdit: (bookmark: Bookmark) => void;
  onDelete: (id: string) => void;
}

export function BookmarkCard({ bookmark, onEdit, onDelete }: BookmarkCardProps) {
  const isSpotifyId = bookmark.episodeId && !bookmark.episodeId.startsWith('itunes-');
  const spotifyUrl = isSpotifyId
    ? `https://open.spotify.com/episode/${bookmark.episodeId}`
    : `https://open.spotify.com/search/${encodeURIComponent(bookmark.episodeName)}/episodes`;

  return (
    <Card className="group hover-elevate overflow-visible" data-testid={`card-bookmark-${bookmark.id}`}>
      <CardContent className="p-0">
        <div className="flex gap-4 p-4">
          <div className="relative flex-shrink-0">
            {bookmark.showImageUrl ? (
              <img
                src={bookmark.showImageUrl}
                alt={bookmark.showName}
                className="w-20 h-20 rounded-md object-cover"
                data-testid={`img-bookmark-cover-${bookmark.id}`}
              />
            ) : (
              <div className="w-20 h-20 rounded-md bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                <Play className="w-8 h-8 text-primary" />
              </div>
            )}
            <a
              href={isSpotifyId ? `${spotifyUrl}?t=${Math.floor(bookmark.timestampMs / 1000)}` : spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md"
              data-testid={`link-play-${bookmark.id}`}
            >
              <div className="bg-primary rounded-full p-2">
                <Play className="w-5 h-5 text-primary-foreground fill-current" />
              </div>
            </a>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground truncate" data-testid={`text-episode-name-${bookmark.id}`}>
                  {bookmark.episodeName}
                </h3>
                <p className="text-sm text-muted-foreground truncate" data-testid={`text-show-name-${bookmark.id}`}>
                  {bookmark.showName}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(bookmark)}
                  data-testid={`button-edit-${bookmark.id}`}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(bookmark.id)}
                  data-testid={`button-delete-${bookmark.id}`}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="secondary" className="gap-1" data-testid={`badge-timestamp-${bookmark.id}`}>
                <Clock className="w-3 h-3" />
                {formatTime(bookmark.timestampMs)}
              </Badge>
              {bookmark.durationMs && (
                <Badge variant="outline" className="text-muted-foreground" data-testid={`badge-duration-${bookmark.id}`}>
                  Duration: {formatTime(bookmark.durationMs)}
                </Badge>
              )}
            </div>

            {bookmark.note && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2" data-testid={`text-note-${bookmark.id}`}>
                {bookmark.note}
              </p>
            )}

            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-muted-foreground" data-testid={`text-date-${bookmark.id}`}>
                {formatRelativeDate(new Date(bookmark.createdAt))}
              </span>
              <a
                href={spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
                data-testid={`link-spotify-${bookmark.id}`}
              >
                Open in Spotify
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
