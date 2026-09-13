import styled from "@emotion/styled";
import { Model } from "@ironcalc/workbook";
import { Share2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { exportModelToChat } from "./exportXlsx";

/**
 * Sends the workbook to a chat as an .xlsx file.
 *
 * It sits over the empty right end of IronCalc's sheet tab bar rather than in
 * a bar of its own, so it costs no vertical space on the small screens most
 * Delta Chat users are on. `App.css` reserves the room it occupies so sheet
 * tabs cannot scroll underneath it.
 */
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
    <Button type="button" onClick={onClick} disabled={busy} title={label} aria-label={label}>
      <Share2 width={18} height={18} />
    </Button>
  );
}

const Button = styled("button")`
  position: absolute;
  right: 8px;
  bottom: 0;
  height: var(--navigation-height, 40px);
  width: 44px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--palette-grey-700, #333);
  font-family: var(--typography-font-family);

  &:hover:not(:disabled) {
    color: var(--palette-primary-main, #f2994a);
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;

export default ExportButton;
