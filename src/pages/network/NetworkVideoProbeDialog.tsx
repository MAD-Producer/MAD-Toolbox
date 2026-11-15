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
import type { NetworkProbeResult } from "./useNetworkVideoWorkspace";

interface NetworkVideoProbeDialogProps {
  active: boolean;
  result: NetworkProbeResult | null;
  onClose: () => void;
}

/**
 * 探测结果弹窗：等宽换行展示原始输出，最高 420px 内滚动；
 * viewport 与根容器同时限高，内容超出时 Radix 滚动条才生效。
 */
export function NetworkVideoProbeDialog({ active, result, onClose }: NetworkVideoProbeDialogProps) {
  return (
    <Dialog open={active && result !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{result?.title}</DialogTitle>
          <DialogDescription>{t("network.probe.dialogDescription")}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[420px] [&>[data-radix-scroll-area-viewport]]:max-h-[420px]">
          <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed">
            {result?.text}
          </pre>
        </ScrollArea>
        {result?.text ? (
          <div className="flex justify-end">
            <CopyIconButton value={result.text} label={t("common.copy")} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
