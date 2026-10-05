import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";

type PoemFixture = {
  id: string;
  title: string;
  theme: string;
  text: string;
  dedication?: string;
};
const works: PoemFixture[] = JSON.parse(
  readFileSync(new URL("../assets/poemes.json", import.meta.url), "utf8"),
);
const firstPoem = works[0];
const secondPoem = works[1];

test.beforeEach(async ({ page }) => {
  const userId = "00000000-0000-4000-8000-000000000001";
  const user = {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: "",
    app_metadata: { provider: "anonymous", providers: ["anonymous"] },
    user_metadata: {},
    identities: [],
    created_at: "2026-01-01T00:00:00.000Z",
    is_anonymous: true,
  };
  const session = {
    access_token: "test-access-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: 4102444800,
    refresh_token: "test-refresh-token",
    user,
  };
  const likedPoemIds = new Set<string>();

  await page.route("**/auth/v1/signup", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user, session }),
    }),
  );
  await page.route("**/rest/v1/rpc/get_poem_like_counts", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        [...likedPoemIds].map((poem_id) => ({ poem_id, likes_count: 1 })),
      ),
    }),
  );
  await page.route("**/rest/v1/poem_likes**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          [...likedPoemIds].map((poem_id) => ({ poem_id })),
        ),
      });
      return;
    }
    if (request.method() === "POST") {
      const like = request.postDataJSON() as { poem_id: string };
      likedPoemIds.add(like.poem_id);
      await route.fulfill({ status: 201, body: "" });
      return;
    }
    if (request.method() === "DELETE") {
      const poemId =
        new URL(request.url()).searchParams.get("poem_id")?.slice(3) ?? "";
      likedPoemIds.delete(poemId);
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    await route.fulfill({ status: 405, body: "" });
  });
});

test("accueil simple et accès aux poèmes", async ({ page }, testInfo) => {
  const errors: string[] = [];
  await page.emulateMedia({ reducedMotion: "reduce" });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Les mots de Coco",
  );
  const portrait = page.getByRole("img", {
    name: "Coco",
  });
  await expect(portrait).toBeVisible();
  await expect(page.locator(".simple-remembrance")).toHaveText(
    "Ils continueront de traverser le temps.",
  );
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await expect(page.locator(".simple-index summary")).toHaveCount(works.length);
  await expect(portrait).toHaveJSProperty(
    "naturalWidth",
    1080,
  );
  expect(
    await portrait.evaluate((image) => image.getBoundingClientRect().width),
  ).toBeLessThanOrEqual(360);
  await expect(page.getByText(/La dictature, c’est « ferme ta gueule »/)).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(1);
  await expect(page.locator(".simple-header svg, .simple-header .breton-mark")).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation", { name: "Navigation principale" })
      .getByRole("link"),
  ).toHaveText(["POÈMES", "OUVRAGES"]);
  await expect(
    page.getByRole("region", { name: "Hommage à notre Coco" }),
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
    "Les mots de Coco",
  );
  expect(errors).toEqual([]);
});
test("menu Poèmes et Ouvrages", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "OUVRAGES", exact: true }).click();
  await expect(page).toHaveTitle("Les mots de Coco");
  await expect(page.getByRole("heading", { name: "Ouvrages" })).toBeVisible();
  await expect(page.getByText("Aucun ouvrage pour le moment.")).toBeVisible();
  await expect(page.getByRole("img", { name: "Coco" })).toBeVisible();
  await expect(page.getByText("À la mémoire de notre Coco")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "OUVRAGES", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "POÈMES", exact: true }).click();
  await expect(page).toHaveURL(/#poemes$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Les mots de Coco",
  );
  await expect(page.locator(".simple-index h2")).toHaveText(
    [...works]
      .sort((first, second) => first.title.localeCompare(second.title, "fr"))
      .map((poem) => poem.title),
  );
});
test("copie et sélection bloquées sur les poèmes", async ({ page }) => {
  await page.goto("/");
  const simpleIndex = page.locator(".simple-index");
  await expect(simpleIndex).toHaveCSS("user-select", "none");
  await page
    .getByRole("button", { name: firstPoem.title, exact: true })
    .click();
  const simplePoemText = page.locator(".simple-verses p").first();
  const simpleCopyBlocked = await simplePoemText.evaluate((element) => {
    const event = new ClipboardEvent("copy", {
      bubbles: true,
      cancelable: true,
    });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(simpleCopyBlocked).toBe(true);
  const contextMenuBlocked = await simplePoemText.evaluate((element) => {
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(contextMenuBlocked).toBe(true);

  await page.goto("/#library");
  const poemCard = page.locator(".poem-card").first();
  await expect(poemCard).toHaveCSS("user-select", "none");
  const cardCopyBlocked = await poemCard.evaluate((element) => {
    const event = new ClipboardEvent("copy", {
      bubbles: true,
      cancelable: true,
    });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(cardCopyBlocked).toBe(true);
});
test("drapeau breton uniquement en bas et menus centrés", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".simple-header .simple-brand")).toHaveCount(0);
  await expect(page.locator(".simple-header .breton-mark")).toHaveCount(0);
  await expect(page.locator(".simple-footer .breton-mark")).toBeVisible();
  const simpleHeaderCenterOffset = await page
    .locator(".simple-header")
    .evaluate((header) => {
      const nav = header.querySelector(".simple-main-nav")!.getBoundingClientRect();
      const bounds = header.getBoundingClientRect();
      return Math.abs(
        nav.left + nav.width / 2 - (bounds.left + bounds.width / 2),
      );
    });
  expect(simpleHeaderCenterOffset).toBeLessThan(2);
  await page.goto("/#library");
  await expect(page.locator(".site-header .brand")).toHaveCount(0);
  await expect(page.locator(".site-header .breton-mark")).toHaveCount(0);
  await expect(page.locator(".site-footer .breton-mark")).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) > 700) {
    const desktopNavCenterOffset = await page
      .locator(".site-header")
      .evaluate((header) => {
        const nav = header.querySelector(".desktop-nav")!.getBoundingClientRect();
        const bounds = header.getBoundingClientRect();
        return Math.abs(
          nav.left + nav.width / 2 - (bounds.left + bounds.width / 2),
        );
      });
    expect(desktopNavCenterOffset).toBeLessThan(2);
  }
});
test("recherche, expression, thème et état vide", async ({ page }) => {
  await page.goto("/#library");
  await expect(page.locator(".poem-card")).toHaveCount(works.length);
  const search = page.getByRole("searchbox");
  await search.fill("soupirs pour exprimer l'espoir");
  await expect(page.locator(".poem-card")).toHaveCount(1);
  await search.fill("gagne-petit de l'amitié");
  await expect(page.locator(".poem-card")).toHaveCount(1);
  await search.fill("Hôpital");
  await expect(page.locator(".poem-card")).toHaveCount(
    works.filter((poem) => poem.theme === "Hôpital").length,
  );
  await search.fill("xyz-introuvable");
  await expect(
    page.getByRole("heading", { name: "Aucun poème trouvé." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Voir tous les poèmes" }).click();
  await page.getByRole("button", { name: "Hôpital", exact: true }).click();
  await expect(page.locator(".poem-card")).toHaveCount(
    works.filter((poem) => poem.theme === "Hôpital").length,
  );
});
test("tri par date et titre", async ({ page }) => {
  await page.goto("/#library");
  await expect(page.locator(".poem-card")).toHaveCount(works.length);
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
test("J’aime partagé, compteur et retrait après rechargement", async ({
  page,
}) => {
  await page.goto("/");
  const like = page.getByRole("button", {
    name: `J’aime ${firstPoem.title}, 0 J’aime`,
    exact: true,
  });
  await expect(like).toHaveAttribute("aria-pressed", "false");
  await like.click();
  const liked = page.getByRole("button", {
    name: `Retirer votre J’aime sur ${firstPoem.title}, 1 J’aime`,
    exact: true,
  });
  await expect(liked).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  const restoredLike = page.getByRole("button", {
    name: `Retirer votre J’aime sur ${firstPoem.title}, 1 J’aime`,
    exact: true,
  });
  await expect(restoredLike).toHaveAttribute("aria-pressed", "true");
  await restoredLike.click();
  await expect(
    page.getByRole("button", {
      name: `J’aime ${firstPoem.title}, 0 J’aime`,
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "false");
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
  await expect(
    page.locator(".simple-main-nav").evaluate((element) =>
      getComputedStyle(element).position,
    ),
  ).resolves.toBe("fixed");
  await expect(page.locator(".simple-index summary")).toHaveCount(works.length);
  await expect(
    page.getByRole("link", { name: "POÈMES", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "OUVRAGES", exact: true }),
  ).toBeVisible();
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
  const paradiseTitle = page.locator(".simple-index summary h2").filter({
    hasText: "Le Paradis des poètes",
  });
  expect(
    await paradiseTitle.evaluate((element) =>
      element.getBoundingClientRect().height,
    ),
  ).toBeLessThan(30);
  const firstPoemTop = await page
    .locator(".simple-index summary")
    .first()
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(firstPoemTop).toBeLessThan(844);
  const chevronLeftOffset = await page
    .locator(".simple-index summary")
    .first()
    .evaluate((summary) => {
      const chevron = summary.querySelector("svg")!.getBoundingClientRect();
      return chevron.left - summary.getBoundingClientRect().left;
    });
  expect(chevronLeftOffset).toBeLessThanOrEqual(12);
  const iconCenterOffset = await page
    .locator(".simple-index li")
    .first()
    .evaluate((item) => {
      const chevron = item
        .querySelector("summary > svg")!
        .getBoundingClientRect();
      const heart = item
        .querySelector(".simple-like-button svg")!
        .getBoundingClientRect();
      return Math.abs(
        chevron.top + chevron.height / 2 - (heart.top + heart.height / 2),
      );
    });
  expect(iconCenterOffset).toBeLessThanOrEqual(1);
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
  const previousTitleTop = await firstTitle.evaluate((element) =>
    element.getBoundingClientRect().top,
  );
  await firstTitle.click();
  await expect(page.locator("details[open]")).toHaveCount(0);
  await page.evaluate(async () => {
    await Promise.all(
      [...document.querySelectorAll(".simple-index details")]
        .flatMap((panel) => panel.getAnimations())
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  const currentTitleTop = await firstTitle.evaluate((element) =>
    element.getBoundingClientRect().top,
  );
  expect(
    Math.abs(currentTitleTop - previousTitleTop),
    `Position du titre avant/après fermeture : ${previousTitleTop}px / ${currentTitleTop}px, scrollY ${await page.evaluate(() => window.scrollY)}px`,
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
test("œuvres transcrites avec portrait et dédicaces", async ({ page }) => {
  const imageRequests: string[] = [];
  await page.emulateMedia({ reducedMotion: "reduce" });
  page.on("request", (entry) => {
    if (
      entry.resourceType() === "image" &&
      /\.(?:png|webp)(?:\?|$)/.test(entry.url())
    )
      imageRequests.push(entry.url());
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Les mots de Coco",
  );
  await expect(page.locator(".simple-demo")).toHaveCount(0);
  await expect(page.locator(".simple-poem .simple-date")).toHaveCount(0);
  await expect.poll(() => imageRequests.length).toBe(1);
  expect(imageRequests[0]).toMatch(/coco.*\.webp(?:\?|$)/);
  for (const poem of works) {
    expect("sourceImage" in poem).toBe(false);
    await page.evaluate((id) => {
      window.location.hash = `poeme/${id}`;
    }, poem.id);
    await expect(page.locator("details[open] h2")).toHaveText(poem.title);
    expect(
      await page.locator("details[open] .simple-verses p").allTextContents(),
    ).toEqual(poem.text.split("\n\n"));
    await expect(
      page.locator("details[open]").getByRole("link", {
        name: /version illustrée/,
      }),
    ).toHaveCount(0);
    if (poem.dedication)
      await expect(
        page.locator("details[open] .simple-poem-dedication"),
      ).toHaveText(poem.dedication);
  }
});
