import { getCurrentWindow } from "@tauri-apps/api/window";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { shutdownApp } from "../../app/api";
import { t } from "../../locale";

interface CloseGuardDialogProps {
  opened: boolean;
  activeCount: number;
  /** 用户取消关闭：仅收起弹窗 */
  onCancel: () => void;
}

/** 关窗确认弹窗（有活动任务时拦截 onCloseRequested 后打开）。
 * 继续退出走 shutdown_app：后端先尽力取消全部任务再退出进程；
 * 最小化是挂机下载/做种的正解——进程与任务原样保留。 */
export function CloseGuardDialog({ opened, activeCount, onCancel }: CloseGuardDialogProps) {
  const [exiting, setExiting] = useState(false);

  const shutdown = async () => {
    setExiting(true);
    try {
      await shutdownApp();
    } catch {
      // 命令失败时兜底直接关窗（Windows 有 Job Object 兜底杀树）
      void getCurrentWindow().destroy();
    }
  };

  const minimize = () => {
    onCancel();
    void getCurrentWindow().minimize();
  };

  return (
    <Dialog open={opened} onOpenChange={(open) => (!open ? onCancel() : undefined)}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogTitle>{t("app.closeGuard.title")}</DialogTitle>
        <DialogDescription>
          {t("app.closeGuard.description", { count: activeCount })}
        </DialogDescription>
        <DialogFooter className="mt-2 flex-row">
          <Button variant="ghost" onClick={onCancel} disabled={exiting}>
            {t("app.closeGuard.cancel")}
          </Button>
          <Button variant="outline" onClick={minimize} disabled={exiting}>
            {t("app.closeGuard.minimize")}
          </Button>
          <Button variant="destructive" loading={exiting} onClick={() => void shutdown()}>
            {t("app.closeGuard.exit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
