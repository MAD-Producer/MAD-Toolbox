import { useEffect, useState } from "react";
import type { EmblaCarouselType } from "embla-carousel";
import { Carousel } from "@mantine/carousel";
import {
  ActionIcon,
  Button,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon
} from "@mantine/core";
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

export function StartupTipsModal({ opened, onClose }: StartupTipsModalProps) {
  const [embla, setEmbla] = useState<EmblaCarouselType | null>(null);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (opened) embla?.reInit();
  }, [opened, embla]);

  const dismissForToday = () => {
    try {
      localStorage.setItem(DISMISSED_AT_KEY, localDateKey());
    } catch {}
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title={t("startup.title")} size={560} centered>
      <Carousel
        slideSize="100%"
        height={240}
        withControls={false}
        emblaOptions={{ loop: false, watchDrag: false }}
        getEmblaApi={setEmbla}
        onSlideChange={setSlide}
      >
        <Carousel.Slide>
          <ScrollArea h="100%" type="never">
            <Stack gap="sm" pt="sm" px="xl">
              <Group gap="xs">
                <ThemeIcon variant="transparent" color="blue" size="lg">
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
          </ScrollArea>
        </Carousel.Slide>
        <Carousel.Slide>
          <ScrollArea h="100%" type="never">
            <Stack gap="sm" pt="sm" px="xl">
              <Group gap="xs">
                <ThemeIcon variant="transparent" color="blue" size="lg">
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
          </ScrollArea>
        </Carousel.Slide>
        <Carousel.Slide>
          <ScrollArea h="100%" type="never">
            <Stack gap="sm" pt="sm" px="xl">
              <Group gap="xs">
                <ThemeIcon variant="transparent" color="blue" size="lg">
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
          </ScrollArea>
        </Carousel.Slide>
      </Carousel>

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
