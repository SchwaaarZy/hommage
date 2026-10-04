# Les Poèmes

Un site de transmission exclusivement consacré aux poèmes, sans biographie.
React, TypeScript, Vite, Tailwind CSS, Framer Motion, Lucide et jsPDF.

Le parcours principal tient sur une seule page : un hommage centré et les titres des poèmes classés alphabétiquement. Cliquer sur un titre déplie le texte juste en dessous ; cliquer de nouveau le referme. Un seul poème reste ouvert à la fois. Un bouton J’aime et son compteur partagé apparaissent à côté de chaque titre. Sur mobile, le menu Poèmes/Ouvrages reste accessible dans une barre flottante.

## Démarrage

```sh
npm install
npm run dev
npm run build
npm run lint
npx playwright install chromium
npx playwright test
```

Les tests standards couvrent les formats ordinateur, tablette et mobile, de 320 à 1920 pixels, ainsi que le paysage. Ils vérifient également les titres longs, les zones tactiles, le centrage et la fluidité des volets. Pour ajouter le moteur Firefox :

```sh
npx playwright install firefox
TEST_FIREFOX=1 npx playwright test --project=firefox
```

Le lancement automatisé de Firefox peut être limité par l’environnement local, indépendamment du navigateur Firefox utilisé pour consulter le site.

Pour l’aperçu avec le bouton **Go Live**, Live Server sert le dossier `dist` sur le port 5000 et ouvre Firefox. Après une modification, relancer `npm run build`, puis actualiser la page.

## Ajouter les véritables œuvres

Le site contient 25 textes transcrits à partir des 29 pages fournies, signées Yves Cholet. Les illustrations ne sont pas intégrées pour le moment. Aucune date de rédaction n’est inventée.

Les textes sont regroupés dans `assets/poemes.json`. Le guide `assets/README.md` explique le format, l’ajout de poèmes, les images sources et les dédicaces.

Le nom `Yves Cholet` et `isDemo = false` sont renseignés dans `src/poems.ts`.

Chaque poème contient un `id` stable et unique, un `title`, un `theme`, le `text` intégral et une `date` facultative au format `AAAA-MM-JJ`. Utiliser `\n` pour un retour à la ligne et `\n\n` pour séparer les strophes. Conserver les identifiants après publication pour préserver les liens partagés.

Les thèmes, l’index, les temps de lecture et les PDF se mettent à jour automatiquement. La recherche ignore les accents et la casse, et accepte les apostrophes droites ou typographiques. Les textes sont affichés comme du texte, jamais comme du HTML.

## Fonctions et confidentialité

- Hommage et titres centrés, sans formulaire ni menu.
- Lecture intégrale sur place, avec volets accessibles au clavier et historique du navigateur conservé.
- Ouverture et fermeture progressives, sans retour en haut de page lors de la fermeture. Les animations et le défilement respectent la préférence de réduction des mouvements, y compris lorsqu’elle change pendant la visite.
- Liens directs `/#poeme/identifiant`, à partager en copiant l’adresse de la page.
- J’aime partagés et compteur par poème, enregistrés dans Supabase.
- Les anciens outils sont conservés sur les routes secondaires `/#library`, `/#favorites`, `/#index` et `/#collections`, sans lien dans le parcours principal.
- Polices servies localement ; seuls les J’aime partagés utilisent Supabase, sans outil d’analyse d’audience.

## J’aime partagés

Le compteur est commun aux visiteurs. Chaque visiteur reçoit une identité anonyme Supabase ; la base n’accepte qu’un J’aime par personne et par poème. Les identités anonymes restent propres à leur navigateur et peuvent être recréées si ses données sont effacées.

1. Activer **Anonymous Sign-Ins** dans les réglages d’authentification Supabase.
2. Exécuter `supabase/schema.sql` dans l’éditeur SQL du projet.
3. Copier `.env.example` vers `.env.local` et renseigner l’URL du projet et sa clé `sb_publishable`.
4. Redémarrer Vite avec `npm run dev`.

La clé publishable est destinée au navigateur. Ne jamais utiliser une clé `service_role` côté client. Les règles RLS limitent chaque utilisateur à ses propres J’aime ; une fonction SQL séparée expose uniquement les totaux.

## Déploiement

Publier le dossier `dist` obtenu avec `npm run build` sur un hébergement statique en HTTPS. Les J’aime utilisent le projet Supabase configuré dans les variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`. Le routage par fragment permet l’ouverture directe des poèmes sans configuration de réécriture. Pour une publication dans un sous-dossier, configurer `base` dans `vite.config.ts`.

## Ressources

Photographie de carnet : [source Unsplash](https://images.unsplash.com/photo-1455390582262-044cdead277a), [conditions](https://unsplash.com/license).
Polices : Crimson Text et Manrope, sous la SIL Open Font License. Licences incluses dans `public/fonts`.
# hommage
