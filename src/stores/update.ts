import { create } from "zustand";
import type { UpdateCheck } from "../pages/settings/api";

interface UpdateStore {
  update: UpdateCheck | null;
  downloading: boolean;
  progress: number | null;
  setUpdate: (update: UpdateCheck | null) => void;
  startDownload: () => void;
  finishDownload: () => void;
  setDownloadProgress: (received: number, total: number | null) => void;
}

/**
 * 更新检查与下载状态放在模块级 store：设置页不是驻留工作区，切走即卸载，
 * 页面本地状态会在返回时丢失。
 */
export const useUpdateStore = create<UpdateStore>((set) => ({
  update: null,
  downloading: false,
  progress: null,
  setUpdate: (update) => set({ update }),
  startDownload: () => set({ downloading: true, progress: null }),
  finishDownload: () => set({ downloading: false, progress: null }),
  setDownloadProgress: (received, total) =>
    set({ progress: total && total > 0 ? Math.floor((received / total) * 100) : null })
}));
