import { AppHeader } from "@/components/app-header";
import { useCurrentOrganization } from "@/components/organization-provider";
import { SectionPlaceholder } from "@/components/section-placeholder";

export default function SongsScreen() {
  const { organization } = useCurrentOrganization();

  if (!organization) {
    return null;
  }

  return (
    <>
      <AppHeader />
      <SectionPlaceholder
        symbol={{ ios: "music.note.list", android: "queue_music" }}
        title="Not available yet"
        body={`${organization.name}'s song library will appear here once its endpoint is live.`}
      />
    </>
  );
}
