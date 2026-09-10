# deploy-setup

Ce qu'une fusion dans `main` suppose déjà en place, et qui n'est posé par aucune
fusion. La tâche 12 du plan de la tranche 4 est la version en prose de cet
outil ; celui-ci est la version qui se vérifie.

```bash
npx nx run deploy-setup:audit -- --check   # lit et imprime l'écart, n'écrit rien
npx nx run deploy-setup:audit              # imprime l'écart, demande, puis le comble
npx nx run deploy-setup:secrets            # demande les secrets qui n'en ont pas
npx nx run deploy-setup:secrets -- --all   # les redemande tous, pour une rotation
npx nx run deploy-setup:repo               # les variables du dépôt, et la protection de main
npx nx run deploy-setup:repo -- --check    # lit et imprime l'écart, n'écrit rien
```

Il faut un `gcloud` authentifié sur un compte qui a le droit d'administrer l'IAM
du projet — le tien, pas celui qu'il installe — et un `gh` authentifié sur le
dépôt.

Les trois cibles couvrent les étapes 3 à 6 de la tâche 12. Ce qu'elles
laissent : la fusion elle-même, qui est la décision d'un humain (§10).

**Ce qu'il affiche est en français, et c'est une exception assumée** à la règle
« interface en anglais » de `CLAUDE.md`. Cette règle protège le produit, que des
joueurs lisent ; ici le seul lecteur est l'administrateur du dépôt, et ce qu'il
lit décide s'il accorde un droit d'administrateur sur le projet de production.
Les identifiants restent en anglais.

## Les secrets

Les cinq noms ne sont pas écrits ici : ils se lisent dans `container.ts`, dans
les `defineSecret`. Une liste tenue à côté dérive, et c'est arrivé — celle de
`tools/dev-secrets.mjs` a passé une tranche entière sans `S3_SECRET_KEY`, ce qui
s'est vu comme un émulateur incapable de s'authentifier au milieu d'une session,
loin du commit fautif.

Un secret qui existe mais dont toutes les versions sont détruites est traité
comme vide, parce que c'est exactement la panne que la tâche 12 décrit : la CLI
demande la valeur, `--non-interactive` transforme la question en erreur, et ça
tombe après que `firebase deploy` a commencé.

La commande est affichée **avant** qu'on demande la valeur, pas après qu'elle est
posée : ce à quoi on s'apprête à confier un identifiant est ce qu'il faut lire,
et le lire ensuite c'est lire un reçu. Une saisie vide saute le secret.

La valeur tapée n'est pas affichée, n'atteint aucun fichier, et ne passe pas par
`argv` — où n'importe quelle liste de processus la lirait. Elle va dans stdin de
`firebase functions:secrets:set … --data-file -`, et nulle part ailleurs. Aucun
saut de ligne n'est ajouté : `--data-file` stocke les octets qu'on lui donne, et
un secret terminé par `\n` ne s'authentifie nulle part tout en ressemblant, dans
toutes les consoles, au bon.

## Les variables du dépôt, et la protection de `main`

Les onze noms se lisent dans `deploy.yml`, dans ses `vars.X` — pas dans une
liste tenue ici, qui dériverait le jour où le workflow en lit une douzième.

**Sur les onze, une seule catégorie t'est demandée.** Trois viennent de
`wanted.ts`, qui sait déjà le projet, le compte et le fournisseur qu'il vient de
créer ; quatre viennent de `.env.example`, que le dépôt porte en clair ; une
reste vide exprès. Restent trois valeurs qu'aucun fichier du dépôt ne peut
connaître, et l'outil dit à côté de chaque question où on la lit.

Te faire recopier ce que le code sait est précisément comment un `principalSet`
finit par nommer l'identifiant du projet au lieu de son numéro : la liaison est
acceptée, personne ne la refuse, et le premier déploiement échoue sur un message
de permissions.

`AGENT_ENDPOINT` n'est jamais demandée. C'est l'url d'une Function que ce
déploiement-là crée : l'exiger rendrait le premier déploiement impossible, et
c'est le seul cas qu'un amorçage doit survivre.

Une variable posée à la chaîne vide compte comme absente. C'est l'état exact que
la garde de `deploy.yml` refuse par son nom, parce que `vars.X` sur une variable
que personne n'a créée vaut la chaîne vide et que rien ne devient rouge.

**La protection de `main` se lit dans les rulesets, et non dans l'API
historique** `branches/main/protection`. C'était la première lecture de cet
outil et son pire défaut : une branche protégée par un ruleset répond 404
là-bas, donc un dépôt correctement configuré était annoncé grand ouvert — et le
geste proposé pour le fermer aurait posé un second mécanisme par-dessus le
premier, deux endroits à lire et deux à tenir à jour.

Ce qu'il exige : ni suppression, ni poussée forcée, et **la vérification
`verify` de `pull-request.yml`**. Sans cette dernière une pull request se
fusionne alors que ses tests sont rouges, et une fusion est la mise en
production. C'est aussi elle qui interdit la poussée directe, sans qu'aucune
règle ne le dise : `verify` ne se déclenche que sur une pull request, donc rien
de poussé directement ne peut la satisfaire.

Le corps de la requête est imprimé avant d'être envoyé, et il passe par un
fichier — c'est du json, et `commandLine` refuse une guillemet double pour de
bonnes raisons.

## Ce que l'audit lit, et ce qu'il en fait

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

`gcloud` n'est appelé qu'à un seul endroit, `lib/cli.ts`, qui ne porte aucune
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

Il ne fusionne pas, ne déploie pas, et ne crée aucune ressource facturée. Ce
qu'il pose est de la configuration : des droits, des noms et une politique de
branche.
