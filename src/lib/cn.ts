import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind class 组合工具：条件拼接 + 冲突去重（后者优先） */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
