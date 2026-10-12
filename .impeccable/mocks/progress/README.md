# Tour de l'attente — 2026-10-12

Trace durable du tour qui a rouvert la contrainte d'interface n° 3. Ouvrir
`index.html` pour voir les maquettes ; ce fichier dit ce qui a été décidé et
pourquoi.

Le monde visuel ne rejoue pas : **The Departure Board**, contrat dans
[`../../DIRECTION.md`](../../DIRECTION.md).

| Fichier | Contenu |
|---|---|
| `desktop.html` | Les trois variantes en 1440 px, chacune avec et sans heure à annoncer, la comparaison des deux filets d'une étape sans avancement, l'écran après un échec |
| `phone.html` | Les trois variantes en 390 px, avec l'autre ordre d'étapes, et l'écran après un échec |

## Ce que la contrainte protégeait

Elle interdisait à l'écran de démarrage toute barre, toute étape et tout
pourcentage. Sa récriture est dans
[`../decision/README.md`](../decision/README.md) ; il n'en reste que le
comportement : l'écran rend le joueur à sa soirée, et ne montre jamais un
avancement qu'aucune mesure ne porte.

## Décidé

| Question | Décision | Ce qui a été écarté |
|---|---|---|
| La forme de l'écran | **C** : l'étape à la place d'honneur en chiffres de tableau, la fourchette à droite, le filet sous le bandeau coupé en quatre longueurs | **A**, une ligne annoncée sous la fourchette, qui ne montre que l'étape en cours ; **B**, les quatre étapes comme les arrêts d'un train, la plus dense |
| Une étape sans avancement | **Une courte longueur d'encre la traverse en boucle** | La longueur grise et immobile |
| L'écran sans heure à annoncer | **La ligne de la fourchette disparaît**, rien ne la remplace : l'étape et le filet suffisent, et le cas ne dure que deux sessions par jeu | `Too early to say`, `Not known yet`, et le maintien de l'ancienne fourchette fixe tant que l'historique est court |
| La règle de mouvement du contrat | **Le mouvement est permis et reste sobre** | « La seconde qui tombe est la seule animation de la page » |

C tient debout quand aucune heure ne peut être annoncée, puisque sa place
d'honneur n'en dépend pas ; A et B la remplaçaient alors par une phrase.

## Ce que les planches posent, et qui reste à valider

- Les mots des quatre étapes : `Waking the server`, `Getting the game`,
  `Bringing your world back`, `Starting the game`.
- `No need to stay.` à la place de `Nothing to watch here.`, qui mentirait
  maintenant qu'il y a quelque chose à regarder.
- La phrase `Five to eight minutes is what it has taken so far` disparaît : la
  fourchette vient des lancements réels.
- Après un échec : `Where it stopped, at 20:19` suivi du rang et du nom de
  l'étape, sans aucun texte venu de la machine.

## Deux réserves d'outillage

- Les planches tournent sur les polices système, comme celles des tours
  précédents. La typographie reste un tour à elle seule.
- `impeccable surface-brief` cherche le brief de surface sous
  `apps/web/.impeccable/` et ne trouve pas celui qui existe sous
  `.impeccable/surfaces/`. Le brief a été mis à jour dans son fichier, la
  dérive n'est pas réparée.
