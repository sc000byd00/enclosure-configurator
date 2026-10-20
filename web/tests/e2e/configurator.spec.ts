import { expect, test, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FIX = join(__dirname, "fixtures");
const result = JSON.parse(readFileSync(join(FIX, "build.json"), "utf-8"));
const stl = readFileSync(join(FIX, "box.stl"));

test("form -> preview -> download", async ({ page }) => {
  const bodies: unknown[] = [];
  await page.route("**/api/build", async (route: Route) => {
    bodies.push(route.request().postDataJSON());
    const failed = bodies.length > 1;
    await route.fulfill({
      json: failed
        ? { ...result, passed: false, checks: [{ id: "walls", ok: false, message: "wall 1.2, floor 2, lid 2 mm (min 1.6)" }] }
        : result,
    });
  });
  await page.route("**/api/files/**/*.stl", (route) =>
    route.fulfill({ body: stl, contentType: "model/stl" }));

  await page.goto("/");
  await expect(page.getByText("all checks passed")).toBeVisible();
  await expect(page.getByText("outside 75.4 × 55.0 × 24.1 mm")).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  const download = page.getByRole("link", { name: /Download STEP, STL, 3MF/ });
  await expect(download).toHaveAttribute("href", /\/api\/files\/0123456789abcdef01234567\/enclosure\.zip$/);
  expect((bodies[0] as { name: string }).name).toBe("m");

  await page.getByLabel("wall", { exact: true }).fill("1.2");
  await page.getByRole("button", { name: "Build enclosure" }).click();
  await expect(page.getByText("some checks failed")).toBeVisible();
  await expect(page.getByText("FAIL", { exact: true })).toBeVisible();
  expect((bodies[1] as { shell: { wall: number } }).shell.wall).toBe(1.2);
});

test("YAML tab round trip", async ({ page }) => {
  await page.route("**/api/build", (route) => route.fulfill({ json: result }));
  await page.route("**/api/files/**/*.stl", (route) =>
    route.fulfill({ body: stl, contentType: "model/stl" }));
  await page.goto("/");
  await page.getByRole("tab", { name: "YAML" }).click();
  const yaml = page.getByLabel("board YAML");
  await expect(yaml).toHaveValue(/name: m/);
  await yaml.fill((await yaml.inputValue()).replace("size:\n    - 70", "size:\n    - 80"));
  await page.getByRole("button", { name: "Apply YAML" }).click();
  await expect(page.getByLabel("length x")).toHaveValue("80");
});

test("server error is shown", async ({ page }) => {
  await page.route("**/api/build", (route) =>
    route.fulfill({ status: 422, json: { detail: "board.holes[0]: (90, 4) is outside the board" } }));
  await page.goto("/");
  await expect(page.getByRole("alert").filter({ hasText: "outside the board" })).toBeVisible();
});
