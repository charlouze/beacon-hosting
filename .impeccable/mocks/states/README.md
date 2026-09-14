# Tour des états manquants — 2026-09-11

Trace durable du tour qui a dessiné les états que le choix du monde visuel
n'avait pas dessinés. Ouvrir `index.html` pour voir les maquettes ; ce fichier
dit ce qui a été décidé et pourquoi.

Le monde visuel ne rejoue pas : **The Departure Board**, contrat dans
[`../../DIRECTION.md`](../../DIRECTION.md), retenu au tour du 2026-09-02 dont la
trace est dans [`../decision/`](../decision/README.md).

| Fichier | Contenu |
|---|---|
| `desktop.html` | Les neuf compositions en 1440 px, plus les deux variantes écartées à l'échelle réelle |
| `phone.html` | Les mêmes neuf en 390 px |

## Neuf compositions, et non cinq

Le tour de décision couvrait deux états sur cinq. En dessinant les trois autres,
le §8 du spec a fait apparaître deux distinctions que le mot « panne » et le mot
« rejoindre » masquaient :

- **`IDLE` a deux visages.** « Création d'instance refusée par le fournisseur →
  nettoyage, puis `IDLE` avec `lastError` : le bouton est immédiatement
  recliquable. » Un démarrage refusé n'est donc pas l'état de panne, c'est
  l'écran le plus courant avec un avertissement et un bouton qui marche.
- **`FAILED` veut dire autre chose** : « Nettoyage impossible après un échec →
  `FAILED`, que le watchdog retente toutes les 5 min jusqu'à `IDLE`. Aucun état
  du système n'est sans issue. » Une machine est restée debout et facture, et le
  membre n'a **rien** à y faire. Cet écran ne porte donc aucun bouton : en
  offrir un serait mentir.
- **Le jeu qui se rejoint par une adresse n'avait jamais eu sa composition.**
  Les deux fichiers conservés du tour de décision ne montrent que le cas sans
  adresse. La forme « adresse + IP brute + port » est dessinée ici pour la
  première fois.

Restent le déconnecté et le visiteur non membre, que `PRODUCT.md` exige de
traiter et qu'aucune maquette n'avait montrés. Le second ne laisse rien fuir :
ni état, ni adresse, ni coût.

## Ce que les reports ont retiré de l'écran

Quatre reports décidés en cadrant la tranche — la face écriture des membres, les
réglages et le gabarit, les cumuls sur `events`, la lecture de `saves` — enlèvent
de l'écran approuvé « Ce mois », « Joué », « Soirées », « Dernière soirée hier,
fermée à 00:30 », « Dernière sauvegarde », « Monde » et « Hébergement ». Le pied
ne porte plus que le coût de la session, et le bandeau de trois colonnes
disparaît de l'écran hors service.

**Rien de ce qui reste n'est inventé** : chaque valeur affichée se lit dans
`server/current`, `config/settings`, `members/{uid}` ou le profil Google. C'est
la contrainte qui a le plus façonné ces compositions — et le seul critère qui
permette de dire d'une maquette qu'elle est honnête.

Conséquence de composition, découverte à l'inspection : la hauteur héritée du
comp laissait un creux de 150 à 350 px juste au-dessus des actions, une fois le
contenu amputé d'un tiers. Le champ est désormais centré entre ses deux filets,
avec autant d'air au-dessus qu'en dessous. Un tableau de gare avec un trou en
bas se lit comme inachevé.

## La copie passe en anglais

`CLAUDE.md` et `PRODUCT.md` l'exigeaient tous les deux ; les maquettes de
décision avaient pourtant été jugées en français, et le monde visuel avait été
choisi sur cette copie-là. La règle gagne, et la copie se refait.

Le registre du tableau de gare y survit sans effort : `OUT OF SERVICE` et
`IN SERVICE` sont les mots des panneaux, pas une traduction. Conséquence à
retenir : **tout terme visible doit entrer au glossaire du §4 du spec.**

## Trois corrections du comp approuvé, tirées de son propre contrat

- **Le battement de la pastille disparaît.** Le contrat écrit « la seconde qui
  tombe est la seule animation de la page. Rien d'autre ne bouge » ; le comp
  animait pourtant la pastille.
- **« Prêt vers » quitte l'écran hors service** et descend dans le démarrage. Le
  brief de surface tranchait déjà : « la phrase retirée promettait avant le
  clic, celle-ci constate après ». En 1440 px la ligne avait glissé du mauvais
  côté du clic ; le téléphone, lui, était juste.
- **Le port d'Enshrouded n'apparaît qu'une fois.** Imprimé dans l'adresse, dans
  l'IP brute et dans sa propre colonne, c'était le même nombre trois fois sur
  une ligne. Chaque bouton « Copier » livre toujours l'hôte et le port
  ensemble, qui est ce qu'on collera.

## Décidé

| Question | Décision | Ce qui a été écarté |
|---|---|---|
| La pastille de statut, que la contrainte n° 2 refuse | **Elle reste** — le comp approuvé gagne sur le texte de la contrainte, qui se desserre sur ce point | Le mot seul, les capitales espacées et le filet de 4 px disant déjà l'état deux fois. Variante conservée dans `desktop.html` |
| Le rouge de signalisation, que le brief autorisait à virer au bleu | **Il reste rouge** | Le bleu de quai, qui garde l'adresse pour lui seul |
| La fenêtre de prolongation | **Une ligne annoncée, au-dessus du bouton**, sur les deux largeurs — l'annonce précède la main | Le texte rouge qui s'excusait sous un bouton grisé, et le placement sous le bouton |

## Une heure annoncée est une fourchette, et c'est la sonde qui l'impose

Le premier jet de l'écran de démarrage annonçait « Ready around 20:18 », une
heure unique. C'est exactement ce que la mesure interdit, et elle était déjà au
dossier : `probe/RESULTS.md` §S, deux sessions sur le même gabarit dans la même
zone, à une heure d'intervalle, **4 min 49 s puis 7 min 58 s**. Sa conclusion
est écrite comme une contrainte — « l'annonce serait fausse de trois minutes une
fois sur deux […] la mesure tranche pour la fourchette. Cinq à huit minutes ».

L'écran annonce donc `Ready between 20:19 – 20:22`. Ce qui avait le droit de
revenir avec la mesure, c'est **un chiffre** ; pas sa précision. Et une heure
démentie ne libère personne, ce qui est très exactement ce que la contrainte
n° 3 demande à cet écran.

Conséquence de forme : le contrat fixe 172 px au **temps restant**, et cet écran
n'en a aucun à montrer. La fourchette y descend à 112 px en large et se casse en
deux lignes sur téléphone, deux heures et un tiret ne tenant pas à 390 px.

**La note « Non tranché » du brief de surface est donc périmée** : elle attend
une mesure qui existe depuis la tranche 0. Elle se corrigera à la
régénération du brief, pas à la main.

## Ce qui reste ouvert, et n'était pas dans ce tour

**La typographie.** Ces planches tournent sur les polices système, comme celles
de décision. Le plancher de métier d'Impeccable est explicite : une police
système en voix d'affichage est un échec, pas un repli. Il faut une fonte
choisie et auto-hébergée — donc un fichier binaire dans le dépôt et une licence
à retenir —, et le juge est le décompte à 172 px, où la forme des chiffres
tabulaires décide de tout. C'est un tour à elle seule.

**Le rouge de signalisation reste réversible** au sens du brief de surface : il
ne sert qu'aux secondes et aux avertissements, et rien d'autre n'en dépend.

## Deux réserves d'outillage, notées pour ne pas les redécouvrir

- **Le détecteur mécanique tourne en mode dégradé** sur ce poste : `htmlparser2`,
  `css-select`, `css-tree` et `domutils` sont absents, donc les propriétés
  personnalisées, la correspondance de sélecteurs et le contraste calculé ne
  sont pas évalués. Son verdict vide est un sous-comptage, pas un quitus.
- **`context.mjs` ne trouve pas le brief de surface** qui existe pourtant à
  [`../../surfaces/apps-web-src-app-session-session-page-html.md`](../../surfaces/apps-web-src-app-session-session-page-html.md),
  et rapporte `surfaceBriefReason: not-found`. Dérive signalée, non réparée.
