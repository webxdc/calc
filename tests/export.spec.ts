import { expect, test } from "@playwright/test";
import { installHost, type Payload, type SentFile } from "./host";

// The workbook is converted to xlsx inside the IronCalc WASM and handed to
// Delta Chat with `sendToChat`. Upstream IronCalc converts on a server, which
// a webxdc app cannot reach, so this path is ours and is worth covering.

// Names of the parts an xlsx must contain. Zip stores entry names uncompressed
// in the local and central directory headers, so they can be found in the raw
// bytes without unpacking the archive.
const REQUIRED_PARTS = [
  "[Content_Types].xml",
  "xl/workbook.xml",
  "xl/worksheets/sheet1.xml",
];

test.describe("exporting the workbook", () => {
  test("sends a valid xlsx named after the workbook", async ({ page }) => {
    const history: Payload[] = [];
    const sentFiles: SentFile[] = [];
    await installHost(page, history, { sentFiles });
    await page.goto("/");
    await page.waitForFunction(() => !!window.__model);

    await page.evaluate(() => {
      window.__model?.setUserInput(0, 1, 1, "Revenue");
      window.__model?.setUserInput(0, 2, 1, "10");
      window.__model?.setUserInput(0, 3, 1, "=A2*2");
    });
    expect(
      await page.evaluate(() => window.__model?.getFormattedCellValue(0, 3, 1)),
    ).toBe("20");

    await page.getByRole("button", { name: "Send as .xlsx" }).click();

    await expect.poll(() => sentFiles.length).toBe(1);
    const file = sentFiles[0];

    const name = await page.evaluate(() => window.__model?.getName());
    expect(file.name).toBe(`${name}.xlsx`);

    // One character per byte, so the ASCII entry names can be searched for
    // directly and the leading bytes compared as text.
    const bytes = atob(file.base64);
    // "PK\x03\x04" is the local file header a zip, and so an xlsx, starts with.
    expect(bytes.startsWith("PK\x03\x04")).toBe(true);
    for (const part of REQUIRED_PARTS) {
      expect(bytes).toContain(part);
    }
  });

  // The workbook name reaches the host as a file name, so characters that no
  // file system accepts must not survive the trip.
  test("sanitizes a workbook name that cannot be a file name", async ({
    page,
  }) => {
    const history: Payload[] = [];
    const sentFiles: SentFile[] = [];
    await installHost(page, history, { sentFiles });
    await page.goto("/");
    await page.waitForFunction(() => !!window.__model);

    await page.evaluate(() => window.__model?.setName('a/b:c*d?e"f'));

    await page.getByRole("button", { name: "Send as .xlsx" }).click();

    await expect.poll(() => sentFiles.length).toBe(1);
    expect(sentFiles[0].name).toBe("a_b_c_d_e_f.xlsx");
  });

  // Exporting reads the workbook; it must not enqueue a diff that peers would
  // then have to apply.
  test("does not send a status update", async ({ page }) => {
    const history: Payload[] = [];
    const sentFiles: SentFile[] = [];
    await installHost(page, history, { sentFiles });
    await page.goto("/");
    await page.waitForFunction(() => !!window.__model);

    await page.evaluate(() => window.__model?.setUserInput(0, 1, 1, "1"));
    await expect.poll(() => history.length).toBe(1);

    await page.getByRole("button", { name: "Send as .xlsx" }).click();
    await expect.poll(() => sentFiles.length).toBe(1);

    // The app flushes on a one second interval; give it time to prove quiet.
    await page.waitForTimeout(1500);
    expect(history.length).toBe(1);
  });
});
