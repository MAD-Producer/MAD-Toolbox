import { createTheme } from "@mantine/core";
import { blue, dark } from "./colors";

// 清爽基调：blue 主色只出现在激活态与主按钮，其余交给留白与细边框
export const theme = createTheme({
  primaryColor: "blue",
  primaryShade: { light: 6, dark: 6 },
  defaultRadius: "md",
  colors: {
    blue,
    dark
  },
  components: {
    // 去掉 Mantine v9 默认的选项间 1px 分隔线（withItemsBorders 默认 true），
    // 与全局激活段淡入淡出的样式语言保持一致
    SegmentedControl: {
      defaultProps: {
        withItemsBorders: false
      }
    },
    // Chip 库默认 xl 圆角呈胶囊形，与全局圆角矩形语言（defaultRadius: md）不符
    Chip: {
      defaultProps: {
        radius: "md"
      }
    },
    Switch: {
      vars: () => ({
        root: {
          "--label-offset-start": "calc(var(--mantine-spacing-md) / 3)"
        }
      })
    }
  }
});
