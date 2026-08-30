import { ActionIcon, Box, Group, Indicator, Title, Tooltip } from "@mantine/core";
import { IconArrowLeft, IconSettings } from "@tabler/icons-react";
import type { ReactNode } from "react";
import type { L1NavigationItem, L2NavigationItem } from "../../app/navigation";
import type { AppRoute } from "../../app/route";
import { t } from "../../locale";
import { AppBrand } from "./AppBrand";
import { LeftNavigation } from "./LeftNavigation";
import { TopNavigation } from "./TopNavigation";
import type { NavigationStatus } from "./TopNavigation";
import { WorkspaceFrame } from "./WorkspaceFrame";

type AppSection = AppRoute["section"];
type SecondaryPage = Extract<AppRoute, { page: string }>["page"];

interface AppShellProps {
  route: AppRoute;
  primaryItems: readonly L1NavigationItem[];
  secondaryItems: readonly L2NavigationItem[];
  onNavigatePrimary: (section: AppSection) => void;
  onNavigateSecondary: (page: SecondaryPage) => void;
  onBackFromSettings: () => void;
  navigationStatuses?: Partial<Record<AppSection, NavigationStatus>>;
  children: ReactNode;
}

function secondaryPage(route: AppRoute): SecondaryPage | null {
  return "page" in route ? route.page : null;
}

function HeaderSettingsButton({
  status,
  onNavigate
}: {
  status?: NavigationStatus;
  onNavigate: (section: AppSection) => void;
}) {
  const label = t("shell.settings");
  return (
    <Tooltip
      label={status ? `${label} · ${status.label}` : label}
      position="bottom"
      withArrow
      arrowSize={5}
      offset={4}
      openDelay={300}
      closeDelay={100}
      events={{ hover: true, focus: true, touch: false }}
      styles={{ tooltip: { padding: "3px 7px", fontSize: 11, lineHeight: 1.2 } }}
    >
      <Indicator
        disabled={!status || status.count === 0}
        label={status && status.count > 99 ? "99+" : status?.count}
        color={status?.color}
        size={16}
        offset={3}
      >
        <ActionIcon
          className="app-header-icon"
          size="lg"
          radius="md"
          variant="transparent"
          color="gray"
          aria-label={status ? `${label}，${status.label}` : label}
          onClick={() => onNavigate("settings")}
        >
          <IconSettings size={22} stroke={1.7} />
        </ActionIcon>
      </Indicator>
    </Tooltip>
  );
}

export function AppShell({
  route,
  primaryItems,
  secondaryItems,
  onNavigatePrimary,
  onNavigateSecondary,
  onBackFromSettings,
  navigationStatuses,
  children
}: AppShellProps) {
  const activeSecondaryPage = secondaryPage(route);
  const hasSecondaryNavigation = secondaryItems.length > 0 && activeSecondaryPage !== null;

  const settingsHeader = route.section === "settings";

  return (
    <Box
      className="app-chrome"
      style={{
        width: "100%",
        height: "100vh",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
      }}
    >
      <Box component="header" style={{ flex: "0 0 88px" }}>
        {settingsHeader ? (
          <Group h="100%" px="md" gap="sm" wrap="nowrap">
            <ActionIcon
              variant="default"
              radius="md"
              size="lg"
              aria-label={t("shell.backToMain")}
              onClick={onBackFromSettings}
            >
              <IconArrowLeft size={20} stroke={1.7} />
            </ActionIcon>
            <Title order={3}>{t("shell.settings")}</Title>
          </Group>
        ) : (
          <Box
            h="100%"
            px="md"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 50% minmax(0, 1fr)",
              alignItems: "center",
              columnGap: "var(--mantine-spacing-md)"
            }}
          >
            <Box style={{ minWidth: 0, justifySelf: "start" }}>
              <Group gap={10} wrap="nowrap">
                <AppBrand />
                <HeaderSettingsButton
                  status={navigationStatuses?.settings}
                  onNavigate={onNavigatePrimary}
                />
              </Group>
            </Box>
            <TopNavigation
              items={primaryItems}
              active={route.section}
              onNavigate={onNavigatePrimary}
              statuses={navigationStatuses}
            />
          </Box>
        )}
      </Box>

      <WorkspaceFrame
        navigation={
          hasSecondaryNavigation ? (
            <LeftNavigation
              items={secondaryItems}
              active={activeSecondaryPage}
              onNavigate={onNavigateSecondary}
            />
          ) : undefined
        }
      >
        {children}
      </WorkspaceFrame>
    </Box>
  );
}
