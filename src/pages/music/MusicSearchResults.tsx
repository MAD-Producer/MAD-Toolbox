import { DownloadSimple } from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction
} from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Chip } from "../../components/ui/chip";
import { t } from "../../locale";
import type { MusicdlSearchResponse, MusicdlSearchResult } from "./api";
import { musicSourceLabel } from "./configuration";
import type { MusicSessionPhase } from "../../stores/music-session";

function resultFormat(result: MusicdlSearchResult): string {
  return (result.extension || result.codec || t("music.format.unknown")).toLowerCase();
}

const DOWNSAMPLE_TARGET_RATE = 48000;
const CLEAR_ARM_RESET_MS = 3000;

function denoiseEstimate(result: MusicdlSearchResult, enabled: boolean): string | null {
  if (!enabled) return null;
  const { sampleRate, fileSizeBytes, fileSize } = result;
  if (!sampleRate || sampleRate <= DOWNSAMPLE_TARGET_RATE) return null;
  let bytes = fileSizeBytes;
  if (bytes == null) {
    const parsed = /([\d.]+)\s*MB/i.exec(fileSize);
    if (!parsed) return null;
    bytes = Number.parseFloat(parsed[1]) * 1024 * 1024;
  }
  const megabytes = ((bytes * DOWNSAMPLE_TARGET_RATE) / sampleRate / 1024 / 1024).toFixed(1);
  return t("music.denoise.estimate", { size: megabytes });
}

interface MusicSearchResultsProps {
  response: MusicdlSearchResponse;
  selected: number[];
  queuedIndices: number[];
  sessionPhase: MusicSessionPhase;
  taskSubmitting: boolean;
  denoise: boolean;
  onSelectedChange: Dispatch<SetStateAction<number[]>>;
  onDownload: () => void;
  onEndSession: () => void;
}

export function MusicSearchResults({
  response,
  selected,
  queuedIndices,
  sessionPhase,
  taskSubmitting,
  denoise,
  onSelectedChange,
  onDownload,
  onEndSession
}: MusicSearchResultsProps) {
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const queuedSet = useMemo(() => new Set(queuedIndices), [queuedIndices]);

  const [formats, setFormats] = useState<string[]>([]);

  // 清空结果两步确认：首击变为确认态，3 秒无操作自动还原（对齐 tasks.clearHistory 模式）
  const [clearArmed, setClearArmed] = useState(false);
  const clearTimer = useRef<number | null>(null);
  const disarmClear = useCallback(() => {
    setClearArmed(false);
    if (clearTimer.current !== null) {
      window.clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }
  }, []);
  useEffect(() => disarmClear, [disarmClear]);

  const handleClear = () => {
    if (!clearArmed) {
      setClearArmed(true);
      if (clearTimer.current !== null) window.clearTimeout(clearTimer.current);
      clearTimer.current = window.setTimeout(() => setClearArmed(false), CLEAR_ARM_RESET_MS);
      return;
    }
    disarmClear();
    onEndSession();
  };

  const formatCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const result of response.results) {
      const format = resultFormat(result);
      counts.set(format, (counts.get(format) ?? 0) + 1);
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1]);
  }, [response.results]);

  const visibleResults = useMemo(
    () =>
      formats.length
        ? response.results.filter((result) => formats.includes(resultFormat(result)))
        : response.results,
    [response.results, formats]
  );
  const allVisibleSelected =
    visibleResults.length > 0 && visibleResults.every((result) => selectedSet.has(result.index));

  const toggleResult = (index: number) => {
    onSelectedChange((current) =>
      current.includes(index) ? current.filter((value) => value !== index) : [...current, index]
    );
  };

  const toggleFormat = (format: string) => {
    setFormats((current) =>
      current.includes(format) ? current.filter((value) => value !== format) : [...current, format]
    );
  };

  const toggleSelectVisible = () => {
    const visibleIndices = visibleResults.map((result) => result.index);
    if (allVisibleSelected) {
      const visible = new Set(visibleIndices);
      onSelectedChange((current) => current.filter((value) => !visible.has(value)));
      return;
    }
    onSelectedChange((current) =>
      [...new Set([...current, ...visibleIndices])].sort((a, b) => a - b)
    );
  };

  const selectVisibleLossless = () => {
    // 与全选同口径：只作用于当前格式筛选可见的行，避免静默选中被筛掉的条目
    onSelectedChange(
      visibleResults.filter((result) => result.lossless).map((result) => result.index)
    );
  };

  const hasStats = selected.length > 0 || queuedIndices.length > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {formats.length
            ? t("music.results.range", {
                visible: visibleResults.length,
                total: response.results.length
              })
            : t("music.results.count", { count: response.results.length })}
          {hasStats
            ? ` ${t("music.results.stats", { selected: selected.length, queued: queuedIndices.length })}`
            : ""}
        </p>
        <div className="flex items-center gap-2">
          {clearArmed ? (
            <Button
              size="sm"
              variant="destructive"
              className="h-8 gap-1.5 px-2 text-xs"
              onClick={handleClear}
            >
              {t("music.results.clearConfirm", { count: response.results.length })}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2 text-xs text-destructive hover:bg-destructive/10"
              disabled={sessionPhase !== "ready" || taskSubmitting}
              onClick={handleClear}
            >
              {t("music.results.clear")}
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            className="h-8 gap-1.5 px-2 text-xs"
            onClick={toggleSelectVisible}
          >
            {allVisibleSelected ? t("music.results.deselectAll") : t("music.results.selectAll")}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-8 gap-1.5 px-2 text-xs"
            onClick={selectVisibleLossless}
          >
            {t("music.results.losslessOnly")}
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5 px-2 text-xs"
            leftSection={<DownloadSimple size={14} />}
            disabled={!selected.length || taskSubmitting || sessionPhase !== "ready"}
            loading={taskSubmitting}
            onClick={onDownload}
          >
            {t("music.download.selected")}
          </Button>
        </div>
      </div>
      {formatCounts.length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          {formatCounts.map(([format, count]) => (
            <Chip
              key={format}
              selected={formats.includes(format)}
              onClick={() => toggleFormat(format)}
            >
              {format} · {count}
            </Chip>
          ))}
        </div>
      ) : null}
      {response.results.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("music.results.noneFound")}</p>
      ) : visibleResults.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("music.results.formatFilteredEmpty")}</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {visibleResults.map((result) => {
              const checked = selectedSet.has(result.index);
              const queued = queuedSet.has(result.index);
              const estimate = denoiseEstimate(result, denoise);
              return (
                <tr
                  key={`${result.source}-${result.index}`}
                  className="cursor-pointer border-b border-border/60 transition-colors last:border-b-0 hover:bg-secondary/40"
                  onClick={() => toggleResult(result.index)}
                >
                  <td className="w-9 py-1.5 pl-1 align-middle">
                    <Checkbox
                      aria-label={`${result.songName} · ${result.singers} · ${musicSourceLabel(result.source)}`}
                      checked={checked}
                      onCheckedChange={() => toggleResult(result.index)}
                      onClick={(event) => event.stopPropagation()}
                    />
                  </td>
                  <td className="py-1.5 align-middle">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{result.songName}</span>
                      {queued ? (
                        <Badge variant="primary" className="px-2 py-0 text-[11px]">
                          {t("music.results.queued")}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {result.singers}
                      {result.album ? ` · ${result.album}` : ""}
                    </p>
                  </td>
                  <td className="w-[230px] py-1.5 align-middle">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      {estimate ? (
                        <span className="text-xs text-muted-foreground">{estimate}</span>
                      ) : null}
                      <Badge
                        variant={result.lossless ? "success" : "default"}
                        className="px-2 py-0 text-[11px]"
                      >
                        {result.extension || result.codec || t("music.format.unknown")}
                        {result.bitrate ? ` · ${Math.round(result.bitrate / 1000)}k` : ""}
                      </Badge>
                    </div>
                  </td>
                  <td className="w-[160px] py-1.5 align-middle">
                    <p className="text-xs">{musicSourceLabel(result.source)}</p>
                    <p className="text-xs text-muted-foreground">
                      {[result.fileSize, result.duration].filter(Boolean).join(" · ")}
                    </p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
