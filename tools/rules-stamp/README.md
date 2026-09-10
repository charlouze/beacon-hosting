# rules-stamp

Le tampon de version que le déploiement pose, et la moitié visible du garde-fou
qui recharge l'onglet resté ouvert depuis hier.

Le calcul n'existe qu'une fois dans le dépôt, mais il peut exister deux fois en
production : un onglet ouvert hier exécute le `libs/session` d'hier contre le
`config/settings` et le watchdog d'aujourd'hui. Le déploiement écrit la
référence du commit à deux endroits — `config/settings.rulesVersion` côté base,
`apps/web/src/app/rules-version.ts` côté paquet — et le navigateur recharge dès
que les deux divergent.

## `rules-stamp:stamp` — le geste de chaque déploiement

```bash
npx nx run rules-stamp:stamp -- 9c1f2e3
```

Réécrit une seule ligne d'`apps/web/src/app/rules-version.ts`, avant le build.
Il refuse tout ce qui n'est pas `[0-9a-f]{7,40}` : la valeur atterrit dans un
littéral de chaîne d'un fichier que le build compile, et un guillemet ne ferait
pas échouer le tampon, il ferait échouer le build des heures plus tard.

Dans un dépôt qui n'a pas été tamponné, le module vaut `'dev'` — une valeur
qu'aucun déploiement ne pose, donc qui ne dérive jamais contre elle-même.

## Pourquoi un projet à lui, et pas un dossier d'`apps/web`

L'outil lit et écrit des fichiers. Le compilateur Angular refuse `node:fs`, et
la cible `test` d'`apps/web` ne découvre que ce qui vit sous son `sourceRoot` :
un spec posé à côté n'aurait jamais tourné, tout en passant pour vert.
