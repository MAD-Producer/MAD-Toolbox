import { SpeakerSlash, Play, Stop } from "@phosphor-icons/react";
import { DependencyMissingBadge } from "../../components/common/DependencyMissingBadge";
import { PageToolbar } from "../../components/common/PageToolbar";
import { Button } from "../../components/ui/button";
import { Switch } from "../../components/ui/switch";
import { Tooltip } from "../../components/ui/tooltip";
import { t } from "../../locale";
import type { MusicMode } from "./configuration";

interface MusicPageHeaderProps {
  mode: MusicMode;
  runLoading: boolean;
  runDisabled: boolean;
  /** 禁用原因（runDisabled 时给 Tooltip 播报；null 表示短暂过渡态不提示） */
  runDisabledReason: string | null;
  onRun: () => void;
  searching: boolean;
  stopping: boolean;
  onStopSearch: () => void;
  denoise: boolean;
  onDenoiseChange: (value: boolean) => void;
  dependencyLabels?: string[];
  onOpenDependencies?: () => void;
}

/** 页头工具栏：去噪 pill 开关 + 运行/停止按钮（与其他域页头一致的 32px 规格） */
export function MusicPageHeader({
  mode,
  runLoading,
  runDisabled,
  runDisabledReason,
  onRun,
  searching,
  stopping,
  onStopSearch,
  denoise,
  onDenoiseChange,
  dependencyLabels,
  onOpenDependencies
}: MusicPageHeaderProps) {
  const runLabel = mode === "search" ? t("music.run.search") : t("music.mode.playlist");
  const runButton = (
    <Button
      size="sm"
      className="h-8 gap-1.5"
      leftSection={<Play size={16} />}
      loading={runLoading}
      disabled={runDisabled}
      onClick={onRun}
    >
      {runLabel}
    </Button>
  );

  return (
    <PageToolbar>
      <DependencyMissingBadge labels={dependencyLabels} onOpen={onOpenDependencies} />
      {/* label 包裹：整颗 pill 都是开关热区；文字可见后不再依赖 Tooltip 提示含义 */}
      <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-2">
        <SpeakerSlash size={16} className="text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{t("music.denoise.label")}</span>
        <Switch checked={denoise} onCheckedChange={onDenoiseChange} />
      </label>
      {searching ? (
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
          leftSection={<Stop size={16} />}
          loading={stopping}
          autoFocus
          onClick={onStopSearch}
        >
          {t("music.stopSearch")}
        </Button>
      ) : runDisabled && runDisabledReason && !runLoading ? (
        <Tooltip label={runDisabledReason}>
          <span className="inline-flex">{runButton}</span>
        </Tooltip>
      ) : (
        runButton
      )}
    </PageToolbar>
  );
}
