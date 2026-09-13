import { Model } from "@ironcalc/workbook";

const MAX_FILENAME_LENGTH = 100;
const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Workbook names are free text, so they can hold characters that are not
// allowed in a file name on the receiving device. Mirrors the sanitization
// upstream applies before offering the file as a download.
function sanitizeFileName(name: string): string {
  const normalized = name.normalize("NFKC");

  const safe = [...normalized]
    .map((char) => {
      const code = char.charCodeAt(0);
      // Remove control chars and filesystem-unsafe chars
      if (
        code <= 0x1f || // ASCII control
        code === 0x7f || // DEL
        ["<", ">", ":", '"', "/", "\\", "|", "?", "*"].includes(char)
      ) {
        return "_";
      }
      return char;
    })
    .join("");

  const trimmed = safe.slice(0, MAX_FILENAME_LENGTH).trim();

  // A name made entirely of stripped characters, or of dots, leaves nothing
  // usable to name the attachment with.
  if (trimmed === "" || /^\.+$/.test(trimmed)) {
    return "workbook";
  }
  return trimmed;
}

/**
 * Converts the workbook to xlsx and hands it to Delta Chat, which lets the
 * user pick the chat to send it to.
 *
 * The conversion runs in the IronCalc WASM. Upstream does it on a server, but
 * a webxdc app has no network access.
 */
export async function exportModelToChat(model: Model): Promise<void> {
  const bytes = model.toXlsx();
  // `toXlsx` returns a view on the WASM memory. Copying it into a Blob
  // detaches it from that memory, which any later edit may reallocate.
  const blob = new Blob([bytes.slice()], { type: XLSX_MIME_TYPE });
  await window.webxdc.sendToChat({
    file: { name: `${sanitizeFileName(model.getName())}.xlsx`, blob },
  });
}
