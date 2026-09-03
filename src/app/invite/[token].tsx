import { useUser } from "@clerk/expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import Building2 from "lucide-react-native/icons/building-2";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import CircleCheckBig from "lucide-react-native/icons/circle-check-big";
import CircleSlash from "lucide-react-native/icons/circle-slash";
import Clock from "lucide-react-native/icons/clock";
import MailX from "lucide-react-native/icons/mail-x";
import { type ReactNode } from "react";
import { Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { Logo } from "@/components/logo";
import { useCurrentOrganization } from "@/components/organization-provider";
import { InvitationCard } from "@/components/organizations/invitation-card";
import { Button, ButtonText } from "@/components/ui/button";
import { Center } from "@/components/ui/center";
import { HStack } from "@/components/ui/hstack";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand, withAlpha } from "@/constants/branding";
import {
  useInvitationByToken,
  useRespondToOrgInvitation,
} from "@/hooks/use-my-invitations";
import { useOrganizations } from "@/hooks/use-organizations";
import { useTheme } from "@/hooks/use-theme";
import { ApiError } from "@/lib/api";
import { failureMessage } from "@/lib/failure";

/**
 * One invitation, opened from its link.
 *
 * The picker already lists whatever is waiting on this account, so this screen
 * exists for the other way in: somebody tapping the emailed link on their
 * phone. Its real work is explaining the invitations that cannot be answered,
 * which the picker's list never contains — lapsed, already answered, or sent
 * to a different address than the one signed in here.
 */
export default function InviteScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useUser();

  const { token } = useLocalSearchParams<{ token: string }>();

  const invitation = useInvitationByToken(token ?? "");
  const respond = useRespondToOrgInvitation();
  const organizations = useOrganizations();
  const { select } = useCurrentOrganization();

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/organizations");
  };

  const enter = (organizationId: string) => {
    select(organizationId);
    router.replace("/");
  };

  const answer = async (action: "accept" | "decline") => {
    if (!token) return;

    try {
      const result = await respond.mutateAsync({ token, action });

      if (action === "accept" && result.orgId) {
        // `select` resolves against the membership list, so that has to have
        // landed before the tabs are sent at the new organization.
        await organizations.refetch();
        enter(result.orgId);
        return;
      }

      leave();
    } catch (error) {
      Alert.alert(
        action === "accept" ? "Couldn't accept" : "Couldn't decline",
        failureMessage(error),
      );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-grouped" edges={["top", "left", "right"]}>
      <HStack className="items-center gap-2 border-b border-border bg-background px-4 py-3">
        <Logo size={28} trim />
        <Text className="flex-1 text-[17px] font-bold tracking-[-0.3px] text-brand">
          aeghin
        </Text>
        <Button variant="link" onPress={leave}>
          <ButtonText className="text-base text-brand">Close</ButtonText>
        </Button>
      </HStack>

      <ScrollView
        contentContainerStyle={{ padding: 16, flexGrow: 1, justifyContent: "center" }}
        contentInsetAdjustmentBehavior="never"
      >
        {invitation.isPending ? (
          <Center className="py-12">
            <Spinner color={theme.textMuted} />
          </Center>
        ) : invitation.isError ? (
          <Notice
            icon={
              invitation.error instanceof ApiError && invitation.error.status === 404
                ? CircleSlash
                : CircleAlert
            }
            tone="muted"
            title={
              invitation.error instanceof ApiError && invitation.error.status === 404
                ? "Invitation not found"
                : "Couldn't load this invitation"
            }
            body={
              invitation.error instanceof ApiError && invitation.error.status === 404
                ? "The link may be wrong, or the invitation was withdrawn."
                : "Check your connection and try again."
            }
          >
            <Button
              variant="outline"
              onPress={() => invitation.refetch()}
              className="mt-1.5 rounded-xl border-border"
            >
              <ButtonText className="text-brand">Try again</ButtonText>
            </Button>
          </Notice>
        ) : invitation.data.alreadyMember ? (
          <Notice
            icon={CircleCheckBig}
            tone="success"
            title="You're already in"
            body={`You're a member of ${invitation.data.organization.name}.`}
          >
            <Button
              onPress={() => enter(invitation.data.organization.id)}
              className="mt-1.5 rounded-xl bg-brand"
            >
              <ButtonText className="text-white">
                {`Open ${invitation.data.organization.name}`}
              </ButtonText>
            </Button>
          </Notice>
        ) : !invitation.data.forYou ? (
          <Notice
            icon={MailX}
            tone="muted"
            title="This invitation isn't yours"
            body={`It was sent to ${invitation.data.email}${
              user?.primaryEmailAddress?.emailAddress
                ? `, and you're signed in as ${user.primaryEmailAddress.emailAddress}`
                : ""
            }. Sign in with that address to accept it.`}
          />
        ) : invitation.data.status !== "PENDING" ? (
          <Notice
            icon={MailX}
            tone="muted"
            title="Invitation unavailable"
            body={`This invitation has already been ${invitation.data.status.toLowerCase()}.`}
          />
        ) : invitation.data.expired ? (
          <Notice
            icon={Clock}
            tone="muted"
            title="Invitation expired"
            body={`Ask an owner of ${invitation.data.organization.name} to send a new one.`}
          />
        ) : (
          <VStack className="gap-3">
            <VStack className="items-center gap-1.5 pb-1">
              <Center
                className="h-14 w-14 rounded-full"
                style={{ backgroundColor: withAlpha(brand.orange, 0.12) }}
              >
                <AppIcon icon={Building2} size={26} color={brand.orange} />
              </Center>
              <Text className="text-[20px] font-bold tracking-[-0.3px] text-foreground">
                {"You're invited"}
              </Text>
            </VStack>

            <InvitationCard
              invitation={invitation.data}
              busy={respond.isPending ? respond.variables.action : undefined}
              onAccept={() => answer("accept")}
              onDecline={() => answer("decline")}
            />
          </VStack>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

type NoticeProps = {
  icon: AppIconName;
  title: string;
  body: string;
  tone: "muted" | "success";
  children?: ReactNode;
};

/** What the screen says when there is nothing to answer. */
function Notice({ icon, title, body, tone, children }: NoticeProps) {
  const theme = useTheme();
  const accent = tone === "success" ? theme.success : theme.textMuted;

  return (
    <VStack className="items-center gap-2 rounded-2xl border border-border bg-card px-6 py-10">
      <Center
        className="mb-1 h-12 w-12 rounded-full"
        style={{ backgroundColor: withAlpha(accent, 0.12) }}
      >
        <AppIcon icon={icon} size={22} color={accent} />
      </Center>
      <Text className="text-center text-[17px] font-semibold text-foreground">{title}</Text>
      <Text className="max-w-[280px] text-center text-[13.5px] leading-[19px] text-muted-foreground">
        {body}
      </Text>
      {children}
    </VStack>
  );
}
