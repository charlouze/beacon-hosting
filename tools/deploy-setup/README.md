# deploy-setup

Le compte de service avec lequel une fusion dans `main` déploie, et tout ce qui
doit être vrai de lui. La tâche 12 du plan de la tranche 4 est la version en
prose de cet outil ; celui-ci est la version qui se vérifie.

```bash
npx nx run deploy-setup:audit -- --check   # lit et imprime l'écart, n'écrit rien
npx nx run deploy-setup:audit              # imprime l'écart, demande, puis le comble
```

Il faut un `gcloud` authentifié sur un compte qui a le droit d'administrer l'IAM
du projet — le tien, pas celui qu'il installe.

**Ce qu'il affiche est en français, et c'est une exception assumée** à la règle
« interface en anglais » de `CLAUDE.md`. Cette règle protège le produit, que des
joueurs lisent ; ici le seul lecteur est l'administrateur du dépôt, et ce qu'il
lit décide s'il accorde un droit d'administrateur sur le projet de production.
Les identifiants restent en anglais.

## Ce qu'il lit, et ce qu'il en fait

Sept lectures, aucune écriture avant la question : le compte existe-t-il, quels
rôles porte-t-il, quelles API sont activées, le pool est-il là, le fournisseur
OIDC est-il là et **sa condition verrouille-t-elle le dépôt et la branche**, et
le dépôt a-t-il le droit d'usurper le compte.

De ces sept lectures il calcule une liste de gestes et l'imprime en entier, pour
qu'on voie l'écart avant d'en discuter. Puis **il demande commande par
commande** : ce qui manque, une phrase sur ce que la commande fait, la ligne
exacte, et `[o/N/q]`. `q` arrête là.

Les deux phrases sont distinctes et le geste porte les deux. « Aucun compte
nommé X » dit ce qui manque, pas ce que la commande va faire — et c'est sur la
seconde qu'on consent. Un test parcourt tout ce que l'outil sait proposer, sur
un projet vide, et refuse le geste dont l'une des deux est absente : c'est ce
qui empêche un geste ajouté plus tard de passer avec un constat pour toute
explication.

Un seul `o` pour treize rôles d'administrateur, ce sont treize décisions que
personne n'a prises. Et pouvoir en refuser une doit rester possible : c'est
aussi ce qui permet de poser le compte sans les API, ou l'inverse, quand on
diagnostique. Ce que chaque rôle débloque est donc une donnée dans `wanted.ts`,
pas un commentaire — un test refuse un rôle dont la raison est vide, parce
qu'une raison manquante ramène le geste à son nom seul, et l'assentiment en bloc
avec lui.

Un passage partiel se termine sur un décompte et un code de sortie non nul :
sinon il ressemble trait pour trait à un passage complet, et le déploiement qu'il
prépare à moitié échoue sur la permission qu'on a déclinée.

Il est **idempotent** : relancé sur un compte déjà posé, il ne propose rien. La
question à laquelle il répond en priorité n'est donc pas « comment installer »,
qui n'arrive qu'une fois, mais « est-ce que c'est toujours bien posé », qui se
repose tous les six mois.

## Pourquoi le calcul est séparé de l'appel

`gcloud` n'est appelé qu'à un seul endroit, `lib/gcloud.ts`, qui ne porte aucune
décision. Tout ce qui décide — l'état voulu, la lecture des politiques, la
condition OIDC, la composition des gestes — est pur et testé.

C'est ce qui rend l'outil testable alors qu'il pilote un compte de production
auquel aucun test n'a le droit de toucher : les tests passent la sortie JSON de
`gcloud` à des fonctions, et vérifient les gestes qui en sortent sans qu'aucun
ne soit exécuté.

## Les deux pièges que les tests tiennent

**Un rôle lié sous condition ne compte pas.** Une liaison conditionnelle est un
autre droit, et celles qui apparaissent sur un compte de déploiement sont celles
qui expirent. Comptée comme acquise, l'audit serait vert le matin où la
permission tombe.

**Un fournisseur déjà là se met à jour, il ne se crée pas.** Sa condition est
toute la différence entre un dépôt qui peut déployer et tous les dépôts de
GitHub. Confiée à `create-oidc`, la correction serait refusée à chaque passage
et le défaut survivrait à toutes les exécutions de l'outil.

## Ce qu'il ne fait pas

Il ne pose ni les variables de dépôt GitHub, ni les cinq secrets de Secret
Manager, ni la protection de `main`. Les secrets se posent depuis un poste avec
`firebase functions:secrets:set`, et leur valeur ne doit traverser aucun outil
qui l'écrirait quelque part.
