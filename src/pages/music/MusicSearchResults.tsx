import { Badge, Button, Checkbox, Chip, Group, Stack, Table, Text } from "@mantine/core";
import { IconDownload } from "@tabler/icons-react";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { MusicdlSearchResponse, MusicdlSearchResult } from "./api";
import { musicSourceLabel } from "./configuration";
import type { MusicSessionPhase } from "../../stores/music-session";

function resultFormat(result: MusicdlSearchResult): string {
  return (result.extension || result.codec || "未知格式").toLowerCase();
}

const DOWNSAMPLE_TARGET_RATE = 48000;

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
  return `去杂后约${megabytes}MB`;
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
  useEffect(() => {
    setFormats([]);
  }, [response.sessionId]);

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

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text fw={500}>
          搜索结果
          <Text span size="xs" c="dimmed" ml={8}>
            {formats.length
              ? `${visibleResults.length} / ${response.results.length} 项`
              : `${response.results.length} 项`}{" "}
            · 已选 {selected.length} 项 · 已入队 {queuedIndices.length} 项
          </Text>
        </Text>
        <Group gap="xs">
          <Button
            size="compact-sm"
            variant="subtle"
            color="red"
            loading={sessionPhase === "releasing"}
            disabled={sessionPhase !== "ready" || taskSubmitting}
            onClick={onEndSession}
          >
            清空搜索结果
          </Button>
          <Button size="compact-sm" variant="default" onClick={toggleSelectVisible}>
            {allVisibleSelected ? "取消全选" : "全选"}
          </Button>
          <Button
            size="compact-sm"
            variant="default"
            onClick={() =>
              onSelectedChange(
                response.results.filter((result) => result.lossless).map((result) => result.index)
              )
            }
          >
            只选无损
          </Button>
          <Button
            size="compact-sm"
            leftSection={<IconDownload size={14} />}
            disabled={!selected.length || taskSubmitting || sessionPhase !== "ready"}
            loading={taskSubmitting}
            onClick={onDownload}
          >
            下载所选
          </Button>
        </Group>
      </Group>
      {formatCounts.length > 1 ? (
        <Chip.Group multiple value={formats} onChange={setFormats}>
          <Group gap={6}>
            {formatCounts.map(([format, count]) => (
              <Chip key={format} value={format} size="xs">
                {format} · {count}
              </Chip>
            ))}
          </Group>
        </Chip.Group>
      ) : null}
      {response.results.length === 0 ? (
        <Text size="sm" c="dimmed">
          没有找到音乐，请更换关键词、音乐源或登录 Cookie。
        </Text>
      ) : visibleResults.length === 0 ? (
        <Text size="sm" c="dimmed">
          当前格式筛选没有匹配的结果，取消筛选即可查看全部。
        </Text>
      ) : (
        <Table highlightOnHover verticalSpacing={6}>
          <Table.Tbody>
            {visibleResults.map((result) => {
              const checked = selectedSet.has(result.index);
              const queued = queuedSet.has(result.index);
              const estimate = denoiseEstimate(result, denoise);
              return (
                <Table.Tr
                  key={`${result.source}-${result.index}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => toggleResult(result.index)}
                >
                  <Table.Td w={36}>
                    <Checkbox checked={checked} readOnly tabIndex={-1} />
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Text size="sm" fw={500}>
                        {result.songName}
                      </Text>
                      {queued ? (
                        <Badge size="xs" variant="light" color="blue">
                          已入队
                        </Badge>
                      ) : null}
                    </Group>
                    <Text size="xs" c="dimmed">
                      {result.singers}
                      {result.album ? ` · ${result.album}` : ""}
                    </Text>
                  </Table.Td>
                  {/* 列宽从 140 加宽到 230，为开启去杂时的体积估算留位 */}
                  <Table.Td w={230}>
                    <Group gap="xs" wrap="nowrap">
                      {estimate ? (
                        <Text size="xs" c="dimmed">
                          {estimate}
                        </Text>
                      ) : null}
                      <Badge
                        variant="light"
                        color={result.lossless ? "teal" : "gray"}
                        style={{ textTransform: "none" }}
                      >
                        {result.extension || result.codec || "未知格式"}
                        {result.bitrate ? ` · ${Math.round(result.bitrate / 1000)}k` : ""}
                      </Badge>
                    </Group>
                  </Table.Td>
                  <Table.Td w={160}>
                    <Text size="xs">{musicSourceLabel(result.source)}</Text>
                    <Text size="xs" c="dimmed">
                      {[result.fileSize, result.duration].filter(Boolean).join(" · ")}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
