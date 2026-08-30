import { useEffect, useRef, useState } from "react";
import { Box, Text } from "@mantine/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { IconUpload } from "@tabler/icons-react";
import { t } from "../../locale";

interface MediaDropzoneProps {
  onPickFiles: () => Promise<void>;
  onDropPaths: (paths: string[]) => void;
}

export function MediaDropzone({ onPickFiles, onDropPaths }: MediaDropzoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const dropRef = useRef(onDropPaths);

  useEffect(() => {
    dropRef.current = onDropPaths;
  });

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
