import { Info, Moon, Gear, Sun, X } from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";
import { useColorScheme } from "../../lib/theme";
import { cn } from "../../lib/cn";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Chip } from "../ui/chip";
import { NumberField } from "../ui/number-field";
import { Segmented } from "../ui/segmented";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "../ui/dialog";
import { IconButton } from "../ui/icon-button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Progress } from "../ui/progress";
import { ScrollArea } from "../ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Separator } from "../ui/separator";
import { Switch } from "../ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Tooltip } from "../ui/tooltip";

/** 语义 token 色板（类名必须以字面量出现在源码中，Tailwind 才能生成） */
const TOKEN_SWATCHES = [
  { name: "background", className: "bg-background" },
  { name: "foreground", className: "bg-foreground" },
  { name: "card", className: "bg-card" },
  { name: "primary", className: "bg-primary" },
  { name: "secondary", className: "bg-secondary" },
  { name: "muted", className: "bg-muted" },
  { name: "accent", className: "bg-accent" },
  { name: "destructive", className: "bg-destructive" },
  { name: "border", className: "bg-border" },
  { name: "success", className: "bg-success" },
  { name: "warning", className: "bg-warning" },
  { name: "info", className: "bg-info" },
  { name: "sidebar", className: "bg-sidebar" }
] as const;

const BUTTON_VARIANTS = ["primary", "secondary", "outline", "ghost", "destructive"] as const;
const BUTTON_SIZES = ["sm", "md", "lg"] as const;
const RADII = ["rounded-sm", "rounded-md", "rounded-lg", "rounded-xl"] as const;
const BADGE_VARIANTS = ["default", "primary", "solid", "success", "warning", "error"] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Design System 样式指南面板（开发用）。
 * Ctrl+Shift+U 切换显隐；不接入应用路由，由 App 侧自行挂载。
 */
export default function StyleguideLayer() {
  const [open, setOpen] = useState(false);
  const { resolvedColorScheme, setColorScheme } = useColorScheme();
  const [switchA, setSwitchA] = useState(true);
  const [switchB, setSwitchB] = useState(false);
  const [fruit, setFruit] = useState("banana");
  const [tab, setTab] = useState("overview");
  const [checkboxA, setCheckboxA] = useState(true);
  const [chips, setChips] = useState<string[]>(["1080P"]);
  const [quality, setQuality] = useState<"high" | "low">("high");
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "u") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!open) return null;

  const toggleTheme = () => setColorScheme(resolvedColorScheme === "dark" ? "light" : "dark");

  return (
    <div className="fixed inset-0 z-[9999] overflow-auto bg-background p-8 text-foreground">
      {/* 顶部工具条 */}
      <div className="sticky top-0 z-10 -mx-8 mb-8 flex items-center justify-between gap-4 border-b border-border bg-background/90 px-8 py-4 backdrop-blur">
        <h1 className="text-base font-semibold">MAD Toolbox Design System</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={toggleTheme}
            leftSection={resolvedColorScheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          >
            {resolvedColorScheme === "dark" ? "切换到浅色" : "切换到深色"}
          </Button>
          <IconButton label="关闭样式指南" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            <X size={16} />
          </IconButton>
        </div>
      </div>

      <div className="mx-auto max-w-5xl">
        {/* ① Token 色板 */}
        <Section title="Token 色板">
          <div className="grid grid-cols-4 gap-3 md:grid-cols-6">
            {TOKEN_SWATCHES.map((token) => (
              <div key={token.name} className="flex flex-col gap-1.5">
                <div className="h-12 overflow-hidden rounded-lg border border-border bg-card">
                  <div className={cn("size-full rounded-[inherit]", token.className)} />
                </div>
                <span className="text-xs text-muted-foreground">{token.name}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ② 圆角 */}
        <Section title="圆角">
          <div className="flex items-end gap-6">
            {RADII.map((radius) => (
              <div key={radius} className="flex flex-col items-center gap-1.5">
                <div className={cn("size-16 border border-border bg-primary", radius)} />
                <span className="text-xs text-muted-foreground">{radius}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ③ Button */}
        <Section title="Button">
          <div className="flex flex-col gap-3">
            {BUTTON_VARIANTS.map((variant) => (
              <div key={variant} className="flex flex-wrap items-center gap-3">
                <span className="w-24 text-xs text-muted-foreground">{variant}</span>
                {BUTTON_SIZES.map((size) => (
                  <Button key={size} variant={variant} size={size}>
                    按钮
                  </Button>
                ))}
                <Button variant={variant} size="icon" aria-label="设置">
                  <Gear size={16} />
                </Button>
                <Button variant={variant} loading>
                  加载中
                </Button>
                <Button variant={variant} disabled>
                  禁用
                </Button>
              </div>
            ))}
          </div>
        </Section>

        {/* ④ IconButton */}
        <Section title="IconButton">
          <div className="flex flex-wrap items-center gap-3">
            <IconButton label="设置">
              <Gear size={16} />
            </IconButton>
            <IconButton label="设置（激活态）" active>
              <Gear size={16} />
            </IconButton>
            <IconButton label="幽灵按钮" variant="ghost">
              <Info size={16} />
            </IconButton>
            <IconButton label="主色按钮" variant="primary">
              <Moon size={16} />
            </IconButton>
            <IconButton label="描边按钮" variant="outline">
              <Sun size={16} />
            </IconButton>
            <IconButton label="小尺寸" size="sm">
              <Gear size={16} />
            </IconButton>
            <IconButton label="禁用" disabled>
              <Gear size={16} />
            </IconButton>
          </div>
        </Section>

        {/* ⑤ Input / Textarea */}
        <Section title="Input / Textarea">
          <div className="flex max-w-md flex-col gap-3">
            <Input placeholder="普通输入框" />
            <Input defaultValue="已填入内容" />
            <Input placeholder="校验失败态" invalid />
            <Textarea placeholder="多行输入（可拖拽调整高度）" />
            <Textarea placeholder="校验失败态" invalid />
          </div>
        </Section>

        {/* ⑥ Badge */}
        <Section title="Badge">
          <div className="flex flex-wrap items-center gap-3">
            {BADGE_VARIANTS.map((variant) => (
              <Badge key={variant} variant={variant}>
                {variant}
              </Badge>
            ))}
          </div>
        </Section>

        {/* ⑦ Tooltip */}
        <Section title="Tooltip">
          <div className="flex items-center gap-3">
            <Tooltip label="这是 Tooltip 提示">
              <Button variant="secondary" size="sm">
                悬浮我
              </Button>
            </Tooltip>
            <Tooltip label="图标按钮同样有提示">
              <IconButton label="信息" variant="ghost">
                <Info size={16} />
              </IconButton>
            </Tooltip>
          </div>
        </Section>

        {/* ⑧ Dialog */}
        <Section title="Dialog">
          <Dialog>
            <DialogTrigger asChild>
              <Button>打开对话框</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>示例对话框</DialogTitle>
                <DialogDescription>
                  用于检查居中布局、圆角、遮罩与暗色主题下的表现。
                </DialogDescription>
              </DialogHeader>
              <div className="py-2 text-sm text-foreground">
                这里可以放任意内容，例如表单、说明文字或操作确认。
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="secondary">取消</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button>确认</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Section>

        {/* ⑨ Switch */}
        <Section title="Switch">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Switch checked={switchA} onCheckedChange={setSwitchA} label="第一枚开关" />
              <span className="text-sm text-foreground">{switchA ? "已开启" : "已关闭"}</span>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={switchB} onCheckedChange={setSwitchB} label="第二枚开关" />
              <span className="text-sm text-foreground">{switchB ? "已开启" : "已关闭"}</span>
            </div>
          </div>
        </Section>

        {/* ⑩ Select */}
        <Section title="Select">
          <div className="max-w-xs">
            <Select value={fruit} onValueChange={setFruit}>
              <SelectTrigger aria-label="选择水果">
                <SelectValue placeholder="选择一种水果" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="banana">香蕉</SelectItem>
                <SelectItem value="apple">苹果</SelectItem>
                <SelectItem value="orange">橙子</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Section>

        {/* ⑫ 表单后建组件（阶段 3-6） */}
        <Section title="Checkbox / Chip / Segmented / NumberField">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={checkboxA}
                  onCheckedChange={(v) => setCheckboxA(v === true)}
                  aria-label="普通复选"
                />
                <span className="text-sm">普通复选</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox checked="indeterminate" onCheckedChange={() => {}} aria-label="半选态" />
                <span className="text-sm">半选态</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox checked={false} onCheckedChange={() => {}} aria-label="未选" />
                <span className="text-sm">未选</span>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {["1080P", "720P", "480P"].map((item) => (
                <Chip
                  key={item}
                  selected={chips.includes(item)}
                  onClick={() =>
                    setChips((cur) =>
                      cur.includes(item) ? cur.filter((c) => c !== item) : [...cur, item]
                    )
                  }
                >
                  {item}
                </Chip>
              ))}
            </div>
            <div className="max-w-md">
              <Segmented
                aria-label="画质偏好"
                value={quality}
                onChange={setQuality}
                options={[
                  { value: "high", label: "高清", icon: <Sun size={15} /> },
                  { value: "low", label: "流畅" }
                ]}
              />
            </div>
            <div className="flex items-center gap-3">
              <NumberField
                className="w-32"
                value={speed}
                onChange={(v) => setSpeed(v ?? 1)}
                min={0.25}
                max={4}
                step={0.25}
                aria-label="倍速"
              />
              <span className="text-sm text-muted-foreground">
                失焦 clamp 到 [0.25, 4]（min/max 步进由浏览器原生承担）
              </span>
            </div>
          </div>
        </Section>

        {/* ⑪ Tabs */}
        <Section title="Tabs">
          <Tabs value={tab} onValueChange={setTab} className="max-w-md">
            <TabsList className="w-full">
              <TabsTrigger value="overview">概览</TabsTrigger>
              <TabsTrigger value="tasks">任务</TabsTrigger>
              <TabsTrigger value="settings">设置</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">这是「概览」标签页的内容。</TabsContent>
            <TabsContent value="tasks">这是「任务」标签页的内容。</TabsContent>
            <TabsContent value="settings">这是「设置」标签页的内容。</TabsContent>
          </Tabs>
        </Section>

        {/* ⑫ Progress */}
        <Section title="Progress">
          <div className="flex max-w-md flex-col gap-4">
            <Progress value={60} />
            <Progress indeterminate />
          </div>
        </Section>

        {/* ⑬ Separator */}
        <Section title="Separator">
          <div className="flex max-w-md flex-col gap-3">
            <span className="text-sm text-foreground">水平分隔线上方</span>
            <Separator />
            <span className="text-sm text-foreground">水平分隔线下方</span>
            <div className="flex h-12 items-center gap-4">
              <span className="text-sm text-foreground">左</span>
              <Separator orientation="vertical" />
              <span className="text-sm text-foreground">右</span>
            </div>
          </div>
        </Section>

        {/* ⑭ ScrollArea */}
        <Section title="ScrollArea">
          <ScrollArea className="h-32 max-w-md rounded-lg border border-border">
            <div className="flex flex-col gap-2 p-3">
              {Array.from({ length: 10 }, (_, index) => (
                <span key={index} className="text-sm text-foreground">
                  滚动内容行 {index + 1}
                </span>
              ))}
            </div>
          </ScrollArea>
        </Section>
      </div>
    </div>
  );
}
