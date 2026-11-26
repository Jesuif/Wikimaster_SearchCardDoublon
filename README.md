# WikiMasters Doublons — extension Chrome et Firefox non officielle

Une extension gratuite pour [wiki-masters.com](https://www.wiki-masters.com/). Elle ajoute un panneau sur le site qui trouve **vos doublons**, vos **cartes manquantes** et vos **cartes animées**, relève les **prix du Marché** et repère les bonnes affaires, vous prévient **avant la fin de vos enchères** et quand votre **stock de paquets est plein**, et vous aide à **échanger** avec vos amis. Elle est livrée avec plus de 40 000 prix de cartes, offerts.

**AVERTISSEMENT : lisez entièrement ce document avant d'installer ou d'utiliser cette extension. Son utilisation peut entraîner la suspension ou le bannissement définitif de votre compte WikiMasters. En l'installant, vous acceptez d'en assumer seul tous les risques.**

## Télécharger

| Navigateur | Fichier | Comment l'installer |
|---|---|---|
| **Google Chrome** (111 ou plus récent) | bouton vert **Code** de cette page → **Download ZIP** | [Installation sur Google Chrome](#installation-sur-google-chrome) |
| **Mozilla Firefox** (140 ou plus récent) | **[WikiMasters-Doublons-Firefox.xpi](https://github.com/Jesuif/Wikimaster_SearchCardDoublon/raw/main/WikiMasters-Doublons-Firefox.xpi)** (fichier signé par Mozilla) | [Installation sur Mozilla Firefox](#installation-sur-mozilla-firefox) |

## Fonctionnalités

L'extension ajoute sur le site un panneau flottant, en bas à droite (réduit au départ, avec les boutons **📋** mes listes, **⚙️** réglages et **− / +**). Ses boutons sont rangés par groupes et n'apparaissent que sur les pages où ils servent. Chaque fonction peut être activée ou désactivée dans la page des réglages.

### Collection et doublons

- **Lit toute votre Collection** en cliquant pour vous sur « Suivant » (environ toutes les 2 secondes), avec **⏹ Stop** et **▶ Reprendre la lecture**.
- **Affiche vos doublons**, triés par quantité, rareté, nom ou animation.
- **Statistiques par rareté** : exemplaires, cartes différentes, doublons, cartes animées.
- **Historique** de vos 30 dernières lectures, avec les nouvelles cartes depuis la précédente.
- **Votre collection reste à jour entre deux lectures** : les cartes des paquets ouverts sont ajoutées une par une, une carte mise aux enchères ou défaussée est retirée, une enchère remportée, une vente annulée ou invendue et un échange accepté sont comptés.
- **Exports** en CSV (Excel) ou JSON, et **📥 import** d'un fichier exporté (collection ou prix).
- Les cartes **L+ (shiny)** sont comptées comme des L.

### Cartes manquantes et cartes animées

- Sur **Toutes les cartes** : votre **pourcentage par rareté** et la **liste des cartes qui vous manquent** (avec le filtre de rareté du site), exportable en CSV.
- **Cartes animées mises en valeur** (les GIF qui bougent vraiment) : cadre doré sur le site, colonne « Animée », filtre dédié, et un « A » doré qui tourne en affichage allégé du Marché.
- **« ✨ Trouver les cartes animées du jeu »**, rareté par rareté, pour savoir lesquelles vous manquent.

### Marché et prix

- **Relève les prix** du Marché pendant que vous naviguez : les **mises actuelles** (jamais les mises de départ), les ventes terminées et les pages d'enchères.
- **Prix moyen du site** relu sur la fiche d'une carte, pour toutes ses raretés, avec une **pastille rouge** quand l'historique des prix de la carte est enregistré. Le bouton **« 📈 Relever son prix moyen maintenant »** le fait depuis la fiche de n'importe quelle carte. **« ? »** signale une carte dont le site n'a pas de prix moyen.
- **Estime la valeur de vos cartes** et affiche le prix dans la fiche d'une carte, sur la page d'une enchère et en badges sur votre Collection (rangés sous l'étoile des favoris).
- **Encadre les bonnes affaires** : jaune puis rouge par rapport au prix moyen du site, bleu par rapport au prix le plus haut du Marché, avec des seuils réglables.
- **Repères « + / ++ / +++ »** (vert ou rouge) selon l'écart entre la mise et le prix moyen.
- **Flèches de variation** du prix sur une semaine et sur 2 mois.
- **Alertes sur les prix** : 🕒 prix ancien ou sans date, ⚠ prix le plus haut douteux, 🎈 **prix gonflé artificiellement** (pic de ventes très chères, puis retour à la normale).
- **Filtres du Marché** : seulement les enchères encadrées, les cartes animées, celles qui finissent dans X minutes, jusqu'à une mise maximale, ou pas trop au-dessus du prix moyen.
- **Affichage allégé** du Marché (rareté, nom, mise et durée seulement) pour voir beaucoup plus de cartes à la fois.
- **« 🛒 Voir au Marché »** en un clic depuis la fiche de n'importe quelle carte, une page d'enchère ou les souhaits de la guilde, avec le nombre d'annonces de la carte exacte.
- **⭐ Mes souhaits** sur le Marché : la liste de vos cartes souhaitées, un clic pour chercher chacune au Marché.
- **Prix d'achat** des cartes remportées aux enchères (badge 🛒), et sur la page d'une enchère gagnée, **« 📚 Tu l'as gagnée : la trouver dans ma collection »**.
- **☁️ Prix partagés** entre amis par un fichier Google Drive (facultatif, voir plus bas).

### 🎁 Prix du Marché offerts

L'extension est livrée avec un fichier de prix, **offert gratuitement par l'auteur** : [`prix-marche-wikimasters.csv`](https://github.com/Jesuif/Wikimaster_SearchCardDoublon/raw/main/prix-marche-wikimasters.csv).

- **40 845 cartes** (par nom et par rareté) : les prix relevés au Marché du 23 au 25 novembre 2026, le prix moyen du site pour 2 548 d'entre elles, les variations de prix et les pics suspects (🎈) quand ils sont connus.
- **Rien à faire** : au premier passage sur wiki-masters.com après l'installation, l'extension ajoute ces prix toute seule. Le panneau affiche « Prix importés depuis « les prix offerts avec l'extension » ».
- **Vos propres prix sont respectés** : seuls les prix qui vous manquent, ou ceux datés d'un jour plus récent que les vôtres, sont repris.
- Vous pouvez aussi télécharger le fichier pour l'ouvrir dans Excel.

### Échanges

- Sur la page **Échanges** du site, et dans la fenêtre « Détail de l'échange » : **le prix de chaque carte et le total de chaque côté**, pour voir tout de suite si l'échange est équilibré.
- **Cadres de couleur** : **vert** pour une carte de votre liste de souhaits qu'on vous offre, **jaune** pour une carte que vous n'avez pas encore, **rouge** pour une carte que vous donnez et dont c'est votre dernier exemplaire.
- **Un clic sur une carte** de l'échange : son prix moyen, la voir au Marché, savoir quels amis l'ont, ouvrir sa fiche.
- **Vos doublons en texte prêt pour Discord**, et comparaison de votre collection avec le fichier JSON d'un ami.
- **Vos souhaits chez vos amis** et **« 👥 Vérifier si un de mes amis la possède »** depuis la fiche d'une carte.

### Enchères et amis

- **Alertes avant la fin des enchères que vous suivez**, autant de fois que vous voulez (par exemple 1 h, 10 min et 2 min avant), sur l'ordinateur et/ou le téléphone.
- **Suivi à la seconde** : heure de fin exacte, **« tu mènes »** ou **« surenchéri »**, toutes vos enchères en cours suivies dès que vous passez sur le Marché.
- **Fenêtre bleue « un ami a misé »** sur l'enchère que vous regardez (vous choisissez quels amis ignorer).

### Étiquettes

- **Suggère une étiquette** pour chaque carte (comédiens, politique, film & série, flore, insectes, faune, musique, carte animée) d'après sa description : un badge sur la Collection, et l'étiquette écrite dans le champ « Ajouter une étiquette » quand vous ouvrez la carte. **C'est toujours vous qui appuyez sur Entrée.** Noms et mots-clés modifiables, étiquettes personnelles possibles.

### Paquets et notifications

- **Nombre de paquets estimé** sur l'icône de l'extension.
- **Si vous l'activez**, une notification quand votre stock de 10 paquets est plein (et, si vous voulez, un peu avant), sur l'ordinateur et/ou sur le téléphone avec l'application gratuite ntfy.

### Confort

- **Un clic sur le nom d'une carte** dans le panneau la cherche dans votre Collection, au Marché ou dans « Toutes les cartes ».
- **Vos listes sont gardées** (doublons, collection, cartes manquantes, enchères suivies…) : la dernière revient sur les autres pages, et **📋** les rouvre toutes.

### Ce que l'extension ne fait pas

Elle **n'ouvre aucun paquet**, n'achète rien, ne mise pas, n'échange rien et ne vend rien. Elle ignore volontairement tout bouton payant.

## Installation sur Google Chrome

Il faut **Google Chrome version 111** ou plus récente. L'extension n'est pas sur le Chrome Web Store : on l'installe à partir du dossier téléchargé ici, avec le « mode développeur » de Chrome. Comptez deux minutes.

**1. Télécharger l'extension**

- En haut de cette page GitHub, cliquez sur le bouton vert **<> Code**, puis sur **Download ZIP**.
- Le fichier `Wikimaster_SearchCardDoublon-main.zip` arrive dans votre dossier **Téléchargements**.

**2. Décompresser le fichier**

- Faites un clic droit sur ce fichier zip > **Extraire tout…** > **Extraire**.
- Ouvrez le dossier obtenu, `Wikimaster_SearchCardDoublon-main` : vous devez y voir **directement** le fichier `manifest.json` (avec `content.js`, `options.html`…). Si vous voyez à la place un autre dossier `Wikimaster_SearchCardDoublon-main`, c'est ce dossier intérieur qu'il faudra choisir à l'étape 4.
- **Rangez ce dossier à un endroit où il restera** (par exemple dans Documents). Chrome le relit à chaque démarrage : si vous le supprimez ou le déplacez, l'extension s'arrête.

**3. Activer le mode développeur**

- Dans la barre d'adresse de Chrome, tapez `chrome://extensions` puis appuyez sur **Entrée**.
- En haut à droite de la page, activez l'interrupteur **Mode développeur**.

**4. Charger l'extension**

- Cliquez sur **Charger l'extension non empaquetée** (en haut à gauche).
- Choisissez le dossier de l'étape 2, celui qui contient `manifest.json`, puis cliquez sur **Sélectionner un dossier**.
- « WikiMasters Doublons » apparaît dans la liste : vérifiez que son interrupteur est bien activé.

**5. Épingler l'icône**

- Cliquez sur l'icône des extensions (la pièce de puzzle 🧩) en haut à droite de Chrome, puis sur la punaise 📌 à côté de « WikiMasters Doublons ».
- L'icône affiche le nombre de paquets estimé ; un clic dessus ouvre les réglages.

**6. Ouvrir WikiMasters**

- Allez sur [wiki-masters.com](https://www.wiki-masters.com/), ou rechargez la page avec **F5** si elle était déjà ouverte.
- Le panneau de l'extension apparaît en bas à droite, réduit : cliquez sur **+** pour l'ouvrir. Les prix offerts sont ajoutés tout seuls au premier passage (quelques secondes).

**Notifications sur l'ordinateur (facultatif)** : dans Windows, **Paramètres > Système > Notifications**, vérifiez que Google Chrome a le droit d'afficher des notifications.

**En cas de souci**

- Chrome affiche « Fichier manifeste manquant ou illisible » : vous avez choisi le mauvais dossier. Prenez celui qui contient directement `manifest.json` (voir l'étape 2).
- Le panneau n'apparaît pas sur le site : rechargez la page avec **F5**, et vérifiez dans `chrome://extensions` que l'extension est activée.

**Mettre à jour** : téléchargez de nouveau le ZIP, remplacez les fichiers du dossier de l'extension par les nouveaux (même emplacement), cliquez sur la flèche ↻ de « WikiMasters Doublons » dans `chrome://extensions`, puis rechargez les onglets WikiMasters (**F5**). Vos réglages et votre historique sont gardés.

## Installation sur Mozilla Firefox

Il faut **Mozilla Firefox version 140** ou plus récente (menu ≡ > Aide > À propos de Firefox).

> **Vous aviez installé une version Firefox téléchargée ici avant le 26 novembre 2026 ?** Supprimez-la d'abord (`about:addons` > trois points à côté de « WikiMasters Doublons » > **Supprimer**). La nouvelle version ne la remplace pas : elle s'installerait à côté, avec deux panneaux sur le site. Les réglages et l'historique de l'ancienne version ne sont pas repris.

1. Cliquez sur **[WikiMasters-Doublons-Firefox.xpi](https://github.com/Jesuif/Wikimaster_SearchCardDoublon/raw/main/WikiMasters-Doublons-Firefox.xpi)** : Firefox télécharge le fichier.
2. Ouvrez-le depuis la liste des téléchargements de Firefox, ou glissez-le dans une fenêtre de Firefox (ou menu ≡ > Extensions et thèmes > roue dentée > **Installer un module depuis un fichier…**), puis cliquez sur **Ajouter**. Le fichier est signé par Mozilla : il reste installé après la fermeture de Firefox.
3. Ouvrez `about:addons`, cliquez sur « WikiMasters Doublons » puis sur l'onglet **Permissions**, et vérifiez que l'accès à wiki-masters.com est activé.
4. Pour voir le nombre de paquets, épinglez l'icône : icône des extensions (la pièce de puzzle) > roue à côté de « WikiMasters Doublons » > **Épingler à la barre d'outils**.
5. Notifications sur le téléphone : quand vous cochez cette option, Firefox vous demande votre accord pour envoyer des données hors du navigateur (vers ntfy.sh). Acceptez, sinon la case se décoche.
6. Les réglages : `about:addons` > WikiMasters Doublons > **Options** (ou clic droit sur l'icône > « Gérer l'extension »).

**Mettre à jour** : téléchargez le nouveau fichier `.xpi` avec le même lien et installez-le de la même façon, par-dessus la version installée. Vos réglages et votre historique sont gardés.

## Utilisation

1. **Doublons, statistiques et historique** : sur la page **Collection**, cliquez sur **Trouver mes doublons**. Pour une grande collection, la lecture peut durer environ un quart d'heure ; ne changez pas de page pendant ce temps. Le bouton **Stop** interrompt la lecture. Les filtres du site (rareté, étiquette, recherche) limitent la lecture aux cartes filtrées : une lecture filtrée ou interrompue n'est pas gardée en mémoire.
2. **Cartes manquantes** : lisez d'abord toute votre collection, sans filtre. Allez ensuite sur **Toutes les cartes**, choisissez une rareté avec les filtres du site (L ou UR : le jeu compte plusieurs millions de cartes, l'extension refuse de lire plus de 300 pages), puis cliquez sur **Trouver mes cartes manquantes**. Le bouton **Exporter les cartes manquantes (CSV)** enregistre la liste.
3. **Échanges** : passez sur la page **Échanges** du site pour voir les prix et les cadres sur chaque offre. **Copier mes doublons pour Discord** copie la liste, des plus rares aux plus communes (un message Discord est limité à 2 000 caractères). Pour comparer avec un ami, chacun clique sur **Exporter en JSON** et envoie son fichier à l'autre, puis **Comparer avec un ami** et choisissez son fichier.
4. **Réglages et notifications** : cliquez sur le bouton **⚙️** en haut du panneau, ou sur l'icône de l'extension. Cochez ou décochez chaque fonction. Pour les notifications, cochez « Sur ce PC » et/ou « Sur mon téléphone », et si vous voulez « Prévenir aussi avant », puis cliquez sur **Envoyer une notification de test**. Avec WikiMasters PRO, choisissez « 3 minutes » par paquet.
5. **Pour le téléphone** : installez l'application **ntfy** (Google Play, F-Droid ou App Store), touchez **+** et abonnez-vous au même nom de canal que dans les réglages, sur le serveur ntfy.sh.
6. Passez sur la page **Paquets** du site après avoir ouvert des paquets : c'est là que l'extension recalcule l'heure du stock plein et le nombre affiché sur son icône.
7. **Prix du marché** : les prix offerts sont déjà là. Passez simplement sur la page **Marché** pour en relever de nouveaux ; ils s'affichent tout seuls dans le panneau, y compris après une recherche. Lisez votre collection au moins une fois, puis cliquez sur **Estimer la valeur de mes cartes** (page Marché ou Collection). **Exporter les prix du marché (CSV)** enregistre tous les prix connus.
8. **Alertes d'enchères** : dans les réglages, partie « Enchères », réglez vos alertes (« + Ajouter une alerte ») et où les recevoir. Misez comme d'habitude : l'enchère est suivie toute seule. L'encart « 🔔 » sur la page de l'enchère montre l'heure de fin lue ; si elle n'a pas pu être lue, tapez le temps restant.
9. **Cartes animées du jeu** : sur **Toutes les cartes**, choisissez une rareté (L, UR, SR…) avec les filtres du site, puis cliquez sur **« ✨ Trouver les cartes animées du jeu »**. Repères (novembre 2026) : L ≈ 1 650 cartes (33 pages, quelques minutes), UR ≈ 11 100 (223 pages, environ 12 minutes) ; SR ≈ 62 000 (1 244 pages, environ 1 heure : augmentez le maximum de pages dans les réglages) ; R, PC et C sont beaucoup trop nombreuses. Recommencez avec d'autres raretés : les résultats s'additionnent. **« ✨ Revoir les cartes animées trouvées »** les réaffiche, aussi sur la page Collection.
10. **Étiquettes suggérées** : sur votre Collection, un badge bleu indique l'étiquette à poser, un badge vert « ✓ » qu'elle est déjà posée. Cliquez sur une carte : l'étiquette est écrite dans le champ « Ajouter une étiquette », appuyez sur Entrée pour la poser (ou tapez autre chose). Ouvrez une fois le menu « Toutes les étiquettes » de la page Collection pour que l'extension connaisse toutes vos étiquettes existantes.
11. **Trouver une carte** : dans le panneau, cliquez sur le nom d'une carte (doublons, cartes manquantes, cartes animées, prix…). Choisissez **Dans ma collection**, **Au Marché** ou **Dans « Toutes les cartes »** : l'extension fait la recherche du site pour vous et ouvre la fiche de la carte.
12. **Une lecture s'est arrêtée ?** Cliquez sur **« Reprendre la lecture »** dans le panneau, sans changer de page ni recharger (un rechargement remettrait le site à la page 1 et effacerait les filtres).
13. **Pas de notification sur l'ordinateur ?** Vérifiez que « Sur ce PC » est coché, que les notifications du navigateur sont autorisées dans Windows (Paramètres > Système > Notifications) et que « Ne pas déranger » est désactivé. La page des réglages contient une aide pas à pas.

## Prix partagés entre amis (facultatif)

Le bouton **« ☁️ Mettre à jour les prix »** (pages Marché et Collection) lit un fichier de prix commun rangé dans le Google Drive d'une personne du groupe, ajoute à l'extension les prix qui lui manquent, puis renvoie le fichier complet avec vos prix en plus. Personne n'a besoin de compte Google : les autres n'ont besoin que de **l'adresse du script et du code secret**, à indiquer dans les réglages, partie « Prix partagés ».

**Installer le script (une seule fois, par le propriétaire du fichier)** :

1. Ouvrez [script.google.com](https://script.google.com/) avec le compte Google qui possède le fichier, puis **Nouveau projet**.
2. Remplacez tout le code par le contenu du fichier `script-google-prix-partages.gs` (dans ce dépôt).
3. En haut du code, remplacez `ID_FICHIER` par l'identifiant de votre fichier (dans son lien, entre `/d/` et `/view`) et **remplacez `CODE_SECRET`** par un code de votre choix. Enregistrez.
4. **Déployer → Nouveau déploiement**, type **Application Web** : « Exécuter en tant que : **Moi** », « Qui a accès : **Tout le monde** ». Cliquez sur **Déployer**, puis autorisez l'accès à votre Drive (Google peut afficher « application non validée » : **Paramètres avancés → Accéder au projet**, c'est votre propre script).
5. Copiez l'**adresse de l'application Web** (elle finit par `/exec`) et donnez-la, avec le code secret, aux utilisateurs de l'extension.
6. Vous pouvez remettre le partage du fichier sur **Accès limité** : le script n'en a pas besoin.

Si vous modifiez le script plus tard : **Déployer → Gérer les déploiements → modifier (crayon) → Nouvelle version**, pour garder la même adresse.

## Risques : à lire absolument

1. **Extension non officielle.** Elle n'est ni créée, ni approuvée, ni soutenue par WikiMasters, par son éditeur Shoobidoo Labs inc. ou par la Wikimedia Foundation.
2. **Elle peut enfreindre les règles du jeu.** Les [Règles de la communauté WikiMasters](https://www.wiki-masters.com/rules) (section 3, « Pas d'automatisation ni de triche ») interdisent les bots, scripts, macros et outils qui jouent ou interagissent à la place du joueur. Comme cette extension clique sur « Suivant » à votre place (et, quand vous le lui demandez depuis le panneau, avec « 🛒 Voir au Marché » ou « 📚 Tu l'as gagnée », remplit la recherche du site, choisit un filtre de rareté et ouvre la fiche d'une carte) (pages de votre collection, de « Toutes les cartes », y compris pour chercher les cartes animées du jeu, ce qui peut représenter des centaines de pages), reclique et clique sur « Réessayer » quand une page tarde, et, pour la recherche des souhaits ou la vérification d'une carte chez vos amis, ouvre et referme les fenêtres d'échange de vos amis, WikiMasters peut la considérer comme une automatisation interdite. « 📈 Relever son prix moyen maintenant » demande au site l'historique des prix de la carte (une requête), comme le fait l'onglet « Marché » de sa fiche. Les alertes d'enchères, elles, ne cliquent sur rien : elles lisent la page, les réponses que le site reçoit déjà et regardent vos propres clics. Avec le filtre « Seulement les mises jusqu'à … », et seulement quand vous cliquez sur « ⏬ Charger la suite jusqu'aux mises ≤ … », l'extension clique jusqu'à 20 fois sur « Charger la suite » du Marché (une requête au site par clic), et « Trier par Mise la plus basse » choisit ce tri dans le menu du site. Les étiquettes suggérées écrivent une étiquette dans le champ « Ajouter une étiquette » quand vous ouvrez une carte, sans la valider : c'est toujours vous qui la posez.
3. **Les sanctions peuvent être lourdes.** Selon les [Conditions d'utilisation](https://www.wiki-masters.com/terms) (section 6), l'éditeur peut, à sa seule discrétion et sans préavis, avertir, restreindre, suspendre ou supprimer définitivement un compte. Il peut aussi annuler des progrès, objets ou récompenses, sans remboursement.
4. **Le site peut changer à tout moment.** Une mise à jour de WikiMasters peut rendre l'extension inutilisable ou fausser ses résultats. Les doublons, cartes animées, cartes manquantes, statistiques, prix, totaux d'échange, comparaisons et étiquettes suggérées affichés peuvent être incomplets ou inexacts : vérifiez-les avant tout échange ou toute vente. Les prix offerts sont ceux relevés à leur date : ils vieillissent.
5. **Les alertes d'enchères ne sont pas garanties.** L'heure de fin est lue sur la page du site : si le site change d'affichage, si l'enchère est prolongée sans que vous repassiez dessus, ou si le navigateur est fermé (sans l'option téléphone), une alerte peut manquer, partir en avance ou en retard. Ne comptez pas uniquement sur elles pour une enchère importante.
6. **Les notifications et le nombre de paquets ne sont pas garantis.** L'heure du stock plein et le nombre affiché sur l'icône sont des estimations, calculées quand vous passez sur la page Paquets. Elles deviennent fausses si vous ouvrez des paquets ailleurs (sur un autre appareil) sans repasser sur cette page. La notification sur l'ordinateur demande que le navigateur soit ouvert. Celle sur le téléphone dépend du service tiers ntfy.sh, que l'auteur ne contrôle pas.
7. **Les règles peuvent changer.** Les références ci-dessus correspondent aux versions en ligne au 2 novembre 2026 (règles du 20 juillet 2026, conditions du 23 septembre 2026). Il vous appartient de consulter les versions en vigueur.

En cas de doute, ne l'utilisez pas, ou demandez d'abord l'autorisation à WikiMasters : support@wiki-masters.com.

## Utilisation à vos propres risques et exclusion de responsabilité

En installant, en copiant ou en utilisant cette extension, vous reconnaissez avoir lu et compris le présent avertissement, et vous acceptez d'assumer seul l'ensemble des risques liés à son utilisation.

L'extension est fournie **« telle quelle »**, gratuitement, **sans aucune garantie** d'aucune sorte, expresse ou implicite, notamment de fonctionnement, d'exactitude, de compatibilité ou de conformité aux règles d'un site tiers. Il en va de même pour les prix offerts.

Dans toute la mesure permise par la loi applicable, l'auteur ne pourra en aucun cas être tenu responsable d'un dommage direct ou indirect résultant de l'installation, de l'utilisation ou de l'impossibilité d'utiliser l'extension. Cela comprend notamment : l'avertissement, la restriction, la suspension ou le bannissement d'un compte ; la perte de cartes, de paquets, d'objets virtuels, de monnaie virtuelle, de progrès ou d'achats ; une notification absente, en avance ou en retard ; une erreur dans les résultats ou les prix affichés ou exportés.

Vous êtes seul responsable du respect des conditions d'utilisation et des règles des sites que vous visitez avec cette extension, ainsi que des conditions du service ntfy.sh si vous l'utilisez.

## Confidentialité

- Par défaut, l'extension ne transmet **aucune donnée** : rien n'est envoyé à l'auteur ni à un tiers.
- Elle garde **dans votre navigateur uniquement** : vos réglages (dont vos étiquettes et leurs mots-clés), la liste des noms d'étiquettes que vous avez créées sur le site, l'heure prévue du stock plein, votre dernière lecture complète de la collection (tenue à jour entre deux lectures), l'historique de vos lectures (30 au plus), les totaux de cartes du jeu, votre liste de souhaits, les prix relevés au marché (nom de la carte, rareté, mise actuelle, enchère terminée ou non, date ; 60 jours au plus), le prix d'achat des cartes que vous avez remportées aux enchères (nom, rareté, prix, date), les enchères que vous suivez (identifiant, nom de la carte, rareté, dernière mise vue, heure de fin, si vous menez ; plus suivies une minute après leur fin, puis gardées 7 jours pour reconnaître vos achats), votre pseudo (lu sur votre page Profil) et les cartes animées trouvées sur « Toutes les cartes ». Vous pouvez tout effacer depuis la page des réglages.
- Sur wiki-masters.com, le petit script `reponses-site.js` lit les réponses que **le site reçoit déjà** pour son Marché et ses Échanges (enchères affichées, enchère ouverte et ses mises, vos ventes, vos mises en cours et vos victoires, l'historique des prix d'une carte, les cartes des échanges). Il ne transmet rien hors de votre navigateur, et ne demande lui-même quelque chose au site que quand vous cliquez sur « 📈 Relever son prix moyen maintenant ». L'extension n'en garde que ce qui sert aux prix, aux enchères suivies, aux prix d'achat et au suivi de votre collection. Elle garde aussi : votre identifiant sur le site (« monId »), vos amis lus sur la page Amis (pseudos), ceux que vous avez ajoutés ou choisis d'ignorer, la dernière liste ouverte dans le panneau, et votre dernière recherche de cartes manquantes. « Effacer l'historique et la dernière lecture » efface aussi les listes gardées.
- Les **prix offerts** sont lus dans le dossier de l'extension elle-même : rien n'est téléchargé ni envoyé. L'extension note seulement pour quelle version elle les a déjà ajoutés.
- Le fichier JSON d'un ami que vous ouvrez pour une comparaison, comme un fichier CSV que vous importez, est lu dans votre navigateur et n'est envoyé nulle part.
- Pour savoir si une image de carte bouge, l'extension relit le début de l'image GIF affichée par le site (sur upload.wikimedia.org, comme le fait déjà la page). Elle n'envoie rien ; elle garde seulement le résultat (animée ou non) pour ne pas relire la même image.
- Permissions demandées : **stockage** (les réglages et la mémoire décrite ci-dessus), **stockage illimité** (pour que les prix offerts et vos relevés tiennent sans la limite de taille habituelle), **alarmes** (déclencher les notifications et recompter les paquets) et **notifications** (les afficher). Elle ne s'active que sur wiki-masters.com. Elle peut contacter script.google.com **seulement si vous réglez les prix partagés**.
- **Seulement si vous activez la notification sur le téléphone**, elle envoie au service [ntfy.sh](https://ntfy.sh) : le nom de canal que vous avez choisi, les heures prévues des notifications (stock plein, et alerte avant si vous l'avez cochée ; les alertes des enchères suivies si vous avez coché « Sur mon téléphone » dans la partie Enchères) et leur texte (pour une enchère : le nom de la carte, sa rareté, l'heure de fin et la dernière mise vue). Le nom du canal sert de mot de passe : toute personne qui le connaît peut lire ces notifications. Choisissez un nom difficile à deviner (la page des réglages peut en générer un) et ne le partagez pas.
- Les fichiers exportés restent sur votre ordinateur.

## Désinstallation

- **Chrome** : dans `chrome://extensions`, cliquez sur **Supprimer** sous « WikiMasters Doublons », puis supprimez le dossier.
- **Firefox** : ouvrez `about:addons`, cliquez sur les trois points à côté de « WikiMasters Doublons » puis **Supprimer**.

Pensez aussi à vous désabonner du canal dans l'application ntfy si vous l'utilisiez.

---

Version 1.20.4 · [Historique des versions](CHANGELOG.md) · Auteur : Jesuif — extension non officielle, sans lien avec WikiMasters.
