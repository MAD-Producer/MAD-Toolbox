import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "../../components/ui/dialog";
import { t } from "../../locale";

interface BilibiliLoginDialogProps {
  active: boolean;
  qrDataUrl: string | null;
  onClose: () => void;
}

const QR_SIZE = 280;

/** 扫码登录弹窗：QR 图 + 弱化提示 */
export function BilibiliLoginDialog({ active, qrDataUrl, onClose }: BilibiliLoginDialogProps) {
  return (
    <Dialog open={active && qrDataUrl !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("bilibili.login.title")}</DialogTitle>
          <DialogDescription>{t("bilibili.login.hint")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          {qrDataUrl && (
            <img src={qrDataUrl} alt={t("bilibili.login.qrAlt")} width={QR_SIZE} height={QR_SIZE} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
