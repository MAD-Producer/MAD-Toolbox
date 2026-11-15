import { CopyIconButton } from "../../components/common/CopyIconButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "../../components/ui/dialog";
import { ScrollArea } from "../../components/ui/scroll-area";
import { t } from "../../locale";

interface MediaInspectionDialogProps {
  active: boolean;
  summary: string | null;
  onClose: () => void;
}

/** 首文件探测结果弹窗：等宽换行展示摘要，360px 内滚动；与网络探测弹窗同构（描述 + 复制） */
export function MediaInspectionDialog({ active, summary, onClose }: MediaInspectionDialogProps) {
  return (
    <Dialog open={active && summary !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("media.inspection.title")}</DialogTitle>
          <DialogDescription>{t("media.inspection.description")}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[360px] [&>[data-radix-scroll-area-viewport]]:max-h-[360px]">
          <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed">
            {summary}
          </pre>
        </ScrollArea>
        {summary ? (
          <div className="flex justify-end">
            <CopyIconButton value={summary} label={t("common.copy")} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
