import Paperclip from "lucide-react-native/icons/paperclip";
import { useState } from "react";

import { Dialog } from "@/components/dialog";
import { ErrorBanner } from "@/components/form-fields";
import {
  MAX_AUDIO_BYTES,
  MAX_FILES,
  MAX_PDF_BYTES,
  SongFiles,
  megabytes,
} from "@/components/songs/song-files";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useTheme } from "@/hooks/use-theme";
import { formatStorage } from "@/lib/storage";
import type { LibrarySong } from "@/types/song";

/**
 * A song's charts and tracks: the Original's. The dashboard hangs these off its
 * song modal; an arrangement's live in the Arrangements dialog.
 */

type SongAttachmentsDialogProps = {
  visible: boolean;
  song: LibrarySong | undefined;
  organizationId: string;
  /** The library's charts and audio against the plan's storage. Null until the plan loads. */
  storage: { used: number; limit: number } | null;
  onClose: () => void;
};

export function SongAttachmentsDialog({
  visible,
  song,
  organizationId,
  storage,
  onClose,
}: SongAttachmentsDialogProps) {
  const theme = useTheme();

  // Over counts too: a plan that shrank keeps its files but can't add more.
  const full = storage !== null && storage.used >= storage.limit;

  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog
      visible={visible}
      icon={Paperclip}
      title="Attachments"
      description={song ? `Charts and tracks for ${song.title}.` : undefined}
      onClose={onClose}
    >
      <ErrorBanner message={error} />

      {song ? (
        <VStack className="overflow-hidden rounded-2xl border border-border bg-card">
          <SongFiles
            organizationId={organizationId}
            songId={song.id}
            arrangementId={null}
            attachments={song.attachments}
            storage={storage}
            emptyText="No charts or tracks yet."
            onError={setError}
          />
        </VStack>
      ) : null}

      <Box>
        <Text className="text-[12px] text-muted-foreground">
          {`PDFs up to ${megabytes(MAX_PDF_BYTES)}, audio up to ${megabytes(MAX_AUDIO_BYTES)}, ${MAX_FILES} at a time. Everyone on the team can open them.`}
        </Text>
        {storage ? (
          <Text
            className={`mt-1 text-[12px] ${full ? "font-medium" : "text-muted-foreground"}`}
            style={full ? { color: theme.warning } : undefined}
          >
            {`${formatStorage(storage.used)} of ${formatStorage(storage.limit)} used.${full ? " Remove files you no longer use to make room." : ""}`}
          </Text>
        ) : null}
      </Box>
    </Dialog>
  );
}
