import { expect, test } from "@playwright/test";

test("studio playback mirrors a live workflow run", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("load-demo-button").click();
  await page.getByTestId("open-studio-button").click();

  await expect(page.getByText("Run Studio")).toBeVisible();
  await page.getByTestId("run-workflow-button").click();

  await expect(page.getByTestId("studio-graph-panel")).toContainText("Streaming run progress");
  await page.getByRole("tab", { name: "Timeline" }).click();
  await expect(page.getByTestId("studio-timeline")).toContainText("Collect Context");
  await expect(page.getByTestId("studio-timeline")).toContainText("Compose Summary");

  await page.getByTestId("timeline-step-sub-workflow-summary").click();
  await page.getByRole("tab", { name: "Step Detail" }).click();
  await expect(page.getByTestId("view-nested-graph-button")).toBeVisible();
  await page.getByTestId("view-nested-graph-button").click();

  await expect(page.getByTestId("studio-graph-panel")).toContainText("Compose Summary");
  await expect(page.getByTestId("studio-step-detail")).toContainText("Compose Summary");

  await page.screenshot({ path: "output/playwright/studio-run.png", fullPage: true });
});
