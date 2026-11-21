# WikiMasters Doublons — extension Chrome non officielle

**AVERTISSEMENT : lisez entièrement ce document avant d'installer ou d'utiliser cette extension. Son utilisation peut entraîner la suspension ou le bannissement définitif de votre compte WikiMasters. En l'installant, vous acceptez d'en assumer seul tous les risques.**

---

## Ce que fait l'extension (version 1.9.0)

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
- sur la page **Toutes les cartes**, **trouve les cartes animées du jeu** (rareté par rareté) et vous dit lesquelles vous manquent.

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
  - Le bouton **« 🔔 Mes enchères suivies »** du panneau (et la page des réglages) liste les enchères suivies, leur heure de fin et la prochaine alerte. Sur la liste du Marché, une étiquette bleue « 🔔 » marque les enchères suivies.
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
2. **Elle peut enfreindre les règles du jeu.** Les [Règles de la communauté WikiMasters](https://www.wiki-masters.com/rules) (section 3, « Pas d'automatisation ni de triche ») interdisent les bots, scripts, macros et outils qui jouent ou interagissent à la place du joueur. Comme cette extension clique sur « Suivant » à votre place (pages de votre collection, de « Toutes les cartes », y compris pour chercher les cartes animées du jeu, ce qui peut représenter des centaines de pages), reclique et clique sur « Réessayer » quand une page tarde, et, pour la recherche des souhaits, ouvre et referme les fenêtres d'échange de vos amis, WikiMasters peut la considérer comme une automatisation interdite. Les alertes d'enchères, elles, ne cliquent sur rien : elles lisent la page et regardent vos propres clics. Les étiquettes suggérées écrivent une étiquette dans le champ « Ajouter une étiquette » quand vous ouvrez une carte, sans la valider : c'est toujours vous qui la posez.
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
- Elle garde **dans votre navigateur uniquement** : vos réglages (dont vos étiquettes et leurs mots-clés), la liste des noms d'étiquettes que vous avez créées sur le site, l'heure prévue du stock plein, votre dernière lecture complète de la collection, l'historique de vos lectures (30 au plus), les totaux de cartes du jeu et, nouveau en 1.4, les prix relevés au marché (nom de la carte, rareté, mise actuelle, enchère terminée ou non, date ; 60 jours au plus). Nouveau en 1.8 : les enchères que vous suivez (identifiant, nom de la carte, rareté, dernière mise vue, heure de fin, si vous menez ; oubliées un jour après leur fin), votre pseudo (lu sur votre page Profil) et les cartes animées trouvées sur « Toutes les cartes ». Vous pouvez tout effacer depuis la page des réglages.
- Le fichier JSON d'un ami que vous ouvrez pour une comparaison est lu dans votre navigateur et n'est envoyé nulle part.
- Pour savoir si une image de carte bouge, l'extension relit le début de l'image GIF affichée par le site (sur upload.wikimedia.org, comme le fait déjà la page). Elle n'envoie rien ; elle garde seulement le résultat (animée ou non) pour ne pas relire la même image.
- Permissions demandées : **stockage** (les réglages et la mémoire décrite ci-dessus), **alarmes** (déclencher les notifications et recompter les paquets), **notifications** (les afficher). Elle ne s'active que sur wiki-masters.com.
- **Seulement si vous activez la notification sur le téléphone**, elle envoie au service [ntfy.sh](https://ntfy.sh) : le nom de canal que vous avez choisi, les heures prévues des notifications (stock plein, et alerte avant si vous l'avez cochée ; nouveau en 1.8, les alertes des enchères suivies si vous avez coché « Sur mon téléphone » dans la partie Enchères) et leur texte (pour une enchère : le nom de la carte, sa rareté, l'heure de fin et la dernière mise vue). Le nom du canal sert de mot de passe : toute personne qui le connaît peut lire ces notifications. Choisissez un nom difficile à deviner (la page des réglages peut en générer un) et ne le partagez pas.
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
7. **Prix du marché** : passez simplement sur la page **Marché** ; l'extension relève les mises actuelles affichées. Leurs prix s'affichent tout seuls dans le panneau, y compris après une recherche. Lisez votre collection au moins une fois, puis cliquez sur **Estimer la valeur de mes cartes** (page Marché ou Collection). L'estimation est le **prix le plus haut trouvé** (le plus bas est affiché à côté) ; « ≥ » signale que ce prix vient d'une enchère encore en cours. **Exporter les prix du marché (CSV)** enregistre tous les prix relevés.
8. **Alertes d'enchères** : dans les réglages, partie « Enchères », réglez vos alertes (« + Ajouter une alerte ») et où les recevoir. Misez comme d'habitude : l'enchère est suivie toute seule. Pour les enchères sur lesquelles vous avez misé avant la 1.8, ouvrez une fois l'onglet **Marché > Mes enchères**. Passez une fois sur votre page **Profil** pour que l'extension connaisse votre pseudo (elle saura alors, sur la page d'une enchère, si vous menez). L'encart « 🔔 » sur la page de l'enchère montre l'heure de fin lue ; si elle n'a pas pu être lue, tapez le temps restant.
9. **Cartes animées du jeu** : sur **Toutes les cartes**, choisissez une rareté (L, UR, SR…) avec les filtres du site, puis cliquez sur **« ✨ Trouver les cartes animées du jeu »**. Repères (novembre 2026) : L ≈ 1 650 cartes (33 pages, quelques minutes), UR ≈ 11 100 (223 pages, environ 12 minutes) ; SR ≈ 62 000 (1 244 pages, environ 1 heure : augmentez le maximum de pages dans les réglages) ; R, PC et C sont beaucoup trop nombreuses. Recommencez avec d'autres raretés : les résultats s'additionnent. **« ✨ Revoir les cartes animées trouvées »** les réaffiche, aussi sur la page Collection.
10. **Étiquettes suggérées** : sur votre Collection, un badge bleu indique l'étiquette à poser, un badge vert « ✓ » qu'elle est déjà posée. Cliquez sur une carte : l'étiquette est écrite dans le champ « Ajouter une étiquette », appuyez sur Entrée pour la poser (ou tapez autre chose). Ouvrez une fois le menu « Toutes les étiquettes » de la page Collection pour que l'extension connaisse toutes vos étiquettes existantes.
11. **Une lecture s'est arrêtée ?** Cliquez sur **« Reprendre la lecture »** dans le panneau, sans changer de page ni recharger (un rechargement remettrait le site à la page 1 et effacerait les filtres).
12. **Pas de notification sur l'ordinateur ?** Vérifiez que « Sur ce PC » est coché, que les notifications du navigateur sont autorisées dans Windows (Paramètres > Système > Notifications) et que « Ne pas déranger » est désactivé. La page des réglages contient une aide pas à pas.

## Désinstallation

Dans `chrome://extensions`, cliquez sur **Supprimer** sous « WikiMasters Doublons », puis supprimez le dossier.

Pensez aussi à vous désabonner du canal dans l'application ntfy si vous l'utilisiez.

---

Auteur : Jesuif — extension non officielle, sans lien avec WikiMasters.
