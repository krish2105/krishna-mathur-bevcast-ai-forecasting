import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ROUTES: { path: string; id: string; charts?: string[] }[] = [
  { path: "/", id: "kpi-row", charts: ["hero-chart"] },
  { path: "/assignment", id: "page-assignment", charts: ["compliance-matrix"] },
  { path: "/lab-air-coolers", id: "page-lab-air-coolers", charts: ["chart-demand-temp", "chart-walk-forward", "chart-impact"] },
  { path: "/data", id: "page-data", charts: ["quality-table"] },
  { path: "/analysis", id: "page-analysis", charts: ["chart-history", "chart-seasonal-index", "chart-heatmap"] },
  { path: "/forecasting", id: "page-forecasting", charts: ["forecast-table"] },
  { path: "/models", id: "page-models", charts: ["leaderboard", "chart-test-year", "chart-residuals"] },
  { path: "/insights", id: "page-insights", charts: ["chart-first-year", "plan-table"] },
  { path: "/copilot", id: "page-copilot", charts: ["copilot"] },
  { path: "/live", id: "page-live" },
  { path: "/reports", id: "page-reports", charts: ["printable-report"] },
  { path: "/methodology", id: "page-methodology" },
  { path: "/about", id: "page-about" },
];

const ENV = process.env.BASE_URL ? "production" : "local";
const SHOTS = path.join("docs", "screenshots", ENV);
const AXE_OUT = path.join("docs", "qa", `axe-${ENV}`);

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  return errors;
}

async function noHorizontalOverflow(page: Page) {
  // Compare with the configured viewport, not innerWidth: mobile emulation widens the layout viewport to fit
  // overflowing content, which would hide the problem.
  const w = page.viewportSize()!.width;
  await page.waitForTimeout(300);
  const sw = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
  expect(sw, `page is ${sw}px wide in a ${w}px viewport`).toBeLessThanOrEqual(w + 1);
}

for (const r of ROUTES) {
  test(`route ${r.path} renders, has no overflow, no console errors and passes axe`, async ({ page }, info) => {
    const errors = watchErrors(page);
    const res = await page.goto(r.path, { waitUntil: "networkidle" });
    expect(res?.status()).toBe(200);
    await expect(page.getByTestId(r.id)).toBeVisible();
    for (const c of r.charts ?? []) await expect(page.getByTestId(c)).toBeVisible();
    await expect(page.getByRole("contentinfo")).toContainText("Krishna Mathur · AS25DXB018 · MAIB September 2025 · AI in Operations: Problems and Exercises");
    await noHorizontalOverflow(page);

    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    fs.mkdirSync(AXE_OUT, { recursive: true });
    fs.writeFileSync(
      path.join(AXE_OUT, `${info.project.name}${r.path === "/" ? "-overview" : r.path.replace(/\//g, "-")}.json`),
      JSON.stringify(axe.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })), null, 2),
    );
    const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id} (${v.impact}): ${v.help} [${v.nodes[0]?.target}]`)).toEqual([]);

    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, `${r.path === "/" ? "overview" : r.path.slice(1)}-${info.project.name}.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}

test("unknown route shows the 404 page", async ({ page }) => {
  const res = await page.goto("/does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByTestId("page-404")).toBeVisible();
});

test("upload -> forecast flow (browser-only)", async ({ page }) => {
  await page.goto("/data");
  await page.getByTestId("load-sample").click();
  await expect(page.getByTestId("upload-preview")).toBeVisible();
  await page.getByTestId("use-upload").click();
  await expect(page.getByTestId("current-upload")).toContainText("36 months");
  await page.goto("/forecasting?dataset=uploaded&tab=engine");
  await expect(page.getByTestId("engine-results")).toBeVisible();
  const rows = page.getByTestId("forecast-table").locator("tbody tr");
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText("Oct 2026");
});

test("forecasting model toggle updates URL and results", async ({ page }) => {
  await page.goto("/forecasting");
  await expect(page.getByTestId("engine-results")).toBeVisible();
  const before = await page.getByTestId("engine-results").locator("tbody tr").count();
  await page.getByTestId("model-toggle-moving-average").click();
  await expect(page).toHaveURL(/models=.*moving-average/);
  await expect(page.getByTestId("engine-results").locator("tbody tr")).toHaveCount(before + 1);
});

test("theme toggle switches to dark mode", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("theme-toggle").click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByTestId("theme-toggle").click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("command palette jumps to a page", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "keyboard shortcut is a desktop feature");
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByTestId("open-palette").click();
  await expect(page.getByPlaceholder("Search pages, models and actions…")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("ControlOrMeta+k");
  const input = page.getByPlaceholder("Search pages, models and actions…");
  await expect(input).toBeVisible();
  await input.fill("Model Comparison");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/models/);
});

test("mobile drawer navigation", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "drawer exists below 1024 px");
  await page.goto("/");
  await page.getByTestId("mobile-menu").click();
  await page.getByRole("dialog").getByRole("link", { name: "Insights" }).click();
  await expect(page).toHaveURL(/\/insights/);
});

test("copilot answers with source labels (AI or labelled fallback)", async ({ page }) => {
  await page.goto("/copilot");
  await page.getByTestId("suggested-prompts").getByRole("button").nth(1).click();
  const answer = page.getByTestId("assistant-message").last();
  await expect(answer).toContainText(/XGBoost/, { timeout: 60_000 });
  await expect(answer).toContainText(/Data as of/, { timeout: 60_000 });
  await expect(answer.getByText(/AI-generated|Rule-based fallback \(not AI\)/).first()).toBeVisible();
});

test("APIs: report CSV and live feeds", async ({ request }, info) => {
  test.skip(info.project.name === "mobile", "API checks run once");
  const csv = await request.get("/api/report?type=forecasts");
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain("XGBoost");
  expect((await request.get("/api/report?type=nope")).status()).toBe(400);
  for (const p of ["/api/live/fred", "/api/live/weather"]) {
    const r = await request.get(p);
    expect([200, 502]).toContain(r.status());
    const j = await r.json();
    expect(j).toHaveProperty("retrievedAt");
  }
});

// Run separately (npm run test:e2e:ratelimit): it uses up this IP's chat quota for a minute.
test("chat API rate limit returns 429 @ratelimit", async ({ request }, info) => {
  test.skip(info.project.name === "mobile", "API checks run once");
  // Invalid bodies are rejected before any LLM call but still count toward the limit (10/min/IP).
  const statuses: number[] = [];
  for (let i = 0; i < 12; i++) statuses.push((await request.post("/api/chat", { data: { bad: true } })).status());
  expect(statuses.slice(0, 10).every((s) => s === 400)).toBe(true);
  expect(statuses).toContain(429);
});
