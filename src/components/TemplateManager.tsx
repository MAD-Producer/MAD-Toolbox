import { Check, FolderInput, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { SelectInput, TextInput } from "./Field";

interface SavedTemplate<T> {
  id: string;
  name: string;
  updatedAt: string;
  value: T;
}

interface TemplateManagerProps<T> {
  featureKey: string;
  value: T;
  onApply: (value: T) => void;
}

const STORAGE_PREFIX = "mad-toolbox.setting-templates.v1.";
const LAST_SETTINGS_PREFIX = "mad-toolbox.last-settings.v1.";

function parseTemplates<T>(raw: string | null): SavedTemplate<T>[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        "value" in item
    ) as SavedTemplate<T>[];
  } catch {
    return [];
  }
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function TemplateManager<T>({
  featureKey,
  value,
  onApply
}: TemplateManagerProps<T>) {
  const [templates, setTemplates] = useState<SavedTemplate<T>[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const restoring = useRef(true);
  const loaded = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const latestValue = useRef(value);
  latestValue.current = value;
  const onApplyRef = useRef(onApply);
  onApplyRef.current = onApply;
  const selected = useMemo(
    () => templates.find((item) => item.id === selectedId) ?? null,
    [templates, selectedId]
  );

  useEffect(() => {
    restoring.current = true;
    loaded.current = false;
    try {
      const rawTemplates = window.localStorage.getItem(`${STORAGE_PREFIX}${featureKey}`);
      const rawLast = window.localStorage.getItem(`${LAST_SETTINGS_PREFIX}${featureKey}`);
      const stored = parseTemplates<T>(rawTemplates);
      setTemplates(stored);
      setSelectedId(stored[0]?.id ?? "");
      setName("");
      setFeedback(null);
      if (rawLast) onApplyRef.current(JSON.parse(rawLast) as T);
    } catch {
      setFeedback("无法读取设置，已使用默认值");
    } finally {
      loaded.current = true;
      restoring.current = false;
    }
    return () => {
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current);
      }
      if (loaded.current) {
        window.localStorage.setItem(
          `${LAST_SETTINGS_PREFIX}${featureKey}`,
          JSON.stringify(latestValue.current)
        );
      }
    };
  }, [featureKey]);

  useEffect(() => {
    if (restoring.current || !loaded.current) return;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          `${LAST_SETTINGS_PREFIX}${featureKey}`,
          JSON.stringify(latestValue.current)
        );
      } catch {
        setFeedback("无法保存上次设置");
      }
      saveTimer.current = null;
    }, 500);
  }, [featureKey, value]);

  const persist = (next: SavedTemplate<T>[]) => {
    setTemplates(next);
    try {
      window.localStorage.setItem(`${STORAGE_PREFIX}${featureKey}`, JSON.stringify(next));
    } catch {
      setFeedback("无法保存模板");
    }
  };

  const save = () => {
    const templateName = name.trim();
    if (!templateName) {
      setFeedback("请填写模板名称");
      return;
    }
    const existing = templates.find(
      (item) => item.name.toLocaleLowerCase() === templateName.toLocaleLowerCase()
    );
    const saved: SavedTemplate<T> = {
      id:
        existing?.id ??
        `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: templateName,
      updatedAt: new Date().toISOString(),
      value: cloneValue(value)
    };
    const next = existing
      ? templates.map((item) => (item.id === existing.id ? saved : item))
      : [...templates, saved];
    persist(next);
    setSelectedId(saved.id);
    setName("");
    setFeedback(existing ? "已更新同名模板" : "模板已保存");
  };

  const load = () => {
    if (!selected) {
      setFeedback("请先选择模板");
      return;
    }
    onApply(cloneValue(selected.value));
    setFeedback(`已载入“${selected.name}”`);
  };

  const remove = () => {
    if (!selected) return;
    const next = templates.filter((item) => item.id !== selected.id);
    persist(next);
    setSelectedId(next[0]?.id ?? "");
    setFeedback(`已删除“${selected.name}”`);
  };

  return (
    <section className="template-manager">
      <div className="template-heading">
        <div>
          <strong>设置模板</strong>
          <span>自动保存上次参数，也可创建多个常用设置模板；不会保存链接或输入文件。</span>
        </div>
        {feedback && (
          <span className="template-feedback">
            <Check size={13} />
            {feedback}
          </span>
        )}
      </div>
      <div className="template-controls">
        <SelectInput
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          aria-label="选择设置模板"
        >
          <option value="">选择已保存模板</option>
          {templates.map((item) => (
            <option value={item.id} key={item.id}>
              {item.name}
            </option>
          ))}
        </SelectInput>
        <button
          className="secondary-button"
          type="button"
          disabled={!selected}
          onClick={load}
        >
          <FolderInput size={15} />
          载入
        </button>
        <button
          className="icon-button"
          type="button"
          title="删除当前模板"
          disabled={!selected}
          onClick={remove}
        >
          <Trash2 size={15} />
        </button>
        <TextInput
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") save();
          }}
          placeholder="新模板名称"
          aria-label="新模板名称"
        />
        <button className="primary-button" type="button" onClick={save}>
          <Save size={15} />
          保存当前设置
        </button>
      </div>
    </section>
  );
}
