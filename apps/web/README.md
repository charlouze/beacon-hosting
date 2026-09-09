# web

**Le pilote de la tranche 2, pas l'écran.** Il existe pour exercer la face
client de `libs/session-record` et de `libs/membership-record` — le SDK du
navigateur, la connexion, la transaction anti-double-clic, l'abonnement temps
réel — contre l'émulateur.

Aucune direction visuelle, volontairement. Le monde retenu (The Departure
Board), les cinq états sur un seul écran, le décompte et la libération pendant
le démarrage sont la **tranche 5** : ils s'écrivent avec la skill `impeccable`
et les cinq contraintes fermes de `.impeccable/mocks/decision/README.md`. Un
écran « provisoire » écrit ici serait l'écran définitif, juré provisoire.

Ce projet n'importe **jamais** un SDK Firestore ni un SDK Auth, et ne nomme
jamais un champ de document : tout passe par `@beacon/session-record/client` et
`@beacon/membership-record/client` (§4 du spec). Une règle de lint le vérifie.

```bash
# 1. les Functions construites, puis l'emulateur avec les vraies regles
mise run dev-functions
npx firebase emulators:start --config firebase.dev.json --project demo-beacon \
  --only firestore,auth,functions
# 2. les deux documents qu'aucun client ne peut creer
mise run seed
# 3. le pilote ; se connecter une fois pour exister
npx nx serve web
```

Reste le quatrième geste, qui n'est pas une commande : **se faire membre à la
main.** L'UI de l'émulateur est sur <http://127.0.0.1:4000>, et elle édite
Firestore. Onglet **Authentication**, copier l'`uid` du compte qu'on vient de
créer en se connectant ; onglet **Firestore**, créer la collection `members` et,
dedans, un document dont l'identifiant **est** cet `uid`, avec trois champs :

| Champ | Type | Valeur |
|---|---|---|
| `role` | string | `admin` |
| `email` | null | — |
| `steamId` | null | — |

Les trois champs, pas seulement `role` : les règles demandent que `email` soit
présent, fût-il nul, et un document qui n'en porte pas refuse toute écriture de
son sujet — il ne peut pas y déclarer son `steamId` — jusqu'à ce qu'un admin y
ajoute `email`. Ce n'est donc pas sans issue, et un admin peut réparer le sien :
`isAdmin()` ne lit que `role`. Recharger le pilote : il est membre.

C'est **exactement** le geste de production, écran pour écran — la console
Firebase à la place de l'UI de l'émulateur. Il n'y a pas de semis de premier
admin, ni ici ni là-bas : un `uid` Google n'existe qu'après une connexion, donc
aucun déploiement ne peut le connaître.

`mise run seed` pose `GCLOUD_PROJECT`, et ce n'est pas décoratif : `defaultApp()`
appelle `initializeApp()` sans options, et sans identifiant de projet dans
l'environnement l'Admin SDK échoue sur « Unable to detect a Project Id in the
current environment » avant d'avoir écrit quoi que ce soit. Une ligne collée à
la main doit le poser aussi.

Les Functions sont dans la liste des émulateurs, et `mise run dev-functions` la
précède : sans elles rien ne réagit à `server/current`, et une session lancée
depuis le pilote reste en `PROVISIONING` sans que personne ne la ramasse.

C'est exactement la séquence de production — les mêmes règles, la même
connexion, le même semis, la même inscription à la main — et c'est ce qui la
rend utile : depuis la tranche 4 l'émulateur ne laisse plus rien passer que le
déploiement refuserait.

Les mêmes gestes existent en tâches `mise` — `mise run emulators`, `mise run
serve`, `mise run seed` —, et la tâche de semis pose toujours
`FIRESTORE_EMULATOR_HOST` : elle ne **peut pas** atteindre la base de
production, même lancée par distraction.
