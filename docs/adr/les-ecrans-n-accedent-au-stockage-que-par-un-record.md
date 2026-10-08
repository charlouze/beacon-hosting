# Les écrans n'accèdent au stockage que par un record

`apps/web` et `libs/session` n'importent aucun SDK Firebase et ne nomment aucun
champ de document. Ils passent par une bibliothèque `*-record`, et chaque
collection que le navigateur touche a la sienne. Un changement de stockage ne
touche ainsi ni un écran ni le domaine.

## Considered options

Des écrans qui appellent Firebase directement ont été écartés. Renommer un champ
ou une collection obligerait alors à modifier les écrans qui les lisent.

## Consequences

La connexion vit dans le record qui lit l'enregistrement de l'utilisateur, et
non dans l'écran qui porte le bouton. Cet écran devrait sinon importer le SDK
d'authentification.

Une collection que le navigateur commence à toucher reçoit son record avant
l'écran qui en a besoin.

`apps/functions` n'est pas tenu par cette décision et parle au stockage
directement.
