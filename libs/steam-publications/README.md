# steam-publications

Implémente le port `GamePublisher` de `libs/session` : la version qu'un éditeur publie chez Steam.

Chaque lecture ouvre une session anonyme, lit le `buildid` de la branche `public` de l'application du jeu, puis se déconnecte. Une lecture qui n'aboutit pas dans les dix secondes (`timeoutMs`) répond une version illisible, avec sa cause.

`steam-user` est chargé à la première lecture et non avec le paquet : il lit un fichier à son chargement, et un échec à cet endroit ne doit pas empêcher les autres Functions du paquet de démarrer. Un chargement qui échoue reste en échec jusqu'au recyclage de l'instance, Node gardant en cache un `import()` échoué ; un `load` injecté est rappelé à la lecture suivante.

Aucun test n'atteint Steam : ils injectent `load`. La sonde `npm --prefix probe run steam:version` est le seul moyen d'atteindre Steam à la main.
