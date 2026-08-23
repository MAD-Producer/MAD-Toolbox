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
import { t } from "../../locale";

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
      title={t("startup.title")}
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
              <Text fw={600}>{t("startup.bilibiliQuality.title")}</Text>
            </Group>
            <Text size="sm" c="dimmed">
              {t("startup.bilibiliQuality.p1")}
            </Text>
            <Text size="sm" c="dimmed">
              {t("startup.bilibiliQuality.p2")}
            </Text>
            <Text size="sm" c="dimmed">
              {t("startup.bilibiliQuality.p3")}
            </Text>
          </Stack>
        </Carousel.Slide>
        <Carousel.Slide>
          <Stack gap="sm" h="100%" justify="flex-start" pt="sm" px="xl">
            <Group gap="xs">
              <ThemeIcon variant="light" color="orange" size="lg">
                <IconNetwork size={18} />
              </ThemeIcon>
              <Text fw={600}>{t("startup.proxy.title")}</Text>
            </Group>
            <Text size="sm" c="dimmed">
              {t("startup.proxy.p1")}
            </Text>
            <Text size="sm" c="dimmed">
              {t("startup.proxy.p2")}
            </Text>
            <Text size="sm" c="dimmed">
              {t("startup.proxy.p3")}
            </Text>
          </Stack>
        </Carousel.Slide>
        <Carousel.Slide>
          <Stack gap="sm" h="100%" justify="flex-start" pt="sm" px="xl">
            <Group gap="xs">
              <ThemeIcon variant="light" color="orange" size="lg">
                <IconFileMusic size={18} />
              </ThemeIcon>
              <Text fw={600}>{t("startup.flac.title")}</Text>
            </Group>
            <Text size="sm" c="dimmed">
              {t("startup.flac.p1")}
            </Text>
            <Text size="sm" c="dimmed">
              {t("startup.flac.p2")}
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
          aria-label={t("startup.prev")}
        >
          <IconChevronLeft size={18} />
        </ActionIcon>
        <span style={{ visibility: slide === 2 ? "visible" : "hidden" }}>
          <Button variant="light" onClick={dismissForToday}>
            {t("startup.dismissToday")}
          </Button>
        </span>
        <ActionIcon
          variant="default"
          radius="sm"
          w={44}
          h={32}
          disabled={slide === 2}
          onClick={() => embla?.scrollNext()}
          aria-label={t("startup.next")}
        >
          <IconChevronRight size={18} />
        </ActionIcon>
      </Group>
    </Modal>
  );
}
