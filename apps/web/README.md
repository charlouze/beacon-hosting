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
npx firebase emulators:start --config firebase.dev.json --project demo-beacon --only firestore
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-beacon npx nx run functions:seed
npx nx serve web
```

Les règles chargées par `firebase.dev.json` laissent tout passer : ce sont
celles du développement, jamais celles du déploiement. Les vraies arrivent en
tranche 4.
