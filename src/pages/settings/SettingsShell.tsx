import { Stack } from "@mantine/core";
import type { ReactNode } from "react";
import { SETTINGS_L2_NAVIGATION } from "../../app/navigation";
import type { SettingsPageId } from "../../app/route";
import { L2TabNav } from "../../components/common/L2TabNav";
import { t } from "../../locale";

interface SettingsShellProps {
  page: SettingsPageId;
  onNavigatePage: (page: SettingsPageId) => void;
  missingDependencies?: number;
  children: ReactNode;
}

export function SettingsShell({
  page,
  onNavigatePage,
  missingDependencies,
  children
}: SettingsShellProps) {
  return (
    <Stack gap="lg" p="md">
      <L2TabNav
        items={SETTINGS_L2_NAVIGATION.map(({ page: id, labelKey }) => ({
          page: id,
          label: t(labelKey)
        }))}
        value={page}
        onChange={onNavigatePage}
        badges={
          missingDependencies && missingDependencies > 0
            ? { dependencies: missingDependencies }
            : undefined
        }
        aria-label={t("settings.shell.sectionAria")}
      />
      {children}
    </Stack>
  );
}
