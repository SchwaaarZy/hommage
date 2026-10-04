# Ajouter vos poèmes

Le fichier `poemes.json` contient les neuf poèmes transcrits à partir des images fournies, signées Yves Cholet. Les images originales restent dans ce dossier et chaque texte propose un lien « Voir la version illustrée ».

Les dates absentes des images ne sont pas renseignées. Les thèmes sont des catégories éditoriales utilisées uniquement dans les outils secondaires. Le poème « 1968 » conserve sa dédicace « À Yves Amiet » ; son titre n’est pas transformé en date.

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
- `sourceImage` : facultatif, nom exact d’une image PNG conservée dans ce dossier, extension comprise. Le site crée le lien vers la version illustrée.
- `dedication` : facultative, dédicace figurant dans l’œuvre, affichée avant les vers et conservée dans les PDF.

Pour ajouter plusieurs poèmes, placez leurs blocs entre les crochets et séparez les blocs par une virgule. Le fichier doit rester au format JSON valide ; VS Code signale les erreurs de syntaxe.

Le nom `Yves Cholet` et le réglage `isDemo = false` sont déjà renseignés dans `src/poems.ts`.

Pour voir vos changements avec **Go Live**, lancez `npm run build` dans le terminal du projet, puis actualisez Firefox sur `http://127.0.0.1:5000`.

Les neuf images actuelles ont été transcrites et intégrées. Pour de nouveaux fichiers PDF, Word ou images, ajouter également la transcription dans `poemes.json` : déposer un fichier seul ne crée pas automatiquement un nouveau poème.
