import { useEffect, useRef, useState } from "react";
import { Box, Text } from "@mantine/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { IconUpload } from "@tabler/icons-react";
import { t } from "../../locale";

interface MediaDropzoneProps {
  onPickFiles: () => Promise<void>;
  onDropPaths: (paths: string[]) => void;
}

/**
 * 视觉沿用 Mantine Dropzone 的设计语言，但拖放事件走 Tauri 的 onDragDropEvent：
 * WebView 内 HTML5 drop 被 Tauri 原生层拦截，且 File 对象不含真实路径，
 * 后端执行需要路径，只有原生拖放能同时给出文件与目录的路径。
 */
export function MediaDropzone({ onPickFiles, onDropPaths }: MediaDropzoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const dropRef = useRef(onDropPaths);

  useEffect(() => {
    dropRef.current = onDropPaths;
  });

  useEffect(() => {
    // 纯浏览器预览时没有 Tauri internals，此时只保留点击选择
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
    <Box
      component="button"
      type="button"
      onClick={() => void onPickFiles()}
      aria-label={t("media.dropzone.ariaLabel")}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        width: "100%",
        minHeight: 108,
        font: "inherit",
        textAlign: "center",
        cursor: "pointer",
        borderRadius: "var(--mantine-radius-md)",
        // 常态即粗虚线标识落点，拖拽悬停时高亮为主色
        border: `3px dashed ${
          dragActive ? "var(--mantine-primary-color-filled)" : "var(--mantine-color-default-border)"
        }`,
        background: dragActive ? "var(--mantine-primary-color-light)" : "transparent",
        color: dragActive
          ? "var(--mantine-primary-color-light-color)"
          : "var(--mantine-color-dimmed)",
        transition: "border-color 120ms ease, background-color 120ms ease, color 120ms ease"
      }}
    >
      <IconUpload size={30} stroke={1.4} />
      <Text size="sm" fw={500} c="inherit">
        {t("media.dropzone.hint")}
      </Text>
      <Text size="xs" c="inherit" style={{ opacity: 0.75 }}>
        {t("media.dropzone.clickHint")}
      </Text>
    </Box>
  );
}
