import { IconFile, IconX } from "@tabler/icons-react";
import { memo, useRef } from "react";
import { IconButton } from "../../components/ui/icon-button";
import { ScrollArea } from "../../components/ui/scroll-area";
import { t } from "../../locale";

interface MediaFileListProps {
  inputs: readonly string[];
  onRemove: (path: string) => void;
  /** 列表被删空后回调（父级把焦点交回拖放区） */
  onEmptied?: () => void;
}

function fileName(path: string): string {
  const index = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return index === -1 ? path : path.slice(index + 1);
}

/** 所在目录的末段（同名文件来自递归扫描，靠它消歧） */
function parentDir(path: string): string {
  const index = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (index === -1) return "";
  const dir = path.slice(0, index);
  const i = Math.max(dir.lastIndexOf("/"), dir.lastIndexOf("\\"));
  return dir.slice(i + 1);
}

/** 文件清单：280px 内滚动（根与 viewport 双限高滚动条才生效），逐项可移除；删除后焦点落到邻近行 */
export const MediaFileList = memo(function MediaFileList({
  inputs,
  onRemove,
  onEmptied
}: MediaFileListProps) {
  const listRef = useRef<HTMLUListElement>(null);

  const handleRemove = (path: string, index: number) => {
    onRemove(path);
    requestAnimationFrame(() => {
      const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>("li button");
      const next = buttons?.[Math.min(index, (buttons.length ?? 1) - 1)];
      if (next) next.focus();
      else onEmptied?.();
    });
  };

  return (
    <ScrollArea className="max-h-[280px] [&>[data-radix-scroll-area-viewport]]:max-h-[280px]">
      <ul ref={listRef} className="flex flex-col gap-2">
        {inputs.map((path, index) => {
          const name = fileName(path);
          const dir = parentDir(path);
          return (
            <li key={path} className="flex items-center gap-2">
              <IconFile size={16} stroke={1.8} className="shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm">
                <span className="font-medium">{name}</span>
                {dir && <span className="text-xs text-muted-foreground"> {dir}</span>}
              </span>
              <IconButton
                label={
                  dir
                    ? t("media.removeFileAria", { name, dir })
                    : t("media.removeFileAriaNoDir", { name })
                }
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => handleRemove(path, index)}
              >
                <IconX size={16} stroke={1.8} />
              </IconButton>
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
});
