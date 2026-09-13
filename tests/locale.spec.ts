import { test, expect } from "@playwright/test";
import { installHost, type Payload } from "./host";

// IronCalc diffs carry the raw text the user typed, and the receiving model
// re-parses it with its own locale and language (see
// docs/formula-compatibility.md). The engine settings must therefore be the
// same on every device, whatever regional settings that device has.

test.describe("a device with German regional settings", () => {
  test.use({ locale: "de-DE", timezoneId: "Europe/Berlin" });

  test("creates workbooks with the shared engine settings", async ({
    page,
  }) => {
    await installHost(page, []);
    await page.goto("/");
    await page.waitForFunction(() => !!window.__model);

    expect(await page.evaluate(() => window.__model?.getLocale())).toBe("en");
    expect(await page.evaluate(() => window.__model?.getLanguage())).toBe("en");
    expect(await page.evaluate(() => window.__model?.getTimezone())).toBe(
      "UTC",
    );
  });

  // Locale and timezone are stored in the workbook, so a workbook written by an
  // earlier version of the app - or changed through IronCalc's regional
  // settings panel - comes back with the wrong ones.
  test("restores the shared settings of a diverging workbook and tells the peers", async ({
    page,
  }) => {
    const history: Payload[] = [];
    await installHost(page, history);
    await page.goto("/");
    await page.waitForFunction(() => !!window.__model);

    await page.evaluate(() => {
      window.__model?.setLocale("de");
      window.__model?.setTimezone("Europe/Berlin");
    });
    await expect.poll(() => history.length).toBe(1);

    await page.reload();
    await page.waitForFunction(() => !!window.__model);

    await expect
      .poll(() => page.evaluate(() => window.__model?.getLocale()))
      .toBe("en");
    expect(await page.evaluate(() => window.__model?.getTimezone())).toBe(
      "UTC",
    );
    // Both settings are synchronized as diffs, so the correction reaches the
    // peers that still hold the diverging workbook.
    await expect.poll(() => history.length).toBe(2);
  });

  test("sends numbers and formulas an English device reads identically", async ({
    page,
    browser,
    baseURL,
  }) => {
    const history: Payload[] = [];
    await installHost(page, history);
    await page.goto("/");
    await page.waitForFunction(() => !!window.__model);

    // Both edits happen in one task, so they leave in a single diff.
    await page.evaluate(() => {
      window.__model?.setUserInput(0, 1, 1, "1.5");
      window.__model?.setUserInput(0, 2, 1, "=SUM(A1,A1)");
    });
    await expect.poll(() => history.length).toBe(1);
    expect(
      await page.evaluate(() => window.__model?.getFormattedCellValue(0, 2, 1)),
    ).toBe("3");

    const device = await browser.newContext({
      locale: "en-US",
      timezoneId: "America/New_York",
    });
    try {
      const otherPage = await device.newPage();
      await installHost(otherPage, history);
      await otherPage.goto(baseURL!);

      // The decimal separator and the formula must survive the trip: an
      // engine following the device would read "1.5" as a thousands group and
      // reject the English argument separator.
      await expect
        .poll(() =>
          otherPage.evaluate(() =>
            window.__model?.getFormattedCellValue(0, 2, 1),
          ),
        )
        .toBe("3");
      expect(
        await otherPage.evaluate(() =>
          window.__model?.getFormattedCellValue(0, 1, 1),
        ),
      ).toBe("1.5");
    } finally {
      await device.close();
    }
  });
});
