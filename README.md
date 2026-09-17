# Beacon

Serveurs de jeu à la demande, pour trois ou quatre amis. Le serveur n'existe
que pendant les sessions de jeu : il naît avec son heure de fin déjà fixée,
prolongeable d'une heure autant de fois qu'on veut mais seulement dans les
trente dernières minutes. Une machine oubliée s'arrête donc toujours dans
l'heure.

App : `beacon.charlouze.com` · serveurs de jeu : `<jeu>.beacon.charlouze.com`

Angular sur monorepo Nx, plan de contrôle Firebase, serveur de jeu chez
Scaleway.

Le spec est validé, et révisé le 2026-09-05 pour faire entrer un second jeu. La
tranche 0 — une sonde, sans code de production — a répondu à ses questions
ouvertes ; la tranche 1 est déployée, et son watchdog tourne toutes les cinq
minutes en production : il interroge Scaleway par le tag d'appartenance et
détruit ce qu'aucune intention de création ouverte n'explique.

## Le dépôt

| Fichier | Contenu |
|---|---|
| `CLAUDE.md` | Les règles de travail — à lire avant de proposer quoi que ce soit |
| `STACK.md` | Stack technique, tests, conteneurs, identifiants |
| `PRODUCT.md` | Utilisateurs, but, périmètre, principes produit |
| `docs/specs/` | Une spec vivante par module — l'autorité de toute revue |
| `docs/batches/` | Les lots de user stories qui font grandir les specs |
| `docs/archive/` | Les documents datés d'avant les specs vivantes — matière d'adoption, sans autorité |
| `.impeccable/` | Monde visuel, maquettes et décisions d'interface |

Les maquettes s'ouvrent depuis `.impeccable/mocks/decision/index.html`, sans
aucune dépendance externe.

## Regarder les écrans

```bash
mise run dev                  # Firestore, Auth, le semis, les personas, le pilote
mise run screen -- expiring   # dans un second terminal
```

`mise run dev` ne monte que les deux émulateurs que l'app interroge, avec leur
UI sur <http://localhost:4000> — ni Functions, ni tunnel, ni machine. Rien n'y
est facturable.

Se connecter en Google dans l'émulateur avec `admin@dev.beacon`,
`player@dev.beacon`, `rookie@dev.beacon` (celui à qui le Steam n'a pas encore
été demandé) ou `visitor@dev.beacon` (celui à qui la porte reste fermée).

L'app n'a pas de route : l'écran affiché est une lecture de `server/current`.
`mise run screen` écrit ce document, et l'onglet ouvert suit sans rechargement —
`idle`, `preparing`, `running`, `running-sunkenland`, `expiring`, `closing`,
`failed`, `unreadable`.

Pour une vraie machine et une vraie session, c'est `mise run session` qui monte
le tunnel et les Functions ; voir `tools/dev-session/README.md`.
