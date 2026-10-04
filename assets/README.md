# Ajouter vos poèmes

Le fichier `poemes.json` contient les 25 textes transcrits à partir des 29 pages numérisées de l'œuvre d'Yves Cholet. Le site affiche uniquement les textes ; les images ne sont pas intégrées pour le moment.

Les dates absentes du document ne sont pas renseignées. Les thèmes sont des catégories éditoriales utilisées uniquement dans les outils secondaires. Le poème « 1968 » conserve sa dédicace « À Yves Amiot » ; son titre n’est pas transformé en date. Les textes d'ouverture et de clôture sont également conservés.

Chaque poème prend cette forme :

```json
[
  {
    "id": "mon-premier-poeme",
    "title": "Titre du poème",
    "theme": "Nature",
    "date": "2020-04-15",
    "text": "Premier vers\nDeuxième vers\n\nPremière ligne de la deuxième strophe"
  }
]
```

- `id` : identifiant unique, sans espace ni accent, à conserver après publication pour ne pas casser les liens.
- `title` : titre du poème.
- `theme` : thème de votre choix ; les filtres sont créés automatiquement.
- `date` : facultative, au format `AAAA-MM-JJ`. Supprimez cette ligne si la date est inconnue.
- `text` : texte complet. `\n` crée un retour à la ligne, `\n\n` sépare deux strophes. Pour insérer des guillemets droits dans le texte, écrivez `\"`.
- `dedication` : facultative, dédicace figurant dans l’œuvre, affichée avant les vers et conservée dans les PDF.

Pour ajouter plusieurs poèmes, placez leurs blocs entre les crochets et séparez les blocs par une virgule. Le fichier doit rester au format JSON valide ; VS Code signale les erreurs de syntaxe.

Le nom `Yves Cholet` et le réglage `isDemo = false` sont déjà renseignés dans `src/poems.ts`.

Pour voir vos changements avec **Go Live**, lancez `npm run build` dans le terminal du projet, puis actualisez Firefox sur `http://127.0.0.1:5000`.

Pour de nouveaux fichiers PDF, Word ou images, ajouter également la transcription dans `poemes.json` : déposer un fichier seul ne crée pas automatiquement un nouveau poème. Les textes numérisés pouvant contenir des caractères ambigus, vérifier chaque transcription sur le document source avant publication.
