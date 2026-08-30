import { create } from "zustand";
import type { UpdateCheck } from "../pages/settings/api";

interface UpdateStore {
  update: UpdateCheck | null;
  setUpdate: (update: UpdateCheck | null) => void;
}

/**
 * 更新检查结果放在模块级 store：设置页不是驻留工作区，切走即卸载，
 * 页面本地状态会在返回时丢失（About 页图标回退为"检查更新"）。
 */
export const useUpdateStore = create<UpdateStore>((set) => ({
  update: null,
  setUpdate: (update) => set({ update })
}));
