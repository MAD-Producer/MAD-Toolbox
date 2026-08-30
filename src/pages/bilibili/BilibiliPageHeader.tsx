import { Button, Group } from "@mantine/core";
import { IconCircleCheck, IconPlayerPlay, IconQrcode } from "@tabler/icons-react";
import { DependencyMissingBadge } from "../../components/common/DependencyMissingBadge";
import { HeaderActions } from "../../components/layout/HeaderActions";
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
  const submitLabel = t("bilibili.actions.addToQueue");
  const loginLabel =
    loginPhase === "running" ? t("bilibili.login.waitingScan") : t("bilibili.login.qrLogin");
  return (
    <HeaderActions section="bilibili">
      <Group gap="xs" wrap="nowrap">
        <DependencyMissingBadge labels={dependencyLabels} onOpen={onOpenDependencies} />
        {loggedIn ? (
          <Button
            size="compact-md"
            variant="light"
            color="green"
            leftSection={<IconCircleCheck size={16} />}
            disabled
          >
            {t("bilibili.login.signedIn")}
          </Button>
        ) : (
          <Button
            size="compact-md"
            variant="light"
            leftSection={<IconQrcode size={16} />}
            loading={loginPhase === "starting"}
            disabled={loginPhase !== "idle"}
            onClick={onBeginLogin}
          >
            {loginLabel}
          </Button>
        )}
        <Button
          size="compact-md"
          leftSection={<IconPlayerPlay size={16} />}
          loading={submitting}
          disabled={submitDisabled}
          onClick={onSubmit}
        >
          {submitLabel}
        </Button>
      </Group>
    </HeaderActions>
  );
}
