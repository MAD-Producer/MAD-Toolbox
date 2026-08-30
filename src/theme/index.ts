import { createTheme } from "@mantine/core";
import { blue, dark } from "./colors";

export const theme = createTheme({
  primaryColor: "blue",
  primaryShade: { light: 6, dark: 6 },
  defaultRadius: "md",
  colors: {
    blue,
    dark
  },
  components: {
    SegmentedControl: {
      defaultProps: {
        withItemsBorders: false
      }
    },
    Chip: {
      defaultProps: {
        radius: "md"
      }
    },
    NumberInput: {
      defaultProps: {
        hideControls: true
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
