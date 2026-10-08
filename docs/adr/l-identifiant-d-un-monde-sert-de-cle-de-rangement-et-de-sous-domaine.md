# L'identifiant d'un monde sert de clé de rangement et de sous-domaine

L'identifiant d'un monde est le segment sous lequel ses sauvegardes sont rangées
et le sous-domaine de son serveur. Un monde est ainsi désigné de la même façon
dans le stockage, dans le domaine et dans l'application.

## Considered options

Le nom du monde a été écarté. Ses membres le changent, alors qu'une clé de
rangement et un sous-domaine ne se renomment pas sans déplacer les sauvegardes
et recréer un enregistrement de domaine.

Le jeu a été écarté. Il tenait lieu de monde tant qu'un jeu n'en avait qu'un, et
il ne peut désigner qu'un serveur par jeu.

## Consequences

L'identifiant d'un monde ne change jamais.

L'identifiant ne contient que ce qu'un sous-domaine accepte.
