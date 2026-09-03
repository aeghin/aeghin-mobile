import * as DocumentPicker from "expo-document-picker";
import AudioLines from "lucide-react-native/icons/audio-lines";
import FileText from "lucide-react-native/icons/file-text";
import Paperclip from "lucide-react-native/icons/paperclip";
import Plus from "lucide-react-native/icons/plus";
import Trash2 from "lucide-react-native/icons/trash-2";
import { useState } from "react";
import { Alert } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { Dialog } from "@/components/dialog";
import { ErrorBanner } from "@/components/form-fields";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { useAddAttachments, useDeleteAttachment } from "@/hooks/use-songs";
import { useTheme } from "@/hooks/use-theme";
import type { UploadFile } from "@/lib/api";
import { failureMessage } from "@/lib/failure";
import type { LibrarySong, SongAttachment } from "@/types/song";

/**
 * A song's charts and tracks.
 *
 * The dashboard hangs these off its song modal, where the browser can upload
 * straight to UploadThing. The phone cannot — there is no UploadThing client
 * for React Native — so the file goes to our own API and the server does that
 * leg. What the person sees is the same either way.
 */

/** The `songAttachment` file router's limits, checked before a byte goes up. */
const MAX_FILES = 5;
const MAX_PDF_BYTES = 16 * 1024 * 1024;
const MAX_AUDIO_BYTES = 64 * 1024 * 1024;

const PDF = "application/pdf";

/** What the picker is allowed to return, matching the route's own list. */
const ACCEPTED = [PDF, "audio/*"];

const isPdf = (type: string) => type === PDF;

const limitFor = (type: string) =>
  isPdf(type) ? MAX_PDF_BYTES : type.startsWith("audio/") ? MAX_AUDIO_BYTES : null;

const megabytes = (bytes: number) => `${Math.round(bytes / (1024 * 1024))}MB`;

/** `1536` -> `"2 KB"`, `5_242_880` -> `"5.0 MB"`. */
function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

type SongAttachmentsDialogProps = {
  visible: boolean;
  song: LibrarySong | undefined;
  organizationId: string;
  onClose: () => void;
};

export function SongAttachmentsDialog({
  visible,
  song,
  organizationId,
  onClose,
}: SongAttachmentsDialogProps) {
  const theme = useTheme();

  const upload = useAddAttachments(organizationId);
  const remove = useDeleteAttachment(organizationId);

  const [error, setError] = useState<string | null>(null);

  const attachments = song?.attachments ?? [];

  /**
   * Picks files and sends them.
   *
   * The same limits the route enforces are checked here first, because a 64MB
   * track that is going to be refused should not be uploaded to find that out.
   */
  const pick = async () => {
    if (!song) return;

    setError(null);

    const picked = await DocumentPicker.getDocumentAsync({
      type: ACCEPTED,
      multiple: true,
      // The uri has to outlive the picker for the upload to stream from it.
      copyToCacheDirectory: true,
    }).catch(() => null);

    if (!picked || picked.canceled || picked.assets.length === 0) return;

    if (picked.assets.length > MAX_FILES) {
      setError(`Up to ${MAX_FILES} files at a time.`);
      return;
    }

    const files: UploadFile[] = [];

    for (const asset of picked.assets) {
      // iOS can hand back a document with no MIME type; the extension is the
      // only other thing that says what it is.
      const type =
        asset.mimeType ?? (asset.name.toLowerCase().endsWith(".pdf") ? PDF : "");

      const limit = limitFor(type);

      if (limit === null) {
        setError(`${asset.name} is not a PDF or an audio file.`);
        return;
      }

      if (asset.size !== undefined && asset.size > limit) {
        setError(`${asset.name} is over the ${megabytes(limit)} limit.`);
        return;
      }

      files.push({ uri: asset.uri, name: asset.name, type });
    }

    upload.mutate(
      { songId: song.id, files },
      {
        onError: (failure) => setError(failureMessage(failure)),
        onSuccess: (result) => {
          if (result.skipped > 0) {
            setError(
              `${result.added} of ${result.added + result.skipped} files went up. Try the rest again.`,
            );
          }
        },
      },
    );
  };

  const confirmRemove = (attachment: SongAttachment) => {
    if (!song) return;

    Alert.alert("Remove attachment", `${attachment.name} will be deleted for everyone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          remove.mutate(
            { songId: song.id, attachmentId: attachment.id },
            { onError: (failure) => setError(failureMessage(failure)) },
          ),
      },
    ]);
  };

  return (
    <Dialog
      visible={visible}
      icon={Paperclip}
      title="Attachments"
      description={song ? `Charts and tracks for ${song.title}.` : undefined}
      onClose={onClose}
    >
      <ErrorBanner message={error} />

      <VStack className="overflow-hidden rounded-2xl border border-border bg-card">
        {attachments.length === 0 ? (
          <Text className="px-3.5 py-4 text-center text-[13px] text-muted-foreground">
            No charts or tracks yet.
          </Text>
        ) : (
          attachments.map((attachment, index) => (
            <VStack key={attachment.id}>
              {index > 0 ? <Divider /> : null}
              <HStack className="items-center gap-2.5 px-3.5 py-2.5">
                <AppIcon
                  icon={isPdf(attachment.type) ? FileText : AudioLines}
                  size={17}
                  color={theme.textMuted}
                />
                <VStack className="flex-1">
                  <Text className="text-[14px] text-foreground" numberOfLines={1}>
                    {attachment.name}
                  </Text>
                  <Text className="text-[12px] text-muted-foreground">
                    {formatSize(attachment.size)}
                  </Text>
                </VStack>
                <Pressable
                  onPress={() => confirmRemove(attachment)}
                  disabled={remove.isPending}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${attachment.name}`}
                  hitSlop={8}
                >
                  <AppIcon icon={Trash2} size={16} color={theme.destructive} />
                </Pressable>
              </HStack>
            </VStack>
          ))
        )}

        <Divider />

        <Pressable
          onPress={pick}
          disabled={upload.isPending}
          accessibilityRole="button"
          className="px-3.5 py-3"
        >
          <HStack className="items-center justify-center gap-1.5">
            {upload.isPending ? (
              <>
                <Spinner size="small" color={brand.orange} />
                <Text className="text-[14px] font-medium" style={{ color: brand.orange }}>
                  Uploading…
                </Text>
              </>
            ) : (
              <>
                <AppIcon icon={Plus} size={16} color={brand.orange} />
                <Text className="text-[14px] font-medium" style={{ color: brand.orange }}>
                  Add chart or track
                </Text>
              </>
            )}
          </HStack>
        </Pressable>
      </VStack>

      <Box>
        <Text className="text-[12px] text-muted-foreground">
          {`PDFs up to ${megabytes(MAX_PDF_BYTES)}, audio up to ${megabytes(MAX_AUDIO_BYTES)}, ${MAX_FILES} at a time. Everyone on the team can open them.`}
        </Text>
      </Box>
    </Dialog>
  );
}
