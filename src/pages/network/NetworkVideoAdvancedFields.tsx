import { Group, NumberInput, Stack, Switch, TextInput } from "@mantine/core";
import { t } from "../../locale";
import type { NetworkFormState } from "./form";

interface NetworkVideoAdvancedFieldsProps {
  form: NetworkFormState;
  disabled: boolean;
  onUpdate: (patch: Partial<NetworkFormState>) => void;
}

export function NetworkVideoAdvancedFields({
  form,
  disabled,
  onUpdate
}: NetworkVideoAdvancedFieldsProps) {
  return (
    <Stack gap="sm">
      <Group grow>
        <TextInput
          label={t("network.fields.outputTemplate")}
          value={form.outputTemplate}
          onChange={(event) => onUpdate({ outputTemplate: event.currentTarget.value })}
          disabled={disabled}
        />
        <TextInput
          label={t("network.fields.format")}
          placeholder={t("network.fields.formatPlaceholder")}
          value={form.format}
          onChange={(event) => onUpdate({ format: event.currentTarget.value })}
          disabled={disabled}
        />
      </Group>
      <Group grow>
        <NumberInput
          label={t("network.fields.retries")}
          min={0}
          value={form.retries}
          onChange={(value) => onUpdate({ retries: typeof value === "number" ? value : 10 })}
          disabled={disabled}
        />
        <NumberInput
          label={t("network.fields.concurrentFragments")}
          min={1}
          value={form.concurrentFragments}
          onChange={(value) =>
            onUpdate({ concurrentFragments: typeof value === "number" ? value : 4 })
          }
          disabled={disabled}
        />
      </Group>
      <Group gap="lg">
        <Switch
          label={t("network.fields.writeInfoJson")}
          checked={form.writeInfoJson}
          onChange={(event) => onUpdate({ writeInfoJson: event.currentTarget.checked })}
          disabled={disabled}
        />
        <Switch
          label={t("network.fields.verbose")}
          checked={form.verbose}
          onChange={(event) => onUpdate({ verbose: event.currentTarget.checked })}
          disabled={disabled}
        />
      </Group>
    </Stack>
  );
}
