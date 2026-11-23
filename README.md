# WikiMasters Doublons — extension Chrome non officielle

**AVERTISSEMENT : lisez entièrement ce document avant d'installer ou d'utiliser cette extension. Son utilisation peut entraîner la suspension ou le bannissement définitif de votre compte WikiMasters. En l'installant, vous acceptez d'en assumer seul tous les risques.**

---

## Ce que fait l'extension (version 1.16.0)

Sur [wiki-masters.com](https://www.wiki-masters.com/), l'extension ajoute un panneau qui :

- sur la page **Collection**, lit les cartes de chaque page et **clique automatiquement sur le bouton « Suivant »**, environ toutes les 2 secondes, pour parcourir toute la collection ;
- affiche vos doublons, triés par quantité, rareté, nom ou animation ;
- **met en valeur les cartes animées** (celles dont l'image bouge, c'est-à-dire un GIF qui contient plusieurs images ; les GIF fixes, comme certains logos, ne comptent pas) : un cadre doré sur le site, une colonne « Animée » et un filtre qui liste toutes vos cartes animées ;
- exporte le résultat dans un fichier CSV (Excel) ou JSON, enregistré sur votre ordinateur ;
- affiche des **statistiques par rareté** (exemplaires, cartes différentes, doublons, cartes animées) ;
- garde un **historique** de vos lectures et vous montre les nouvelles cartes depuis la dernière ;
- sur la page **Toutes les cartes**, calcule votre **pourcentage par rareté** et, avec un filtre de rareté choisi par vous, **liste les cartes qui vous manquent** (en cliquant sur « Suivant » de la même façon) ;
- aide aux **échanges** : copie vos doublons en texte prêt pour Discord, et compare votre collection au fichier JSON d'un ami ;
- **suggère des étiquettes** pour vos cartes (comédiens, politique, film & série, flore, insectes, faune, musique, carte animée), d'après leur courte description : un badge sur chaque carte de votre Collection et, quand vous ouvrez une carte, l'étiquette écrite dans le champ « Ajouter une étiquette ». **L'extension ne pose jamais d'étiquette elle-même : c'est vous qui appuyez sur Entrée.** Si vous avez déjà une étiquette équivalente sur le site (par exemple « Écrans »), c'est elle qui est proposée. Noms et mots-clés sont modifiables, et vous pouvez ajouter vos propres étiquettes ;
- affiche sur son icône le **nombre de paquets estimé** ;
- **si vous l'activez**, vous prévient quand votre stock de 10 paquets est plein, et si vous le souhaitez un peu avant, sur votre ordinateur et/ou sur votre téléphone (avec l'application gratuite ntfy) ;
- sur la page **Marché**, relève les prix des **mises actuelles** (jamais les mises de départ) et **estime la valeur de vos cartes** ;
- **vous prévient avant la fin des enchères que vous suivez**, autant de fois que vous voulez (par exemple 1 h, 10 min et 2 min avant), sur votre ordinateur et/ou votre téléphone ;
- sur la page **Toutes les cartes**, **trouve les cartes animées du jeu** (rareté par rareté) et vous dit lesquelles vous manquent ;
- **un clic sur le nom d'une carte** listée dans le panneau propose de la **trouver dans votre Collection, au Marché ou dans « Toutes les cartes »** ;
- **garde vos listes** (doublons, collection, cartes manquantes…) : la dernière ouverte revient toute seule sur les autres pages, et le bouton **« 📋 »** les rouvre toutes ;
- **vous prévient par une fenêtre bleue quand un de vos amis a misé** sur l'enchère que vous regardez (vous choisissez quels amis ignorer) ;
- **« 🛒 Voir au Marché » en un clic** depuis la fiche de n'importe quelle carte et depuis la page d'une enchère.

### Nouveautés de la 1.16.0

- **Fichier des prix partagés : la donnée la plus récente gagne** : à l'import (et avec « ☁️ Mettre à jour les prix »), chaque donnée est comparée au jour près, et celle du fichier remplace celle de l'extension si elle est plus récente, au lieu de seulement compléter ce qui manque. Ça vaut pour le prix moyen du site, les variations, et maintenant aussi pour les **prix du Marché** : une nouvelle colonne « Prix du Marché relevés le » les date, et les prix d'une carte sont alors remplacés en bloc par ceux du fichier (jamais additionnés, pour ne pas compter deux fois). À date égale, l'extension garde les siens.
- **Flèches de variation du prix sur les cartes encadrées** : sur le Marché, une carte encadrée (bonne affaire) porte en bas à gauche la variation de son prix **sur une semaine** (la dernière semaine complète comparée à celle d'avant) et en bas à droite **sur 2 mois** (les 4 dernières semaines comparées aux 4 semaines d'il y a 2 mois), par exemple « ↑ 12 % » en vert ou « ↓ 8 % » en rouge, sans décimales. Elles viennent de l'historique des prix lu dans l'onglet « Marché » de la fiche ; sans vente la semaine dernière, pas de flèche. Elles sont aussi dans l'export des prix et le fichier des prix partagés (colonnes « Variation 1 semaine (%) », « Variation 2 mois (%) », « Variations du ») : à l'import, les variations datées d'un jour plus récent remplacent les anciennes.
- **🕒 aussi pour les prix sans date** : un prix qui sert au cadre mais dont la date de relevé est inconnue (fichier importé sans date, relevé ancien) porte maintenant lui aussi le « 🕒 ».
- **Prix moyens de toutes les raretés d'une carte** : quand vous ouvrez l'onglet « Marché » de la fiche d'une carte, le site charge de lui-même l'historique de ses prix, pour **chaque rareté**. L'extension lit cette réponse et note un prix moyen pour toutes les raretés de la carte, pas seulement celle affichée : la moyenne des ventes des 4 dernières semaines (ou, sans vente récente, celle du dernier mois connu). Ce prix est daté du jour des ventes, donc un vieux prix garde son « 🕒 » sur les cadres. Le prix affiché sur la fiche reste prioritaire pour sa rareté. Aucune requête ni aucun clic de plus : l'extension lit seulement ce que le site a déjà reçu.
- **🕒 sur les cadres basés sur un vieux prix** : quand le prix qui sert au cadre d'une bonne affaire (le prix moyen du site, ou le prix le plus haut du Marché) a été relevé il y a plus d'une semaine, l'étiquette du cadre commence par « 🕒 ». En survolant la carte, vous voyez la date du relevé.
- **Options du Marché seulement dans « Parcourir » et « Mes enchères »** : les cadres des bonnes affaires, l'affichage allégé et les filtres (enchères encadrées, bientôt finies, prix maximum, au-dessus du prix moyen) ne s'appliquent plus dans les onglets « Mes ventes », « Gagnées » et « Historique » du Marché, où toutes les cartes restent affichées normalement. Le sous-menu y cache ces options ; elles reviennent, avec vos choix, en repassant sur « Parcourir » ou « Mes enchères ».
- **« Seulement les enchères encadrées »** : une case du sous-menu « ⚙️ Options du Marché », juste sous les cadres des bonnes affaires. Cochée, elle cache toutes les enchères du Marché qui n'ont pas de cadre (ni jaune → rouge, ni bleu) et indique combien sont cachées. Elle suit les seuils choisis juste au-dessus et se combine avec les autres filtres ; le choix est retenu. Rien n'est demandé au site.
- **Options du Marché regroupées dans un sous-menu** : dans le panneau, toutes les options qui concernent le Marché (min/max, affichage allégé, cadres des bonnes affaires, cartes bientôt finies, prix maximum, cartes au-dessus du prix moyen) sont rangées sous « ⚙️ Options du Marché », qui se déplie et se replie comme « Les mises de cette page ». L'extension retient s'il est ouvert ou fermé.
- **« Cacher les cartes à plus de … % au-dessus du prix moyen »** : une case du panneau, sur la page Marché. Cochée, elle cache les cartes dont la mise (actuelle, ou de départ) dépasse de plus du pourcentage choisi le **prix moyen du site** que l'extension connaît pour cette carte dans cette rareté, et indique combien sont cachées. Par exemple, avec 50 %, une carte au prix moyen de 100 est cachée au-delà de 150 ; avec 0 %, dès qu'elle dépasse 100. Changer le pourcentage coche la case. Les cartes dont le prix moyen n'est pas connu restent affichées. Elle se combine avec les autres filtres et l'affichage allégé ; le choix est retenu. Rien n'est demandé au site.
- **Seuils des cadres du Marché dans le panneau** (plus dans les réglages) : sur la page Marché, « Cadres des bonnes affaires » règle chaque cadre (prix moyen du site, jaune → rouge ; prix le plus haut du Marché, bleu) avec **soit un %, soit un montant en wikibidous** sous l'estimation (plus de « et / ou »). Par exemple « 25 % » encadre une carte estimée 1 000 dès 750, « 300 wikibidous » dès 700. Changer d'unité reprend la dernière valeur utilisée pour cette unité. Si vous aviez donné un montant avant la 1.14, c'est lui qui est repris.
- **« 🛒 Voir au Marché », en un clic, partout où vous regardez une carte.** Le bouton ouvre le Marché dans un nouvel onglet, y cherche la carte, et le panneau dit **combien d'annonces de cette carte exacte sont en vente** (elles sont entourées en bleu ; « Aucune annonce… » sinon).
  - **Page d'une enchère** : « 🛒 Voir les autres ventes au Marché », juste sous le titre, dans la rareté de l'enchère (lien « toutes raretés » à côté). L'enchère d'où vous venez n'est pas comptée. Le bouton reste là même si le relevé des prix est coupé dans les réglages.
  - **Fiche en fenêtre de « Toutes les cartes »**, y compris pour une carte de votre **liste de souhaits** (favoris) : « 🛒 Voir au Marché si elle est en vente », dans toutes les raretés (la rareté affichée est celle du catalogue), avec un lien « seulement L » (ou UR, SR…).
  - **Fiche d'une de vos cartes** (Collection) : le même bouton, dans la rareté de votre exemplaire, avec un lien « toutes raretés » (il remplace « 🔎 Chercher au marché »).
  - C'est la recherche du site, comme si vous la tapiez (une requête), avec le filtre de rareté. Les titres avec parenthèses sont gérés (1.15). Rien n'est acheté ni misé.

### Nouveautés de la 1.15.0

- **Suivi des enchères à la seconde, et « tu mènes / surenchéri » toujours à jour.**
  - Le site envoie lui-même à sa page du Marché l'heure de fin **exacte** de chaque enchère, la mise, le meneur et l'historique des mises. L'extension **lit ces réponses, que le site reçoit déjà** (un petit script, `reponses-site.js`, tourne pour cela dans la page) : **aucune requête de plus**, rien n'est modifié ni envoyé ailleurs.
  - **Toutes vos enchères en cours sont suivies dès que vous passez sur le Marché** (plus besoin d'ouvrir « Mes enchères »), avec leur heure de fin exacte et si vous menez ou avez été surenchéri.
  - Votre **pseudo** et votre identifiant sont connus grâce à vos ventes ou vos victoires : plus besoin de passer par la page Profil pour savoir si vous menez.
  - Sur la page d'une enchère, l'encart « 🔔 » suit **le compte à rebours du site à la seconde** (« dans 8 min 27 s (vers 23:06:12) ») et dit d'où vient l'information et de quand elle date. Une lecture de la page ne s'écarte plus de 30 s de celle du site (3 s au plus, et l'heure donnée par le site passe avant).
  - Le statut est lu d'abord sur la page elle-même (« Vous menez », « Surenchéri »), puis d'après les données du site, puis en comparant le meneur à votre pseudo. La phrase d'aide du site « Si vous êtes surenchéri… » n'est jamais prise pour un statut.
  - Sur la liste du Marché, l'étiquette des enchères suivies dit **« 🔔 fin 18:42 · tu mènes »** (en vert) ou **« · ⚠ surenchéri »** (en rouge), et la dernière mise vue est mise à jour à chaque passage.
  - Dans « 🔔 Mes enchères suivies », **le temps restant défile** et le statut indique depuis quand il est connu (« à revérifier » au-delà de 10 minutes).
  - **Téléphone (ntfy)** : une alerte programmée est renvoyée quand votre statut ou la dernière mise change (avant, elle pouvait annoncer « Tu mènes » alors que vous aviez été surenchéri).
  - Une enchère prolongée par une mise de dernière seconde est de nouveau suivie quand sa page montre qu'elle court encore.
  - Vos victoires (« Gagnées ») sont notées avec leur **prix final et leur date exacte**, dès le passage sur le Marché.
- **« A » doré qui tourne** : en affichage allégé du Marché (où l'image est cachée), chaque **carte animée** porte une petite pièce dorée « A » qui tourne, à côté de son nom.
- **Fenêtre bleue « un ami a misé »** : sur la page d'une enchère, si un de vos amis fait partie des enchérisseurs, une fenêtre bleue le dit (sa mise, sa date, et s'il mène). Elle revient à chaque visite et quand un nouvel ami mise.
  - Vos amis sont lus quand vous passez sur la page **Amis** du site. Dans les réglages, partie **« Amis »**, décochez ceux à ignorer, ajoutez-en à la main, ou coupez l'alerte. Le bouton « Ne plus m'avertir pour … » de la fenêtre fait la même chose.
- **Vos listes ne se perdent plus en changeant de page.**
  - La dernière liste ouverte dans le panneau (doublons, toute la collection, cartes animées, cartes manquantes, cartes animées du jeu, souhaits, enchères suivies, valeur estimée) **revient toute seule** sur toute autre page, dans un nouvel onglet ou en revenant en jeu, avec ses noms cliquables. « ✕ Fermer la liste » l'arrête.
  - Le bouton **« 📋 »** (dans le titre du panneau, visible même réduit) et **« 📋 Mes listes »** ouvrent le menu de toutes les listes gardées, avec leur date. **« Mes doublons » s'affichent depuis la mémoire, sans relire la Collection.**
  - Les cartes manquantes et les « nouvelles cartes depuis la lecture précédente » sont maintenant gardées en mémoire, elles aussi.
  - Sur le Marché, les mises de la page ont leur propre bloc repliable (« 🛒 Mises de cette page ») : une recherche au Marché n'efface plus votre liste.
- **Titres avec parenthèses** : la recherche du site ne trouvait pas « Bob Marley (chanson) ». L'extension tape maintenant **« Bob Marley »**, puis choisit elle-même la carte au nom exact (Collection, « Toutes les cartes » : jusqu'à 5 pages de résultats ; Marché : les annonces de la carte exacte sont entourées en bleu ; fenêtre d'échange des amis : seule la carte exacte est comptée). Même chose pour les autres signes que la recherche du site comprend mal (`[ ] { } * + ? | ^ $ \`).
- **« Seulement les mises jusqu'à … » avec le tri « Mise la plus haute »** : le site charge les annonces 50 par 50 et ne sait pas filtrer par prix. Triées de la plus chère à la moins chère, les 50 premières dépassaient toutes un petit montant (moins de 2 000 environ) : la page paraissait vide. Maintenant :
  - un encart le dit à la place de la liste (avec la mise la plus basse chargée) et propose **« ⏬ Charger la suite jusqu'aux mises ≤ … »** (l'extension clique sur « Charger la suite » du site, comme vous, une requête par clic, 20 fois au plus, avec Stop), **« Trier par Mise la plus basse »** (choisit ce tri dans le menu du site) ou **« Afficher quand même »** ;
  - les annonces qui arrivent (« Charger la suite », tri, recherche) sont filtrées **avant d'être affichées** : plus d'annonce trop chère qui apparaît une seconde.
- Après la mise à jour : rechargez l'extension dans `chrome://extensions`, puis les onglets WikiMasters (F5). Chrome 111 ou plus récent est nécessaire.

### Nouveautés de la 1.14.0

- **« Seulement les mises jusqu'à … wikibidous »** : une case du panneau, sur la page Marché, avec le montant à choisir (taper un montant coche la case). Cochée, elle cache les cartes dont la mise (actuelle, ou de départ s'il n'y a pas encore de mise) dépasse ce montant, et indique combien sont cachées. Elle se combine avec la case « 5 min » et l'affichage allégé ; le choix est retenu. Rien n'est demandé au site.
- **« Seulement les enchères qui finissent dans 5 min »** : une case du panneau, sur la page Marché. Cochée, elle cache les cartes dont le compte à rebours dépasse 5 minutes ; elles réapparaissent toutes seules quand elles passent sous les 5 minutes. Le panneau indique combien de cartes sont cachées. Une carte sans compte à rebours lisible (par exemple terminée) reste affichée. Rien n'est demandé au site : l'extension lit seulement le temps affiché. Le choix est retenu, et la case se combine avec l'affichage allégé.
- **Prix du marché partagés : bouton « ☁️ Mettre à jour les prix »** (pages Marché et Collection). Il lit le fichier des prix partagé (un CSV dans le Google Drive d'une personne du groupe), **ajoute à l'extension seulement les prix qui lui manquent** (comme l'import), puis **renvoie le fichier complet** avec vos propres prix en plus. Une fois réglé, il remplace le bouton « Exporter les prix du marché (CSV) ».
  - **Personne n'a besoin de compte Google** : le fichier est lu et écrit par un petit script Google installé une seule fois par son propriétaire. Les autres n'ont besoin que de **l'adresse du script et du code secret**, à indiquer dans les réglages, partie « Prix partagés » (le bouton « Tester » vérifie sans rien modifier).
  - **Le fichier peut rester privé** (« Accès limité » dans Google Drive) : seul le script y touche, avec le compte de son propriétaire. Le code secret protège la lecture et l'écriture : ne le donnez qu'à des personnes de confiance. Il n'est **jamais réaffiché** dans les réglages (le champ reste vide une fois le code enregistré ; tapez-en un nouveau pour le changer) et il ne voyage jamais dans une adresse web.
  - **Prix moyens du site datés (au jour près)** : le fichier note le jour où chaque prix moyen a été relu (colonne « Prix moyen relu le », par exemple 2026-11-22). À l'import ou à la mise à jour, un prix moyen déjà connu est **remplacé s'il en arrive un relu un jour plus récent** ; sinon il est gardé. Un fichier sans date (ancien export) ne remplace rien, il complète seulement ce qui manque.
  - **Deux mises à jour en même temps ne s'écrasent pas** : le script les traite l'une après l'autre et fusionne chaque envoi avec le fichier (une ligne par carte et par rareté ; une carte absente de l'envoi est gardée).
  - Rien n'est envoyé à WikiMasters : ce bouton ne parle qu'au script Google.

#### Installer le script (une seule fois, par le propriétaire du fichier)

1. Ouvrez [script.google.com](https://script.google.com/) avec le compte Google qui possède le fichier, puis **Nouveau projet**.
2. Remplacez tout le code par le contenu du fichier `script-google-prix-partages.gs` (fourni avec l'extension).
3. En haut du code, vérifiez `ID_FICHIER` (l'identifiant du fichier, dans son lien entre `/d/` et `/view`) et **remplacez `CODE_SECRET`** par un code de votre choix. Enregistrez.
4. **Déployer → Nouveau déploiement**, type **Application Web** : « Exécuter en tant que : **Moi** », « Qui a accès : **Tout le monde** ». Cliquez sur **Déployer**, puis autorisez l'accès à votre Drive (Google peut afficher « application non validée » : **Paramètres avancés → Accéder au projet**, c'est votre propre script).
5. Copiez l'**adresse de l'application Web** (elle finit par `/exec`) et donnez-la, avec le code secret, aux utilisateurs de l'extension.
6. Vous pouvez remettre le partage du fichier sur **Accès limité** : le script n'en a pas besoin.

Si vous modifiez le script plus tard : **Déployer → Gérer les déploiements → modifier (crayon) → Nouvelle version**, pour garder la même adresse.

### Nouveautés de la 1.13.0

- **« 👥 Vérifier si un de mes amis la possède »** dans la fiche d'une carte (la vôtre, ou une carte que vous n'avez pas, par exemple sur « Toutes les cartes ») : l'extension va sur la page **Amis**, ouvre la fenêtre « Échanger » de chaque ami, cherche cette carte (même rareté) dans l'onglet « Cartes de … » et referme avec « Annuler », comme la recherche des souhaits. Le résultat dit qui la possède, avec un bouton « Échanger ». **Elle n'envoie jamais d'offre.**
  - À la fin, le panneau indique **combien de requêtes la recherche a envoyées au site** (et le total du jour), avec un avertissement ; sous le bouton, la fiche rappelle **l'heure de la dernière utilisation** et son nombre de requêtes. Chaque ami ouvert demande plusieurs requêtes, et **utiliser souvent cette fonction peut être vu par WikiMasters comme une utilisation abusive de requêtes automatiques**. Le bouton Stop l'arrête.
- **Affichage allégé du Marché** : cochez « Affichage allégé du Marché (nom et prix) » dans le panneau (sur la page Marché) pour ne garder sur chaque carte que la **rareté, le nom, la mise et la durée**, sans l'image ni la description. On voit environ quatre fois plus de cartes à la fois, et les **cadres de l'extension** (bonnes affaires) restent, avec leur texte sous la carte. Un clic sur une carte ouvre toujours l'enchère. Décochez la case pour revenir à l'affichage normal ; le choix est retenu. Rien n'est retiré de la page : l'image est seulement cachée, et l'extension ne fait aucune requête de plus.
- **Extension plus légère.** Les vérifications répétées de la page (cadres du Marché, badges de la Collection, prix dans la fiche, étiquettes…) ne tournent plus que lorsque la page a réellement changé, et plus du tout quand l'onglet est en arrière-plan (avec une vérification de secours toutes les 10 secondes). Les annonces du Marché ne sont relues qu'une fois par changement de page. Le comportement est le même, et l'extension n'envoie **aucune requête de plus** au site.

### Nouveautés de la 1.12.0

- **Une enchère finie n'est plus suivie, une minute après sa fin.** Elle disparaît de « 🔔 Mes enchères suivies », de la page des réglages et des alertes. L'extension sait qu'elle est finie quand sa fin la plus tardive possible est passée, ou quand le site affiche « Terminée » / « Vendue ».
  - Elle n'est pas reprise automatiquement ensuite (même si son nom apparaît encore dans « Mes enchères »), sauf si vous misez à nouveau dessus ou si sa page montre qu'elle a été prolongée (une mise dans les 10 dernières secondes la prolonge d'une minute).
  - Les prix d'achat (1.10) continuent de marcher : l'extension garde 7 jours ce qu'elle savait d'une enchère finie (dernière mise vue, si vous meniez), uniquement pour reconnaître votre achat quand vous repassez sur l'enchère ou sur le Marché.
- Réunit dans une seule version les ajouts faits en parallèle sur la 1.10 : les **seuils réglables des cadres du Marché** et le relevé des prix d'achat depuis l'onglet **« Gagnées »** (voir « Nouveautés de la 1.10.0 »), avec la recherche d'une carte depuis le panneau (1.11).

### Nouveautés de la 1.11.0

- **Trouver une carte depuis le panneau.** Dans toutes les listes du panneau (doublons, nouvelles cartes, cartes manquantes, cartes animées du jeu, mises du Marché, valeur estimée, échange avec un ami, souhaits chez les amis, enchères suivies), le **nom de chaque carte est cliquable**. Le clic ouvre un petit menu :
  - **📚 Dans ma collection** : la recherche de la Collection est remplie avec le nom, puis la **fiche de la carte s'ouvre**. Le menu rappelle si vous l'avez (« tu l'as : L ×2 ») ou non (« pas dans ta dernière lecture ») ;
  - **🛒 Au Marché** : comme « Chercher au marché », le nom est recherché et le filtre de rareté est choisi. Pour une carte venant de « Toutes les cartes » (cartes manquantes, cartes animées du jeu), il n'y a pas de filtre : la rareté du catalogue peut différer de celle des exemplaires vendus ;
  - **🌐 Dans « Toutes les cartes »** : le nom est tapé, « Rechercher » est cliqué, puis la **fiche de la carte s'ouvre** (la carte qui porte exactement ce nom, pas « Bob Marley (chanson) ») ;
  - **🔨 Ouvrir l'enchère**, en plus, pour une enchère suivie.
  - Si vous êtes déjà sur la bonne page (et qu'aucune lecture ne tourne), la recherche se fait **sur place** ; sinon dans un **nouvel onglet**, pour garder les résultats affichés dans le panneau. Le menu l'indique sous chaque choix. Échap, ou un clic ailleurs, le referme.
  - L'extension ne clique que sur le champ de recherche, le bouton « Rechercher », le filtre de rareté (Marché) et la carte trouvée. Jamais sur ce qui achète, mise, échange ou défausse.

### Nouveautés de la 1.10.0

- **Seuils des cadres du Marché réglables** : dans les réglages (partie « Fonctions de l'extension »), choisissez à partir de quel écart une enchère est encadrée, séparément pour le **prix moyen du site** (cadre jaune → rouge) et pour le **prix le plus haut trouvé** (cadre bleu). L'écart est en % sous l'estimation : 25 % (la valeur de départ, comme avant) encadre une carte estimée 1 000 dès une mise de 750 ou moins. Vous pouvez y ajouter un **montant fixe** en wikibidous (0 = pas utilisé) et choisir s'il faut **les deux** (le % ET le montant) ou si **l'un des deux suffit** (le % OU le montant) : par exemple « 25 % ET 500 » n'encadre une carte estimée 1 000 qu'à 500 ou moins.
- **Prix d'achat des cartes remportées aux enchères** : quand une enchère que vous avez remportée est terminée, l'extension note le prix payé. Elle le voit sur la **page de l'enchère** (le meneur ou l'acheteur affiché est votre pseudo, ou le site écrit que vous l'avez remportée) et sur l'onglet **« Mes enchères »** du Marché (le site écrit « Remportée », ou vous meniez au dernier passage et le prix final est votre mise). Le prix s'affiche :
  - sur vos cartes de la **Collection**, avec un badge orange **« 🛒 450 »** (« (+1) » si vous en avez acheté plusieurs ; le détail est dans l'infobulle) ;
  - dans la **fiche** de la carte : « 🛒 Achetée aux enchères : 450 le 21/11/2026 ».
  - « ≈ » signale un achat **probable** : vous meniez, mais le prix final n'a pas pu être lu (c'est alors votre dernière mise vue).
  - **Le plus simple : ouvrez l'onglet « Gagnées » du Marché.** Toutes les annonces affichées (« Achetée pour 350 ») sont notées d'un coup, même les enchères qui n'étaient pas suivies, et un achat « ≈ » devient exact. Changez de page dans l'onglet pour relever les plus anciennes. Pour ces achats, la date n'est connue que si l'extension avait vu la fin de l'enchère.
  - Pour que l'extension reconnaisse vos victoires ailleurs, passez une fois sur votre page **Profil** (pour votre pseudo), et repassez sur l'enchère ou sur « Mes enchères » après la fin.
- **Cadres du prix le plus haut du Marché** : ils sont maintenant **toujours bleus**, quel que soit l'écart entre la mise et ce prix, et **blancs** quand le « ⚠ » est ajouté (un prix moyen du site est connu pour la carte : le prix le plus haut est probablement trompeur). Les cadres jaune → rouge du prix moyen ne changent pas.
- **« 📥 Importer un fichier CSV (collection ou prix) »** (panneau, Collection et Marché) : remet dans l'extension un fichier exporté par elle. Le type est reconnu tout seul :
  - **collection** (« Exporter en CSV ») : remplace la collection en mémoire, après confirmation, comme une lecture complète (utile sur un autre PC ou après avoir tout effacé) ;
  - **prix du marché** (« Exporter les prix du marché ») : n'ajoute **que ce qui manque**. Un prix moyen du site n'est repris que si la carte (dans cette rareté) n'en a pas encore ; les prix du Marché ne sont repris que pour les cartes qui n'en ont aucun, pour ne pas les compter deux fois. Ce qui est déjà dans l'extension n'est jamais modifié.
  - **Plusieurs fichiers d'un coup** : sélectionnez-les ensemble (Ctrl + clic). Ils sont importés l'un après l'autre, chacun ne reprenant que ce que l'extension et les fichiers précédents n'avaient pas ; le panneau donne le bilan de chaque fichier.
  - L'export des prix a deux colonnes de plus, **« Prix moyen du site »** et **« Prix moyen relu le »**, pour que l'import sache quels prix sont des prix moyens. Un fichier exporté avant la 1.10 s'importe aussi (le prix moyen y est deviné : c'est le prix estimé quand il ne vient pas des prix du Marché).
  - Le fichier est lu dans votre navigateur et n'est envoyé nulle part.

### Nouveautés de la 1.9.0

- **Retour des étiquettes suggérées** (la fonction de la branche 1.4 de l'extension), vérifiées sur le site actuel :
  - sur la **Collection**, un badge **bleu** « 🏷️ 🎭 comédiens » indique l'étiquette à poser, un badge **vert** « ✓ Écrans » qu'une étiquette correspondante est déjà posée ;
  - quand vous **ouvrez une carte**, l'étiquette est écrite (et sélectionnée) dans le champ « Ajouter une étiquette… » : appuyez sur **Entrée** pour la poser, ou tapez autre chose par-dessus. Le panneau affiche aussi un bouton par étiquette suggérée, même quand il est réduit ;
  - vos étiquettes existantes sont réutilisées (« Écrans » pour « film & série », « Faune & Flore » pour « faune » et « flore »…) : ouvrez une fois le menu **« Toutes les étiquettes »** de la Collection pour que l'extension les connaisse toutes ;
  - dans les réglages, partie **« Étiquettes suggérées »** : renommez, coupez ou modifiez les mots-clés de chaque étiquette, ajoutez les vôtres. Vos réglages d'étiquettes de la 1.4 sont repris tels quels.
  - Nouveau par rapport à la 1.4 : les badges ne s'affichent que sur votre Collection (plus sur le Marché), le badge vert montre l'étiquette réellement posée, et une carte ouverte sans avoir été vue dans la grille est reconnue grâce à la description de sa fiche.

### Nouveautés de la 1.8.0

- **Alertes avant la fin des enchères.**
  - Une enchère est **suivie toute seule** quand vous cliquez sur « Miser » (l'extension regarde votre clic ; elle ne mise jamais à votre place), et **toutes vos enchères en cours** le sont dès que vous ouvrez l'onglet **« Mes enchères »** du Marché (celles marquées « Vous menez » ou « Surenchéri »). Vous pouvez aussi suivre une enchère à la main avec le bouton **« 🔔 Me prévenir avant la fin »** affiché sur sa page.
  - L'extension retient si **vous menez** ou si vous avez été **surenchéri** (onglet « Mes enchères », ou « Meneur : … » sur la page de l'enchère comparé à votre pseudo, lu une fois sur votre page **Profil**), et le rappelle dans l'alerte : « Il reste environ 10 min (fin vers 18:42). Tu as été surenchéri ! (vu à 18:20) ».
  - Dans les réglages, **ajoutez autant d'alertes que vous voulez** (10 au plus), en minutes, heures ou jours avant la fin.
  - Les alertes arrivent **sur ce PC** (navigateur ouvert) et/ou **sur le téléphone** avec ntfy (même canal que pour les paquets ; elles arrivent alors même si le PC est éteint).
  - L'heure de fin est lue sur la page de l'enchère (« Se termine dans 23m 39s ») et sur la liste du Marché (« Durée 1h 20m »), à chacun de vos passages. Si le site n'affiche qu'une durée arrondie (« 3 h »), l'heure est approximative : les alertes partent alors un peu **en avance, jamais en retard**. Si l'heure ne peut pas être lue, tapez le temps restant dans l'encart « 🔔 » (« 2h30 », « 45 min »…).
  - Le bouton **« 🔔 Mes enchères suivies »** du panneau (et la page des réglages) liste les enchères suivies, leur heure de fin et la prochaine alerte (une enchère finie en disparaît au bout d'une minute). Sur la liste du Marché, une étiquette bleue « 🔔 » marque les enchères suivies.
- **Cartes animées de tout le jeu** : sur « Toutes les cartes », choisissez une rareté avec les filtres du site, puis cliquez sur **« ✨ Trouver les cartes animées du jeu »**. Les résultats s'ajoutent d'une recherche à l'autre (Légendaires un jour, Ultra rares le lendemain…), avec une colonne « À moi », un filtre « Seulement celles que je n'ai pas » et un export CSV. Les images sont vérifiées plusieurs à la fois (la lecture est plus rapide) et une image qui ne répond pas est réessayée.
- **La lecture page par page ne s'arrête plus au premier ralentissement.** Avant, une page qui mettait plus de 5 secondes à arriver arrêtait tout (« La page suivante n'a pas répondu à temps »). Maintenant, l'extension attend plus longtemps à chaque essai, reclique sur « Suivant » si le site n'a pas pris le clic (et revient en arrière si un clic de trop a sauté une page), clique sur « Réessayer » si le site en affiche un, et insiste pendant 3 minutes (réglable de 1 à 30 minutes). Si la page ne vient vraiment pas, **rien n'est perdu** : le bouton **« Reprendre la lecture »** repart de la page où la lecture s'est arrêtée, sans relire les autres.
- Le nombre maximum de pages lues sur « Toutes les cartes » se règle (300 par défaut).
- Corrigé : l'encart de prix de la fiche d'une carte pouvait, dans certains cas, se recréer toutes les secondes et s'empiler.
- Corrigé : une recherche « souhaits chez mes amis » restée en mémoire (plus de 30 minutes) laissait le bouton **Stop** affiché sur toutes les pages.

### Nouveautés de la 1.7.7

- Sur le Marché, un **« ⚠ »** s'ajoute à l'étiquette d'un cadre bleu quand le prix moyen du site est connu pour cette carte : la mise n'est une bonne affaire que par rapport au prix le plus haut trouvé, qui est probablement trompeur.

### Nouveautés de la 1.7.6

- **Deux sortes de cadres sur le Marché** :
  - **jaune → rouge** : la mise est à 75 % ou moins du **prix moyen du site** (étiquette « −40 % · moy. 461 ») ;
  - **blanc → bleu** : la mise est à 75 % ou moins du **prix le plus haut trouvé au Marché** (étiquette « −40 % · max 530 »). Le cadre est blanc à 75 % et de plus en plus bleu quand l'écart grandit.
  - Si les deux sont possibles, c'est toujours le cadre du prix moyen qui est affiché.

### Nouveautés de la 1.7.5

- **« Estimer la valeur de mes cartes »** n'affiche plus que le **prix moyen du site** et le **prix le plus bas du Marché** (plus de prix le plus haut ni de nombre de ventes). La valeur totale additionne les prix moyens du site ; les cartes vues seulement au Marché n'y comptent pas.
- **Les noms de cartes sont cliquables** : un clic va sur la page Collection, cherche la carte et ouvre sa fiche.

### Nouveautés de la 1.7.4

- Une case **« Afficher les prix min / max du Marché »** dans le panneau : décochée, le badge bleu « -120 / +530 » et les lignes « Marché : min · max » sont cachés (le badge « $ » du prix moyen reste).
- Les boutons **« Exporter en JSON »**, **« Copier mes doublons pour Discord »** et **« Comparer avec un ami »** sont retirés du panneau.
- Le bouton **Stop** n'apparaît que pendant une tâche automatique (lecture de la collection ou des cartes manquantes, recherche des souhaits chez les amis).

### Nouveautés de la 1.7.3

- Le **prix moyen du site** est gardé à part : les prix trouvés au Marché ne le changent jamais, et « Oublier ces prix » ne l'efface pas.
- Sur la **Collection**, deux badges : **« $461 »** (vert) = le prix moyen du site, **« -120 / +530 »** (bleu) = le prix le plus bas et le plus haut trouvés au Marché.
- Dans la **fiche** d'une carte et dans « Estimer la valeur de mes cartes », le prix moyen du site et le min / max du Marché sont affichés séparément.

### Nouveautés de la 1.7.2

- **Prix moyen du site** : quand la fiche d'une carte affiche, dans son onglet « Marché », le **prix moyen** (« Prix moyen · Super Rare »), l'extension le relève. Il **remplace toujours l'estimation** de cette carte dans cette rareté, même si le prix le plus haut trouvé était plus élevé. Il est signalé « (prix moyen du site) » ou « moy. ». Le prix le plus bas et le prix de vente le plus bas ne changent pas. « Oublier ces prix » efface aussi ce prix moyen.

### Nouveautés de la 1.7.1

- Le **prix le plus bas auquel la carte a été vue vendue** s'affiche aussi sur vos propres cartes : dans la **fiche** d'une carte (« Vendue au minimum : 450 ») et dans l'**infobulle du « $ »** sur la Collection.

### Nouveautés de la 1.7.0

- Sur le **Marché**, l'étiquette des annonces encadrées indique aussi le **prix le plus bas auquel la carte a été vue vendue** (enchère terminée), par exemple « −40 % · estimé ≈ 820 · vendue min 450 ». Si aucune vente terminée n'est connue, cette partie n'apparaît pas.

### Nouveautés de la 1.6.9

- **Aucun prix n'est plus écarté** : l'estimation est toujours le prix le plus haut trouvé, le plus bas étant affiché à côté. La règle « prix aberrant » des versions 1.6.5 à 1.6.8 est supprimée. Si un prix est faux, effacez-le avec le bouton « Oublier ces prix » dans la fiche de la carte.

### Nouveautés de la 1.6.7

- Corrigé : depuis la nouvelle fiche de carte du site, le **prix estimé** et le bouton **« Chercher au marché »** n'apparaissaient plus (le site n'écrit plus la rareté en toutes lettres, seulement le badge « UR », « L »…).

### Nouveautés de la 1.6.6

- Le badge vert **« $ »** sur les cartes de la Collection affiche maintenant la **valeur estimée**, par exemple « $530 » (« $≥530 » si ce prix vient d'une enchère en cours).

### Nouveautés de la 1.6.5

- **Lecture des prix plus sûre** : « 100.00 » ou deux nombres côte à côte ne sont plus lus comme 10 000, et l'extension ne va plus chercher un nombre sans rapport plus bas dans l'annonce quand le prix est écrit avec une unité (« 300 pièces »).
- Bouton **« Oublier ces prix »** dans la fiche d'une carte : efface les prix relevés pour cette carte dans cette rareté (ils seront relus au Marché).
- À l'installation de la 1.6.5, les prix relevés pour « Système de Ponzi » sont effacés une fois (une estimation à 10 000 avait été enregistrée).
- L'export CSV des prix a une colonne de plus : tous les prix relevés pour la carte.

### Nouveautés de la 1.6.4

- Sur la **page d'une enchère** (en cours ou vendue), un encart sous le titre affiche l'**estimation** de la carte dans sa rareté (prix le plus haut trouvé), le **prix le plus bas** trouvé, et où en est la mise par rapport à l'estimation (par exemple « Mise actuelle 300 : 37 % de l'estimation »). L'enchère affichée n'est pas comptée dans son propre calcul. L'extension ne mise jamais.

### Nouveautés de la 1.6.3

- L'**estimation** d'une carte est maintenant le **prix le plus haut trouvé** au Marché (ventes terminées et enchères en cours). Le **prix le plus bas** est affiché à côté : dans la fiche de la carte, dans « Estimer la valeur de mes cartes » (colonne Min), dans l'infobulle du « $ » et dans le tableau « Prix de cette page » (colonnes Min et Max). L'encadrement des bonnes affaires (75 %) compare la mise à ce prix le plus haut. « ≥ » signale que ce prix vient d'une enchère encore en cours.

### Nouveautés de la 1.6.2

- Les bonnes affaires du Marché ne sont encadrées qu'à partir d'une mise **à 75 % ou moins** de l'estimation : en **jaune** à 75 %, puis de plus en plus **rouge** quand l'écart grandit. L'étiquette indique l'écart, par exemple « −40 % · estimé ≈ 820 ».

### Nouveautés de la 1.6.1

- Sur la liste du **Marché**, les enchères en cours dont la mise (actuelle ou de départ) est **inférieure au prix estimé** par l'extension (même carte, même rareté) sont **encadrées en rouge**, avec l'estimation affichée au-dessus de l'annonce. L'estimation ne tient pas compte de l'annonce elle-même ; une carte sans autre prix connu n'est pas encadrée.

### Nouveautés de la 1.6

- **Les cartes des paquets ouverts sont ajoutées à votre collection en mémoire**, une par une pendant l'ouverture (« Carte 3 / 10 »), sans relancer « Trouver mes doublons ». Revenir en arrière sur une carte ne la compte pas deux fois. Il faut avoir lu votre collection au moins une fois. Les cartes qui partent (échange, vente, défausse) ne sont pas retirées : une lecture complète de temps en temps garde la collection exacte.

### Nouveautés de la 1.5.2

- Le panneau s'affiche **réduit** au chargement de chaque page : seul le titre est visible. Cliquez sur **+** pour l'agrandir, et sur **-** pour le réduire à nouveau.

### Nouveautés de la 1.5.1

- Sur la page **Collection**, un petit badge vert **« $ »** apparaît sur chaque carte dont l'extension connaît le prix (même nom, même rareté). Passez la souris sur la carte pour voir le prix estimé.

### Nouveautés de la 1.5

- **Mes cartes souhaitées chez mes amis** : le bouton « Chercher mes souhaits chez mes amis » (sur toutes les pages) va lire votre **Liste de souhaits** sur « Toutes les cartes », puis, sur la page **Amis**, ouvre la fenêtre « Échanger » de chaque ami, cherche chacune de vos cartes souhaitées dans l'onglet « Cartes de … » et referme avec « Annuler ». À la fin, le panneau liste qui possède quelle carte (même rareté), avec un bouton **Échanger** qui ouvre l'échange avec cet ami sur la bonne carte. **L'extension ne clique jamais sur « Envoyer l'offre »** : c'est vous qui choisissez et envoyez. Le bouton **Stop** arrête la recherche.

### Nouveautés de la 1.4.7

- Corrigé : les erreurs que Chrome affichait dans `content.js` après l'installation d'une nouvelle version (l'ancien script restait actif dans les onglets déjà ouverts). Après une mise à jour, rechargez les onglets WikiMasters (F5).

### Nouveautés de la 1.4.6

- Le titre « WikiMasters Doublons » et son bouton « - » restent toujours visibles en haut du panneau, même quand on fait défiler une longue liste.

### Nouveautés de la 1.4.5

- **Les pages d'une enchère sont aussi relevées** (quand vous cliquez sur une annonce du Marché) : « Vendue pour » compte comme une vente terminée (le vrai prix de vente), « Mise actuelle » (ou, à défaut, la dernière mise de l'historique) comme une enchère en cours, dont le prix peut encore monter. La même annonce vue dans la liste puis sur sa page n'est comptée qu'une fois.

### Nouveautés de la 1.4.4

- **Bouton « Chercher au marché »** dans la fiche d'une de vos cartes : il ouvre le Marché dans un nouvel onglet, y tape le nom de la carte, lance la recherche et choisit le filtre de sa rareté. Les prix trouvés s'affichent ensuite tout seuls dans le panneau.

### Nouveautés de la 1.4.3

- **Les prix de la page du marché s'affichent tout seuls** dans le panneau dès que vous êtes sur le Marché (et à chaque recherche ou changement de page) : plus besoin de cliquer sur « Prix de cette page ».
- **Le parcours automatique du marché est supprimé** : l'extension ne fait plus défiler ni ne change de page sur le Marché.

### Nouveautés de la 1.4.2

- **Prix estimé dans la fiche d'une carte** : quand vous cliquez sur une de vos cartes, son prix estimé (dans sa rareté) s'affiche au-dessus du bouton « Mettre aux enchères ». Si la carte n'a été vue au marché que dans une autre rareté, ce prix est indiqué à part, à titre indicatif.

### Nouveautés de la 1.4.1

- **Nouveau bouton « Prix de cette page »** sur le Marché : affiche tout de suite les mises actuelles des annonces affichées (après une recherche par exemple), carte par carte, avec la médiane et les exemplaires que vous possédez.
- Le panneau indique maintenant, à chaque changement de page ou de recherche, combien de mises actuelles ont été lues et combien de mises de départ ont été ignorées.
- Chaque annonce est reconnue par son identifiant sur le site (plus de doublons). Les prix relevés avec la 1.4 sont oubliés une fois, puis relus.

### Nouveautés de la 1.4

- **Corrigé : la double notification « stock plein ».** L'alarme, le rattrapage au démarrage de Chrome et la page Paquets pouvaient chacun envoyer la notification en même temps. Ils passent maintenant l'un après l'autre, et la notification n'est envoyée qu'une fois.
- **Prix du marché** : relevé des mises actuelles, bouton « Estimer la valeur de mes cartes » et export CSV des prix.

Chaque fonction peut être activée ou désactivée dans la page des réglages.

Elle **n'ouvre aucun paquet**, n'achète rien, n'échange rien et ne vend rien. Elle ignore volontairement tout bouton payant.

## Risques : à lire absolument

1. **Extension non officielle.** Elle n'est ni créée, ni approuvée, ni soutenue par WikiMasters, par son éditeur Shoobidoo Labs inc. ou par la Wikimedia Foundation.
2. **Elle peut enfreindre les règles du jeu.** Les [Règles de la communauté WikiMasters](https://www.wiki-masters.com/rules) (section 3, « Pas d'automatisation ni de triche ») interdisent les bots, scripts, macros et outils qui jouent ou interagissent à la place du joueur. Comme cette extension clique sur « Suivant » à votre place (et, quand vous le lui demandez depuis le panneau ou avec « 🛒 Voir au Marché », remplit la recherche du site, choisit un filtre de rareté et ouvre la fiche d'une carte) (pages de votre collection, de « Toutes les cartes », y compris pour chercher les cartes animées du jeu, ce qui peut représenter des centaines de pages), reclique et clique sur « Réessayer » quand une page tarde, et, pour la recherche des souhaits ou la vérification d'une carte chez vos amis (1.13), ouvre et referme les fenêtres d'échange de vos amis, WikiMasters peut la considérer comme une automatisation interdite. Les alertes d'enchères, elles, ne cliquent sur rien : elles lisent la page, les réponses que le site reçoit déjà (1.15) et regardent vos propres clics. Avec le filtre « Seulement les mises jusqu'à … » (1.15), et seulement quand vous cliquez sur « ⏬ Charger la suite jusqu'aux mises ≤ … », l'extension clique jusqu'à 20 fois sur « Charger la suite » du Marché (une requête au site par clic), et « Trier par Mise la plus basse » choisit ce tri dans le menu du site. Les étiquettes suggérées écrivent une étiquette dans le champ « Ajouter une étiquette » quand vous ouvrez une carte, sans la valider : c'est toujours vous qui la posez.
3. **Les sanctions peuvent être lourdes.** Selon les [Conditions d'utilisation](https://www.wiki-masters.com/terms) (section 6), l'éditeur peut, à sa seule discrétion et sans préavis, avertir, restreindre, suspendre ou supprimer définitivement un compte. Il peut aussi annuler des progrès, objets ou récompenses, sans remboursement.
4. **Le site peut changer à tout moment.** Une mise à jour de WikiMasters peut rendre l'extension inutilisable ou fausser ses résultats. Les doublons, cartes animées, cartes manquantes, statistiques, comparaisons et étiquettes suggérées affichés peuvent être incomplets ou inexacts : vérifiez-les avant tout échange ou toute vente.
5. **Les alertes d'enchères ne sont pas garanties.** L'heure de fin est lue sur la page du site : si le site change d'affichage, si l'enchère est prolongée sans que vous repassiez dessus, ou si le navigateur est fermé (sans l'option téléphone), une alerte peut manquer, partir en avance ou en retard. Ne comptez pas uniquement sur elles pour une enchère importante.
6. **Les notifications et le nombre de paquets ne sont pas garantis.** L'heure du stock plein et le nombre affiché sur l'icône sont des estimations, calculées quand vous passez sur la page Paquets. Elles deviennent fausses si vous ouvrez des paquets ailleurs (sur un autre appareil) sans repasser sur cette page. La notification sur l'ordinateur demande que le navigateur soit ouvert. Celle sur le téléphone dépend du service tiers ntfy.sh, que l'auteur ne contrôle pas.
7. **Les règles peuvent changer.** Les références ci-dessus correspondent aux versions en ligne au 2 novembre 2026 (règles du 20 juillet 2026, conditions du 23 septembre 2026). Il vous appartient de consulter les versions en vigueur.

En cas de doute, ne l'utilisez pas, ou demandez d'abord l'autorisation à WikiMasters : support@wiki-masters.com.

## Utilisation à vos propres risques et exclusion de responsabilité

En installant, en copiant ou en utilisant cette extension, vous reconnaissez avoir lu et compris le présent avertissement, et vous acceptez d'assumer seul l'ensemble des risques liés à son utilisation.

L'extension est fournie **« telle quelle »**, gratuitement, **sans aucune garantie** d'aucune sorte, expresse ou implicite, notamment de fonctionnement, d'exactitude, de compatibilité ou de conformité aux règles d'un site tiers.

Dans toute la mesure permise par la loi applicable, l'auteur ne pourra en aucun cas être tenu responsable d'un dommage direct ou indirect résultant de l'installation, de l'utilisation ou de l'impossibilité d'utiliser l'extension. Cela comprend notamment : l'avertissement, la restriction, la suspension ou le bannissement d'un compte ; la perte de cartes, de paquets, d'objets virtuels, de monnaie virtuelle, de progrès ou d'achats ; une notification absente, en avance ou en retard ; une erreur dans les résultats affichés ou exportés.

Vous êtes seul responsable du respect des conditions d'utilisation et des règles des sites que vous visitez avec cette extension, ainsi que des conditions du service ntfy.sh si vous l'utilisez.

## Confidentialité

- Par défaut, l'extension ne transmet **aucune donnée** : rien n'est envoyé à l'auteur ni à un tiers.
- Elle garde **dans votre navigateur uniquement** : vos réglages (dont vos étiquettes et leurs mots-clés), la liste des noms d'étiquettes que vous avez créées sur le site, l'heure prévue du stock plein, votre dernière lecture complète de la collection, l'historique de vos lectures (30 au plus), les totaux de cartes du jeu et, nouveau en 1.4, les prix relevés au marché (nom de la carte, rareté, mise actuelle, enchère terminée ou non, date ; 60 jours au plus). Nouveau en 1.10 : le prix d'achat des cartes que vous avez remportées aux enchères (nom, rareté, prix, date). Nouveau en 1.8 : les enchères que vous suivez (identifiant, nom de la carte, rareté, dernière mise vue, heure de fin, si vous menez ; plus suivies une minute après leur fin, puis gardées 7 jours pour reconnaître vos achats), votre pseudo (lu sur votre page Profil) et les cartes animées trouvées sur « Toutes les cartes ». Vous pouvez tout effacer depuis la page des réglages.
- Nouveau en 1.15 : sur wiki-masters.com, le petit script `reponses-site.js` lit les réponses que **le site reçoit déjà** pour son Marché (enchères affichées, enchère ouverte et ses mises, vos ventes, vos mises en cours et vos victoires). Il n'envoie **aucune requête** et ne transmet rien hors de votre navigateur ; l'extension n'en garde que ce qui sert aux enchères suivies et aux prix d'achat. Elle garde aussi : votre identifiant sur le site (« monId »), vos amis lus sur la page Amis (pseudos), ceux que vous avez ajoutés ou choisis d'ignorer, la dernière liste ouverte dans le panneau, et votre dernière recherche de cartes manquantes. « Effacer l'historique et la dernière lecture » efface aussi les listes gardées.
- Le fichier JSON d'un ami que vous ouvrez pour une comparaison, comme un fichier CSV que vous importez (1.10), est lu dans votre navigateur et n'est envoyé nulle part.
- Pour savoir si une image de carte bouge, l'extension relit le début de l'image GIF affichée par le site (sur upload.wikimedia.org, comme le fait déjà la page). Elle n'envoie rien ; elle garde seulement le résultat (animée ou non) pour ne pas relire la même image.
- Permissions demandées : **stockage** (les réglages et la mémoire décrite ci-dessus), **alarmes** (déclencher les notifications et recompter les paquets), **notifications** (les afficher). Elle ne s'active que sur wiki-masters.com.
- **Seulement si vous activez la notification sur le téléphone**, elle envoie au service [ntfy.sh](https://ntfy.sh) : le nom de canal que vous avez choisi, les heures prévues des notifications (stock plein, et alerte avant si vous l'avez cochée ; nouveau en 1.8, les alertes des enchères suivies si vous avez coché « Sur mon téléphone » dans la partie Enchères) et leur texte (pour une enchère : le nom de la carte, sa rareté, l'heure de fin et la dernière mise vue). Le nom du canal sert de mot de passe : toute personne qui le connaît peut lire ces notifications. Choisissez un nom difficile à deviner (la page des réglages peut en générer un) et ne le partagez pas.
- Les fichiers exportés restent sur votre ordinateur.

## Installation (à vos risques)

Cette version est pour **Google Chrome** (version 111 ou plus récente). La version pour Mozilla Firefox se trouve dans un autre dépôt.

1. Sur cette page GitHub, cliquez sur le bouton vert **Code**, puis **Download ZIP**.
2. Décompressez l'archive (clic droit > **Extraire tout**) et rangez le dossier obtenu à un endroit où il restera (si vous le supprimez, l'extension disparaît).
3. Dans Chrome, ouvrez `chrome://extensions` et activez le **Mode développeur** (en haut à droite).
4. Cliquez sur **Charger l'extension non empaquetée** et choisissez ce dossier : celui qui contient directement `manifest.json`.
5. Pour recevoir les notifications sur l'ordinateur, vérifiez que Windows autorise les notifications de Chrome (Paramètres > Système > Notifications).
6. Pour voir le nombre de paquets sur l'icône de l'extension, épinglez-la : cliquez sur l'icône des extensions (la pièce de puzzle) en haut à droite de Chrome, puis sur la punaise à côté de « WikiMasters Doublons ».

## Utilisation

1. **Doublons, statistiques et historique** : sur la page **Collection**, cliquez sur **Trouver mes doublons**. Pour une grande collection, la lecture peut durer environ un quart d'heure ; ne changez pas de page pendant ce temps. Le bouton **Stop** interrompt la lecture. Les filtres du site (rareté, étiquette, recherche) limitent la lecture aux cartes filtrées : une lecture filtrée ou interrompue n'est pas gardée en mémoire.
2. **Cartes manquantes** : lisez d'abord toute votre collection, sans filtre. Allez ensuite sur **Toutes les cartes**, choisissez une rareté avec les filtres du site (L ou UR : le jeu compte plusieurs millions de cartes, l'extension refuse de lire plus de 300 pages), puis cliquez sur **Trouver mes cartes manquantes**. Le bouton **Exporter les cartes manquantes (CSV)** enregistre la liste.
3. **Échanges** : **Copier mes doublons pour Discord** copie la liste, des plus rares aux plus communes (un message Discord est limité à 2 000 caractères). Pour comparer avec un ami, chacun clique sur **Exporter en JSON** et envoie son fichier à l'autre, puis **Comparer avec un ami** et choisissez son fichier.
4. **Réglages et notifications** : cliquez sur le bouton du même nom dans le panneau, ou sur l'icône de l'extension. Cochez ou décochez chaque fonction. Pour les notifications, cochez « Sur ce PC » et/ou « Sur mon téléphone », et si vous voulez « Prévenir aussi avant », puis cliquez sur **Envoyer une notification de test**. Avec WikiMasters PRO, choisissez « 3 minutes » par paquet.
5. **Pour le téléphone** : installez l'application **ntfy** (Google Play, F-Droid ou App Store), touchez **+** et abonnez-vous au même nom de canal que dans les réglages, sur le serveur ntfy.sh.
6. Passez sur la page **Paquets** du site après avoir ouvert des paquets : c'est là que l'extension recalcule l'heure du stock plein et le nombre affiché sur son icône.
7. **Prix du marché** : passez simplement sur la page **Marché** ; l'extension relève les mises actuelles affichées. Leurs prix s'affichent tout seuls dans le panneau, y compris après une recherche. Lisez votre collection au moins une fois, puis cliquez sur **Estimer la valeur de mes cartes** (page Marché ou Collection). L'estimation est le **prix le plus haut trouvé** (le plus bas est affiché à côté) ; « ≥ » signale que ce prix vient d'une enchère encore en cours. **Exporter les prix du marché (CSV)** enregistre tous les prix relevés.
8. **Alertes d'enchères** : dans les réglages, partie « Enchères », réglez vos alertes (« + Ajouter une alerte ») et où les recevoir. Misez comme d'habitude : l'enchère est suivie toute seule. Pour les enchères sur lesquelles vous avez misé avant la 1.8, ouvrez une fois l'onglet **Marché > Mes enchères**. Passez une fois sur votre page **Profil** pour que l'extension connaisse votre pseudo (elle saura alors, sur la page d'une enchère, si vous menez). L'encart « 🔔 » sur la page de l'enchère montre l'heure de fin lue ; si elle n'a pas pu être lue, tapez le temps restant.
9. **Cartes animées du jeu** : sur **Toutes les cartes**, choisissez une rareté (L, UR, SR…) avec les filtres du site, puis cliquez sur **« ✨ Trouver les cartes animées du jeu »**. Repères (novembre 2026) : L ≈ 1 650 cartes (33 pages, quelques minutes), UR ≈ 11 100 (223 pages, environ 12 minutes) ; SR ≈ 62 000 (1 244 pages, environ 1 heure : augmentez le maximum de pages dans les réglages) ; R, PC et C sont beaucoup trop nombreuses. Recommencez avec d'autres raretés : les résultats s'additionnent. **« ✨ Revoir les cartes animées trouvées »** les réaffiche, aussi sur la page Collection.
10. **Étiquettes suggérées** : sur votre Collection, un badge bleu indique l'étiquette à poser, un badge vert « ✓ » qu'elle est déjà posée. Cliquez sur une carte : l'étiquette est écrite dans le champ « Ajouter une étiquette », appuyez sur Entrée pour la poser (ou tapez autre chose). Ouvrez une fois le menu « Toutes les étiquettes » de la page Collection pour que l'extension connaisse toutes vos étiquettes existantes.
11. **Trouver une carte** : dans le panneau, cliquez sur le nom d'une carte (doublons, cartes manquantes, cartes animées, prix…). Choisissez **Dans ma collection**, **Au Marché** ou **Dans « Toutes les cartes »** : l'extension fait la recherche du site pour vous et ouvre la fiche de la carte.
12. **Une lecture s'est arrêtée ?** Cliquez sur **« Reprendre la lecture »** dans le panneau, sans changer de page ni recharger (un rechargement remettrait le site à la page 1 et effacerait les filtres).
13. **Pas de notification sur l'ordinateur ?** Vérifiez que « Sur ce PC » est coché, que les notifications du navigateur sont autorisées dans Windows (Paramètres > Système > Notifications) et que « Ne pas déranger » est désactivé. La page des réglages contient une aide pas à pas.

## Désinstallation

Dans `chrome://extensions`, cliquez sur **Supprimer** sous « WikiMasters Doublons », puis supprimez le dossier.

Pensez aussi à vous désabonner du canal dans l'application ntfy si vous l'utilisiez.

---

Auteur : Jesuif — extension non officielle, sans lien avec WikiMasters.
