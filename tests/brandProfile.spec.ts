import { test, expect } from "@playwright/test";

const MUST_SECTIONS = [
  /Key people/i,
  /Ownership/i,
  /Top shareholders|Investors/i,
  /Evidence|Events/i,
];

test("brand profile baseline", async ({ page }) => {
  await page.goto("/brand/5b465261-bca1-41c1-9929-5ee3a8ceea61"); // Walmart

  // Description with source link
  await expect(page.getByText(/Source/i)).toBeVisible();

  // All major sections present
  for (const section of MUST_SECTIONS) {
    await expect(page.getByText(section)).toBeVisible();
  }

  // All 4 scores default present
  for (const category of ["labor", "environment", "politics", "social"]) {
    await expect(page.getByText(new RegExp(category, "i"))).toBeVisible();
  }

  // Dark mode snapshot
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({
    path: "screenshots/walmart-dark.png",
    fullPage: true,
  });

  // No console errors
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.waitForTimeout(500); // Allow hydration
  expect(errors, errors.join("\n")).toHaveLength(0);
});
