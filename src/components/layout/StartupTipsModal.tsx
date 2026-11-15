import useEmblaCarousel from "embla-carousel-react";
import { IconChevronLeft, IconChevronRight, IconFileMusic, IconNetwork, IconQrcode } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { IconButton } from "../ui/icon-button";
import { t } from "../../locale";

const DISMISSED_KEY = "mad-toolbox:startup-tips-dismissed";
const TIPS_LAST_SLIDE = 2;

export function isStartupTipsDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) !== null;
  } catch {
    return false;
  }
}

interface StartupTipsModalProps {
  opened: boolean;
  onClose: () => void;
}

/** 首启提示弹窗：embla 轮播三页（无拖拽，仅按钮翻页），末页出现"不再提示" */
export function StartupTipsModal({ opened, onClose }: StartupTipsModalProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, watchDrag: false });
  const [slide, setSlide] = useState(0);

  const onSelect = useCallback(() => {
    if (emblaApi) setSlide(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  useEffect(() => {
    if (opened) emblaApi?.reInit();
  }, [opened, emblaApi]);

  const dismissForever = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {}
    onClose();
  };

  return (
    <Dialog open={opened} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t("startup.title")}</DialogTitle>
          <DialogDescription>{t("startup.description")}</DialogDescription>
        </DialogHeader>
        <div ref={emblaRef} className="h-60 overflow-hidden">
          <div className="flex h-full">
            <div className="min-w-0 flex-[0_0_100%] overflow-y-auto">
              <div className="flex flex-col gap-3 px-6 pt-2">
                <div className="flex items-center gap-1.5">
                  <IconQrcode size={18} stroke={1.8} className="text-primary" />
                  <p className="font-semibold">{t("startup.bilibiliQuality.title")}</p>
                </div>
                <p className="text-sm text-muted-foreground">{t("startup.bilibiliQuality.p1")}</p>
                <p className="text-sm text-muted-foreground">{t("startup.bilibiliQuality.p2")}</p>
                <p className="text-sm text-muted-foreground">{t("startup.bilibiliQuality.p3")}</p>
              </div>
            </div>
            <div className="min-w-0 flex-[0_0_100%] overflow-y-auto">
              <div className="flex flex-col gap-3 px-6 pt-2">
                <div className="flex items-center gap-1.5">
                  <IconNetwork size={18} stroke={1.8} className="text-primary" />
                  <p className="font-semibold">{t("startup.proxy.title")}</p>
                </div>
                <p className="text-sm text-muted-foreground">{t("startup.proxy.p1")}</p>
                <p className="text-sm text-muted-foreground">{t("startup.proxy.p2")}</p>
                <p className="text-sm text-muted-foreground">{t("startup.proxy.p3")}</p>
              </div>
            </div>
            <div className="min-w-0 flex-[0_0_100%] overflow-y-auto">
              <div className="flex flex-col gap-3 px-6 pt-2">
                <div className="flex items-center gap-1.5">
                  <IconFileMusic size={18} stroke={1.8} className="text-primary" />
                  <p className="font-semibold">{t("startup.flac.title")}</p>
                </div>
                <p className="text-sm text-muted-foreground">{t("startup.flac.p1")}</p>
                <p className="text-sm text-muted-foreground">{t("startup.flac.p2")}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-2.5 flex items-center justify-between">
          <IconButton
            label={t("startup.prev")}
            variant="outline"
            size="sm"
            disabled={slide === 0}
            onClick={() => emblaApi?.scrollPrev()}
          >
            <IconChevronLeft size={18} stroke={1.8} />
          </IconButton>
          {slide === TIPS_LAST_SLIDE ? (
            <Button variant="secondary" className="h-8" onClick={dismissForever}>
              {t("startup.dismiss")}
            </Button>
          ) : (
            <span />
          )}
          <IconButton
            label={t("startup.next")}
            variant="outline"
            size="sm"
            disabled={slide === TIPS_LAST_SLIDE}
            onClick={() => emblaApi?.scrollNext()}
          >
            <IconChevronRight size={18} stroke={1.8} />
          </IconButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
