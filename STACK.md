# Stack

Choisie par le commanditaire, pas déléguée. Ce fichier dit **ce qu'on utilise et
ce qui n'est pas négociable dedans**. Comment les pièces s'emboîtent est
l'affaire du spec (§4).

## Les trois couches

**Application** — monorepo Nx, Angular, TypeScript de bout en bout, styles en
Tailwind CSS. `apps/web` est déployé sur Firebase Hosting.

Tailwind se configure **depuis le contrat de direction**, jamais sur ses valeurs
par défaut : la palette, les trois poids de filets, l'espacement de capitales et
l'échelle de chiffres tabulaires viennent tous de `.impeccable/DIRECTION.md`.
Une classe utilitaire qui ne correspond à rien dans ce contrat est un défaut,
pas un raccourci. Le mode sombre est désactivé et il n'existe aucune variante
`dark:` sur ce produit — c'est la première contrainte ferme, appliquée à
l'outillage plutôt que rappelée en commentaire.

**Plan de contrôle** — Firebase, **un seul projet** : Hosting, Auth (Google),
Firestore, Functions gen2, Cloud Scheduler. Il n'y a pas d'environnement de
préproduction ; l'émulateur en tient lieu. La conséquence est assumée —
déployer les règles touche directement la base que les joueurs utilisent — et
c'est la raison pour laquelle leurs tests de refus sont une barrière de
déploiement.

**Serveur de jeu** — OVH, région GRA (Gravelines) : Public Cloud pour le calcul
(`b3-8` par défaut, sélecteur réservé à l'admin), Object Storage pour les
sauvegardes, DynHost pour le DNS. Trois services, trois protocoles, trois jeux
d'identifiants — donc trois adapters, `ovh-compute`, `ovh-storage`, `ovh-dns`.

L'arborescence du monorepo et le rôle de chaque `libs/*` sont au §4 du spec.

## Tests

**Vitest** pour tout l'unitaire. Le gros de l'effort porte sur `libs/session`,
en tests purs avec un `Clock` bouchonné : ils n'instancient ni Firestore ni OVH,
et le jour où l'un d'eux en a besoin, c'est le noyau de décision qui a laissé
fuir une dépendance.

**Playwright** pour le bout en bout de `apps/web`.

Deux familles échappent à ces deux-là, et le spec les pose nommément au §9 :

- les **règles Firestore** ont leur propre suite, écrite avec
  `@firebase/rules-unit-testing` contre l'émulateur, et testée **par ses refus** ;
- le **test de fumée `docker-compose`** est en shell, dans GitHub Actions. C'est
  le seul endroit du système où un bug détruit des données irremplaçables.

Les tests de contrat de l'adapter OVH se lancent à la demande contre le compte
réel, jamais en intégration continue — voir les identifiants, plus bas.

## Conteneurs

`mornedhels/enshrouded-server` est consommée **telle quelle** : elle gère déjà
SteamCMD, Wine, supervisord et les backups périodiques. La forker nous priverait
des mises à jour amont pour un bénéfice nul.

La **seule image maison** est le compagnon (`rclone` + `curl`), poussée sur
ghcr.io par son propre workflow.

Les deux images sont référencées par un **tag immuable, jamais `latest`**. Le
`cloud-init` est écrit au moment du provisionnement : avec un tag mobile, la
session de ce soir pourrait tirer une image différente de celle qui a été
testée. Changer de version est un commit, pas un effet de bord.

## Identifiants

**Les identifiants OVH n'entrent pas dans GitHub.** Ils vivent dans Secret
Manager ; les tests de contrat contre le compte réel se lancent depuis la
machine du développeur, jamais depuis un runner. Une copie dans les secrets
GitHub en ferait un second dépôt à protéger, avec un modèle de menace différent
et une surface plus large.

Le déploiement Firebase, lui, s'authentifie par **identité fédérée GitHub
(OIDC)** vers un compte de service dédié — aucune clé de longue durée
entreposée.

## Ce qui a été écarté, et ce qui reste en repli

**Scaleway** est le repli naturel si l'API OpenStack d'OVH s'avère pénible. Il
ne concerne que le **calcul** : Object Storage et DynHost ne bougent pas. Coût
de l'échange : ~0,082 €/h contre ~0,047 €/h, plus une IPv4 facturée à part.

**GCP** est écarté pour le serveur de jeu : il facture l'egress, et Enshrouded
sort ~14 Go par session de 4 h à quatre joueurs. Cela reviendrait plus cher que
le serveur dédié qu'on remplace.

**Cloudflare R2** est écarté pour les saves malgré un coût imbattable :
société américaine, et les saves sont couvertes par la contrainte de
souveraineté.

## Frontière avec `PRODUCT.md`

`PRODUCT.md § Stack` dit la même chose en trois lignes. Ce n'est pas une
duplication à réparer : ce fichier est écrit par la skill `impeccable` sous son
propre schéma (`impeccable:product-schema 1`) et sert **sa** conception
d'interface. **Il ne s'édite pas à la main.**

Si la stack change, elle change **ici**, et `PRODUCT.md` se régénère par la
skill.
