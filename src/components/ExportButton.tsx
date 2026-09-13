import { Model } from "@ironcalc/workbook";
import { Share2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { exportModelToChat } from "./exportXlsx";
import { ToolbarButton } from "./ToolbarButton";

/** Sends the workbook to a chat as an .xlsx file. */
function ExportButton({ model }: { model: Model }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const label = t("export.send_as_xlsx");

  async function onClick() {
    // Converting a large workbook is not instant, and sendToChat resolves
    // only once the user has picked a chat. Guard against a second run.
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await exportModelToChat(model);
    } catch (error) {
      console.error("Failed to export workbook as xlsx", error);
      // The conversion can fail on a workbook the xlsx writer cannot
      // represent. Say so rather than leaving the button silently dead.
      window.alert(t("export.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolbarButton
      type="button"
      onClick={onClick}
      disabled={busy}
      title={label}
      aria-label={label}
    >
      <Share2 width={18} height={18} />
    </ToolbarButton>
  );
}

export default ExportButton;
