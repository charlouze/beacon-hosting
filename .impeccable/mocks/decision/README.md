# Tour de direction visuelle — 2026-09-02

Trace durable du choix du monde visuel de Beacon. Ouvrir `index.html` pour voir
les maquettes ; ce fichier dit ce qui a été décidé et pourquoi.

Seed Impeccable : `21285bd8`, scope `direction`, mode `operate`.

## Retenu

**The Departure Board** — horloge de gare et tableau à palettes. L'heure de
fermeture s'écrit comme une heure de départ. La matière est l'impression :
filets en trois poids, capitales espacées, chiffres tabulaires, un seul rouge.
Aucun objet physique dessiné en CSS.

Le contrat complet est dans [`../../DIRECTION.md`](../../DIRECTION.md) ; la
stratégie de l'écran est dans
[`../../surfaces/apps-web-src-app-session-session-page-html.md`](../../surfaces/apps-web-src-app-session-session-page-html.md).

| Fichier | Contenu |
|---|---|
| `directions.html` | Départ · téléphone · états en service et hors service |
| `desktop.html` | Départ · écran large 1440 px · les deux états |
| `compare.html` | Les deux mondes finalistes écartés, en 1440 px |

## Mise à jour du 2026-09-05 — un second jeu

Le monde n'a pas bougé ; les maquettes, si. La session porte désormais un jeu,
choisi à son ouverture par n'importe quel membre. Deux conséquences se voient dans
`desktop.html` et `directions.html` :

- **Hors service, le jeu se choisit juste avant le bouton.** C'est un
  enregistrement et non un catalogue — la soirée s'est décidée sur Discord, l'écran
  ne participe pas à ce choix-là.
- **Le bloc « comment rejoindre » varie selon le jeu**, et certains n'ont aucune
  adresse : on les rejoint par un identifiant de 55 caractères régénéré à chaque
  démarrage. C'est ce cas difficile que les maquettes montrent ; la forme
  « adresse + IP » ne change pas.

Sur téléphone, la ligne à deux colonnes ne survivait pas à cette chaîne : le libellé
passe au-dessus, la valeur prend toute la largeur, et chaque moitié est insécable
pour que la coupure tombe sur le `~` — seul endroit où elle sépare deux choses
différentes plutôt que de couper un identifiant en deux.

La colonne « machine » a disparu de l'écran en service. Elle nommait un type
d'instance chez un hébergeur que le projet a quitté, et c'était le jargon
d'infrastructure que la contrainte n° 2 refuse.

`compare.html` n'est pas touché : c'est une trace des mondes écartés, elle se lit
telle qu'elle a été présentée.

## Écarté, et pourquoi

**The Lido Board** et **The Pay-and-Display** — éliminés par une relance du
commanditaire en registre *safer*, avant construction. Jamais dessinés.

**The Call Board** (feuille d'appel de régie) — construit en large, écarté après
comparaison. Sa trouvaille méritait d'être notée : la fenêtre de prolongation s'y
lisait comme une ligne de programme annoncée (« appel des trente minutes »)
plutôt que comme la justification d'un bouton grisé. Son coût : un vocabulaire
de métier que le groupe devrait apprendre.

**The Watch Roster** (registre de veille) — construit en large, écarté après
comparaison. Sa trouvaille : l'historique par soirée avec l'ouvrant, le relevant
et le coût par nuit, qui raconte le groupe et n'existe dans aucun autre monde.
Son coût : une gravité administrative qui sonne faux pour quatre copains le
mardi soir.

Ces deux trouvailles restent adoptables **sans leur habillage**, si l'occasion
se présente dans le monde retenu.

**Le standard de la catégorie** — tableau de bord avec pastille de statut,
identifiant d'instance en monospace et bouton primaire bleu. Écarté par le
commanditaire dès la question d'ouverture, avant tout tirage.

## Contraintes fermes issues de ce tour

Elles valent pour toute la suite du projet, pas seulement pour cet écran.

1. **Rien de sombre.** Aucune surface sombre, nulle part.
2. **Jamais une console cloud** : ni pastille de statut, ni identifiant
   d'instance mis en avant, ni jargon d'infrastructure.
3. **Pendant l'attente de démarrage, l'interface libère** : elle annonce
   l'heure de disponibilité et rend l'utilisateur à sa soirée. La durée de cette
   attente n'est pas mesurée — l'estimation de quatre minutes précède le
   changement d'hébergeur du 2026-09-03 et n'a jamais rencontré une vraie
   session. La contrainte porte sur le comportement, pas sur le nombre.
4. **Le coût ne se compare jamais** au tarif du serveur dédié précédent, et
   aucune économie réalisée n'est affichée.
5. **L'état mène**, les actions disponibles découlent de l'état lu.

## Une erreur de méthode, notée pour ne pas la refaire

La première série de maquettes a été rejetée : six vignettes de 302 px sur fond
beige, avec un cadran d'horloge et une ampoule dessinés en CSS. Dessiner des
objets physiques en CSS à petite échelle produit du clipart. Ce que le médium
fait bien — et qui a été retenu — c'est la typographie à grande échelle, les
filets, les champs de couleur et les chiffres tabulaires.

Et un monde visuel ne se choisit pas sur une description : il se construit avant
d'être présenté.
