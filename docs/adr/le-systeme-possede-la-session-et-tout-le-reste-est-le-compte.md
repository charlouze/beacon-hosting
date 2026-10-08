# Le système possède la session, et tout le reste est le compte

Ce qui naît et meurt avec une session appartient au système, qui le crée et le
détruit en tournant. Ce qui survit à toutes les sessions est le compte : il se
déclare, et rien ne le crée ni ne le détruit à l'exécution. Un seul mécanisme
répond ainsi de chaque ressource.

Le seau des sauvegardes est au compte, bien que le système y écrive à chaque
session : ce qui range une ressource est qui la crée, pas qui y écrit.

## Considered options

Un seul outil qui déclare tout, serveurs de jeu compris, a été écarté. Il se
disputerait les serveurs avec ce qui ferme les sessions, qui tourne en boucle et
l'emporterait après l'avoir fait échouer.

Ranger une ressource selon qui y écrit a été écarté. Le seau des sauvegardes
serait alors au système, qui ne le crée ni ne le détruit.

## Consequences

La mise en place du compte ne revendique ni un serveur de jeu, ni son adresse.
