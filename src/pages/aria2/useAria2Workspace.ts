import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";
import type { CookieFileOption, TaskIntent, TaskSeed } from "../../contracts/types";
import { parseExpertArgv, useDraftPreviewWorkspace } from "../../hooks/useDraftPreviewWorkspace";
import { notifications } from "../../lib/notifications";
import { loadStoredForm, saveStoredForm } from "../../lib/formStorage";
import { t } from "../../locale";
import { aria2Preview, aria2Submit, aria2TrackerList, type TrackerListResult } from "./api";
import { defaultAria2Form, type Aria2FormState, type TrackerSource } from "./form";

const ARIA2_FORM_STORAGE_KEY = "aria2.form";

// 这四个字段后端是 u32：小数/负数会让 serde 反序列化直接失败（预览/提交均报错），
// 录入侧先收敛为非负整数，再交给失焦 clamp
const INTEGER_FIELDS = [
  "split",
  "maxConnectionPerServer",
  "btMaxPeers",
  "seedTimeMinutes"
] as const;

/** 组装意图数据：只携带当前来源的源字段，另一侧清空（后端 torrentFile 优先于 uri）。
 * 返回类型保持推断的匿名对象——接口类型没有隐式索引签名，赋不过 TaskIntent["data"]。 */
function intentData(form: Aria2FormState) {
  return {
    ...form,
    uri: form.source === "uri" ? form.uri : "",
    torrentFile: form.source === "torrent" ? form.torrentFile : ""
  };
}

export interface Aria2PageProps {
  active: boolean;
  seed?: TaskSeed | null;
  onRetain?: () => void;
  onSubmitted?: () => void;
  dependencyLabels?: string[];
  onOpenDependencies?: () => void;
  globalProxy?: string | null;
  cookieFiles: CookieFileOption[];
  onAddCookieFile?: () => void;
}

export function useAria2Workspace({ active, seed, onRetain, onSubmitted }: Aria2PageProps) {
  // 任务种子只在挂载时消费一次（deliver → generation+1 → 重挂）；无种子时读持久化草稿
  const [form, setForm] = useState<Aria2FormState>(() => {
    if (seed?.task.intent.type === "form") {
      const saved = seed.task.intent.data as Partial<Aria2FormState>;
      return {
        ...defaultAria2Form,
        ...saved,
        source: saved.source ?? (saved.torrentFile ? "torrent" : "uri")
      };
    }
    return {
      ...loadStoredForm(ARIA2_FORM_STORAGE_KEY, defaultAria2Form),
      uri: "",
      torrentFile: "",
      allProxy: "",
      header: "",
      referer: ""
    };
  });
  const [advancedOpen, setAdvancedOpen] = useState(seed != null);
  const toggleAdvanced = useCallback(() => setAdvancedOpen((open) => !open), []);
  const [submitting, setSubmitting] = useState(false);
  const [trackerInfo, setTrackerInfo] = useState<TrackerListResult | null>(null);
  const [trackerLoading, setTrackerLoading] = useState(false);

  const buildPreviewIntent = useCallback(
    (): TaskIntent => ({ type: "form", data: intentData(form) }),
    [form]
  );
  const draft = useDraftPreviewWorkspace({
    active,
    onRetain,
    initialExpertText:
      seed?.task.intent.type === "manual" ? seed.task.intent.data.argv.join("\n") : null,
    buildPreviewIntent,
    runPreview: aria2Preview
  });

  const update = (patch: Partial<Aria2FormState>) => {
    draft.reviseDraft();
    setForm((current) => {
      const next = { ...current, ...patch };
      for (const key of INTEGER_FIELDS) {
        const value = next[key];
        if (typeof value === "number" && (!Number.isInteger(value) || value < 0)) {
          next[key] = Math.max(0, Math.trunc(value));
        }
      }
      return next;
    });
  };

  // 【Effect 白名单⑤】表单草稿持久化到 localStorage（同 network 工作区）
  useEffect(() => {
    saveStoredForm(ARIA2_FORM_STORAGE_KEY, {
      ...form,
      uri: "",
      torrentFile: "",
      allProxy: "",
      header: "",
      referer: ""
    });
  }, [form]);

  const loadTrackers = useCallback(
    async (source: TrackerSource, refresh: boolean) => {
      const requestedRevision = draft.draftRevisionRef.current;
      setTrackerLoading(true);
      try {
        const result = await aria2TrackerList(source, refresh);
        if (draft.draftRevisionRef.current === requestedRevision) setTrackerInfo(result);
      } catch (error) {
        if (draft.draftRevisionRef.current === requestedRevision) {
          notifications.show({ color: "red", message: String(error) });
        }
      } finally {
        setTrackerLoading(false);
      }
    },
    // draftRevisionRef 是 ref；draft 容器每次渲染都是新对象，回调因此每次渲染重建
    // （代价可忽略），写 [draft] 是为通过 exhaustive-deps
    [draft]
  );

  // 【Effect 白名单⑤】页面激活时预取 tracker 列表状态（缓存优先，过期才拉网），
  // 供高级区展示"已加载 N 条"；与防抖预览同类的持续同步路径
  useEffect(() => {
    if (!active) return;
    void loadTrackers(form.trackerSource, false);
    // 只在首次激活时预取；切换来源由 selectTrackerSource 显式触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const refreshTrackers = () => loadTrackers(form.trackerSource, true);

  // 切换来源即拉新列表：提示行必须与表单当前来源一致，否则与命令预览互相矛盾
  const selectTrackerSource = (source: TrackerSource) => {
    update({ trackerSource: source });
    void loadTrackers(source, false);
  };

  const submit = async () => {
    const submittedRevision = draft.draftRevisionRef.current;
    const intent: TaskIntent =
      draft.expertText !== null
        ? { type: "manual", data: { argv: parseExpertArgv(draft.expertText) } }
        : { type: "form", data: intentData(form) };
    onRetain?.();
    setSubmitting(true);
    try {
      await aria2Submit(intent);
      notifications.show({ color: "green", message: t("aria2.submitted") });
      if (draft.draftRevisionRef.current === submittedRevision) onSubmitted?.();
    } catch (error) {
      notifications.show({ color: "red", message: String(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const pickOutputDirectory = async () => {
    const directory = await openDialog({ directory: true });
    if (typeof directory === "string") update({ outputDirectory: directory });
  };

  const pickCookieFile = async () => {
    const file = await openDialog({ multiple: false, directory: false });
    if (typeof file === "string") update({ cookiesFile: file });
  };

  const pickTorrentFile = async () => {
    const file = await openDialog({
      multiple: false,
      directory: false,
      filters: [{ name: "Torrent", extensions: ["torrent"] }]
    });
    if (typeof file === "string") update({ torrentFile: file });
  };

  return {
    active,
    form,
    update,
    advancedOpen,
    toggleAdvanced,
    expertMode: draft.expertText !== null,
    expertText: draft.expertText,
    setExpertText: draft.setExpertText,
    enterExpert: draft.enterExpert,
    preview: draft.preview,
    previewError: draft.previewError,
    submitting,
    submit,
    trackerInfo,
    trackerLoading,
    refreshTrackers,
    selectTrackerSource,
    pickOutputDirectory,
    pickCookieFile,
    pickTorrentFile
  };
}
