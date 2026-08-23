import { Button, Group, Title } from "@mantine/core";
import { IconCircleCheck, IconPlayerPlay, IconQrcode } from "@tabler/icons-react";
import { DependencyMissingBadge } from "../../components/common/DependencyMissingBadge";
import { t } from "../../locale";

interface BilibiliPageHeaderProps {
  loginPhase: "idle" | "starting" | "running";
  loggedIn: boolean;
  submitting: boolean;
  submitDisabled: boolean;
  onSubmit: () => void;
  onBeginLogin: () => void;
  dependencyLabels?: string[];
  onOpenDependencies?: () => void;
}

export function BilibiliPageHeader({
  loginPhase,
  loggedIn,
  submitting,
  submitDisabled,
  onSubmit,
  onBeginLogin,
  dependencyLabels,
  onOpenDependencies
}: BilibiliPageHeaderProps) {
  return (
    <Group justify="space-between" wrap="nowrap">
      <Group gap="xs" wrap="nowrap">
        <Title order={3}>{t("bilibili.title")}</Title>
        <DependencyMissingBadge labels={dependencyLabels} onOpen={onOpenDependencies} />
      </Group>
      <Group gap="xs" wrap="nowrap">
        <Button
          leftSection={<IconPlayerPlay size={16} />}
          loading={submitting}
          disabled={submitDisabled}
          onClick={onSubmit}
        >
          {t("bilibili.actions.addToQueue")}
        </Button>
        {loggedIn ? (
          <Button
            variant="light"
            color="green"
            leftSection={<IconCircleCheck size={16} />}
            disabled
          >
            {t("bilibili.login.signedIn")}
          </Button>
        ) : (
          <Button
            variant="light"
            leftSection={<IconQrcode size={16} />}
            loading={loginPhase === "starting"}
            disabled={loginPhase !== "idle"}
            onClick={onBeginLogin}
          >
            {loginPhase === "running"
              ? t("bilibili.login.waitingScan")
              : t("bilibili.login.qrLogin")}
          </Button>
        )}
      </Group>
    </Group>
  );
}
