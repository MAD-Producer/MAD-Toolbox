import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { useState, type ComponentPropsWithRef } from "react";
import { cn } from "../../lib/cn";
import { t } from "../../locale";
import { Input } from "./input";

export type PasswordInputProps = Omit<ComponentPropsWithRef<"input">, "type">;

/** 密码输入框：Input 基础上叠加可见性切换，aria-label 随状态切换（"显示/隐藏内容"） */
export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={cn("pr-9", className)} {...props} />
      <button
        type="button"
        aria-label={visible ? t("common.hideValue") : t("common.showValue")}
        onClick={() => setVisible((value) => !value)}
        className={cn(
          "absolute inset-y-0 right-0.5 my-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors",
          "hover:bg-secondary hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        )}
      >
        {visible ? <IconEyeOff size={16} stroke={1.7} /> : <IconEye size={16} stroke={1.7} />}
      </button>
    </div>
  );
}
