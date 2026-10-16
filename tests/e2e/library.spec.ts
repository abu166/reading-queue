import { test, expect } from "@playwright/test";
async function mainFlow(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  const suffix = Date.now().toString();
  await page.goto("./");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Settings & backup" }).click();
  await page.getByLabel("New tag name").fill(`Test ${suffix}`);
  await page.getByRole("button", { name: "Add tag" }).click();
  await expect(
    page.getByRole("dialog").getByText(`#Test ${suffix}`, { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Close settings").click();
  await page
    .getByRole("button", { name: "Save link", exact: true })
    .first()
    .click();
  await page.getByLabel("Link URL").fill(`https://example.com/${suffix}`);
  await page.getByLabel("Title", { exact: true }).fill(`Read ${suffix}`);
  await page.getByLabel(`Test ${suffix}`, { exact: true }).check();
  await page
    .getByRole("button", { name: "Save link", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: `Read ${suffix}` }),
  ).toBeVisible();
  await page
    .getByLabel("Private Markdown note")
    .fill("A persistent **private** note");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved to your library");
  await page.getByRole("button", { name: "Edit link, tags & status" }).click();
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("Finished");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.reload();
  await expect(page.getByLabel("Private Markdown note")).toHaveValue(
    "A persistent **private** note",
  );
  await expect(page.getByText("Finished", { exact: true })).toBeVisible();
  await expect(page.getByText(`Test ${suffix}`, { exact: true })).toBeVisible();
  const detailUrl = page.url();
  await page.getByRole("link", { name: "← Back to library" }).click();
  await page.getByLabel("Search library").fill("persistent");
  await expect(
    page.getByRole("link", { name: `Read ${suffix}`, exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search library").fill("no-such-article-zzzz");
  await expect(page.getByText("No matching reads.")).toBeVisible();
  await page.getByLabel("Search library").fill("");
  await expect(
    page.getByRole("link", { name: `Read ${suffix}`, exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/library-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Save link", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/library-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Save link", exact: true }).click();
  await page
    .getByLabel("Link URL")
    .fill(`https://EXAMPLE.com:443/${suffix}#fragment`);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save link", exact: true })
    .click();
  await expect(page.getByText("Already saved.")).toBeVisible();
  await page
    .getByRole("button", { name: "Open existing item to view or update" })
    .click();
  await expect(page).toHaveURL(detailUrl);
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete link", exact: true }).click();
}

test("browser flow with PostgreSQL and deterministic Auth fixture", async ({
  page,
}) => {
  test.skip(
    !!process.env.VITE_SUPABASE_URL,
    "Fixture uses a local stub origin",
  );
  const { fixtureBackend } = await import("./fixture");
  const db = await fixtureBackend(page);
  try {
    await mainFlow(page, "reader@example.test", "fixture-password");
  } finally {
    await db.close();
  }
});
test("hosted authentication and persistence", async ({ page }) => {
  test.skip(
    !process.env.E2E_EMAIL ||
      !process.env.E2E_PASSWORD ||
      !process.env.VITE_SUPABASE_URL,
    "Requires configured project and confirmed test account",
  );
  await mainFlow(page, process.env.E2E_EMAIL!, process.env.E2E_PASSWORD!);
});
