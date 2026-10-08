# Un outil en ligne de commande crée les mondes et déplace leurs sauvegardes

Créer un monde, y déposer une sauvegarde et en récupérer une se font par un
outil en ligne de commande, lancé depuis le poste d'un administrateur. L'outil
se sert des identifiants que ce poste détient déjà, donc aucun secret de plus
n'est confié au système. Il atteint les sauvegardes par le même port que le
reste du code.

## Considered options

Un écran dans l'application a été écarté. Déposer une sauvegarde recouvre la
dernière d'un monde, et un écran le mettrait à portée d'un clic.

Un outil qui parle au stockage directement a été écarté. Il aurait le moyen de
supprimer une sauvegarde, que le port ne donne pas.

## Consequences

L'outil se sert des identifiants de l'exploitant. Un administrateur qui n'est
pas l'exploitant ne peut ni créer un monde, ni y déposer une sauvegarde, ni en
récupérer une.
