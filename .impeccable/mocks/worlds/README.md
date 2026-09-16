# Tour des mondes — 2026-09-15

Trace durable du tour qui a dessiné ce que la révision du spec du 2026-09-15
ajoute au-dessus de la frontière Firestore : la liste de mes mondes, le monde
sous `/worlds/{worldId}` avec ce qu'il possède hors de toute session, et
`/join/{worldId}/{code}`. Ouvrir `index.html` pour voir les maquettes ; ce
fichier dit ce qui a été décidé et pourquoi.

Le monde visuel ne rejoue pas : **The Departure Board**, contrat dans
[`../../DIRECTION.md`](../../DIRECTION.md), retenu au tour du 2026-09-02
([`../decision/`](../decision/README.md)), étendu au tour du 2026-09-11
([`../states/`](../states/README.md)). Ces planches héritent de
`apps/web/src/styles.css`, qui est le monde tel qu'il est codé — pas des
maquettes précédentes.

Graine Impeccable : `e4199fec`, scope `surface`, mode `operate`. Les trois
structures de liste sont les candidats 5, 6 et 1 d'une liste de sept ordonnée
par résonance avec le tableau de gare ; le tirage désigne lesquels atteignent le
commanditaire, pas lequel gagne.

| Fichier | Contenu |
|---|---|
| `desktop.html` | Dix planches en 1440 px : trois structures de liste, la liste vide, le monde dans ses deux états, renommer, les deux confirmations, l'entrée, le lien périmé |
| `phone.html` | Les mêmes en 390 px |
| `worlds.css` | Le monde de `styles.css` recopié, plus ce que ce tour ajoute — marqué comme tel |

## Décidé avant de dessiner

Trois questions que ni le spec ni le lotissement ne tranchaient, posées au
commanditaire le 2026-09-15 avant la première planche.

| Question | Décision | Ce qui a été écarté |
|---|---|---|
| Le cumul du mois en pied de la liste, que le lotissement annonce et que le §11 décrit, alors que la face client ne lit pas `events` | **Pas dans la 9 bis.** La liste n'affiche que ce qui se lit aujourd'hui ; le cumul arrive avec la tranche 8, qui ouvre la lecture d'`events` | Ajouter la requête « `SessionStopped` du mois » au plan de la 9 bis — elle sortait du périmètre « écran » |
| Ce que fait `/join` à l'ouverture du lien, sachant qu'un premier entrant ne peut rien lire du monde avant d'y être (§5) | **Elle entre tout de suite, puis redirige.** Ouvrir le lien fait devenir joueur ; la page a deux visages, « on t'emmène » et « ce lien ne vaut plus » | Une page avec un bouton `Join`, qui ne pouvait pas nommer le monde et n'ajoutait qu'un clic |
| Exposer `regenerateInvite`, qui existe côté client | **Oui, un geste discret à côté du lien**, avec la phrase qui dit que l'ancien cesse de marcher, et une confirmation sur place | Attendre un besoin réel |

## Ce que ces planches tiennent pour acquis

- **Le jeu se lit, il ne se choisit plus.** Figé à l'adoption (§4), il quitte le
  pied de l'écran hors service : le sélecteur de la tranche 5 disparaît, et le
  bouton n'a plus rien à choisir.
- **Rien n'est inventé.** Chaque valeur se lit dans `worlds/{worldId}`, son
  `server/current`, `players/{uid}` ou `config/settings`. Un document joueur ne
  porte que l'uid, le code et la date : les joueurs se **comptent**, ils ne se
  nomment pas — le §5 interdit à un joueur de lire le document d'un autre
  membre.
- **`/join` ne nomme pas le monde.** La règle seule dit oui ou non, en comparant
  le code à celui du monde ; la page n'a rien lu avant d'écrire, et ne prétend
  pas savoir où elle emmène. Un déconnecté passe par la porte de la tranche 5
  et revient à la même adresse.
- **La règle ne distingue pas un code remplacé d'un code faux**, et l'écran du
  lien périmé ne le prétend pas non plus.
- **Le nom du monde entre dans le bandeau** à la place du jeu, et `Beacon` y
  devient le retour vers la liste. Le jeu descend dans la bande du monde.

## Termes nouveaux, à entrer au glossaire du §4

Tout terme visible doit y figurer. `Your worlds`, `Name`, `Players`,
`Invite link`, `Join`, `Leave this world` y sont déjà. Ces planches en montrent
d'autres :

| Libellé | Où | Ce qu'il dit |
|---|---|---|
| `Rename` · `Save` · `Cancel` | la bande du monde | renommer sur place |
| `New link` · `Keep this one` | la bande du monde | régénérer le code d'invitation, et y renoncer |
| `Leave` · `Stay` | la bande du monde | la confirmation de `Leave this world` |
| `Joining` · `Taking you in.` | `/join` | l'entrée en cours |
| `Link not valid` | `/join` | le lien refusé par la règle |
| `No world yet` · `1 in service` | le bandeau de la liste | l'état de l'ensemble, avant qu'on lise un monde |
| `Next session` · `4 h once opened` | la liste | un monde qui dort, et ce qu'ouvrir donnera |

## Tranché le 2026-09-15

| Question | Décision | Ce qui a été écarté |
|---|---|---|
| La liste : A, B ou C | **B · l'index des noms.** Le nom de chaque monde à l'échelle d'affichage, une bande par monde entre deux filets fins, l'état et l'heure à droite. Le monde mène, la mesure suit | **A · une colonne par monde**, que le tirage mettait en tête : le bandeau du point de jonction agrandi à la page, la mesure en pied de colonne. **C · les lignes du tableau**, la plus proche de la gare et la seule qui ressemble à une table. Les deux restent dans `desktop.html` et `phone.html`, à l'échelle |
| La bande du monde — nom, lien, joueurs — sous les actions, dans les trois colonnes du point de jonction | **Telle quelle** | — |
| Renommer sur place, et les deux confirmations dans leur colonne | **Telles quelles**, jamais dans une fenêtre | — |

Le contrat de direction de la liste est dans
[`../../surfaces/apps-web-src-app-worlds-worlds-page-html.md`](../../surfaces/apps-web-src-app-worlds-worlds-page-html.md) ;
celui du monde reste dans
[`../../surfaces/apps-web-src-app-session-session-page-html.md`](../../surfaces/apps-web-src-app-session-session-page-html.md).

## Ce que l'inspection et le détecteur ont dit

Deux rondes de captures, large et téléphone, puis un passage du détecteur
mécanique sur les trois fichiers.

- **Corrigé.** La phrase du monde endormi se cassait en quatre lignes dans une
  colonne de A ; sur téléphone, le point médian du bandeau restait seul en tête
  de la seconde ligne, et les lignes de C flottaient au milieu de l'écran au
  lieu de commencer sous le filet.
- **Corrigé, et à reporter dans le code.** Les petits boutons de la bande
  (`Rename`, `New link`, `Leave this world`) étaient à 10 px, la taille du
  bouton `Copy` livré en tranche 5. Le détecteur les met sous le plancher de
  lisibilité du texte fonctionnel, et il a raison : 11 px ici, et `Copy` devrait
  suivre dans `copy-button.component.ts`.
- **Laissé tel quel, hérité.** Le bouton désactivé (`+ 1 hour` hors fenêtre)
  est à 2,1:1 sur le papier — c'est `--off-ink` de `styles.css`, le choix de la
  tranche 5, et il vaut pour l'app livrée autant que pour ces planches.
- **Laissé tel quel, faux positif.** Le détecteur compte les capitales
  espacées des clés et des états comme du corps de texte en majuscules. Ce sont
  les libellés du monde retenu, à 10-11 px et jamais plus d'une ligne.

## Ce qui reste ouvert, et n'était pas dans ce tour

**La typographie**, toujours : ces planches tournent sur les polices système,
comme celles des deux tours précédents. Le plancher de métier d'Impeccable en
fait un échec, pas un repli. C'est un tour à elle seule.

**Le cumul du mois** : tranche 8.
