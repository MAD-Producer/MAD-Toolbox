import { useState } from "react";
import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { IconCircleCheck, IconLogout, IconPlayerPlay, IconQrcode } from "@tabler/icons-react";
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
  onLogout: () => Promise<void>;
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
  onLogout,
  dependencyLabels,
  onOpenDependencies
}: BilibiliPageHeaderProps) {
  const [logoutHovered, setLogoutHovered] = useState(false);
  const [logoutOpened, setLogoutOpened] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const submitLabel = t("bilibili.actions.addToQueue");
  const loginLabel =
    loginPhase === "running" ? t("bilibili.login.waitingScan") : t("bilibili.login.qrLogin");

  const confirmLogout = async () => {
    setLogoutPending(true);
    try {
      await onLogout();
      setLogoutOpened(false);
    } catch {
    } finally {
      setLogoutPending(false);
    }
  };

  return (
    <HeaderActions section="bilibili">
      <Group gap="xs" wrap="nowrap">
        <DependencyMissingBadge labels={dependencyLabels} onOpen={onOpenDependencies} />
        {loggedIn ? (
          <Button
            size="compact-md"
            variant="light"
            color={logoutHovered ? "red" : "green"}
            leftSection={logoutHovered ? <IconLogout size={16} /> : <IconCircleCheck size={16} />}
            onMouseEnter={() => setLogoutHovered(true)}
            onMouseLeave={() => setLogoutHovered(false)}
            onClick={() => setLogoutOpened(true)}
          >
            {logoutHovered ? t("bilibili.login.logout") : t("bilibili.login.signedIn")}
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
      <Modal
        opened={logoutOpened}
        onClose={() => setLogoutOpened(false)}
        title={t("bilibili.login.logoutConfirmTitle")}
        centered
      >
        <Stack gap="md">
          <Text size="sm">{t("bilibili.login.logoutConfirmBody")}</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setLogoutOpened(false)}>
              {t("bilibili.login.logoutCancel")}
            </Button>
            <Button color="red" loading={logoutPending} onClick={() => void confirmLogout()}>
              {t("bilibili.login.logoutConfirm")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </HeaderActions>
  );
}
