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

function LogoutButton({ onLogout }: { onLogout: () => Promise<void> }) {
  const [hovered, setHovered] = useState(false);
  const [opened, setOpened] = useState(false);
  const [pending, setPending] = useState(false);

  const confirmLogout = async () => {
    setPending(true);
    try {
      await onLogout();
      setOpened(false);
    } catch {
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button
        size="compact-md"
        variant="light"
        color={hovered ? "red" : "green"}
        leftSection={hovered ? <IconLogout size={16} /> : <IconCircleCheck size={16} />}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => setOpened(true)}
      >
        {hovered ? t("bilibili.login.logout") : t("bilibili.login.signedIn")}
      </Button>
      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title={t("bilibili.login.logoutConfirmTitle")}
        centered
      >
        <Stack gap="md">
          <Text size="sm">{t("bilibili.login.logoutConfirmBody")}</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOpened(false)}>
              {t("bilibili.login.logoutCancel")}
            </Button>
            <Button color="red" loading={pending} onClick={() => void confirmLogout()}>
              {t("bilibili.login.logoutConfirm")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
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
  const submitLabel = t("bilibili.actions.addToQueue");
  const loginLabel =
    loginPhase === "running" ? t("bilibili.login.waitingScan") : t("bilibili.login.qrLogin");

  return (
    <HeaderActions section="bilibili">
      <Group gap="xs" wrap="nowrap">
        <DependencyMissingBadge labels={dependencyLabels} onOpen={onOpenDependencies} />
        {loggedIn ? (
          <LogoutButton onLogout={onLogout} />
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
