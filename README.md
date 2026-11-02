# WikiMasters Doublons — extension Chrome non officielle

**AVERTISSEMENT : lisez entièrement ce document avant d'installer ou d'utiliser cette extension. Son utilisation peut entraîner la suspension ou le bannissement définitif de votre compte WikiMasters. En l'installant, vous acceptez d'en assumer seul tous les risques.**

---

## Ce que fait l'extension (version 1.3)

Sur [wiki-masters.com](https://www.wiki-masters.com/), l'extension ajoute un panneau qui :

- sur la page **Collection**, lit les cartes de chaque page et **clique automatiquement sur le bouton « Suivant »**, environ toutes les 2 secondes, pour parcourir toute la collection ;
- affiche vos doublons, triés par quantité, rareté, nom ou animation ;
- **met en valeur les cartes animées** (celles dont l'image bouge, c'est-à-dire un GIF qui contient plusieurs images ; les GIF fixes, comme certains logos, ne comptent pas) : un cadre doré sur le site, une colonne « Animée » et un filtre qui liste toutes vos cartes animées ;
- exporte le résultat dans un fichier CSV (Excel) ou JSON, enregistré sur votre ordinateur ;
- affiche des **statistiques par rareté** (exemplaires, cartes différentes, doublons, cartes animées) ;
- garde un **historique** de vos lectures et vous montre les nouvelles cartes depuis la dernière ;
- sur la page **Toutes les cartes**, calcule votre **pourcentage par rareté** et, avec un filtre de rareté choisi par vous, **liste les cartes qui vous manquent** (en cliquant sur « Suivant » de la même façon) ;
- aide aux **échanges** : copie vos doublons en texte prêt pour Discord, et compare votre collection au fichier JSON d'un ami ;
- affiche sur son icône le **nombre de paquets estimé** ;
- **si vous l'activez**, vous prévient quand votre stock de 10 paquets est plein, et si vous le souhaitez un peu avant, sur votre ordinateur et/ou sur votre téléphone (avec l'application gratuite ntfy).

Chaque fonction peut être activée ou désactivée dans la page des réglages.

Elle **n'ouvre aucun paquet**, n'achète rien, n'échange rien et ne vend rien. Elle ignore volontairement tout bouton payant.

## Risques : à lire absolument

1. **Extension non officielle.** Elle n'est ni créée, ni approuvée, ni soutenue par WikiMasters, par son éditeur Shoobidoo Labs inc. ou par la Wikimedia Foundation.
2. **Elle peut enfreindre les règles du jeu.** Les [Règles de la communauté WikiMasters](https://www.wiki-masters.com/rules) (section 3, « Pas d'automatisation ni de triche ») interdisent les bots, scripts, macros et outils qui jouent ou interagissent à la place du joueur. Comme cette extension clique sur « Suivant » à votre place (pages de votre collection et de « Toutes les cartes »), WikiMasters peut la considérer comme une automatisation interdite.
3. **Les sanctions peuvent être lourdes.** Selon les [Conditions d'utilisation](https://www.wiki-masters.com/terms) (section 6), l'éditeur peut, à sa seule discrétion et sans préavis, avertir, restreindre, suspendre ou supprimer définitivement un compte. Il peut aussi annuler des progrès, objets ou récompenses, sans remboursement.
4. **Le site peut changer à tout moment.** Une mise à jour de WikiMasters peut rendre l'extension inutilisable ou fausser ses résultats. Les doublons, cartes animées, cartes manquantes, statistiques et comparaisons affichés peuvent être incomplets ou inexacts : vérifiez-les avant tout échange ou toute vente.
5. **Les notifications et le nombre de paquets ne sont pas garantis.** L'heure du stock plein et le nombre affiché sur l'icône sont des estimations, calculées quand vous passez sur la page Paquets. Elles deviennent fausses si vous ouvrez des paquets ailleurs (sur un autre appareil) sans repasser sur cette page. La notification sur l'ordinateur demande que le navigateur soit ouvert. Celle sur le téléphone dépend du service tiers ntfy.sh, que l'auteur ne contrôle pas.
6. **Les règles peuvent changer.** Les références ci-dessus correspondent aux versions en ligne au 2 novembre 2026 (règles du 20 juillet 2026, conditions du 23 septembre 2026). Il vous appartient de consulter les versions en vigueur.

En cas de doute, ne l'utilisez pas, ou demandez d'abord l'autorisation à WikiMasters : support@wiki-masters.com.

## Utilisation à vos propres risques et exclusion de responsabilité

En installant, en copiant ou en utilisant cette extension, vous reconnaissez avoir lu et compris le présent avertissement, et vous acceptez d'assumer seul l'ensemble des risques liés à son utilisation.

L'extension est fournie **« telle quelle »**, gratuitement, **sans aucune garantie** d'aucune sorte, expresse ou implicite, notamment de fonctionnement, d'exactitude, de compatibilité ou de conformité aux règles d'un site tiers.

Dans toute la mesure permise par la loi applicable, l'auteur ne pourra en aucun cas être tenu responsable d'un dommage direct ou indirect résultant de l'installation, de l'utilisation ou de l'impossibilité d'utiliser l'extension. Cela comprend notamment : l'avertissement, la restriction, la suspension ou le bannissement d'un compte ; la perte de cartes, de paquets, d'objets virtuels, de monnaie virtuelle, de progrès ou d'achats ; une notification absente, en avance ou en retard ; une erreur dans les résultats affichés ou exportés.

Vous êtes seul responsable du respect des conditions d'utilisation et des règles des sites que vous visitez avec cette extension, ainsi que des conditions du service ntfy.sh si vous l'utilisez.

## Confidentialité

- Par défaut, l'extension ne transmet **aucune donnée** : rien n'est envoyé à l'auteur ni à un tiers.
- Elle garde **dans votre navigateur uniquement** : vos réglages, l'heure prévue du stock plein, votre dernière lecture complète de la collection, l'historique de vos lectures (30 au plus) et les totaux de cartes du jeu. Vous pouvez tout effacer depuis la page des réglages.
- Le fichier JSON d'un ami que vous ouvrez pour une comparaison est lu dans votre navigateur et n'est envoyé nulle part.
- Pour savoir si une image de carte bouge, l'extension relit le début de l'image GIF affichée par le site (sur upload.wikimedia.org, comme le fait déjà la page). Elle n'envoie rien ; elle garde seulement le résultat (animée ou non) pour ne pas relire la même image.
- Permissions demandées : **stockage** (les réglages et la mémoire décrite ci-dessus), **alarmes** (déclencher les notifications et recompter les paquets), **notifications** (les afficher). Elle ne s'active que sur wiki-masters.com.
- **Seulement si vous activez la notification sur le téléphone**, elle envoie au service [ntfy.sh](https://ntfy.sh) : le nom de canal que vous avez choisi, les heures prévues des notifications (stock plein, et alerte avant si vous l'avez cochée) et leur texte. Le nom du canal sert de mot de passe : toute personne qui le connaît peut lire ces notifications. Choisissez un nom difficile à deviner (la page des réglages peut en générer un) et ne le partagez pas.
- Les fichiers exportés restent sur votre ordinateur.

## Installation (à vos risques)

Cette version est pour **Google Chrome**. La version pour Mozilla Firefox se trouve dans un autre dépôt.

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
7. **Pas de notification sur l'ordinateur ?** Vérifiez que « Sur ce PC » est coché, que les notifications du navigateur sont autorisées dans Windows (Paramètres > Système > Notifications) et que « Ne pas déranger » est désactivé. La page des réglages contient une aide pas à pas.

## Désinstallation

Dans `chrome://extensions`, cliquez sur **Supprimer** sous « WikiMasters Doublons », puis supprimez le dossier.

Pensez aussi à vous désabonner du canal dans l'application ntfy si vous l'utilisiez.

---

Auteur : Jesuif — extension non officielle, sans lien avec WikiMasters.
