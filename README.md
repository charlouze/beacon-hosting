# Beacon

Serveur Enshrouded à la demande, pour trois ou quatre amis. Le serveur n'existe
que pendant les sessions de jeu : il naît avec son heure de fin déjà fixée,
prolongeable d'une heure autant de fois qu'on veut mais seulement dans les
trente dernières minutes. Une machine oubliée s'arrête donc toujours dans
l'heure.

App : `beacon.charlouze.com` · serveurs de jeu : `<jeu>.beacon.charlouze.com`

Angular sur monorepo Nx, plan de contrôle Firebase, serveur de jeu chez OVH.

Aucun code à ce jour : le spec est en revue.

## Le dépôt

| Fichier | Contenu |
|---|---|
| `CLAUDE.md` | Les règles de travail — à lire avant de proposer quoi que ce soit |
| `STACK.md` | Stack technique, tests, conteneurs, identifiants |
| `PRODUCT.md` | Utilisateurs, but, périmètre, principes produit |
| `docs/superpowers/specs/` | Architecture, modèle de données, sécurité, tests, livraison |
| `docs/superpowers/plans/` | Ordre de construction et plan de chaque tranche |
| `.impeccable/` | Monde visuel, maquettes et décisions d'interface |

Les maquettes s'ouvrent depuis `.impeccable/mocks/decision/index.html`, sans
aucune dépendance externe.
