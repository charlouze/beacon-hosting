# Contrat de direction — Beacon

Ce bloc part en commentaire HTML en tête de l'artefact dès que le code existe,
comme premier enfant du `body` du layout racine, et doit survivre au build de
production.

```
THESIS: Une session de jeu est un départ annoncé. L'écran dit l'état et l'heure
de fermeture avant toute autre chose, et refuse l'arrangement par défaut de la
categorie — la grille de cartes avec pastille de statut, identifiant d'instance
en monospace et bouton primaire bleu.

OWN-WORLD: Papier chaud #faf8f3, encre #16181b, un seul rouge de signalisation
#d8232a reserve aux secondes et aux avertissements, un bleu de quai #12457f pour
l'adresse. Filets en trois poids — 4 px, 3 px, 1 px — qui structurent des bandes
horizontales pleine largeur. Capitales espacees a .22em en 10-11 px contre des
chiffres tabulaires jusqu'a 172 px. Aucun objet physique dessine en CSS. Aucune
surface sombre, nulle part.

STORY: Le visiteur comprend en une seconde si le serveur tourne et jusqu'a
quand. Il croit que la machine s'arretera seule parce que l'heure est ecrite. Il
lance, ou il prolonge, ou il ferme — jamais plus d'une action evidente a la fois.

FIRST VIEWPORT: Bandeau nom + etat, filet de 4 px, puis le temps restant en
chiffres tabulaires occupant le tiers gauche a 172 px sur large et 84 px sur
telephone, secondes en rouge. A droite, l'heure de fermeture et l'ouvrant.
Dessous, trois colonnes separees de filets verticaux — adresse, IP, machine.
L'action primaire est ancree en bas a droite sur large, pleine largeur en bas
sur telephone, et porte toujours sa raison en clair dessous quand elle est
desactivee.

FORM: The Departure Board, candidat 7 de la liste ordonnee, retenu au tour de
relance en registre safer apres construction et comparaison des trois mondes
restants. Seed 21285bd8.

FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance
```

Signature de mouvement : la seconde qui tombe est la seule animation de la page.
Rien d'autre ne bouge, hors transitions d'etat.
