import { Play } from "@phosphor-icons/react";
import { DependencyMissingBadge } from "../../components/common/DependencyMissingBadge";
import { PageToolbar } from "../../components/common/PageToolbar";
import { Button } from "../../components/ui/button";
import { Tooltip } from "../../components/ui/tooltip";
import { t } from "../../locale";

interface Aria2PageHeaderProps {
  submitting: boolean;
  submitDisabled: boolean;
  onSubmit: () => void;
  dependencyLabels?: string[];
  onOpenDependencies?: () => void;
}

export function Aria2PageHeader({
  submitting,
  submitDisabled,
  onSubmit,
  dependencyLabels,
  onOpenDependencies
}: Aria2PageHeaderProps) {
  const submitButton = (
    <Button
      size="sm"
      className="h-8 gap-1.5"
      leftSection={<Play size={16} />}
      loading={submitting}
      disabled={submitDisabled}
      onClick={onSubmit}
    >
      {t("aria2.submit")}
    </Button>
  );

  return (
    <PageToolbar>
      <DependencyMissingBadge labels={dependencyLabels} onOpen={onOpenDependencies} />
      {submitDisabled && !submitting ? (
        <Tooltip label={t("common.submitWaitingPreview")}>
          <span className="inline-flex">{submitButton}</span>
        </Tooltip>
      ) : (
        submitButton
      )}
    </PageToolbar>
  );
}
