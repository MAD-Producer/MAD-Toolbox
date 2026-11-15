import { useEffect, useRef, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { IconUpload } from "@tabler/icons-react";
import { cn } from "../../lib/cn";
import { t } from "../../locale";

interface MediaDropzoneProps {
  onPickFiles: () => Promise<void>;
  onDropPaths: (paths: string[]) => void;
}

/** 文件拖放区：Tauri 拖放事件驱动高亮，点击唤起文件选择 */
export function MediaDropzone({ onPickFiles, onDropPaths }: MediaDropzoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const dropRef = useRef(onDropPaths);

  // latest-ref 模式：让下方的原生拖放订阅只挂载一次，回调始终取最新 prop（转发引用，非隐藏业务状态）
  useEffect(() => {
    dropRef.current = onDropPaths;
  });

  // 【Effect 白名单②】订阅 webview 原生拖放事件（Tauri onDragDropEvent）
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;

    let disposed = false;
    let unlisten: (() => void) | undefined;
    void getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === "drop") {
          setDragActive(false);
          dropRef.current(event.payload.paths);
        } else {
          setDragActive(event.payload.type !== "leave");
        }
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => void onPickFiles()}
      className={cn(
        "flex min-h-[108px] w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-[3px] border-dashed text-center transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        dragActive
          ? "border-primary bg-accent text-accent-foreground"
          : "border-border bg-transparent text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
      )}
    >
      <IconUpload size={30} stroke={1.4} />
      <span className="text-sm font-medium">{t("media.dropzone.hint")}</span>
      <span className="text-xs opacity-75">{t("media.dropzone.clickHint")}</span>
    </button>
  );
}
