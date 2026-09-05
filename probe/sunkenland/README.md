# Sonde Sunkenland

Ce que la tranche 1 bis mesure sur le second jeu. Jetable, sauf le script de
démarrage si la tranche 3 finit par l'adopter.

- `start.sh` — remplace le script de l'image amont, qui ignore les options dont
  Beacon a besoin et tente un `+login anonymous` sur un jeu sous licence. Il est
  **monté** dans l'image, pas construit dedans : si cette forme suffit, ni fork
  ni image maison n'ont à exister.
- `docker-compose.yml` — le même montage en local que sur la VM, pour que ce qui
  est mesuré ici soit ce qui tourne là-bas.
- `.env.example` — les variables, et lesquelles restent vides au premier essai.

```bash
cp probe/sunkenland/.env.example probe/sunkenland/.env   # puis renseigner les chemins
MSYS_NO_PATHCONV=1 docker compose -f probe/sunkenland/docker-compose.yml \
  --env-file probe/sunkenland/.env up -d
```

Les 2,3 Go du jeu viennent du compte Steam de l'administrateur et ne montent
jamais sur une machine de jeu par SteamCMD (§7 du spec). Le monde se copie
depuis le client : son GUID relie les personnages des joueurs, il ne se recrée
jamais.

## Ce que l'image impose

Relevé sur l'image elle-même, et non déduit — chacun de ces points a corrigé le
script :

- **Le serveur tourne en `uid 7000` (`sunkenland`), pas en root.** Le dossier
  des mondes doit lui appartenir, sinon l'autosave n'écrit rien. Sur Docker
  Desktop la question ne se pose pas ; sur une vraie VM, `chown 7000:7000` sur
  le dossier monté est obligatoire.
- **`DISPLAY=:1` est posé dans l'image**, et le serveur X démarre par
  `/etc/init.d/xvfb start`, pas par `xvfb-run`. `start.sh` reprend cette
  séquence telle quelle : la reproduire est ce qui fait que c'est la même
  expérience que la section J.
- **Le conteneur ne s'arrête proprement que par le `trap` amont.** En PID 1, un
  processus sans gestionnaire ne reçoit jamais `SIGTERM` : un `exec` ferait de
  chaque `docker stop` dix secondes d'attente puis un `SIGKILL`, éventuellement
  au milieu d'une sauvegarde.
- **Les mondes se lisent par un lien symbolique.**
  `…/LocalLow/Vector3 Studio/Sunkenland/Worlds` pointe sur `/sunkenland/Worlds`,
  qui n'existe pas dans l'image : c'est un point de montage, pas un dossier.
- **`/sunkenland/game` est vide.** L'image ne contient pas le jeu, elle le
  télécharge — ce que Beacon lui interdit.

## Un piège qui n'est pas de l'image

**Un `$` dans le mot de passe ne survit pas à `docker compose`.** La valeur passe
par l'interpolation du compose, qui lit `$bc` comme une variable vide : mesuré,
`a$bc${REGION}d` arrive au serveur comme `aeud`. Compose prévient d'une variable
inconnue, jamais d'un mot de passe amputé — et personne ne peut vérifier depuis
le journal ce que le serveur a réellement retenu.

Deux défenses, parce qu'aucune ne couvre les deux chemins : le rendeur du
`cloud-init` refuse un mot de passe qui contient un `$`, **avant** qu'une machine
facturée existe ; et `start.sh` imprime la longueur du mot de passe au
démarrage, ce qui rend l'amputation visible en local aussi.
