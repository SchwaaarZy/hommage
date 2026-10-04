import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";

type PoemFixture = {
  id: string;
  title: string;
  theme: string;
  text: string;
  sourceImage: string;
  dedication?: string;
};
const works: PoemFixture[] = JSON.parse(
  readFileSync(new URL("../assets/poemes.json", import.meta.url), "utf8"),
);
const firstPoem = works[0];
const secondPoem = works[1];

test("accueil simple et accès aux poèmes", async ({ page }, testInfo) => {
  const errors: string[] = [];
  await page.emulateMedia({ reducedMotion: "reduce" });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Les Poèmes de",
  );
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await expect(page.locator(".simple-index summary")).toHaveCount(works.length);
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Hommage à notre grand-père" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".simple-index summary")).toHaveCount(works.length);
  await page.screenshot({
    path: testInfo.outputPath("accueil.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: firstPoem.title, exact: true })
    .click();
  await expect(page.locator("details[open] h2")).toHaveText(firstPoem.title);
  await expect(page.locator(".simple-index summary")).toHaveCount(works.length);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Les Poèmes de",
  );
  expect(errors).toEqual([]);
});
test("recherche, expression, thème et état vide", async ({ page }) => {
  await page.goto("/#library");
  await expect(page.locator(".poem-card")).toHaveCount(works.length);
  const search = page.getByRole("searchbox");
  await search.fill("poesie");
  await expect(page.locator(".poem-card")).toHaveCount(1);
  await search.fill("le cœur est le seul passeport");
  await expect(page.locator(".poem-card")).toHaveCount(1);
  await search.fill("Mémoire");
  await expect(page.locator(".poem-card")).toHaveCount(2);
  await search.fill("xyz-introuvable");
  await expect(
    page.getByRole("heading", { name: "Aucun poème trouvé." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Voir tous les poèmes" }).click();
  await page.getByRole("button", { name: "Mémoire", exact: true }).click();
  await expect(page.locator(".poem-card")).toHaveCount(2);
});
test("tri par date et titre", async ({ page }) => {
  await page.goto("/#library");
  await page.getByRole("combobox").selectOption("newest");
  await expect(page.locator(".poem-card h3").first()).toHaveText(
    firstPoem.title,
  );
  await page.getByRole("combobox").selectOption("oldest");
  await expect(page.locator(".poem-card h3").first()).toHaveText(
    firstPoem.title,
  );
  await page.getByRole("combobox").selectOption("title");
  await expect(page.locator(".poem-card h3").first()).toHaveText(
    [...works].sort((first, second) =>
      first.title.localeCompare(second.title, "fr"),
    )[0].title,
  );
});
test("favoris et mode sombre persistants", async ({ page }) => {
  await page.goto("/#library");
  await page
    .getByRole("button", {
      name: `Ajouter ${firstPoem.title} aux favoris`,
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Mes favoris", exact: true }).click();
  await expect(page.locator(".poem-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Activer le mode sombre" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".poem-card")).toHaveCount(1);
  await page
    .getByRole("button", {
      name: `Retirer ${firstPoem.title} des favoris`,
      exact: true,
    })
    .click();
  await expect(page.locator(".poem-card")).toHaveCount(0);
});
test("lecture directe et navigation", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/#poeme/${firstPoem.id}`);
  await expect(page.locator("details[open] h2")).toHaveText(firstPoem.title);
  await expect(page.locator("details[open] .simple-verses p")).toHaveText(
    firstPoem.text.split("\n\n"),
  );
  await expect(page.locator("details[open]")).toHaveCount(1);
  await page.screenshot({
    path: testInfo.outputPath("lecture.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: secondPoem.title, exact: true })
    .click();
  await expect(page.locator("details[open] h2")).toHaveText(secondPoem.title);
  await expect(page.locator("details[open]")).toHaveCount(1);
  await page.goBack();
  await expect(page.locator("details[open] h2")).toHaveText(firstPoem.title);
  await page
    .getByRole("button", { name: firstPoem.title, exact: true })
    .click();
  await expect(page.locator("details[open]")).toHaveCount(0);
  await page
    .getByRole("button", { name: firstPoem.title, exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("details[open]")).toHaveCount(1);
  await page.keyboard.press("Space");
  await expect(page.locator("details[open]")).toHaveCount(0);
  await page.goto("/#poeme/introuvable");
  await expect(page.getByRole("alert")).toContainText("introuvable");
});
test("exports PDF complet et thématique", async ({ page }) => {
  await page.goto("/#collections");
  const completePromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Télécharger le recueil", exact: true })
    .click();
  const complete = await completePromise;
  expect(complete.suggestedFilename()).toMatch(/\.pdf$/);
  const contents = await readFile((await complete.path())!);
  expect(contents.subarray(0, 5).toString()).toBe("%PDF-");
  expect(contents.length).toBeGreaterThan(30000);
  expect(
    contents.toString("latin1").match(/\/Type \/Page\b/g)?.length,
  ).toBeGreaterThanOrEqual(works.length + 2);
  const themePromise = page.waitForEvent("download");
  await page
    .locator(".theme-collection")
    .filter({
      has: page.getByRole("heading", { name: "Mémoire", exact: true }),
    })
    .getByRole("button", { name: "Télécharger" })
    .click();
  const thematic = await themePromise;
  const themeContents = await readFile((await thematic.path())!);
  expect(
    themeContents.toString("latin1").match(/\/Type \/Page\b/g)?.length,
  ).toBeGreaterThanOrEqual(
    works.filter((poem) => poem.theme === "Mémoire").length + 2,
  );
});
test("index automatique", async ({ page }) => {
  await page.goto("/#index");
  await expect(page.locator(".poem-index a")).toHaveCount(works.length);
  await page.locator(".poem-index a").first().click();
  await expect(page.locator("details[open] h2")).toHaveText(
    [...works].sort((first, second) =>
      first.title.localeCompare(second.title, "fr"),
    )[0].title,
  );
});
test("partage par un lien unique", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: secondPoem.title, exact: true })
    .click();
  expect(new URL(page.url()).hash).toBe(`#poeme/${secondPoem.id}`);
  await page.goto(`/#poeme/${secondPoem.id}`);
  await expect(page.locator("details[open] h2")).toHaveText(secondPoem.title);
});
test("navigation et petit écran", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await expect(page.locator(".simple-index summary")).toHaveCount(works.length);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: firstPoem.title, exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: firstPoem.title, exact: true })
    .click();
  await expect(page.locator("details[open]")).toHaveCount(0);
  await expect(page.locator(".simple-index summary")).toHaveCount(works.length);
});
test("ergonomie et rendu mobile", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  const firstPoemTop = await page
    .locator(".simple-index summary")
    .first()
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(firstPoemTop).toBeLessThan(844);
  for (const link of await page.locator(".simple-index summary").all()) {
    const bounds = await link.boundingBox();
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
  }
  await expect(
    page.getByRole("button", { name: "Menu", exact: true }),
  ).toHaveCount(0);
  const tributeCenter = await page
    .locator(".simple-tribute")
    .evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.left + bounds.width / 2;
    });
  expect(Math.abs(tributeCenter - 195)).toBeLessThan(2);
  await page.screenshot({
    path: testInfo.outputPath("accueil-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: firstPoem.title, exact: true })
    .click();
  await expect(page.locator("details[open] .simple-verses")).toBeVisible();
  expect(
    await page
      .locator("details[open] .simple-verses")
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThanOrEqual(20);
  await page.screenshot({
    path: testInfo.outputPath("lecture-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
});
test("aucun débordement horizontal", async ({ page }) => {
  for (const hash of [
    "",
    "library",
    "collections",
    "index",
    `poeme/${firstPoem.id}`,
  ]) {
    await page.goto(`/#${hash}`);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
  }
});
test("fluidité et fermeture sans saut", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    let animationCount = 0;
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      if (this.matches(".simple-index details")) animationCount++;
      return animate.call(this, keyframes, options);
    };
    Object.defineProperty(window, "panelAnimationCount", {
      get: () => animationCount,
    });
  });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const firstTitle = page.getByRole("button", {
    name: firstPoem.title,
    exact: true,
  });
  await firstTitle.click();
  await expect(page.locator("details[open] h2")).toHaveText(firstPoem.title);
  await page.evaluate(async () => {
    await Promise.all(
      [...document.querySelectorAll(".simple-index details")]
        .flatMap((panel) => panel.getAnimations())
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  await firstTitle.evaluate((element) =>
    element.scrollIntoView({ block: "start", behavior: "instant" }),
  );
  const previousScroll = await page.evaluate(() => window.scrollY);
  await firstTitle.click();
  await expect(page.locator("details[open]")).toHaveCount(0);
  await page.evaluate(async () => {
    await Promise.all(
      [...document.querySelectorAll(".simple-index details")]
        .flatMap((panel) => panel.getAnimations())
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  expect(
    Math.abs((await page.evaluate(() => window.scrollY)) - previousScroll),
  ).toBeLessThan(4);
  const animationCount = await page.evaluate(
    () =>
      (window as Window & { panelAnimationCount: number }).panelAnimationCount,
  );
  expect(animationCount).toBeGreaterThanOrEqual(2);
  await page.goBack();
  await expect(page.locator("details[open] h2")).toHaveText(firstPoem.title);
  await page.goForward();
  await expect(page.locator("details[open]")).toHaveCount(0);
  await page.evaluate(async () => {
    await Promise.all(
      [...document.querySelectorAll(".simple-index details")]
        .flatMap((panel) => panel.getAnimations())
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  const countBeforeReducedMotion = await page.evaluate(
    () =>
      (window as Window & { panelAnimationCount: number }).panelAnimationCount,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("button", { name: secondPoem.title, exact: true })
    .click();
  await expect(page.locator("details[open] h2")).toHaveText(secondPoem.title);
  expect(
    await page.evaluate(
      () =>
        (window as Window & { panelAnimationCount: number })
          .panelAnimationCount,
    ),
  ).toBe(countBeforeReducedMotion);
});
test("formats d’écran et titres longs", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const longestPoem = works.reduce(
    (longest, poem) =>
      poem.title.length > longest.title.length ? poem : longest,
    firstPoem,
  );
  for (const [width, height] of [
    [320, 740],
    [390, 844],
    [768, 1024],
    [1440, 1000],
    [1920, 1080],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const firstTop = await page
      .locator(".simple-index summary")
      .first()
      .evaluate((element) => element.getBoundingClientRect().top);
    expect(firstTop).toBeLessThan(height);
    await page
      .getByRole("button", { name: longestPoem.title, exact: true })
      .click();
    await expect(page.locator("details[open] h2")).toHaveText(
      longestPoem.title,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
    const titleBox = await page.locator("details[open] h2").boundingBox();
    const panelBox = await page.locator("details[open] summary").boundingBox();
    expect(titleBox!.width).toBeLessThan(panelBox!.width);
    const mainBox = await page.locator(".simple-main").boundingBox();
    expect(Math.abs(mainBox!.x + mainBox!.width / 2 - width / 2)).toBeLessThan(
      2,
    );
  }
});
test("œuvres transcrites, dédicace et illustrations originales", async ({
  page,
  request,
}) => {
  const imageRequests: string[] = [];
  page.on("request", (entry) => {
    if (entry.resourceType() === "image" && /\.png(?:\?|$)/.test(entry.url()))
      imageRequests.push(entry.url());
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Yves Cholet",
  );
  await expect(page.locator(".simple-demo")).toHaveCount(0);
  await expect(page.locator(".simple-poem .simple-date")).toHaveCount(0);
  expect(imageRequests).toEqual([]);
  for (const poem of works) {
    expect(
      existsSync(new URL(`../assets/${poem.sourceImage}`, import.meta.url)),
    ).toBe(true);
    await page.getByRole("button", { name: poem.title, exact: true }).click();
    await expect(page.locator("details[open] h2")).toHaveText(poem.title);
    expect(
      await page.locator("details[open] .simple-verses p").allTextContents(),
    ).toEqual(poem.text.split("\n\n"));
    const originalLink = page.locator("details[open]").getByRole("link", {
      name: `Voir la version illustrée de ${poem.title}`,
      exact: true,
    });
    await expect(originalLink).toHaveAttribute("target", "_blank");
    const originalUrl = new URL(
      (await originalLink.getAttribute("href"))!,
      page.url(),
    ).href;
    const original = await request.head(originalUrl);
    expect(original.ok()).toBe(true);
    expect(original.headers()["content-type"]).toContain("image/png");
    if (poem.dedication)
      await expect(
        page.locator("details[open] .simple-poem-dedication"),
      ).toHaveText(poem.dedication);
  }
});
