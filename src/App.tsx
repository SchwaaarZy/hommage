import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Download,
  Feather,
  Heart,
  List,
  Menu,
  Moon,
  Search,
  Sun,
  X,
} from "lucide-react";
import {
  formatDate,
  isDemo,
  normalize,
  poems,
  readingMinutes,
  themes,
  type Poem,
} from "./poems";
import { loadPoemLikeCounts, loadPoemLikeState, savePoemLike } from "./likes";
import { isSupabaseConfigured } from "./supabase";
import cocoPortrait from "../assets/coco.webp";
import "./App.css";

type View =
  | "home"
  | "poemes"
  | "ouvrages"
  | "library"
  | "collections"
  | "favorites"
  | "index";
function savedValue<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function route() {
  const hash = window.location.hash.slice(1);
  if (hash.startsWith("poeme/"))
    return {
      view: "library" as View,
      poem: poems.find((item) => item.id === hash.slice(6)) ?? null,
      missing: !poems.some((item) => item.id === hash.slice(6)),
    };
  return {
    view: (["poemes", "ouvrages", "library", "collections", "favorites", "index"].includes(hash)
      ? hash
      : "home") as View,
    poem: null,
    missing: false,
  };
}

function measurePoemPanels() {
  const heights = new Map<string, number>();
  document
    .querySelectorAll<HTMLDetailsElement>(".simple-index details")
    .forEach((panel) => {
      heights.set(panel.id, panel.getBoundingClientRect().height);
      panel.getAnimations().forEach((animation) => animation.cancel());
    });
  return heights;
}

const poemsAlphabetically = [...poems].sort((first, second) =>
  first.title.localeCompare(second.title, "fr"),
);

function App() {
  const [current, setCurrent] = useState(route);
  const [dark, setDark] = useState(() => savedValue("poetry-dark", false));
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = savedValue<unknown>("poetry-favorites", []);
    return Array.isArray(saved)
      ? saved.filter(
          (item): item is string =>
            typeof item === "string" && poems.some((poem) => poem.id === item),
        )
      : [];
  });
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedPoemIds, setLikedPoemIds] = useState<string[]>([]);
  const [likesReady, setLikesReady] = useState(false);
  const [likeStatus, setLikeStatus] = useState(
    isSupabaseConfigured
      ? ""
      : "Configurez Supabase pour activer les J’aime partagés.",
  );
  const [pendingLike, setPendingLike] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState("Tous");
  const [sort, setSort] = useState("original");
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const heading = useRef<HTMLHeadingElement>(null);
  const poemHeights = useRef(new Map<string, number>());
  const selectedPoemFromList = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (
      !reduceMotion &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      poemHeights.current.forEach((previousHeight, panelId) => {
        const panel = document.getElementById(panelId);
        if (!panel) return;
        const nextHeight = panel.getBoundingClientRect().height;
        if (Math.abs(nextHeight - previousHeight) < 1) return;
        panel.animate(
          [{ height: `${previousHeight}px` }, { height: `${nextHeight}px` }],
          {
            duration: 340,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          },
        );
      });
    }
    poemHeights.current.clear();
  }, [current.poem?.id, reduceMotion]);
  useEffect(() => {
    const change = () => {
      if (["#selected-poems", "#main"].includes(window.location.hash)) return;
      const next = route();
      const wasSelectedFromList =
        next.poem?.id === selectedPoemFromList.current;
      if (wasSelectedFromList) selectedPoemFromList.current = null;
      poemHeights.current = measurePoemPanels();
      setCurrent(next);
      setMenu(false);
      requestAnimationFrame(async () => {
        if (next.poem) {
          const poemElement = document.getElementById(`poem-${next.poem.id}`);
          const animations = [
            ...document.querySelectorAll(".simple-index details"),
          ].flatMap((panel) => panel.getAnimations());
          await Promise.all(
            animations.map((animation) =>
              animation.finished.catch(() => undefined),
            ),
          );
          if (window.location.hash !== `#poeme/${next.poem.id}`) return;
          if (!wasSelectedFromList) {
            const summaryTop = poemElement?.getBoundingClientRect().top;
            if (
              summaryTop !== undefined &&
              (summaryTop < 24 || summaryTop > window.innerHeight * 0.65)
            ) {
              poemElement?.scrollIntoView({
                block: "start",
                behavior:
                  reduceMotion ||
                  window.matchMedia("(prefers-reduced-motion: reduce)").matches
                    ? "instant"
                    : "smooth",
              });
            }
          }
          poemElement?.querySelector("summary")?.focus({ preventScroll: true });
        } else if (next.view !== "home") {
          window.scrollTo({ top: 0, behavior: "instant" });
          heading.current?.focus();
        }
      });
    };
    window.addEventListener("hashchange", change);
    return () => {
      window.removeEventListener("hashchange", change);
    };
  }, [reduceMotion]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try {
      localStorage.setItem("poetry-dark", JSON.stringify(dark));
    } catch {}
  }, [dark]);
  useEffect(() => {
    try {
      localStorage.setItem("poetry-favorites", JSON.stringify(favorites));
    } catch {}
  }, [favorites]);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    void loadPoemLikeState()
      .then((data) => {
        if (!active) return;
        setLikeCounts(data.counts);
        setLikedPoemIds(data.likedPoemIds);
        setLikesReady(true);
        setLikeStatus("");
      })
      .catch(() => {
        if (active)
          setLikeStatus(
            "J’aime partagés indisponibles. Vérifiez le schéma SQL et l’authentification anonyme dans Supabase.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    document.title = current.poem
      ? `${current.poem.title} · Les mots de Coco`
      : "Les mots de Coco";
  }, [current]);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 4500);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  useEffect(() => {
    if (!menu) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menu]);
  const toggleFavorite = (id: string) =>
    setFavorites((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id],
    );
    async function togglePoemLike(poemId: string) {
      if (!likesReady || pendingLike) return;
      const wasLiked = likedPoemIds.includes(poemId);
      setPendingLike(poemId);
      setLikeStatus("");
      try {
        await savePoemLike(poemId, !wasLiked);
        setLikedPoemIds((previous) =>
          wasLiked
            ? previous.filter((id) => id !== poemId)
            : [...previous, poemId],
        );
        setLikeCounts((previous) => ({
          ...previous,
          [poemId]: Math.max(0, (previous[poemId] ?? 0) + (wasLiked ? -1 : 1)),
        }));
        try {
          setLikeCounts(await loadPoemLikeCounts());
        } catch {}
      } catch {
        setLikeStatus("Impossible d’enregistrer ce J’aime. Réessayez.");
      } finally {
        setPendingLike(null);
      }
    }
  const goTo = (view: View) =>
    window.location.assign(view === "home" ? "#" : `#${view}`);
  const filtered = poems
    .filter(
      (poem) =>
        (current.view !== "favorites" || favorites.includes(poem.id)) &&
        (theme === "Tous" || theme === poem.theme) &&
        normalize(`${poem.title} ${poem.text} ${poem.theme}`).includes(
          normalize(query.trim()),
        ),
    )
    .sort((first, second) =>
      sort === "title"
        ? first.title.localeCompare(second.title, "fr")
        : sort === "newest"
          ? (second.date ?? "").localeCompare(first.date ?? "")
          : sort === "oldest"
            ? (first.date ?? "9999").localeCompare(second.date ?? "9999")
            : 0,
    );
  async function exportPdf(selection: Poem[], title: string) {
    setExporting(title);
    try {
      const { downloadCollection } = await import("./pdf");
      await downloadCollection(selection, title);
      setNotice("Votre recueil a été téléchargé.");
    } catch {
      setNotice("Le téléchargement a échoué. Veuillez réessayer.");
    } finally {
      setExporting(null);
    }
  }
  const navItems: { view: View; label: string }[] = [
    { view: "poemes", label: "POÈMES" },
    { view: "ouvrages", label: "OUVRAGES" },
  ];
  const activeNavView = current.view === "ouvrages" ? "ouvrages" : "poemes";
  const simpleHeader = (
    <header className="simple-header">
      <a className="simple-brand" href="#poemes" aria-label="Les mots de Coco">
        <Feather size={26} strokeWidth={1.1} aria-hidden="true" />
        <span>Les mots de Coco</span>
      </a>
      <nav className="simple-main-nav" aria-label="Navigation principale">
        {navItems.map((item) => (
          <a
            key={item.view}
            href={`#${item.view}`}
            className={activeNavView === item.view ? "active" : ""}
            aria-current={activeNavView === item.view ? "page" : undefined}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  );
  const simpleFooter = (
    <footer className="simple-footer">
      <Feather size={19} strokeWidth={1.1} aria-hidden="true" />
      <p>Un héritage de mots transmis à travers les générations.</p>
      <p className="simple-quote">
        La dictature, c’est « ferme ta gueule » ; la démocratie, c’est « cause
        toujours ».
      </p>
    </footer>
  );
  const iconButton = (
    label: string,
    action: () => void,
    icon: ReactNode,
    active = false,
  ) => (
    <button
      className={`icon-button ${active ? "selected" : ""}`}
      onClick={action}
      title={label}
      aria-label={label}
      aria-pressed={active}
    >
      {icon}
    </button>
  );
  function renderCard(poem: Poem, index: number) {
    return (
      <motion.article
        className="poem-card"
        key={poem.id}
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: Math.min(index * 0.06, 0.24) }}
      >
        <div className="card-top">
          <div className="card-kicker">
            <span className="card-number" aria-hidden="true">
              {String(poems.indexOf(poem) + 1).padStart(2, "0")}
            </span>
            <span className="theme-label">{poem.theme}</span>
          </div>
          {iconButton(
            favorites.includes(poem.id)
              ? `Retirer ${poem.title} des favoris`
              : `Ajouter ${poem.title} aux favoris`,
            () => toggleFavorite(poem.id),
            <Heart
              size={17}
              strokeWidth={1.5}
              fill={favorites.includes(poem.id) ? "currentColor" : "none"}
            />,
            favorites.includes(poem.id),
          )}
        </div>
        <h3>
          <a href={`#poeme/${poem.id}`}>{poem.title}</a>
        </h3>
        <p className="card-excerpt">
          {poem.text.split("\n").slice(0, 3).join("\n")}
        </p>
        <div className="card-bottom">
          <span>
            {poem.date ? new Date(poem.date).getUTCFullYear() : "Sans date"}
            <span className="meta-dot">·</span>
            {readingMinutes(poem.text)} min
          </span>
          <a href={`#poeme/${poem.id}`} aria-label={`Lire ${poem.title}`}>
            Lire le poème <ArrowRight size={15} />
          </a>
        </div>
      </motion.article>
    );
  }
  if (current.view === "ouvrages") {
    return (
      <div className="simple-site">
        <a className="skip-link" href="#main">
          Aller au contenu
        </a>
        {simpleHeader}
        <main id="main" tabIndex={-1} className="simple-main">
          <section className="simple-tribute simple-ouvrages">
            <h1 ref={heading} tabIndex={-1} className="simple-title">
              Ouvrages
            </h1>
            <BookOpen size={34} strokeWidth={1.2} aria-hidden="true" />
            <p className="simple-remembrance">
              Aucun ouvrage pour le moment.
            </p>
          </section>
        </main>
        {simpleFooter}
      </div>
    );
  }
  if (
    current.view === "home" ||
    current.view === "poemes" ||
    current.poem ||
    current.missing
  ) {
    return (
      <div className="simple-site">
        <a className="skip-link" href="#main">
          Aller au contenu
        </a>
        {simpleHeader}
        <main id="main" tabIndex={-1} className="simple-main">
          <section
            className="simple-tribute"
            aria-label="Hommage à notre Coco"
          >
            <figure className="simple-portrait">
              <img
                src={cocoPortrait}
                alt="Coco"
                width={1080}
                height={608}
                fetchPriority="high"
              />
            </figure>
            <p className="simple-dedication">
              À la mémoire de notre Coco
            </p>
            <h1 ref={heading} tabIndex={-1} className="simple-title">
              Les mots de <span>Coco</span>
            </h1>
            <p className="simple-remembrance">
              Dont les mots continueront de traverser le temps.
            </p>
            <p className="simple-memorial-date">
              Décédé le <time dateTime="2026-09-21">21 septembre 2026</time>
            </p>
            <div className="simple-tribute-rule" aria-hidden="true" />
          </section>
          {current.missing && (
            <p role="alert" className="simple-date">
              Ce poème est introuvable.
            </p>
          )}
          {likeStatus && (
            <p className="simple-likes-status" role="status">
              {likeStatus}
            </p>
          )}
          <ul
            className="simple-index"
            aria-busy={isSupabaseConfigured && !likesReady}
          >
            {poemsAlphabetically.map((poem) => {
              const isLiked = likedPoemIds.includes(poem.id);
              const likeCount = likeCounts[poem.id] ?? 0;
              return (
                <li key={poem.id}>
                  <button
                    className="simple-like-button"
                    type="button"
                    disabled={!likesReady || pendingLike !== null}
                    title={
                      isLiked
                        ? `Retirer votre J’aime sur ${poem.title}`
                        : `J’aime ${poem.title}`
                    }
                    aria-label={
                      isLiked
                        ? `Retirer votre J’aime sur ${poem.title}, ${likeCount} J’aime`
                        : `J’aime ${poem.title}, ${likeCount} J’aime`
                    }
                    aria-pressed={isLiked}
                    onClick={() => void togglePoemLike(poem.id)}
                  >
                    <Heart
                      size={18}
                      strokeWidth={1.7}
                      fill={isLiked ? "currentColor" : "none"}
                      aria-hidden="true"
                    />
                    <span aria-hidden="true">{likeCount}</span>
                  </button>
                  <details
                    id={`poem-${poem.id}`}
                    open={current.poem?.id === poem.id}
                  >
                    <summary
                      role="button"
                      aria-expanded={current.poem?.id === poem.id}
                      aria-controls={`text-${poem.id}`}
                      onClick={(event) => {
                        event.preventDefault();
                        if (current.poem?.id === poem.id) {
                          poemHeights.current = measurePoemPanels();
                          window.history.pushState(
                            null,
                            "",
                            window.location.pathname + window.location.search,
                          );
                          setCurrent(route());
                        } else {
                          selectedPoemFromList.current = poem.id;
                          window.location.assign(`#poeme/${poem.id}`);
                        }
                      }}
                    >
                      <h2>{poem.title}</h2>
                      <ChevronDown size={18} aria-hidden="true" />
                    </summary>
                    <article
                      id={`text-${poem.id}`}
                      className="simple-poem"
                      aria-label={poem.title}
                    >
                      {poem.date && (
                        <p className="simple-date">{formatDate(poem.date)}</p>
                      )}
                      {poem.dedication && (
                        <p className="simple-poem-dedication">
                          {poem.dedication}
                        </p>
                      )}
                      <div className="simple-verses">
                        {poem.text.split("\n\n").map((stanza, index) => (
                          <p key={index}>{stanza}</p>
                        ))}
                      </div>
                      {isDemo && (
                        <p className="simple-demo">Texte de démonstration</p>
                      )}
                    </article>
                  </details>
                </li>
              );
            })}
          </ul>
          {poems.length === 0 && (
            <p className="simple-date">Aucun poème pour le moment.</p>
          )}
          {isDemo && (
            <p className="simple-demo">
              Textes de démonstration, à remplacer par les œuvres de votre
              grand-père.
            </p>
          )}
        </main>
        {simpleFooter}
      </div>
    );
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Aller au contenu
      </a>
      <header className="site-header">
        <a href="#poemes" className="brand" aria-label="Les mots de Coco">
          <Feather size={25} strokeWidth={1.3} />
          <span>
            Les mots de Coco
            <span className="brand-sub">UN HÉRITAGE DE MOTS</span>
          </span>
        </a>
        <nav className="desktop-nav" aria-label="Navigation principale">
          {navItems.map((item) => (
            <a
              key={item.view}
              href={`#${item.view}`}
              className={activeNavView === item.view ? "active" : ""}
              aria-current={activeNavView === item.view ? "page" : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          {iconButton(
            "Mes favoris",
            () => goTo("favorites"),
            <Heart size={19} />,
            current.view === "favorites",
          )}
          {iconButton(
            dark ? "Activer le mode clair" : "Activer le mode sombre",
            () => setDark(!dark),
            dark ? <Sun size={19} /> : <Moon size={19} />,
          )}
          <button
            className="icon-button mobile-menu"
            aria-label="Menu"
            aria-expanded={menu}
            aria-controls="mobile-navigation"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>
      {menu && (
        <nav
          id="mobile-navigation"
          className="mobile-nav"
          aria-label="Navigation mobile"
        >
          {navItems.map((item) => (
            <a
              key={item.view}
              href={`#${item.view}`}
              onClick={() => setMenu(false)}
              aria-current={activeNavView === item.view ? "page" : undefined}
            >
              {item.label}
            </a>
          ))}
          <a href="#index">Index des poèmes</a>
        </nav>
      )}
      <main id="main" tabIndex={-1}>
        {current.view === "collections" ? (
          <section className="content-width inner-section">
            <div className="page-heading">
              <div className="eyebrow">LES MOTS À EMPORTER</div>
              <h1 ref={heading} tabIndex={-1}>
                Les recueils
              </h1>
              <p>Un recueil complet ou quelques poèmes réunis par thème.</p>
            </div>
            <div className="complete-collection">
              <BookOpen size={54} strokeWidth={1} />
              <div>
                <span className="eyebrow">L’ENSEMBLE DES POÈMES</span>
                <h2>Le recueil intégral</h2>
                <p>{poems.length} poèmes · Index inclus · PDF</p>
              </div>
              <button
                className="primary-button"
                disabled={exporting !== null}
                onClick={() => exportPdf(poems, "Le recueil intégral")}
              >
                <Download size={17} />
                {exporting === "Le recueil intégral"
                  ? "Préparation…"
                  : "Télécharger le recueil"}
              </button>
            </div>
            <h2 className="subheading">Les recueils thématiques</h2>
            <div className="collections-grid">
              {themes.map((item, index) => (
                <article className="theme-collection" key={item}>
                  <div className="collection-number">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <h3>{item}</h3>
                  <p>
                    {poems.filter((poem) => poem.theme === item).length} poèmes
                    · PDF
                  </p>
                  <button
                    className="text-button"
                    disabled={exporting !== null}
                    onClick={() =>
                      exportPdf(
                        poems.filter((poem) => poem.theme === item),
                        item,
                      )
                    }
                  >
                    <Download size={16} />
                    {exporting === item ? "Préparation…" : "Télécharger"}
                  </button>
                </article>
              ))}
            </div>
          </section>
        ) : current.view === "index" ? (
          <section className="content-width inner-section">
            <div className="page-heading">
              <div className="eyebrow">DE LA PREMIÈRE À LA DERNIÈRE PAGE</div>
              <h1 ref={heading} tabIndex={-1}>
                L’index des poèmes
              </h1>
              <p>{poems.length} poèmes, classés par ordre alphabétique.</p>
            </div>
            <div className="poem-index">
              {[...poems]
                .sort((first, second) =>
                  first.title.localeCompare(second.title, "fr"),
                )
                .map((poem, index) => (
                  <a href={`#poeme/${poem.id}`} key={poem.id}>
                    <span className="index-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="index-title">{poem.title}</span>
                    <span className="index-theme">{poem.theme}</span>
                    <ArrowRight size={18} />
                  </a>
                ))}
            </div>
          </section>
        ) : (
          <section className="content-width inner-section reading-library">
            <div className="page-heading">
              <div className="eyebrow">
                {current.view === "favorites"
                  ? "LES MOTS QUE L’ON GARDE"
                  : "LE RECUEIL VIVANT"}
              </div>
              <h1 ref={heading} tabIndex={-1}>
                {current.view === "favorites"
                  ? "Mes poèmes favoris"
                  : "La bibliothèque des poèmes"}
              </h1>
              <p>
                {current.view === "favorites"
                  ? "Les pages auxquelles vous aimez revenir."
                  : "Un héritage de mots transmis à travers les générations."}
              </p>
            </div>
            {current.missing && (
              <p role="alert" className="missing-poem">
                Ce poème est introuvable. Retrouvez les autres textes
                ci-dessous.
              </p>
            )}
            <div className="library-toolbar">
              <label className="search-field">
                <Search size={19} />
                <span className="sr-only">
                  Rechercher un mot, une expression ou un thème
                </span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Un mot, une expression, un thème…"
                  type="search"
                />
                {query && (
                  <button
                    aria-label="Effacer la recherche"
                    onClick={() => setQuery("")}
                  >
                    <X size={16} />
                  </button>
                )}
              </label>
              <label className="sort-field">
                <span className="sr-only">Classer les poèmes</span>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="original">Ordre du recueil</option>
                  <option value="title">Ordre alphabétique</option>
                  <option value="newest">Les plus récents</option>
                  <option value="oldest">Les plus anciens</option>
                </select>
                <ChevronDown size={15} />
              </label>
            </div>
            <div className="theme-filters" aria-label="Filtrer par thème">
              {["Tous", ...themes].map((item) => (
                <button
                  aria-pressed={theme === item}
                  className={theme === item ? "active" : ""}
                  key={item}
                  onClick={() => setTheme(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="results-line">
              <span role="status">
                {filtered.length} {filtered.length === 1 ? "poème" : "poèmes"}
                {query ? ` pour « ${query} »` : ""}
              </span>
              <a href="#index">
                <List size={15} /> Index alphabétique
              </a>
            </div>
            {filtered.length ? (
              <div className="poem-grid">{filtered.map(renderCard)}</div>
            ) : (
              <div className="empty-state">
                <BookOpen size={38} strokeWidth={1} />
                <h2>
                  {current.view === "favorites" && favorites.length === 0
                    ? "Vos pages préférées vous attendent."
                    : "Aucun poème trouvé."}
                </h2>
                <p>
                  {current.view === "favorites" && favorites.length === 0
                    ? "Aucun favori enregistré pour le moment."
                    : "Essayez un autre mot ou un autre thème."}
                </p>
                <button
                  className="text-button"
                  onClick={() => {
                    setQuery("");
                    setTheme("Tous");
                    if (current.view === "favorites") goTo("library");
                  }}
                >
                  Voir tous les poèmes <ArrowRight size={16} />
                </button>
              </div>
            )}
          </section>
        )}
      </main>
      <footer className="site-footer">
        <Feather size={24} strokeWidth={1} />
        <p>
          À la mémoire de notre Coco,
          <br />
          dont les mots continueront de traverser le temps.
        </p>
        <span>Décédé le 21 septembre 2026</span>
        <div className="footer-bottom">
          <span>Les Poèmes · Un héritage à partager</span>
          {isDemo && <span>Édition de démonstration · Textes à remplacer</span>}
          <a href="#index">Index des poèmes</a>
        </div>
      </footer>
      <AnimatePresence>
        {notice && (
          <motion.div
            role="status"
            className="toast"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Check size={17} />
            {notice}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default App;
