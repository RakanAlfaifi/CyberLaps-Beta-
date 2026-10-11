import { TriangleAlert } from "lucide-react";
import { useT } from "@/i18n";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, description, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const t = useT();
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      closeLabel={t("common.close")}
      icon={<TriangleAlert className="text-amber-glow" />}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" size="sm" sfx="reject" onClick={onConfirm} autoFocus>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
