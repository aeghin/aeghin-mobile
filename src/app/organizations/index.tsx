import { useUser } from "@clerk/expo";
import { UserButton } from "@clerk/expo/native";
import { useRouter } from "expo-router";
import Building2 from "lucide-react-native/icons/building-2";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import Plus from "lucide-react-native/icons/plus";
import { type ReactNode } from "react";
import { FlatList, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { Logo } from "@/components/logo";
import { OrganizationRow } from "@/components/organization-row";
import { useCurrentOrganization } from "@/components/organization-provider";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { useOrganizations } from "@/hooks/use-organizations";
import { useTheme } from "@/hooks/use-theme";

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

  const { data, isPending, isError, error, refetch, isRefetching } =
    useOrganizations();

  const organizations = data ?? [];
  const onCreate = () => {};

  const choose = (organizationId: string) => {
    select(organizationId);

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
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
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.textMuted}
            colors={[brand.orange]}
          />
        }
        ListHeaderComponent={
          <VStack className="gap-1 pb-3.5 pt-5">
            <Heading size="2xl" className="tracking-[-0.4px] text-foreground">
              Organizations
            </Heading>
            <Text className="text-[15px] text-muted-foreground">
              {ledeFor({ isPending, isError, count: organizations.length })}
            </Text>
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
              body="Create one, or ask an owner to send you an invitation."
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
};

function ledeFor({ isPending, isError, count }: LedeState): string {
  if (isPending) return "Loading your teams…";
  if (isError) return "Pull down to try again.";
  return count > 0
    ? "Choose a team to work in."
    : "Create a team to get started.";
}
