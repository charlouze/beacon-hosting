# infrastructure

## Boundary

Ce module porte le compte sur lequel Beacon tourne, sa mise en place et sa
reconstruction, la mise en production, la publication de l'image de ses serveurs
de jeu, ce que devient un onglet ouvert quand une mise en production passe, et
les alertes qui préviennent l'exploitant.

Il ne porte ni ce qui naît et meurt avec une session (`session`) ; ni les
mondes, leurs sauvegardes et ce que la règle de durée du stockage en retire
(`monde`) ; ni qui est utilisateur ou administrateur (`utilisateur`).

## Ubiquitous language

| Métier | Code | Ce que c'est |
|---|---|---|
| compte | — | les ressources de Beacon chez ses fournisseurs qui survivent à toutes les sessions |
| contenu | — | ce qui s'écrit dans une ressource du compte pendant que le système tourne |
| déclaration du compte | `WANTED` | ce que le compte doit porter, écrit dans le dépôt |
| écart | `gap` | ce que la déclaration demande et que le compte ne porte pas, ou dont un attribut déclaré diffère |
| mise en place | `deploy-setup` | ce que l'exploitant lance pour combler l'écart |
| mise en production | — | la publication, sur le système en service, de ce que le dépôt contient |
| secret | — | une valeur d'accès que le système présente à un fournisseur |
| surveillance | — | ce qui tient les garanties d'une session sans que personne agisse |
| exploitant | — | la personne qui détient les accès au compte |

### Borrowed terms

| Terme | Ce que ce contexte en connaît |
|---|---|
| `Session` (`docs/specs/session.md`) | une partie ouverte, qui promet des garanties |
| serveur de jeu, `HostedServer` (`docs/specs/session.md`) | ce qu'une session fait naître chez un fournisseur. Il lance une image que Beacon construit |
| réglages, `SessionSettings` (`docs/specs/session.md`) | les valeurs qu'un administrateur change dans `session`. Ce contexte ne les connaît pas une à une |
| monde, `World` (`docs/specs/monde.md`) | ce qu'un administrateur crée pendant que le système tourne, qui survit aux sessions et fait naître des ressources chez un fournisseur |
| utilisateur, administrateur (`docs/specs/utilisateur.md`) | une personne que Beacon connaît, et un rôle qu'elle peut y tenir |

## Setting up the account

Seul l'exploitant lance la mise en place.

Aucun rôle dans Beacon ne donne accès aux ressources du compte.

La mise en place ne détruit aucune ressource qui porte du contenu.

La mise en place ne crée, ne modifie ni ne retire aucun contenu.

L'exploitant peut voir ce que la mise en place ferait sans qu'elle change rien.

La mise en place montre à l'exploitant l'écart entier.

Sur un compte conforme à sa déclaration, la mise en place ne propose rien.

La mise en place ne crée ni ne modifie rien sans le consentement de
l'exploitant, donné geste par geste après lecture de ce qui manque et de ce que
le geste fait.

Une mise en place interrompue ou refusée en partie se signale à l'exploitant
comme partielle.

Un secret est saisi par l'exploitant, et la mise en place ne le conserve pas.

## Rebuilding the account

Beacon se réinstalle chez des fournisseurs où il ne détient rien, par une suite
de gestes écrits.

Toute ressource du compte qu'un monde ne fait pas naître est déclarée dans le
dépôt. Exception : l'identifiant de mise à jour du nom de domaine.

## Putting into production

Seule la fusion d'une pull request dans `main` met en production.

Une fusion qui n'a rien à publier ne met rien en production.

La première mise en production donne un système sans aucun utilisateur.

Une mise en production pose les réglages sur un système qui n'en a aucun, et ne
modifie jamais un réglage existant.

## Publishing the server image

L'image que Beacon construit pour ses serveurs de jeu est publiée par un geste
humain, hors de toute fusion.

L'image que Beacon construit pour ses serveurs de jeu n'est publiée qu'après
avoir démarré.

## Open tabs across a release

Un onglet ouvert avant une mise en production fonctionne encore après elle.

## Warning the operator

Quand la surveillance cesse de tourner, l'exploitant est prévenu au plus tard
une heure après.

Quand la dépense du mois chez les fournisseurs dépasse 5 €, l'exploitant est
prévenu.

Aucune alerte n'est montrée dans l'application.
