import { useEffect, useState } from "react";
import type { EmblaCarouselType } from "embla-carousel";
import { Carousel } from "@mantine/carousel";
import { ActionIcon, Button, Group, Modal, Stack, Text, ThemeIcon } from "@mantine/core";
import {
  IconChevronLeft,
  IconChevronRight,
  IconFileMusic,
  IconNetwork,
  IconQrcode
} from "@tabler/icons-react";

const DISMISSED_AT_KEY = "mad-toolbox:startup-tips-dismissed-at";

function localDateKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

/** 「今日不再提醒」只在当天生效，次日启动再次弹出 */
export function isStartupTipsDismissedToday(): boolean {
  try {
    return localStorage.getItem(DISMISSED_AT_KEY) === localDateKey();
  } catch {
    return false;
  }
}

interface StartupTipsModalProps {
  opened: boolean;
  onClose: () => void;
}

/**
 * 启动提示：三页轮播，翻页箭头与操作按钮固定在底部一行。
 * 「今日不再提醒」仅在末页可见可点，用户必须翻到末页才能当天免打扰。
 */
export function StartupTipsModal({ opened, onClose }: StartupTipsModalProps) {
  const [embla, setEmbla] = useState<EmblaCarouselType | null>(null);
  const [slide, setSlide] = useState(0);

  // Modal 关闭时内容卸载，但打开动画期间容器宽度可能尚未就绪，须 reInit 才能正确测量滑动宽度
  useEffect(() => {
    if (opened) embla?.reInit();
  }, [opened, embla]);

  const dismissForToday = () => {
    try {
      localStorage.setItem(DISMISSED_AT_KEY, localDateKey());
    } catch {
      // localStorage 不可用（隐私模式等）时退化为仅本次关闭
    }
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="使用提示"
      size={560}
      centered
      withCloseButton={false}
    >
      <Carousel
        slideSize="100%"
        height={240}
        withControls={false}
        emblaOptions={{ loop: false, watchDrag: false }}
        getEmblaApi={setEmbla}
        onSlideChange={setSlide}
      >
        <Carousel.Slide>
          <Stack gap="sm" h="100%" justify="flex-start" pt="sm" px="xl">
            <Group gap="xs">
              <ThemeIcon variant="light" color="orange" size="lg">
                <IconQrcode size={18} />
              </ThemeIcon>
              <Text fw={600}>Bilibili 下载画质与登录状态相关</Text>
            </Group>
            <Text size="sm" c="dimmed">
              Bilibili 视频下载的画质，取决于是否通过界面扫码登录，以及大会员账号的等级。
              未登录时最高只能下载 480P，扫码登录后一般可以下载到 1080P。
            </Text>
            <Text size="sm" c="dimmed">
              哔哩哔哩页右上角的按钮会显示当前登录状态：显示「扫码登录」即代表当前未登录，
              或之前的登录已过期；显示「已登录」则无需重复扫码。
            </Text>
            <Text size="sm" c="dimmed">
              下载时默认选择能够获取到的最高规格画质。
            </Text>
          </Stack>
        </Carousel.Slide>
        <Carousel.Slide>
          <Stack gap="sm" h="100%" justify="flex-start" pt="sm" px="xl">
            <Group gap="xs">
              <ThemeIcon variant="light" color="orange" size="lg">
                <IconNetwork size={18} />
              </ThemeIcon>
              <Text fw={600}>按数据源合理开关系统代理</Text>
            </Group>
            <Text size="sm" c="dimmed">
              系统代理的设置会影响应用发起请求时使用的 IP。
            </Text>
            <Text size="sm" c="dimmed">
              国内服务器的下载任务（如 Bilibili 视频下载、国内音乐源下载）建议关闭代理；
              国外服务器的下载任务（如 YouTube、国外音乐源）建议开启代理。
            </Text>
            <Text size="sm" c="dimmed">
              若代理软件开启了 TUN 模式，相当于所有流量都经过代理，下载国内服务器的任务时建议关闭
              TUN 模式。
            </Text>
          </Stack>
        </Carousel.Slide>
        <Carousel.Slide>
          <Stack gap="sm" h="100%" justify="flex-start" pt="sm" px="xl">
            <Group gap="xs">
              <ThemeIcon variant="light" color="orange" size="lg">
                <IconFileMusic size={18} />
              </ThemeIcon>
              <Text fw={600}>体积偏大的 FLAC 可能是「假无损」</Text>
            </Group>
            <Text size="sm" c="dimmed">
              音乐搜索结果中体积明显偏大的无损文件，可能只是通过升高采样率把体积撑大，
              多出的体积都是无效信息。这是音源站返回的文件本身如此，工具侧无法解决，
              请结合体积与时长自行判断是否下载。
            </Text>
            <Text size="sm" c="dimmed">
              也可以在「音乐下载」页标题旁开启「自动去杂」开关：下载完成后自动把高于 48kHz
              的音频统一降至 48kHz。但受API限制，不保证所有都能探测准确，且少数官方发行版本高于
              48kHz 的音乐音质可能有所影响，请按需取舍。
            </Text>
          </Stack>
        </Carousel.Slide>
      </Carousel>
      {/* 底部控制行：左右圆角矩形翻页箭头分居两侧，「今日不再提醒」居中且仅末页可见。
          visibility 占位保证翻页时控制行高度不跳。 */}
      <Group justify="space-between" align="center" mt="xs">
        <ActionIcon
          variant="default"
          radius="sm"
          w={44}
          h={32}
          disabled={slide === 0}
          onClick={() => embla?.scrollPrev()}
          aria-label="上一页"
        >
          <IconChevronLeft size={18} />
        </ActionIcon>
        <span style={{ visibility: slide === 2 ? "visible" : "hidden" }}>
          <Button variant="light" onClick={dismissForToday}>
            今日不再提醒
          </Button>
        </span>
        <ActionIcon
          variant="default"
          radius="sm"
          w={44}
          h={32}
          disabled={slide === 2}
          onClick={() => embla?.scrollNext()}
          aria-label="下一页"
        >
          <IconChevronRight size={18} />
        </ActionIcon>
      </Group>
    </Modal>
  );
}
