import * as DocumentPicker from "expo-document-picker";
import AudioLines from "lucide-react-native/icons/audio-lines";
import FileText from "lucide-react-native/icons/file-text";
import Plus from "lucide-react-native/icons/plus";
import Trash2 from "lucide-react-native/icons/trash-2";
import { Alert } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { useAddAttachments, useDeleteAttachment } from "@/hooks/use-songs";
import { useTheme } from "@/hooks/use-theme";
import { failureMessage } from "@/lib/failure";
import type { UploadFile } from "@/lib/uploadthing";
import type { SongAttachment } from "@/types/song";

/**
 * The rows of a song's charts and tracks, or one arrangement's, and the row
 * that adds more. The parent draws the card around them: the Attachments
 * dialog shows the Original's, the Arrangements dialog one card per
 * arrangement.
 *
 * The dashboard takes the same two steps: the file goes to UploadThing
 * directly, then our own API records what landed.
 */

/** The `songAttachment` file router's limits, checked before a byte goes up. */
export const MAX_FILES = 5;
export const MAX_PDF_BYTES = 16 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 64 * 1024 * 1024;

const PDF = "application/pdf";

/** What the picker is allowed to return, matching the route's own list. */
const ACCEPTED = [PDF, "audio/*"];

const isPdf = (type: string) => type === PDF;

const limitFor = (type: string) =>
  isPdf(type) ? MAX_PDF_BYTES : type.startsWith("audio/") ? MAX_AUDIO_BYTES : null;

export const megabytes = (bytes: number) => `${Math.round(bytes / (1024 * 1024))}MB`;

/** `1536` -> `"2 KB"`, `5_242_880` -> `"5.0 MB"`. */
function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

type SongFilesProps = {
  organizationId: string;
  songId: string;
  /** The arrangement they belong to. Null is the Original's. */
  arrangementId: string | null;
  attachments: SongAttachment[];
  /** The library's charts and audio against the plan's storage. Null until the plan loads. */
  storage: { used: number; limit: number } | null;
  /** Shown in place of the rows while there are none. */
  emptyText?: string;
  /** What went wrong, and null as the next pick starts. */
  onError: (message: string | null) => void;
};

export function SongFiles({
  organizationId,
  songId,
  arrangementId,
  attachments,
  storage,
  emptyText,
  onError,
}: SongFilesProps) {
  const theme = useTheme();

  const upload = useAddAttachments(organizationId);
  const remove = useDeleteAttachment(organizationId);

  // Over counts too: a plan that shrank keeps its files but can't add more.
  const full = storage !== null && storage.used >= storage.limit;

  /**
   * Picks files and sends them.
   *
   * The same limits the route enforces are checked here first, because a 64MB
   * track that is going to be refused should not be uploaded to find that out.
   */
  const pick = async () => {
    onError(null);

    const picked = await DocumentPicker.getDocumentAsync({
      type: ACCEPTED,
      multiple: true,
      // The uri has to outlive the picker for the upload to stream from it.
      copyToCacheDirectory: true,
    }).catch(() => null);

    if (!picked || picked.canceled || picked.assets.length === 0) return;

    if (picked.assets.length > MAX_FILES) {
      onError(`Up to ${MAX_FILES} files at a time.`);
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
        onError(`${asset.name} is not a PDF or an audio file.`);
        return;
      }

      // The upload declares its size before a byte moves, so one we cannot read
      // is one we cannot send.
      if (asset.size === undefined) {
        onError(`${asset.name} couldn't be read. Try picking it again.`);
        return;
      }

      if (asset.size > limit) {
        onError(`${asset.name} is over the ${megabytes(limit)} limit.`);
        return;
      }

      files.push({ uri: asset.uri, name: asset.name, type, size: asset.size });
    }

    upload.mutate(
      { songId, arrangementId, files },
      {
        onError: (failure) => onError(failureMessage(failure)),
        onSuccess: (result) => {
          if (result.skipped > 0) {
            onError(
              `${result.added} of ${result.added + result.skipped} files went up. Try the rest again.`,
            );
          }
        },
      },
    );
  };

  const confirmRemove = (attachment: SongAttachment) => {
    Alert.alert("Remove attachment", `${attachment.name} will be deleted for everyone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          remove.mutate(
            { songId, attachmentId: attachment.id },
            { onError: (failure) => onError(failureMessage(failure)) },
          ),
      },
    ]);
  };

  return (
    <>
      {attachments.length === 0 ? (
        emptyText ? (
          <Text className="px-3.5 py-4 text-center text-[13px] text-muted-foreground">
            {emptyText}
          </Text>
        ) : null
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

      {attachments.length > 0 || emptyText ? <Divider /> : null}

      <Pressable
        onPress={pick}
        disabled={upload.isPending || full}
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
              <AppIcon icon={Plus} size={16} color={full ? theme.textMuted : brand.orange} />
              <Text
                className="text-[14px] font-medium"
                style={{ color: full ? theme.textMuted : brand.orange }}
              >
                {full ? "Storage full" : "Add chart or track"}
              </Text>
            </>
          )}
        </HStack>
      </Pressable>
    </>
  );
}
