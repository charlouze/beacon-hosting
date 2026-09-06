# web

**Le pilote de la tranche 2, pas l'écran.** Il existe pour exercer la face
client de `libs/session-record` — le SDK du navigateur, la transaction
anti-double-clic, l'abonnement temps réel — contre l'émulateur.

Aucune direction visuelle, volontairement. Le monde retenu (The Departure
Board), les cinq états sur un seul écran, le décompte et la libération pendant
le démarrage sont la **tranche 5** : ils s'écrivent avec la skill `impeccable`
et les cinq contraintes fermes de `.impeccable/mocks/decision/README.md`. Un
écran « provisoire » écrit ici serait l'écran définitif, juré provisoire.

Ce projet n'importe **jamais** un SDK Firestore ni ne nomme un champ de
document : tout passe par `@beacon/session-record/client` (§4 du spec). Une
règle de lint le vérifie.

```bash
mise run dev-functions  # construit, et repose .env et .secret.local dans dist/
mise run emulators   # Firestore et les Functions, sur firebase.dev.json
mise run seed        # server/current et config/settings
mise run serve       # le pilote
```

Ce sont des tâches `mise` et non des lignes à recopier, pour deux raisons. `VAR=valeur commande` n'existe pas en PowerShell, donc la forme
POSIX ne marche pas pour tout le monde. Et surtout : une tâche qui pose
toujours `FIRESTORE_EMULATOR_HOST` ne **peut pas** atteindre la base de
production, même lancée par distraction — la sûreté vient de la tâche, pas de
la vigilance de celui qui tape.

Les règles chargées par `firebase.dev.json` laissent tout passer : ce sont
celles du développement, jamais celles du déploiement. Les vraies arrivent en
tranche 4.
