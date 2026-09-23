# utilisateur — Gaps register

## Coverage

Audités contre chaque section de la spec :
- `firestore.rules`, pour ce qu'il dit des utilisateurs et des administrateurs,
  et pour ce qu'il ouvre à un utilisateur en tant que tel : les réglages, le
  journal et les fiches de joueur ;
- `libs/membership-record`, sur ses deux faces ;
- les écrans de `apps/web` qui aiguillent entre déconnecté, visiteur et
  utilisateur, et celui qui demande le compte Steam ;
- ce que `apps/functions` lit ou écrit de `members` : le semis, les personas de
  l'émulateur et la lecture des comptes de jeu au provisionnement.

Non audités : la configuration du fournisseur d'identité en production, que
l'agent ne touche pas, et les suites de refus de `libs/rules`, dont ce sont les
règles qui ont été auditées.

## Violations

- **Ubiquitous language** — le code nomme l'utilisateur `Member` : le type de
  `libs/membership-record/src/lib/viewer.ts`, `isMember` dans
  `firestore.rules`, et la bibliothèque elle-même. Ce renommage doit précéder
  celui du membre d'un monde en `Member`, sans quoi `Member` désigne deux
  concepts à la fois.
- **Becoming a user** — se connecter ne suffit pas : le code tient une liste
  des personnes autorisées. Tant qu'un administrateur n'a pas créé son
  enregistrement depuis la console de la plateforme, la personne connectée ne
  lit rien, et l'écran lui dit « not on the list » (`firestore.rules`,
  `isMember` et `match /members/{uid}` ;
  `libs/membership-record/src/lib/viewer.ts`, `viewerFrom` ;
  `apps/web/src/app/access/visitor.component.ts`).
- **Administrators** — l'application ne permet ni de donner ni de retirer le
  rôle d'administrateur : un administrateur passe par la console de la
  plateforme. L'écran a été reporté
  (`docs/archive/plans/2026-09-12-tranche-5-l-ecran.md`, décision 1).
- **Administrators** — rien n'empêche un administrateur de retirer le rôle au
  dernier administrateur, lui compris, ni d'effacer son enregistrement
  (`firestore.rules`, `adminManagesMembership` et `allow delete`).
- **User profile** — le code garde l'adresse e-mail de l'utilisateur, et
  l'exige quand un administrateur crée l'enregistrement par les règles d'accès
  (`firestore.rules`, `adminEnrols` et `isValidMember`).
- **User profile** — chaque entrée du journal porte le nom de son acteur, et
  tout utilisateur lit le journal (`firestore.rules`, `match /events/{id}`).
- **User profile** — le compte Steam n'est demandé que sur l'écran
  d'un monde, jamais à un utilisateur qui n'est membre d'aucun monde
  (`apps/web/src/app/session/steam-declaration.component.ts`).

## Gaps

- **Becoming a user** — la connexion passe par un compte Google. `PRODUCT.md`
  l'écrit comme une contrainte, et le commanditaire l'a rangé parmi les
  mécanismes.
- **Becoming a user** — rien ne dit si un utilisateur peut cesser de l'être, ni
  ce que deviennent alors son profil et ses mondes. Le code sait effacer un
  enregistrement (`firestore.rules`, `match /members/{uid}`, `allow delete`).
- **Administrators** — le rôle se relit à chaque décision au lieu de voyager
  avec la connexion, et c'est ce qui rend le retrait immédiat
  (`docs/archive/specs/2026-09-02-game-hosting-design.md`, §5).
- **Administrators** — le rôle d'un utilisateur qui n'est pas administrateur
  porte dans le code la valeur `player` (`libs/membership-record/src/lib/viewer.ts`,
  `Role`), alors que la spec ne connaît aucun autre rôle.
- **Administrators** — le premier administrateur se nomme en créant son
  enregistrement depuis la console de la plateforme, et le semis ne le crée
  jamais (`docs/archive/specs/2026-09-02-game-hosting-design.md`, §5 et §14).
- **User profile** — le commanditaire a acté qu'un profil public viendrait,
  pour que les membres d'un même monde se connaissent, sans dire ce qu'il
  portera.
- **User profile** — la déclaration du compte Steam est la seule écriture d'un
  utilisateur sur son propre enregistrement, et les règles la tiennent champ
  par champ (`docs/archive/specs/2026-09-02-game-hosting-design.md`, §5 ;
  `probe/RESULTS.md`, section R).
- **User profile** — un compte Steam déclaré se change mais ne
  s'efface pas : l'écran n'envoie pas un champ vide
  (`apps/web/src/app/session/steam-declaration.component.ts`).
