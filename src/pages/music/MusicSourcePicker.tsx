import { IconMusic } from "@tabler/icons-react";
import { useState } from "react";
import { SettingsSection } from "../../components/common/SettingsSection";
import { Button } from "../../components/ui/button";
import { Chip } from "../../components/ui/chip";
import { Separator } from "../../components/ui/separator";
import { t } from "../../locale";
import { DEFAULT_MUSIC_SOURCES, MUSIC_SOURCE_GROUPS } from "./configuration";

interface MusicSourcePickerProps {
  sources: string[];
  onChange: (sources: string[]) => void;
}

/** 音源多选分组：chip 开关（aria-pressed）+ 分组分隔线 + 重置默认 */
export function MusicSourcePicker({ sources, onChange }: MusicSourcePickerProps) {
  const [open, setOpen] = useState(true);

  const toggleSource = (source: string) => {
    onChange(
      sources.includes(source)
        ? sources.filter((value) => value !== source)
        : [...sources, source]
    );
  };

  return (
    <SettingsSection
      icon={<IconMusic size={20} stroke={1.8} />}
      title={t("music.sources.title")}
      action={
        <div className="flex items-center gap-2">
          <span className="text-xs text-primary">
            {t("music.sources.selected", { count: sources.length })}
          </span>
          {/* 重置作用于折叠内容：折叠态看不到列表就不该改它（计数保留） */}
          {open ? (
            <Button
              size="sm"
              variant="secondary"
              className="h-8 gap-1.5 px-2 text-xs"
              onClick={() => onChange([...DEFAULT_MUSIC_SOURCES])}
            >
              {t("music.sources.reset")}
            </Button>
          ) : null}
        </div>
      }
      opened={open}
      onToggle={() => setOpen((value) => !value)}
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">{t("music.sources.hint")}</p>
        {MUSIC_SOURCE_GROUPS.map(([groupKey, entries]) => (
          <div key={groupKey}>
            <div className="mb-3 flex items-center gap-2.5">
              <span className="shrink-0 text-sm font-medium">{t(groupKey)}</span>
              <Separator className="flex-1" />
            </div>
            <div role="group" aria-label={t(groupKey)} className="flex flex-wrap gap-1.5">
              {entries.map(([source, labelKey]) => (
                <Chip
                  key={source}
                  selected={sources.includes(source)}
                  onClick={() => toggleSource(source)}
                >
                  {t(labelKey)}
                </Chip>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}
