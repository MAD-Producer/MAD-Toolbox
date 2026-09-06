import { ActionIcon, Box, Button, Group, Indicator, Title, Tooltip } from "@mantine/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  IconArrowLeft,
  IconCircleArrowDown,
  IconMessageReport,
  IconSettings
} from "@tabler/icons-react";
import { useState, type ReactNode } from "react";
import type { L1NavigationItem, L2NavigationItem } from "../../app/navigation";
import type { AppRoute } from "../../app/route";
import { t } from "../../locale";
import { useUpdateStore } from "../../stores/update";
import { AppBrand } from "./AppBrand";
import { HeaderActionsProvider, headerTooltipProps } from "./HeaderActions";
import { LeftNavigation } from "./LeftNavigation";
import { TopNavigation } from "./TopNavigation";
import type { NavigationStatus } from "./TopNavigation";
import { WorkspaceFrame } from "./WorkspaceFrame";

type AppSection = AppRoute["section"];
type SecondaryPage = Extract<AppRoute, { page: string }>["page"];

const FEEDBACK_URL = "https://link.mad.org.cn/r8katw";

interface AppShellProps {
  route: AppRoute;
  primaryItems: readonly L1NavigationItem[];
  secondaryItems: readonly L2NavigationItem[];
  onNavigatePrimary: (section: AppSection) => void;
  onNavigateSecondary: (page: SecondaryPage) => void;
  onBackFromSettings: () => void;
  onOpenUpdatePage?: () => void;
  navigationStatuses?: Partial<Record<AppSection, NavigationStatus>>;
  children: ReactNode;
}

function secondaryPage(route: AppRoute): SecondaryPage | null {
  return "page" in route ? route.page : null;
}

function HeaderSettingsButton({
  status,
  onNavigate,
  onOpenUpdate
}: {
  status?: NavigationStatus;
  onNavigate: (section: AppSection) => void;
  onOpenUpdate?: () => void;
}) {
  const label = t("shell.settings");
  const update = useUpdateStore((state) => state.update);
  const updateLabel = update
    ? t("settings.about.updateFound", { version: update.latestVersion })
    : null;
  return (
    <Group gap={4} wrap="nowrap">
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
            size="36px"
            radius="md"
            variant="transparent"
            color="gray"
            aria-label={status ? `${label}，${status.label}` : label}
            onClick={() => onNavigate("settings")}
          >
            <IconSettings size={20} stroke={1.7} />
          </ActionIcon>
        </Indicator>
      </Tooltip>
      {update && onOpenUpdate && (
        <Tooltip {...headerTooltipProps} label={updateLabel}>
          <ActionIcon
            variant="transparent"
            color="green"
            style={{ color: "var(--app-update-icon-color)" }}
            aria-label={updateLabel ?? undefined}
            onClick={onOpenUpdate}
          >
            <IconCircleArrowDown size={20} stroke={1.7} />
          </ActionIcon>
        </Tooltip>
      )}
    </Group>
  );
}

export function AppShell({
  route,
  primaryItems,
  secondaryItems,
  onNavigatePrimary,
  onNavigateSecondary,
  onBackFromSettings,
  onOpenUpdatePage,
  navigationStatuses,
  children
}: AppShellProps) {
  const activeSecondaryPage = secondaryPage(route);
  const hasSecondaryNavigation = secondaryItems.length > 0 && activeSecondaryPage !== null;

  const settingsHeader = route.section === "settings";
  const [headerActionsEl, setHeaderActionsEl] = useState<HTMLDivElement | null>(null);

  return (
    <HeaderActionsProvider value={headerActionsEl}>
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
        <Box component="header" style={{ flex: "0 0 64px" }}>
          {settingsHeader ? (
            <Group h="100%" px={24} gap="sm" wrap="nowrap">
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
              <Button
                ml="auto"
                variant="default"
                radius="md"
                leftSection={<IconMessageReport size={16} stroke={1.7} />}
                onClick={() => void openUrl(FEEDBACK_URL)}
              >
                {t("shell.feedback")}
              </Button>
            </Group>
          ) : (
            <Box
              h="100%"
              px={24}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
                alignItems: "center",
                columnGap: "var(--mantine-spacing-md)"
              }}
            >
              <Box style={{ minWidth: 0, justifySelf: "start" }}>
                <Group gap={8} wrap="nowrap">
                  <AppBrand />
                  <HeaderSettingsButton
                    status={navigationStatuses?.settings}
                    onNavigate={onNavigatePrimary}
                    onOpenUpdate={onOpenUpdatePage}
                  />
                </Group>
              </Box>
              <TopNavigation
                items={primaryItems}
                active={route.section}
                onNavigate={onNavigatePrimary}
                statuses={navigationStatuses}
              />
              <div
                ref={setHeaderActionsEl}
                className="app-header-actions"
                data-active-section={route.section}
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
    </HeaderActionsProvider>
  );
}
