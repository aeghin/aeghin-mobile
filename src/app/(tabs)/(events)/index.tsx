import { AppHeader } from "@/components/app-header";
import { useCurrentOrganization } from "@/components/organization-provider";
import { SectionPlaceholder } from "@/components/section-placeholder";

export default function EventsScreen() {
  const { organization } = useCurrentOrganization();

  // The tabs layout redirects when there is no organization; this is only the
  // frame between that decision and the redirect committing.
  if (!organization) {
    return null;
  }

  return (
    <>
      <AppHeader />
      <SectionPlaceholder
        symbol={{ ios: "calendar", android: "calendar_month" }}
        title="Not available yet"
        body={`${organization.name}'s schedule will appear here once its endpoint is live.`}
      />
    </>
  );
}
