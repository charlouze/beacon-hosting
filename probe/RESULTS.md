# Rapport de sonde — tranche 0

Chaque section répond à une question du §12 du spec. Une réponse sans la
commande ou l'observation qui la fonde n'est pas une réponse.

> **L'hébergeur a changé le 2026-09-03, en cours de tranche.** Les sections T et
> D portent des mesures faites sur OVH, et des « conséquences pour le spec »
> écrites avant la décision. Elles ne sont pas retouchées — une mesure ne se
> réécrit pas — mais chacune est suivie d'un encart *Ce qui a été décidé* qui dit
> où le projet est allé. **Ne pas suivre les pistes des sections T et D sans lire
> leur encart de clôture** : elles mènent chez un fournisseur qu'on a quitté.

## R · Restriction champ par champ dans les règles Firestore

Question du §12 : `diff(resource.data).affectedKeys().hasOnly([...])`
restreint-il réellement champ par champ ? Sinon, `server/current` se scinde en
deux documents.

Commande : `npm --prefix probe run probe:rules`

Mesuré le 2026-09-03, émulateur Firestore de `firebase-tools` 13.35.1, projet
`demo-beacon`, `rules_version = '2'`.

| Cas | Attendu | Observé |
|---|---|---|
| écriture d'un champ demandé | accepté | accepté |
| écriture d'un champ réservé seul | refusé | refusé |
| écriture mixte demandé + réservé | refusé | **refusé** |
| suppression d'un champ réservé | refusé | refusé |
| `state: RUNNING` depuis le navigateur | refusé | refusé |
| écriture par un non-membre | refusé | refusé |
| création du document par un client | refusé | refusé |
| réécriture d'un champ réservé à l'identique | inconnu — c'est l'observation | accepté, et sans effet |

Les huit cas ont d'abord été lancés contre des règles `allow read, write: if
false` : les six refus passaient et les deux écritures légitimes échouaient. Le
harnais parle donc bien à l'émulateur, et les résultats ci-dessus ne sont pas
ceux d'un test qui ne teste rien.

Le tableau ne suffisant pas à distinguer « refusé par `hasOnly` » de « refusé
parce que la règle a planté », `hasOnly` et son argument ont été instrumentés
par `debug()` le temps d'un passage. Ce que le journal de l'émulateur a rendu,
requête par requête :

| Écriture | `affectedKeys()` | `hasOnly(...)` |
|---|---|---|
| `deadline` | `{deadline}` | `true` |
| `ip` | `{ip}` | `false` |
| `deadline` + `ip` | `{deadline, ip}` | `false` |
| suppression de `ip` | `{ip}` | `false` |
| `state` | `{state}` | `true` |
| `ip` réécrit à sa valeur courante | `{}` | `true` |

**Verdict :** oui. `hasOnly` restreint champ par champ, et un seul champ
illégitime coule l'écriture entière : `{deadline, ip}` est refusé alors que
`{deadline}` seul est accepté. **`server/current` reste un seul document.**

Trois observations qui appartiennent à la tranche 4 :

- **Une réécriture à l'identique n'est pas une écriture.** `diff()` compare les
  valeurs, pas les clés soumises : réécrire `ip` avec sa valeur courante donne
  un `affectedKeys()` **vide**, donc `hasOnly` vrai, donc acceptation. Ce n'est
  pas un trou — rien n'a changé — mais une règle qui compterait sur `hasOnly`
  pour *détecter une tentative* se tromperait. Il restreint l'effet, pas
  l'intention.
- **`hasOnly` ne distingue pas l'écriture de la suppression.** Supprimer un
  champ réservé apparaît dans `affectedKeys()` exactement comme le modifier, et
  se refuse par le même prédicat. Aucune clause supplémentaire n'est nécessaire.
- **`'x' in affectedKeys()` n'est pas la bonne forme.** Le plan l'écrivait ainsi
  dans `assertsNoServerOnlyState()` ; `affectedKeys()` rend un `Set`, dont
  l'appartenance se teste par `hasAny(['x'])`. Corrigé avant exécution, la
  question mesurée étant `hasOnly` et non `in`.

**Piège de lecture de l'émulateur :** tout refus d'`update` est journalisé
`evaluation error at L24:24 for 'update' @ L24, false for 'update' @ L24` — une
erreur d'évaluation *en plus* du refus légitime. Elle apparaît aussi quand la
règle est réduite au seul `hasOnly`, et `debug()` prouve que ce même prédicat a
rendu un `false` propre sur la même requête. C'est du bruit de la voie
verbeuse de l'émulateur, pas un défaut des règles. Ne pas partir en chasse en
tranche 4.

**Conséquence pour le spec :** aucune. Le §5 tient tel qu'il est écrit —
`server/current` reste un document unique, dont la propriété des champs est
portée par `affectedKeys().hasOnly([...])`.

