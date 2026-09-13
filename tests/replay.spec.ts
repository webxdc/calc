import { test, expect, type Page } from "@playwright/test";
import { installHost, type Payload } from "./host";

const B2_DIFF = {
  data: "AQEBAAQABAIEAgI0MgA=",
  sender: "6088ce72-5c43-419d-9e60-2605d477d46a",
};

async function expectB2(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => window.__model?.getFormattedCellValue(0, 2, 2)),
    )
    .toBe("42");
}

test("replays history on first open and preserves it after reopening", async ({
  page,
}) => {
  await installHost(page, [B2_DIFF]);
  await page.goto("/");
  await expectB2(page);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("last_serial")))
    .toBe("1");
  await page.reload();
  await expectB2(page);
});

test("replays edits received while the app was closed", async ({ page }) => {
  const history: Payload[] = [];
  await installHost(page, history);
  await page.goto("/");
  await page.waitForFunction(() => !!window.__model);
  await page.goto("about:blank");
  history.push(B2_DIFF);
  await page.goto("/");
  await expectB2(page);
  await page.reload();
  await expectB2(page);
});

test("another device of the same account receives outgoing edits on first open", async ({
  page,
  browser,
  baseURL,
}) => {
  const history: Payload[] = [];
  await installHost(page, history);
  await page.goto("/");
  await page.waitForFunction(() => !!window.__model);
  await page.evaluate(() => window.__model!.setUserInput(0, 2, 2, "42"));
  await expect.poll(() => history.length).toBe(1);

  const device = await browser.newContext();
  try {
    const otherPage = await device.newPage();
    await installHost(otherPage, history);
    await otherPage.goto(baseURL!);
    await expectB2(otherPage);
    await otherPage.reload();
    await expectB2(otherPage);
  } finally {
    await device.close();
  }
});

test("missing workbook resets its stale cursor and replays own historical edits", async ({
  page,
}) => {
  await installHost(page, [B2_DIFF]);
  await page.addInitScript((sender) => {
    localStorage.setItem("last_serial", "99");
    localStorage.setItem("uuid", sender);
  }, B2_DIFF.sender);
  await page.goto("/");
  await expectB2(page);
});
