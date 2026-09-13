import { expect, test } from "@playwright/test";
import { installHost, type Payload, stageImportFile } from "./host";

// Importing appends the file's sheets to the workbook that is already there.
// It goes through ordinary editing operations, so it reaches the peers as
// plain diffs and needs no protocol of its own.

// A real Excel-produced workbook with ten sheets, served by the dev server
// straight out of the vendored tree.
const EXAMPLE_URL = "/vendor/ironcalc/bindings/nodejs/example.xlsx";

// A workbook whose colouring comes from conditional formatting rules.
const CROSSWORD_URL = "/vendor/ironcalc/xlsx/tests/templates/crossword.xlsx";

async function openApp(
  page: import("@playwright/test").Page,
  history: Payload[],
) {
  await installHost(page, history);
  await page.goto("/");
  await page.waitForFunction(() => !!window.__model);
}

async function importExample(page: import("@playwright/test").Page) {
  await stageImportFile(page, EXAMPLE_URL, "example.xlsx");
  await page.getByRole("button", { name: "Add sheets from .xlsx" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => window.__model?.getWorksheetsProperties().length),
    )
    .toBe(11);
}

test.describe("importing a spreadsheet", () => {
  test("appends the file's sheets and keeps the existing one", async ({
    page,
  }) => {
    await openApp(page, []);
    await page.evaluate(() =>
      window.__model?.setUserInput(0, 1, 1, "behalten"),
    );

    await importExample(page);

    // The sheet that was already there keeps its content and its place.
    expect(
      await page.evaluate(() => window.__model?.getFormattedCellValue(0, 1, 1)),
    ).toBe("behalten");
    // The ten imported ones follow it, A1 of the first being "A string".
    expect(
      await page.evaluate(() => window.__model?.getFormattedCellValue(1, 1, 1)),
    ).toBe("A string");
  });

  // Renaming happens in the imported workbook before anything is copied, so
  // IronCalc rewrites the formulas that point at a renamed sheet.
  test("keeps cross-sheet formulas pointing at the imported data", async ({
    page,
  }) => {
    await openApp(page, []);

    // Build the file to import in the page and stage it for the picker, so
    // the whole thing runs through the app's own import path.
    await page.evaluate(() => {
      const target = window.__model!;
      const M = target.constructor as any;

      const source = new M("src", "en", "UTC", "en");
      source.setUserInput(0, 1, 1, "10");
      source.newSheet();
      source.setUserInput(1, 1, 1, "=Sheet1!A1*2");

      const bytes: Uint8Array = source.toXlsx();
      let binary = "";
      for (const byte of bytes) {
        binary += String.fromCharCode(byte);
      }
      window.__nextImportFile = { name: "refs.xlsx", base64: btoa(binary) };

      // The target has a Sheet1 of its own holding something else entirely.
      target.setUserInput(0, 1, 1, "999");
    });

    await page.getByRole("button", { name: "Add sheets from .xlsx" }).click();
    await expect
      .poll(() =>
        page.evaluate(() => window.__model?.getWorksheetsProperties().length),
      )
      .toBe(3);

    const names = await page.evaluate(() =>
      window.__model?.getWorksheetsProperties().map((s) => s.name),
    );
    // The colliding name got a suffix; the other one was free to keep.
    expect(names).toEqual(["Sheet1", "Sheet1 (2)", "Sheet2"]);
    expect(
      await page.evaluate(() => window.__model?.getCellContent(2, 1, 1)),
      // Quoted, because the replacement name contains a space.
    ).toBe("='Sheet1 (2)'!A1*2");
    expect(
      await page.evaluate(() => window.__model?.getFormattedCellValue(2, 1, 1)),
    ).toBe("20");
  });

  // The clipboard carries cells but not the workbook's defined names, so
  // these have to be carried over separately. Without that, every formula
  // using one resolves to #NAME?.
  test("carries over defined names", async ({ page }) => {
    await openApp(page, []);
    await importExample(page);

    // "quantum" is defined as Sheet1!$C$14 in the example workbook, and D14
    // holds "=quantum". Sheet index 1 is the imported Sheet1.
    expect(
      await page.evaluate(() => window.__model?.getCellContent(1, 14, 4)),
    ).toBe("=quantum");
    expect(
      await page.evaluate(() =>
        window.__model?.getFormattedCellValue(1, 14, 4),
      ),
    ).toBe("quantum");
    // C18 sums the "numbers" range.
    expect(
      await page.evaluate(() =>
        window.__model?.getFormattedCellValue(1, 18, 3),
      ),
    ).toBe("15");
  });

  // A workbook that colours its cells through conditional formatting rather
  // than through cell fills, which the clipboard does not carry. Comparing
  // against a plain import of the same file catches both a missing rule and
  // one whose priority moved: with `stop_if_true` in play, the wrong order
  // silently repaints cells instead of failing.
  test("reproduces the styling of a conditionally formatted workbook", async ({
    page,
  }) => {
    await openApp(page, []);
    await stageImportFile(page, CROSSWORD_URL, "crossword.xlsx");
    await page.getByRole("button", { name: "Add sheets from .xlsx" }).click();
    await expect
      .poll(() =>
        page.evaluate(() => window.__model?.getWorksheetsProperties().length),
      )
      .toBe(3);

    const result = await page.evaluate(async (url) => {
      const target = window.__model!;
      const M = target.constructor as any;
      const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
      const direct = M.fromXlsx(bytes, "cw", "en", "UTC", "en");

      // The area the sheet actually uses, which is what got copied.
      direct.setSelectedSheet(0);
      direct.setSelectedRange(1, 1, 1_048_576, 16_384);
      const [firstRow, firstColumn, lastRow, lastColumn] =
        direct.copyToClipboard().range;

      let mismatches = 0;
      for (let row = firstRow; row <= lastRow; row += 1) {
        for (let column = firstColumn; column <= lastColumn; column += 1) {
          if (
            JSON.stringify(direct.getCellStyle(0, row, column)) !==
            JSON.stringify(target.getCellStyle(1, row, column))
          ) {
            mismatches += 1;
          }
        }
      }

      // A crossword's squares are square because of its column widths, so
      // these belong to the styling as much as the fills do.
      let sizeMismatches = 0;
      for (let column = firstColumn; column <= lastColumn; column += 1) {
        if (
          direct.getColumnWidth(0, column) !== target.getColumnWidth(1, column)
        ) {
          sizeMismatches += 1;
        }
      }
      for (let row = firstRow; row <= lastRow; row += 1) {
        if (direct.getRowHeight(0, row) !== target.getRowHeight(1, row)) {
          sizeMismatches += 1;
        }
      }

      return {
        mismatches,
        sizeMismatches,
        rules: target.getConditionalFormattingList(1).length,
        // Ordered by descending priority, as the source has them.
        formulas: target
          .getConditionalFormattingList(1)
          .map((view: any) => view.cf_rule.formula),
        directFormulas: direct
          .getConditionalFormattingList(0)
          .map((view: any) => view.cf_rule.formula),
      };
    }, CROSSWORD_URL);

    expect(result.rules).toBe(3);
    expect(result.formulas).toEqual(result.directFormulas);
    expect(result.mismatches).toBe(0);
    expect(result.sizeMismatches).toBe(0);
  });

  // The export names its file after the workbook, and nothing in the UI
  // renames a workbook, so without this every export would be Workbook1.xlsx.
  test("names an unnamed workbook after the imported file", async ({
    page,
  }) => {
    await openApp(page, []);
    expect(await page.evaluate(() => window.__model?.getName())).toBe(
      "Workbook1",
    );

    await stageImportFile(page, EXAMPLE_URL, "budget-2026.xlsx");
    await page.getByRole("button", { name: "Add sheets from .xlsx" }).click();

    await expect
      .poll(() => page.evaluate(() => window.__model?.getName()))
      .toBe("budget-2026");
    // And it is what the export would use, after a restart too.
    await page.reload();
    await page.waitForFunction(() => !!window.__model);
    await expect
      .poll(() => page.evaluate(() => window.__model?.getName()))
      .toBe("budget-2026");
  });

  test("leaves a chosen workbook name alone", async ({ page }) => {
    await openApp(page, []);
    await page.evaluate(() => window.__model?.setName("Quartalszahlen"));

    await stageImportFile(page, EXAMPLE_URL, "budget-2026.xlsx");
    await page.getByRole("button", { name: "Add sheets from .xlsx" }).click();
    await expect
      .poll(() =>
        page.evaluate(() => window.__model?.getWorksheetsProperties().length),
      )
      .toBe(11);

    expect(await page.evaluate(() => window.__model?.getName())).toBe(
      "Quartalszahlen",
    );
  });

  // Delta Chat's file picker never settles its promise when the dialog is
  // cancelled, so anything that waits on it while showing the button as busy
  // strands the button disabled for the rest of the session.
  test("stays usable after the file picker is cancelled", async ({ page }) => {
    await openApp(page, []);
    const button = page.getByRole("button", { name: "Add sheets from .xlsx" });

    // Nothing staged: the stub models a cancelled dialog and never resolves.
    await button.click();
    await page.waitForTimeout(500);
    await expect(button).toBeEnabled();

    // And a real import still works afterwards.
    await stageImportFile(page, EXAMPLE_URL, "example.xlsx");
    await button.click();
    await expect
      .poll(() =>
        page.evaluate(() => window.__model?.getWorksheetsProperties().length),
      )
      .toBe(11);
  });

  test("reaches the peers as ordinary diffs, not a snapshot", async ({
    page,
  }) => {
    const history: Payload[] = [];
    await openApp(page, history);

    await importExample(page);
    await expect.poll(() => history.length).toBeGreaterThan(0);

    // Nothing carries a `kind`: the import is expressed entirely in diffs.
    for (const payload of history) {
      expect(payload.kind).toBeUndefined();
    }
  });

  // The engine settings must be identical on every device, or peers re-parse
  // the raw input of each diff differently. A file carrying its own locale
  // must not be allowed to change them.
  test("leaves the shared engine settings alone", async ({ page }) => {
    await openApp(page, []);
    await importExample(page);

    expect(await page.evaluate(() => window.__model?.getLocale())).toBe("en");
    expect(await page.evaluate(() => window.__model?.getTimezone())).toBe(
      "UTC",
    );
    expect(await page.evaluate(() => window.__model?.getLanguage())).toBe("en");
  });

  test("a peer receives the imported sheets", async ({
    page,
    browser,
    baseURL,
  }) => {
    const history: Payload[] = [];
    await openApp(page, history);
    await importExample(page);
    await expect.poll(() => history.length).toBeGreaterThan(0);

    const peer = await browser.newContext();
    try {
      const peerPage = await peer.newPage();
      await installHost(peerPage, history);
      await peerPage.goto(baseURL!);
      await peerPage.waitForFunction(() => !!window.__model);

      await expect
        .poll(() =>
          peerPage.evaluate(
            () => window.__model?.getWorksheetsProperties().length,
          ),
        )
        .toBe(11);
      expect(
        await peerPage.evaluate(() =>
          window.__model?.getFormattedCellValue(1, 1, 1),
        ),
      ).toBe("A string");
    } finally {
      await peer.close();
    }
  });

  test("the imported sheets survive a restart", async ({ page }) => {
    await openApp(page, []);
    await importExample(page);

    await page.reload();
    await page.waitForFunction(() => !!window.__model);
    await expect
      .poll(() =>
        page.evaluate(() => window.__model?.getWorksheetsProperties().length),
      )
      .toBe(11);
    expect(
      await page.evaluate(() => window.__model?.getFormattedCellValue(1, 1, 1)),
    ).toBe("A string");
  });
});
