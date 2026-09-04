import { useUser } from "@clerk/expo";
import { UserButton } from "@clerk/expo/native";
import { useRouter } from "expo-router";
import Building2 from "lucide-react-native/icons/building-2";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import Plus from "lucide-react-native/icons/plus";
import { useCallback, useState, type ReactNode } from "react";
import { Alert, FlatList, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { Logo } from "@/components/logo";
import { OrganizationRow } from "@/components/organization-row";
import { CreateOrganizationDialog } from "@/components/organizations/create-organization-dialog";
import { InvitationCard } from "@/components/organizations/invitation-card";
import { useCurrentOrganization } from "@/components/organization-provider";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import {
  useMyInvitations,
  useRespondToOrgInvitation,
} from "@/hooks/use-my-invitations";
import { useOrganizations } from "@/hooks/use-organizations";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useTheme } from "@/hooks/use-theme";
import { failureMessage } from "@/lib/failure";

/**
 * Choosing which organization the tabs read from.
 *
 * Two ways in, and they need different exits. The tabs layout redirects here
 * when nothing is selected — first launch, or the remembered organization is
 * one this account has left — and there is nothing behind it to go back to.
 * The header menu and the Settings row push it to switch, and those do.
 * `canGoBack` is what tells them apart.
 *
 * Its own header rather than the stack's: with no organization there are no
 * tabs, so this is the entire app, and `UserButton` is the only way to sign out
 * of an account that cannot get past this screen.
 */
export default function OrganizationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useUser();
  const { organization, select } = useCurrentOrganization();

  const { data, isPending, isError, error, refetch } = useOrganizations();

  // What is waiting on this account. The one screen somebody with no
  // organizations can reach, so it is where an invitation has to be answerable.
  const invitations = useMyInvitations();
  const respond = useRespondToOrgInvitation();

  const refetchInvitations = invitations.refetch;
  const refresh = useCallback(
    () => Promise.all([refetch(), refetchInvitations()]),
    [refetch, refetchInvitations],
  );
  const pullToRefresh = usePullToRefresh(refresh);

  const waiting = invitations.data ?? [];
  const busy = respond.isPending ? respond.variables : undefined;

  const organizations = data ?? [];
  const [creating, setCreating] = useState(false);
  const onCreate = () => setCreating(true);

  const choose = (organizationId: string) => {
    select(organizationId);

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  // The new organization is the one they came to make: select it and go.
  const onCreated = (organizationId: string) => {
    setCreating(false);
    choose(organizationId);
  };

  const answer = async (token: string, action: "accept" | "decline") => {
    try {
      const result = await respond.mutateAsync({ token, action });

      if (action === "accept" && result.orgId) {
        // The membership list is what `choose` resolves against, so it has to
        // have landed before we send the tabs at the new organization.
        await refetch();
        choose(result.orgId);
      }
    } catch (error) {
      Alert.alert(
        action === "accept" ? "Couldn't accept" : "Couldn't decline",
        failureMessage(error),
      );
    }
  };

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      edges={["top", "left", "right"]}
    >
      <HStack
        space="md"
        className="items-center border-b border-border px-4 py-3"
      >
        <Logo size={48} variant="tile" />

        <VStack className="flex-1">
          <Text className="text-[17px] font-semibold text-foreground">
            {user?.firstName ? `Hi, ${user.firstName}` : "Welcome"}
          </Text>
          <Text
            className="mt-px text-[13px] text-muted-foreground"
            numberOfLines={1}
          >
            {user?.primaryEmailAddress?.emailAddress ?? "Signed in"}
          </Text>
        </VStack>

        {router.canGoBack() ? (
          <Button variant="link" onPress={() => router.back()}>
            <ButtonText className="text-base text-brand">Done</ButtonText>
          </Button>
        ) : (
          <UserButton />
        )}
      </HStack>

      <FlatList
        data={organizations}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 pb-8"
        contentInsetAdjustmentBehavior="automatic"
        ItemSeparatorComponent={() => <VStack className="h-2.5" />}
        refreshControl={
          <RefreshControl
            {...pullToRefresh}
            tintColor={theme.textMuted}
            colors={[brand.orange]}
          />
        }
        ListHeaderComponent={
          <VStack className="pt-5">
            <VStack className="gap-1 pb-3.5">
              <Heading size="2xl" className="tracking-[-0.4px] text-foreground">
                Organizations
              </Heading>
              <Text className="text-[15px] text-muted-foreground">
                {ledeFor({
                  isPending,
                  isError,
                  count: organizations.length,
                  invitations: waiting.length,
                })}
              </Text>
            </VStack>

            {waiting.length > 0 ? (
              <VStack className="gap-2.5 pb-4">
                <Text className="ml-1 text-xs font-bold uppercase tracking-[0.7px] text-muted-foreground">
                  {waiting.length === 1 ? "Invitation" : "Invitations"}
                </Text>

                {waiting.map((invitation) => (
                  <InvitationCard
                    key={invitation.id}
                    invitation={invitation}
                    busy={busy?.token === invitation.token ? busy.action : undefined}
                    onAccept={() => answer(invitation.token, "accept")}
                    onDecline={() => answer(invitation.token, "decline")}
                  />
                ))}
              </VStack>
            ) : null}
          </VStack>
        }
        renderItem={({ item }) => (
          <OrganizationRow
            organization={item}
            onPress={() => choose(item.id)}
            isCurrent={item.id === organization?.id}
          />
        )}
        ListEmptyComponent={
          isPending ? (
            <VStack className="items-center py-10">
              <Spinner color={theme.textMuted} />
            </VStack>
          ) : isError ? (
            <EmptyState
              icon={CircleAlert}
              title="Could not load organizations"
              body={error.message}
            >
              <Button
                variant="outline"
                onPress={() => refetch()}
                className="mt-1.5 rounded-xl border-border"
              >
                <ButtonText className="text-brand">Try again</ButtonText>
              </Button>
            </EmptyState>
          ) : (
            <EmptyState
              icon={Building2}
              title="No organizations yet"
              body={
                waiting.length > 0
                  ? "Accept an invitation above to get started."
                  : "Create one, or ask an owner to send you an invitation."
              }
            />
          )
        }
        ListFooterComponent={
          isPending || isError ? null : (
            <Button
              variant="outline"
              onPress={onCreate}
              className="mt-3.5 h-auto rounded-2xl border-dashed border-border py-3.5"
            >
              <AppIcon
                icon={Plus}
                size={20}
                color={brand.orange}
              />
              <ButtonText className="text-base font-semibold text-brand">
                Create organization
              </ButtonText>
            </Button>
          )
        }
      />

      <CreateOrganizationDialog
        visible={creating}
        onClose={() => setCreating(false)}
        onCreated={onCreated}
      />
    </SafeAreaView>
  );
}

type EmptyStateProps = {
  icon: AppIconName;
  title: string;
  body: string;
  children?: ReactNode;
};

/** The shared shape of "nothing here" and "that didn't work". */
function EmptyState({ icon, title, body, children }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <VStack space="sm" className="items-center py-10">
      <AppIcon icon={icon} size={40} color={theme.textMuted} />
      <Text className="text-[17px] font-semibold text-foreground">{title}</Text>
      <Text className="max-w-[260px] text-center text-sm text-muted-foreground">
        {body}
      </Text>
      {children}
    </VStack>
  );
}

type LedeState = {
  isPending: boolean;
  isError: boolean;
  count: number;
  invitations: number;
};

function ledeFor({ isPending, isError, count, invitations }: LedeState): string {
  if (isPending) return "Loading your teams…";
  if (isError) return "Pull down to try again.";
  if (count > 0) return "Choose a team to work in.";
  if (invitations > 0) return "You've been invited to join a team.";
  return "Create a team to get started.";
}
