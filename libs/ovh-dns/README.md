# ovh-dns

L'adapter du port `DnsUpdater` : un GET sur `ovh.com/nic/update`, en dyndns2.

Il n'est appelé que pour un jeu qui se rejoint par une adresse. L'autre
n'annonce aucune IP et n'a rien à pointer — mesuré le 2026-09-05.

**Une panne ici n'interrompt pas la session** (§8 du spec) : l'écran affiche
l'IP brute, qui est le recours que `JoinInfo` porte déjà. L'appelant journalise
et continue.

Le couple d'identifiants DynHost vit dans Secret Manager, jamais dans GitHub
(§7, §10). Il n'y a pas de test de contrat : le seul enregistrement A du projet
est celui de la production, et le pointer depuis un test le ferait pointer
ailleurs que là où les joueurs se connectent.
