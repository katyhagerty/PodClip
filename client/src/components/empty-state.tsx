import { Bookmark, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  onAddBookmark: () => void;
}

export function EmptyState({ onAddBookmark }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4" data-testid="empty-state">
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
          <Headphones className="w-12 h-12 text-primary" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-primary flex items-center justify-center">
          <Bookmark className="w-5 h-5 text-primary-foreground" />
        </div>
      </div>
      
      <h2 className="text-2xl font-bold text-foreground mb-2">
        No clips saved yet
      </h2>
      <p className="text-muted-foreground max-w-md mb-6">
        Start saving your favorite podcast moments. Search for episodes and bookmark the clips that matter most to you.
      </p>
      
      <Button onClick={onAddBookmark} size="lg" data-testid="button-add-first">
        <Bookmark className="w-4 h-4 mr-2" />
        Add Your First Clip
      </Button>
    </div>
  );
}
