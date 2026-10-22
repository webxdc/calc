import { Model } from "@ironcalc/workbook";
import { FolderOpen } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { modelFromXlsxFile, pickXlsxFile } from "./importXlsx";
import { ToolbarButton } from "./ToolbarButton";

/**
 * Adds the sheets of an .xlsx file the user picks to the shared workbook.
 */
function ImportButton({
  onImported,
}: {
  onImported: (model: Model) => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const label = t("import.add_sheets");

  async function onClick() {
    if (busy) {
      return;
    }
    let file: File | null = null;
    try {
      // Deliberately not marked busy yet. Delta Chat implements the file
      // picker with an <input type=file> and only listens for its `change`
      // event, so cancelling the dialog leaves the promise pending forever.
      // Disabling the button across this call would strand it disabled.
      file = await pickXlsxFile();
    } catch (error) {
      console.error("Failed to pick a file to import", error);
      window.alert(t("import.failed"));
      return;
    }
    if (!file) {
      return;
    }
    // From here on the work is ours and does finish, so the button can say so.
    setBusy(true);
    try {
      onImported(await modelFromXlsxFile(file));
    } catch (error) {
      console.error("Failed to import xlsx", error);
      // Anything the reader cannot make sense of lands here: a file that is
      // not really xlsx, or one using parts IronCalc does not implement.
      window.alert(t("import.failed"));
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
      <FolderOpen width={18} height={18} />
    </ToolbarButton>
  );
}

export default ImportButton;
