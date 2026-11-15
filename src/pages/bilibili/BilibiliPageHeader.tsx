import { CheckCircle, SignOut, Play, QrCode } from "@phosphor-icons/react";
import { useState } from "react";
import { DependencyMissingBadge } from "../../components/common/DependencyMissingBadge";
import { PageToolbar } from "../../components/common/PageToolbar";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "../../components/ui/dialog";
import { Tooltip } from "../../components/ui/tooltip";
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

/**
 * 已登录指示 + 登出入口：文案恒为"登出"（accessible name 稳定），hover/focus
 * 时切换登出图标并转 destructive 语义；语义色只上图标与底色，文字保持默认色
 * （success/destructive 做文字色在浅色下不达 AA，见 D20）。
 */
function LogoutButton({ onLogout }: { onLogout: () => Promise<void> }) {
  const [hovered, setHovered] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const confirmLogout = async () => {
    setPending(true);
    try {
      await onLogout();
      setConfirmOpen(false);
    } catch {
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        className={
          hovered
            ? "h-8 gap-1.5 bg-destructive/10 hover:bg-destructive/10"
            : "h-8 gap-1.5 text-secondary-foreground hover:bg-destructive/10"
        }
        leftSection={
          hovered ? (
            <SignOut size={16} className="text-destructive" />
          ) : (
            <CheckCircle size={16} className="text-success" />
          )
        }
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => setConfirmOpen(true)}
      >
        {t("bilibili.login.logout")}
      </Button>
      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          // 请求进行中禁止 Esc/遮罩关闭——关闭会被读作"取消"，登出却继续执行
          if (pending) return;
          setConfirmOpen(open);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("bilibili.login.logoutConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("bilibili.login.logoutConfirmBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t("bilibili.login.logoutCancel")}
            </Button>
            <Button variant="destructive" loading={pending} onClick={() => void confirmLogout()}>
              {t("bilibili.login.logoutConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

  const submitButton = (
    <Button
      size="sm"
      className="h-8 gap-1.5"
      leftSection={<Play size={16} />}
      loading={submitting}
      disabled={submitDisabled}
      onClick={onSubmit}
    >
      {submitLabel}
    </Button>
  );

  return (
    <PageToolbar>
      <DependencyMissingBadge labels={dependencyLabels} onOpen={onOpenDependencies} />
      {loggedIn ? (
        <LogoutButton onLogout={onLogout} />
      ) : (
        <Button
          size="sm"
          variant="secondary"
          className="h-8 gap-1.5"
          leftSection={<QrCode size={16} />}
          loading={loginPhase === "starting"}
          disabled={loginPhase !== "idle"}
          onClick={onBeginLogin}
        >
          {loginLabel}
        </Button>
      )}
      {submitDisabled && !submitting ? (
        <Tooltip label={t("common.submitWaitingPreview")}>
          <span className="inline-flex">{submitButton}</span>
        </Tooltip>
      ) : (
        submitButton
      )}
    </PageToolbar>
  );
}
