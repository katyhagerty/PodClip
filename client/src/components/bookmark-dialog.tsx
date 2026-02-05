import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { formatTime, parseTimeToMs } from "@/lib/utils";
import type { Bookmark, InsertBookmark } from "@shared/schema";

const bookmarkFormSchema = z.object({
  episodeId: z.string().min(1, "Episode ID is required"),
  episodeName: z.string().min(1, "Episode name is required"),
  showName: z.string().min(1, "Show name is required"),
  showImageUrl: z.string().optional(),
  timestamp: z.string().regex(/^\d+:\d{2}(:\d{2})?$/, "Use format MM:SS or HH:MM:SS"),
  duration: z.string().optional(),
  note: z.string().optional(),
  transcript: z.string().optional(),
});

type BookmarkFormValues = z.infer<typeof bookmarkFormSchema>;

interface BookmarkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookmark?: Bookmark | null;
  onSubmit: (data: InsertBookmark) => void;
  isPending?: boolean;
  prefilledEpisode?: {
    episodeId: string;
    episodeName: string;
    showName: string;
    showImageUrl?: string;
  };
}

export function BookmarkDialog({
  open,
  onOpenChange,
  bookmark,
  onSubmit,
  isPending,
  prefilledEpisode,
}: BookmarkDialogProps) {
  const isEditing = !!bookmark;

  const form = useForm<BookmarkFormValues>({
    resolver: zodResolver(bookmarkFormSchema),
    defaultValues: {
      episodeId: "",
      episodeName: "",
      showName: "",
      showImageUrl: "",
      timestamp: "0:00",
      duration: "",
      note: "",
      transcript: "",
    },
  });

  useEffect(() => {
    if (bookmark) {
      form.reset({
        episodeId: bookmark.episodeId,
        episodeName: bookmark.episodeName,
        showName: bookmark.showName,
        showImageUrl: bookmark.showImageUrl || "",
        timestamp: formatTime(bookmark.timestampMs),
        duration: bookmark.durationMs ? formatTime(bookmark.durationMs) : "",
        note: bookmark.note || "",
        transcript: bookmark.transcript || "",
      });
    } else if (prefilledEpisode) {
      form.reset({
        episodeId: prefilledEpisode.episodeId,
        episodeName: prefilledEpisode.episodeName,
        showName: prefilledEpisode.showName,
        showImageUrl: prefilledEpisode.showImageUrl || "",
        timestamp: "0:00",
        duration: "",
        note: "",
        transcript: "",
      });
    } else {
      form.reset({
        episodeId: "",
        episodeName: "",
        showName: "",
        showImageUrl: "",
        timestamp: "0:00",
        duration: "",
        note: "",
        transcript: "",
      });
    }
  }, [bookmark, prefilledEpisode, form]);

  const handleSubmit = (values: BookmarkFormValues) => {
    const data: InsertBookmark = {
      episodeId: values.episodeId,
      episodeName: values.episodeName,
      showName: values.showName,
      showImageUrl: values.showImageUrl || null,
      timestampMs: parseTimeToMs(values.timestamp),
      durationMs: values.duration ? parseTimeToMs(values.duration) : null,
      note: values.note || null,
      transcript: values.transcript || null,
    };
    onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" data-testid="dialog-bookmark">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">
            {isEditing ? "Edit Bookmark" : "Add Bookmark"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update your podcast clip bookmark."
              : "Save a new moment from your favorite podcast."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="episodeName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Episode Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Episode title"
                      {...field}
                      data-testid="input-episode-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="showName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Show Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Podcast name"
                      {...field}
                      data-testid="input-show-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="timestamp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timestamp</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="0:00"
                        {...field}
                        data-testid="input-timestamp"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clip Duration (optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="1:30"
                        {...field}
                        data-testid="input-duration"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Why is this moment special?"
                      className="resize-none"
                      rows={3}
                      {...field}
                      data-testid="input-note"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="transcript"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transcript (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Paste the transcript of this clip..."
                      className="resize-vertical font-mono text-xs"
                      rows={5}
                      {...field}
                      data-testid="input-transcript"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="episodeId"
              render={({ field }) => (
                <FormItem className="hidden">
                  <FormControl>
                    <Input type="hidden" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="showImageUrl"
              render={({ field }) => (
                <FormItem className="hidden">
                  <FormControl>
                    <Input type="hidden" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-save">
                {isPending ? "Saving..." : isEditing ? "Update" : "Save"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
