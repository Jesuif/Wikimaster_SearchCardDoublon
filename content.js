// =====================================================================
//  WikiMasters Doublons 1.17.5 (sans chargement automatique) - content.js
//  Le navigateur injecte ce script dans chaque page de wiki-masters.com,
//  juste après commun.js (qui fournit api, RARETES, lireReglages...).
//  Nouveau en 1.3 : statistiques, historique, cartes manquantes et aide
//  aux échanges. Chaque fonction s'active ou se coupe dans les réglages.
// =====================================================================


// ---------------------------------------------------------------------
//  PARTIE 1 : LES RÉGLAGES DU SCRIPT (relevés sur ton compte, voir étape 3)
// ---------------------------------------------------------------------
const CONFIG = {
  // Où se trouve le nom d'une carte : un titre h3.
  selecteurNomCarte: "h3",

  // Badge de quantité du genre "x3" : le site n'en affiche pas aujourd'hui
  // (chaque exemplaire est une carte à part). On garde le motif au cas où.
  regexQuantite: /^[x×]\s?(\d+)$/i,

  // Seule une image GIF (adresse qui se termine par .gif) peut bouger. Mais beaucoup de GIF
  // sont fixes (des logos) : l'extension compte ensuite les images contenues dans le fichier.
  regexImageGif: /\.gif$/i,

  // Les listes sont découpées en pages de 50 cartes : textes des boutons de pagination.
  texteBoutonPageSuivante: "Suivant",
  texteBoutonPagePrecedente: "Précédent",

  // Nouveau en 1.3 : pour reconnaître un filtre actif sur la page Collection.
  texteToutesEtiquettes: "Toutes les étiquettes", // le bouton des étiquettes, quand aucune n'est choisie
  classeFiltreChoisi: "ring-2",                    // le site entoure d'un anneau la rareté choisie

  // 1.8 : le nombre maximum de pages se règle maintenant dans les réglages (reglages.pagesMax).
  lecturesGardees: 30,      // nombre de lectures gardées dans l'historique
  nouvellesAffichees: 50,   // nombre maximum de nouvelles cartes listées dans le panneau
  limiteDiscord: 2000,      // un message Discord fait au plus 2 000 caractères

  pauseMs: 2000,        // pause entre deux pages (2000 ms = 2 secondes)
  attenteMaxMs: 5000,   // première attente quand une page se charge ; 1.8 : ensuite on attend plus longtemps
  attenteEssaiMaxMs: 30000, // 1.8 : une attente ne dépasse jamais 30 secondes (puis nouvel essai)
  verificationsImagesSimultanees: 6, // 1.8 : images GIF vérifiées en même temps sur une page

  // 1.9 (repris de la branche 1.4) : le champ des étiquettes dans la fiche d'une carte, et les
  // pastilles des étiquettes déjà posées sur une carte de la grille (vérifié sur le site le 21/11/2026).
  texteChampEtiquette: "Ajouter une étiquette",
  selecteurPastille: "span.rounded-full"
};


// ---------------------------------------------------------------------
//  PARTIE 2 : LA BOÎTE À OUTILS (petites fonctions réutilisables)
// ---------------------------------------------------------------------

// Attendre un certain temps. S'utilise avec "await" : await pause(2000);
function pause(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 1.17 : MODIFIER LA MÉMOIRE DES PRIX CHACUN SON TOUR.
// Plusieurs fonctions lisent la mémoire « marche » (et « tendances »), la modifient, puis la réécrivent
// en entier : le relevé du Marché toutes les 3 s, le prix moyen d'une fiche, l'import, « ☁️ Mettre à jour
// les prix »… et parfois dans deux onglets à la fois. Avant, l'une pouvait réécrire une copie déjà
// dépassée et effacer ce que l'autre venait d'ajouter : des cartes apparaissaient encadrées (nouveaux prix)
// puis plus rien (anciens prix remis). Maintenant, chaque modification attend que la précédente soit finie :
// dans cet onglet (une file d'attente) et entre les onglets du site (un verrou du navigateur, s'il existe).
// "tache" doit relire la mémoire elle-même ; elle ne doit jamais rappeler modifierMemoire (blocage).
let fileMemoire = Promise.resolve();
function modifierMemoire(tache) {
  const executer = () => {
    let promesse = null;
    const une = () => (promesse = promesse || Promise.resolve().then(tache));
    let verrous = null;
    try { verrous = navigator.locks && typeof navigator.locks.request === "function" ? navigator.locks : null; } catch (erreur) { verrous = null; }
    if (!verrous) return une();
    try {
      // Si le verrou ne peut pas appeler notre fonction (Firefox, par exemple), elle tourne quand même, une seule fois.
      return Promise.resolve(verrous.request("wmd-memoire-prix", () => une())).then(() => une(), () => une());
    } catch (erreur) {
      return une();
    }
  };
  const resultat = fileMemoire.then(executer, executer);
  fileMemoire = resultat.catch(() => {});
  return resultat;
}

// Crée un élément HTML avec son texte et sa classe (sans innerHTML, comme le demande Mozilla).
function creer(balise, texte, classe) {
  const element = document.createElement(balise);
  if (texte !== undefined) element.textContent = texte;
  if (classe) element.className = classe;
  return element;
}

// Vrai si l'élément fait partie de NOTRE panneau (pour ne jamais cliquer sur nos propres boutons).
function estDansLePanneau(element) {
  return element.closest("#wmd-panneau") !== null;
}

// Vrai si l'élément est réellement affiché à l'écran.
function estVisible(element) {
  return element.getClientRects().length > 0;
}

// Mots qui signalent un bouton payant (recharge de paquets, abonnement PRO) :
// le script ne cliquera JAMAIS sur un bouton qui contient l'un d'eux.
// Nouveau en 1.4 : avec le marché, on ajoute les mots des enchères (enchérir, miser...).
const MOTS_PAYANTS = ["$", "€", "recharg", "abonne", "achet", "payer", "enchér", "encher", "miser", "vendre", "offre"];

// Cherche un bouton du site qui contient un certain texte. Renvoie null si aucun.
function trouverBoutonParTexte(texte) {
  if (!texte) return null;
  const cherche = texte.trim().toLowerCase();
  const candidats = document.querySelectorAll("button, a, [role='button']");
  for (const element of candidats) {
    if (estDansLePanneau(element)) continue;
    if (element.disabled || element.getAttribute("aria-disabled") === "true") continue;
    if (!estVisible(element)) continue;
    const texteElement = element.textContent.trim().toLowerCase();
    if (MOTS_PAYANTS.some(mot => texteElement.includes(mot))) continue;
    if (texteElement.includes(cherche)) return element;
  }
  return null;
}

// Nouveau en 1.3 : sur quelle page du site sommes-nous ?
function pageActuelle() {
  if (location.pathname.startsWith("/collection")) return "collection";
  if (location.pathname.startsWith("/global-collection")) return "toutes-les-cartes";
  if (location.pathname.startsWith("/marketplace")) return "marche"; // nouveau en 1.4
  return "autre";
}

// 1.16 : les options du Marché (cadres, filtres, affichage allégé) ne servent que sur la liste du Marché,
// dans les onglets « Parcourir » et « Mes enchères » (pas « Mes ventes », « Gagnées », « Historique »).
// L'onglet ouvert est le bouton souligné (border-b-2) de la barre d'onglets. Si on ne le trouve pas, on ne bloque rien.
const REGEX_ONGLETS_MARCHE = /^(parcourir|mes ventes|mes ench[èe]res|gagn[ée]es|historique)\b/i;
const REGEX_ONGLETS_OPTIONS = /^(parcourir|mes ench[èe]res)\b/i;
function ongletMarcheOuvert() {
  for (const bouton of document.querySelectorAll("button.border-b-2")) {
    const texte = bouton.textContent.trim();
    if (REGEX_ONGLETS_MARCHE.test(texte)) return texte;
  }
  return null;
}
function optionsMarcheActives() {
  if (pageActuelle() !== "marche" || REGEX_PAGE_ENCHERE.test(location.pathname)) return false;
  const onglet = ongletMarcheOuvert();
  return onglet === null || REGEX_ONGLETS_OPTIONS.test(onglet);
}

// Un petit tableau tout simple : des titres de colonnes, puis des lignes { valeurs, classe }.
function creerTableau(titres, lignes) {
  const tableau = creer("table", undefined, "wmd-simple");
  const ligneTitres = tableau.createTHead().insertRow();
  for (const titre of titres) ligneTitres.appendChild(creer("th", titre));
  const corps = tableau.createTBody();
  for (const ligne of lignes) {
    const rangee = corps.insertRow();
    if (ligne.classe) rangee.className = ligne.classe;
    for (const valeur of ligne.valeurs) {
      const cellule = rangee.insertCell();
      if (valeur instanceof Node) cellule.appendChild(valeur); // 1.7.5 : une cellule peut contenir un lien
      else cellule.textContent = valeur;
    }
  }
  return tableau;
}

// Nouveau en 1.11 : le nom d'une carte, cliquable, pour les tableaux et listes du panneau.
// Un clic propose de la trouver dans ta Collection, au Marché ou dans « Toutes les cartes »
// (voir la partie 13 UNDECIES). "catalogue" = la rareté vient de « Toutes les cartes » (rareté du
// catalogue, qui peut différer de celle de tes exemplaires) ; "enchere" = l'identifiant d'une enchère.
function lienCarte(nom, rarete, { catalogue = false, enchere = null } = {}) {
  const lien = creer("a", nom, "wmd-lien-carte wmd-carte-cliquable");
  lien.href = "#";
  lien.title = "Trouver cette carte : dans ma collection, au Marché ou dans « Toutes les cartes »";
  lien.dataset.nom = nom;
  if (rarete && RARETES[rarete]) lien.dataset.rarete = rarete;
  if (catalogue) lien.dataset.catalogue = "1";
  if (enchere) lien.dataset.enchere = enchere;
  return lien;
}

// Une liste à puces de cartes, coupée après "maximum" cartes. 1.11 : les noms sont cliquables.
function creerListeDeCartes(cartes, maximum) {
  const liste = creer("ul");
  for (const carte of cartes.slice(0, maximum)) {
    const ligne = creer("li", undefined, `wmd-${carte.rarete}`);
    ligne.append(lienCarte(carte.nom, carte.rarete), ` (${lettreRarete(carte.rarete)})`);
    liste.appendChild(ligne);
  }
  if (cartes.length > maximum) liste.appendChild(creer("li", `… et ${cartes.length - maximum} autre(s).`, "wmd-discret"));
  return liste;
}


// ---------------------------------------------------------------------
//  PARTIE 3 : CE QUE L'EXTENSION A EN MÉMOIRE (réglages, totaux du jeu)
// ---------------------------------------------------------------------

let reglages = { ...REGLAGES_PAR_DEFAUT }; // remplacés dès que la mémoire a répondu
let versionPage = 0; // 1.10 : augmente à chaque changement de la page (voir boucleSiChangement)
let catalogue = null;                      // les totaux par rareté lus sur « Toutes les cartes »
let etiquettes = ETIQUETTES_PAR_DEFAUT;    // 1.9 : les étiquettes que l'extension reconnaît
let etiquettesSurLeSite = {};              // 1.9 : tes étiquettes déjà créées sur le site : { nom: nombre de cartes }
let optionsMarcheOuvertes = true; // 1.16 : le sous-menu « ⚙️ Options du Marché » est-il ouvert ?
api.storage.local.get("optionsMarcheOuvertes").then(({ optionsMarcheOuvertes: valeur }) => {
  optionsMarcheOuvertes = valeur !== false;
  const bloc = document.getElementById("wmd-options-marche");
  if (bloc) bloc.open = optionsMarcheOuvertes;
}).catch(() => {});
let ongletOptionsVu = null;                // 1.16 : les options du Marché étaient-elles actives au dernier affichage du panneau ?
let aDesPrixDePage = false;                // 1.15 : le bloc « Mises de cette page » a quelque chose à montrer

// 1.15 : une promesse tenue quand les réglages sont lus (la liste restaurée en a besoin).
const reglagesPrets = lireReglages().then(lus => {
  reglages = lus;
  actualiserPanneau();
}).catch(() => {});
api.storage.local.get("etiquettesSite").then(({ etiquettesSite }) => {
  etiquettesSurLeSite = etiquettesSite ? etiquettesSite.liste : {};
}).catch(() => {});
lireEtiquettes().then(lues => { etiquettes = lues; }).catch(() => {});
api.storage.local.get("catalogue").then(({ catalogue: lu }) => {
  catalogue = lu ?? null;
});

// Si tu changes un réglage pendant que la page est ouverte, le panneau suit tout de suite.
api.storage.onChanged.addListener(changements => {
  if (changements.reglages) {
    reglages = { ...REGLAGES_PAR_DEFAUT, ...changements.reglages.newValue };
    actualiserPanneau();
    afficherSeuilsPanneau(); // 1.14
  }
  if (changements.catalogue) catalogue = changements.catalogue.newValue ?? null;
  // 1.9 : les étiquettes modifiées dans les réglages, ou relues sur le site dans un autre onglet.
  if (changements.etiquettes) lireEtiquettes().then(lues => { etiquettes = lues; });
  if (changements.etiquettesSite) {
    etiquettesSurLeSite = changements.etiquettesSite.newValue ? changements.etiquettesSite.newValue.liste : {};
  }
});


// ---------------------------------------------------------------------
//  PARTIE 4 : LE PANNEAU FLOTTANT
// ---------------------------------------------------------------------

// Nouveau en 1.5.2 : le panneau s'ouvre RÉDUIT. Il ne s'agrandit que si tu cliques sur « + ».
// (Si le site efface le panneau et qu'il est recréé, il garde l'état choisi sur cette page.)
let panneauOuvert = false;
// 1.17 : les sous-menus des options du Marché ouverts ou fermés (ton choix est gardé).
let sousMenusOuverts = {};
api.storage.local.get("sousMenusOuverts").then(({ sousMenusOuverts: valeur }) => {
  sousMenusOuverts = valeur && typeof valeur === "object" ? valeur : {};
  for (const [id, ouvert] of Object.entries(sousMenusOuverts)) {
    const bloc = document.getElementById(id);
    if (bloc && bloc.tagName === "DETAILS") bloc.open = Boolean(ouvert);
  }
}).catch(() => {});

// 1.17 : le sous-menu « 🤖 Chargement automatique » (voir boucleAutoMarche).
function construireAutoMarche(bloc) {
  const ligne = (...enfants) => {
    const div = creer("label", undefined, "wmd-case");
    div.append(...enfants);
    bloc.appendChild(div);
    return div;
  };
  const caseACocher = (id, quandChange) => {
    const c = creer("input");
    c.type = "checkbox";
    c.id = id;
    c.addEventListener("change", () => quandChange(c.checked));
    return c;
  };
  const nombre = (id, min, quandChange) => {
    const n = creer("input");
    n.type = "number";
    n.min = String(min);
    n.step = "1";
    n.id = id;
    n.className = "wmd-petit-nombre";
    n.addEventListener("change", () => quandChange(Math.round(Number(n.value))));
    return n;
  };
  const actif = caseACocher("wmd-auto-actif", coche => {
    enregistrerAutoMarche({ actif: coche });
    afficherStatut(coche ? "🤖 Chargement automatique lancé (onglet « Parcourir » du Marché)." : "🤖 Chargement automatique arrêté.");
  });
  const principal = ligne(actif, " Charger la suite toute seule (toutes les 2 à 3 s, au hasard)");
  principal.classList.add("wmd-auto-principal");
  const tri = creer("select");
  tri.id = "wmd-auto-tri";
  for (const [valeur, texte] of TRIS_MARCHE) {
    const option = creer("option", texte);
    option.value = valeur;
    tri.appendChild(option);
  }
  tri.addEventListener("change", () => enregistrerAutoMarche({ tri: tri.value }));
  ligne("Tri : ", tri);
  const raretes = creer("div", undefined, "wmd-case wmd-auto-raretes");
  raretes.appendChild(creer("span", "Raretés : "));
  for (const r of Object.keys(RARETES)) {
    const etiquette = creer("label", undefined, `wmd-${r}`);
    const c = caseACocher(`wmd-auto-rarete-${r}`, () => {
      const choisies = Object.keys(RARETES).filter(x => { const e = document.getElementById(`wmd-auto-rarete-${x}`); return e && e.checked; });
      enregistrerAutoMarche({ raretes: choisies });
    });
    etiquette.append(c, " " + lettreRarete(r));
    etiquette.title = RARETES[r].nom;
    raretes.appendChild(etiquette);
  }
  raretes.appendChild(creer("div", "Aucune cochée = toutes. Une seule : le filtre du site. Plusieurs : les autres sont cachées.", "wmd-discret"));
  bloc.appendChild(raretes);
  ligne("Au plus ", nombre("wmd-auto-max", 1, n => enregistrerAutoMarche({ maxChargements: n })), " chargements, puis on s'arrête");
  const actualiser = caseACocher("wmd-auto-actualiser", coche => enregistrerAutoMarche({ actualiser: coche }));
  const minutes = nombre("wmd-auto-minutes", 1, n => enregistrerAutoMarche({ minutes: n, actualiser: true }));
  ligne(actualiser, " Recharger la page toutes les ", minutes, " min (repart de zéro)");
  // 1.17 : « ☁️ Mettre à jour les prix partagés » tout seul, toutes les X minutes (5 au minimum).
  const partage = caseACocher("wmd-auto-partage", coche => enregistrerAutoMarche({ majPartage: coche }));
  const minutesPartage = nombre("wmd-auto-minutes-partage", 5, n => enregistrerAutoMarche({ minutesPartage: n, majPartage: true }));
  const lignePartage = ligne(partage, " ☁️ Mettre à jour les prix partagés toutes les ", minutesPartage, " min");
  lignePartage.title = "Comme le bouton « ☁️ Mettre à jour les prix partagés » : lit le fichier commun, garde la donnée la plus récente, "
    + "puis le renvoie complété de tes prix. Il faut que le fichier partagé soit réglé dans les réglages.";
  const etat = creer("div", "Arrêté.", "wmd-auto-etat");
  etat.id = "wmd-auto-etat";
  bloc.appendChild(etat);
  bloc.appendChild(creer("div", "⚠ Chaque chargement est une requête au site, comme un clic de ta part : "
    + "c'est de l'automatisation, à utiliser avec modération. Pause quand une fiche est ouverte ou que tu écris.", "wmd-discret"));
  setTimeout(afficherReglageAuto, 0);
}

// 1.17 : la légende des cadres, badges et icônes que l'extension ajoute aux cartes.
function construireLegende(bloc) {
  const lignes = [
    ["wmd-leg-jaune", "++", "Cadre jaune : mise sous le prix moyen du site d'au moins le seuil « ++ » ; il devient orangé, de plus en plus rouge, en s'approchant du seuil « +++ »."],
    ["wmd-leg-rouge", "+++", "Cadre rouge : mise sous le prix moyen du site d'au moins le seuil « +++ » (la meilleure affaire)."],
    ["wmd-leg-max", "", "Cadre bleu : mise sous le prix le plus haut vu au Marché (blanc + ⚠ : ce prix est douteux, ces cadres peuvent être masqués)."],
    ["", "−40 %", "En haut du cadre : l'écart et le prix de référence. Survole la carte pour le détail."],
    ["", "+ ++ +++", "En haut à droite : écart avec le prix moyen (vert = moins cher, rouge = plus cher)."],
    ["", "↑ 12 %", "En bas : variation du prix sur 1 semaine (à gauche) et 2 mois (à droite)."],
    ["", "🕒", "Prix de référence relevé il y a plus d'une semaine, ou sans date."],
    ["", "⚠", "Prix le plus haut du Marché probablement trompeur (un prix moyen du site existe)."],
    ["", "🎈", "Prix peut-être gonflé : une semaine de ventes bien plus chères que d'habitude, puis retour à la normale."],
    ["", "✨ / A", "Carte animée (A doré en affichage allégé)."],
    ["", "🔔", "Enchère suivie (vert : tu mènes, rouge : surenchéri)."],
    ["", "$461", "Collection : prix moyen du site ; en bleu, le plus bas / le plus haut vus au Marché ; 🛒 = prix d'achat."]
  ];
  const liste = creer("div", undefined, "wmd-legende-liste");
  for (const [classe, exemple, texte] of lignes) {
    const ligne = creer("div", undefined, "wmd-legende-ligne");
    const pastille = creer("span", exemple, "wmd-legende-exemple" + (classe ? " " + classe : ""));
    ligne.append(pastille, creer("span", texte));
    liste.appendChild(ligne);
  }
  bloc.appendChild(liste);
}

function creerPanneau() {
  if (document.getElementById("wmd-panneau")) return; // il existe déjà

  const panneau = creer("div");
  panneau.id = "wmd-panneau";
  if (!panneauOuvert) panneau.classList.add("wmd-reduit");
  const titre = creer("div", undefined, "wmd-titre");
  titre.appendChild(creer("span", "WikiMasters Doublons", "wmd-titre-texte"));
  panneau.appendChild(titre);

  // Crée un bouton et le branche sur sa fonction (comme un OnClick dans Unity).
  // 1.17 : "parent" = le groupe du panneau où il est rangé.
  const ajouterBouton = (id, texte, action, parent = panneau, aide = "") => {
    const bouton = creer("button", texte);
    bouton.id = id;
    bouton.type = "button";
    if (aide) bouton.title = aide;
    bouton.addEventListener("click", action);
    parent.appendChild(bouton);
    return bouton;
  };
  // 1.17 : la barre de titre a trois petits boutons, visibles même panneau réduit :
  // 📋 mes listes, ⚙️ réglages, − / + réduire.
  const icones = creer("span", undefined, "wmd-titre-boutons");
  titre.appendChild(icones);
  // 1.15 : « 📋 » ouvre le panneau sur tes listes (doublons, collection, cartes manquantes…), même réduit.
  const raccourciListes = ajouterBouton("wmd-raccourci-listes", "📋", () => {
    if (panneau.classList.contains("wmd-reduit")) reduire.click();
    afficherMesListes();
  }, icones, "Mes listes : doublons, collection, cartes manquantes, cartes animées, enchères…");
  ajouterBouton("wmd-reglages", "⚙️", () => {
    api.runtime.sendMessage({ type: "ouvrir-reglages" }).catch(() => {});
  }, icones, "Réglages et notifications (nouvel onglet)");
  // Corrigé en 1.4.6 : le bouton « - » est rangé DANS le titre, qui reste collé en haut du panneau.
  const reduire = ajouterBouton("wmd-reduire", panneauOuvert ? "−" : "+", () => {
    panneauOuvert = panneau.classList.toggle("wmd-reduit") === false;
    reduire.textContent = panneauOuvert ? "−" : "+";
  }, icones, "Agrandir / réduire le panneau");
  // Un clic sur le titre (panneau réduit) l'agrandit aussi.
  titre.addEventListener("click", evenement => {
    if (evenement.target === titre || evenement.target.classList.contains("wmd-titre-texte")) reduire.click();
  });
  void raccourciListes;

  // 1.17 : le statut tout en haut (c'est lui qui dit ce qui se passe), puis Stop / Reprendre.
  const statut = creer("div", "Prêt.");
  statut.id = "wmd-statut";
  panneau.appendChild(statut);
  const taches = creer("div", undefined, "wmd-taches");
  ajouterBouton("wmd-stop", "⏹ Stop", () => arreter(), taches);
  ajouterBouton("wmd-reprendre", "▶ Reprendre la lecture", () => reprendreLecture(), taches); // nouveau en 1.8
  panneau.appendChild(taches);
  const suggestions = creer("div"); // 1.9 : les étiquettes de la carte ouverte (visibles même panneau réduit)
  suggestions.id = "wmd-suggestions";
  panneau.appendChild(suggestions);

  // 1.17 : les boutons sont rangés par groupes ; un groupe sans bouton utile sur cette page est caché.
  const groupe = (id, titreGroupe) => {
    const bloc = creer("div", undefined, "wmd-groupe");
    bloc.id = id;
    bloc.appendChild(creer("div", titreGroupe, "wmd-groupe-titre"));
    panneau.appendChild(bloc);
    return bloc;
  };
  const gPage = groupe("wmd-groupe-page", "🔍 Sur cette page");
  ajouterBouton("wmd-doublons", "Trouver mes doublons", () => trouverMesDoublons(), gPage, "Lit toute ta collection, page par page (ne change pas de page pendant ce temps)");
  ajouterBouton("wmd-manquantes", "Trouver mes cartes manquantes", () => trouverMesCartesManquantes(), gPage, "Choisis d'abord une rareté avec les filtres du site");
  // Nouveau en 1.8 : les cartes animées de tout le jeu (page « Toutes les cartes »).
  ajouterBouton("wmd-animees-jeu", "✨ Trouver les cartes animées du jeu", () => trouverCartesAnimees(), gPage);
  ajouterBouton("wmd-animees-revoir", "✨ Revoir les cartes animées trouvées", () => afficherAnimeesJeu(), gPage);
  const gPrix = groupe("wmd-groupe-prix", "💰 Prix");
  ajouterBouton("wmd-estimer", "Estimer la valeur de mes cartes", () => estimerMesCartes(), gPrix);
  ajouterBouton("wmd-maj-prix", "☁️ Mettre à jour les prix partagés", () => mettreAJourPrixPartages(), gPrix,
    "Lit le fichier des prix partagé, garde la donnée la plus récente, puis le renvoie complété"); // 1.14
  ajouterBouton("wmd-prix-csv", "Exporter les prix du marché (CSV)", () => exporterPrixMarche(), gPrix);
  const gFichiers = groupe("wmd-groupe-fichiers", "📁 Fichiers");
  ajouterBouton("wmd-csv", "Exporter ma collection en CSV (Excel)", () => exporterCSV(), gFichiers);
  ajouterBouton("wmd-importer", "📥 Importer un fichier CSV (collection ou prix)", () => choisirFichierImport(), gFichiers); // 1.10
  const gAmis = groupe("wmd-groupe-amis", "👥 Amis et enchères");
  // Nouveau en 1.5 : tes cartes souhaitées chez tes amis (bouton visible sur toutes les pages).
  ajouterBouton("wmd-souhaits", "Chercher mes souhaits chez mes amis", () => chercherSouhaitsChezAmis(), gAmis,
    "Ouvre la fenêtre d'échange de chaque ami : plusieurs requêtes par ami, à utiliser avec modération");
  ajouterBouton("wmd-souhaits-resultats", "Revoir les résultats (souhaits)", () => afficherResultatsSouhaits(), gAmis);
  // Nouveau en 1.8 : les enchères suivies (alertes avant la fin).
  ajouterBouton("wmd-encheres", "🔔 Mes enchères suivies", () => afficherEncheresSuivies(), gAmis);
  // 1.17.3 : remettre en vente les cartes invendues, au même prix de départ et pour la même durée.
  if (REMISE_EN_VENTE) ajouterBouton("wmd-remise", "🔁 Remettre en vente les invendues", () => boutonRemiseEnVente(), gAmis,
    "Même mise de départ, même durée. Se lance tout de suite (sans confirmation) et clique pour toi dans ta Collection ; recliquer arrête");

  // 1.16 : toutes les options du Marché dans un sous-menu repliable. Ouvert ou fermé : ton choix est gardé.
  // 1.17 : rangées en quatre sous-menus : cadres et repères, filtres, chargement automatique, légende.
  const optionsMarche = creer("details", undefined, "wmd-bloc wmd-options-marche");
  optionsMarche.id = "wmd-options-marche";
  optionsMarche.appendChild(creer("summary", "⚙️ Options du Marché"));
  optionsMarche.open = optionsMarcheOuvertes;
  optionsMarche.addEventListener("toggle", () => {
    optionsMarcheOuvertes = optionsMarche.open;
    api.storage.local.set({ optionsMarcheOuvertes: optionsMarche.open }).catch(() => {});
  });
  panneau.appendChild(optionsMarche);
  const sousMenu = (id, titreSousMenu, ouvertParDefaut) => {
    const bloc = creer("details", undefined, "wmd-sous-menu");
    bloc.id = id;
    bloc.appendChild(creer("summary", titreSousMenu));
    bloc.open = id in sousMenusOuverts ? sousMenusOuverts[id] : ouvertParDefaut;
    bloc.addEventListener("toggle", () => {
      sousMenusOuverts[id] = bloc.open;
      api.storage.local.set({ sousMenusOuverts: sousMenusOuverts }).catch(() => {});
    });
    optionsMarche.appendChild(bloc);
    return bloc;
  };
  const reperes = sousMenu("wmd-om-reperes", "🖼 Cadres et repères sur les cartes", true);
  const filtres = sousMenu("wmd-om-filtres", "🔎 Filtres (cacher des cartes)", false);
  const legende = sousMenu("wmd-legende", "❔ Légende des cadres et icônes", false);

  // Nouveau en 1.7.4 : une case pour afficher ou cacher les prix min / max trouvés au Marché.
  const caseMinMax = creer("label", undefined, "wmd-case");
  caseMinMax.id = "wmd-case-minmax";
  const coche = creer("input");
  coche.type = "checkbox";
  coche.checked = afficherMinMax;
  coche.addEventListener("change", () => {
    afficherMinMax = coche.checked;
    api.storage.local.set({ afficherMinMax: coche.checked }).catch(() => {});
    rafraichirAffichagePrix();
  });
  caseMinMax.append(coche, document.createTextNode(" Afficher les prix min / max du Marché"));
  reperes.appendChild(caseMinMax);

  // 1.13 : l'affichage allégé du Marché (seulement le nom, le prix et les cadres de l'extension).
  const caseCompact = creer("label", undefined, "wmd-case");
  caseCompact.id = "wmd-case-compact";
  const cocheCompact = creer("input");
  cocheCompact.type = "checkbox";
  cocheCompact.checked = marcheCompact;
  cocheCompact.addEventListener("change", () => {
    marcheCompact = cocheCompact.checked;
    api.storage.local.set({ marcheCompact: cocheCompact.checked }).catch(() => {});
    appliquerMarcheCompact();
  });
  caseCompact.append(cocheCompact, document.createTextNode(" Affichage allégé du Marché (nom et prix)"));
  filtres.appendChild(caseCompact);

  // 1.14 : les seuils des cadres des bonnes affaires, réglés ici (avant : dans les réglages).
  // Pour chaque cadre : un nombre, et « % » ou « wikibidous » sous l'estimation.
  const seuils = creer("div", undefined, "wmd-case");
  seuils.id = "wmd-seuils";
  // 1.17 : le cadre jaune / rouge suit les seuils « ++ » / « +++ » (juste au-dessus) : il ne reste ici que le cadre bleu.
  seuils.appendChild(creer("div", "Cadre bleu : mise au moins…"));
  for (const [cadreDe, texte] of [["Max", "sous le plus haut vu au Marché"]]) {
    const ligne = creer("div", undefined, "wmd-ligne-seuil");
    const valeur = creer("input");
    valeur.type = "number";
    valeur.min = "1";
    valeur.id = `wmd-seuil-${cadreDe}`;
    const mode = creer("select");
    mode.id = `wmd-mode-${cadreDe}`;
    for (const [v, t] of [["pourcent", "%"], ["montant", "wikibidous"]]) {
      const option = creer("option", t);
      option.value = v;
      mode.appendChild(option);
    }
    // Changer d'unité reprend la dernière valeur connue pour cette unité.
    mode.addEventListener("change", () => {
      const autre = mode.value === "montant" ? reglages[`ecart${cadreDe}Montant`] : reglages[`ecart${cadreDe}`];
      changerSeuilCadre(cadreDe, mode.value, autre);
    });
    valeur.addEventListener("change", () => changerSeuilCadre(cadreDe, mode.value, valeur.value));
    ligne.append(valeur, mode, document.createTextNode(" " + texte));
    seuils.appendChild(ligne);
  }
  // 1.17.1 : ne plus encadrer en blanc (cadre bleu dont le prix le plus haut est douteux, « ⚠ »).
  const caseBlanc = creer("label", undefined, "wmd-ligne-seuil");
  caseBlanc.id = "wmd-case-blanc";
  const cocheBlanc = creer("input");
  cocheBlanc.type = "checkbox";
  cocheBlanc.checked = marcheSansBlanc;
  cocheBlanc.addEventListener("change", () => {
    marcheSansBlanc = cocheBlanc.checked;
    api.storage.local.set({ marcheSansBlanc: cocheBlanc.checked }).catch(() => {});
    versionPage++;
    marquerBonnesAffaires();
  });
  caseBlanc.title = "Le cadre blanc (⚠) apparaît quand seul le prix le plus haut du Marché donne une bonne affaire, "
    + "alors que le prix moyen du site dit le contraire : ce prix le plus haut est souvent trompeur.";
  caseBlanc.append(cocheBlanc, document.createTextNode(" Masquer les cadres blancs (⚠ prix douteux)"));
  seuils.appendChild(caseBlanc);
  reperes.appendChild(seuils);
  setTimeout(afficherSeuilsPanneau, 0);

  // 1.16 : n'afficher que les enchères encadrées (bonnes affaires).
  const caseEncadrees = creer("label", undefined, "wmd-case");
  caseEncadrees.id = "wmd-case-encadrees";
  const cocheEncadrees = creer("input");
  cocheEncadrees.type = "checkbox";
  cocheEncadrees.checked = marcheQueEncadrees;
  cocheEncadrees.addEventListener("change", () => {
    marcheQueEncadrees = cocheEncadrees.checked;
    api.storage.local.set({ marcheQueEncadrees: cocheEncadrees.checked }).catch(() => {});
    versionPage++;
    marquerBonnesAffaires();
  });
  const texteEncadrees = creer("span", " Seulement les enchères encadrées");
  texteEncadrees.id = "wmd-texte-encadrees";
  caseEncadrees.append(cocheEncadrees, texteEncadrees);
  filtres.appendChild(caseEncadrees);

  // 1.16 : « + / ++ / +++ » en haut à droite des cartes, selon l'écart entre la mise et le prix moyen.
  const caseEcarts = creer("div", undefined, "wmd-case");
  caseEcarts.id = "wmd-case-ecarts";
  const ligneCoche = creer("label");
  const cocheEcarts = creer("input");
  cocheEcarts.type = "checkbox";
  cocheEcarts.checked = marcheEcarts.actif;
  // 1.17 : ces seuils décident aussi des cadres : « ++ » sous le prix moyen = cadre JAUNE, « +++ » = cadre ROUGE.
  const titreEcarts = creer("div", "Écart avec le prix moyen (wikibidous) :", "wmd-titre-ecarts");
  ligneCoche.append(cocheEcarts, document.createTextNode(" Afficher + / ++ / +++ en haut à droite des cartes"));
  const ligneSeuils = creer("div", undefined, "wmd-ligne-ecarts");
  const champsEcarts = [0, 1, 2].map(i => {
    const champ = creer("input");
    champ.type = "number";
    champ.min = "1";
    champ.step = "50";
    champ.id = `wmd-ecart-${i + 1}`;
    champ.value = String(marcheEcarts.seuils[i]);
    return champ;
  });
  const changerEcarts = () => {
    const seuils = champsEcarts.map((champ, i) => {
      const n = Math.round(Number(champ.value));
      return n >= 1 ? n : ECARTS_PAR_DEFAUT[i];
    });
    marcheEcarts = { actif: cocheEcarts.checked, seuils: seuils };
    afficherReglageEcarts();
    api.storage.local.set({ marcheEcarts: marcheEcarts }).catch(() => {});
    versionPage++;
    marquerBonnesAffaires();
  };
  cocheEcarts.addEventListener("change", changerEcarts);
  for (const champ of champsEcarts) champ.addEventListener("change", changerEcarts);
  // Les trois montants sur une seule ligne (dans l'ordre +, ++, +++), chacun avec sa pastille.
  const infos = ["+ : seulement le repère en haut à droite", "++ : cadre JAUNE si la mise est au moins autant sous le prix moyen",
    "+++ : cadre ROUGE si la mise est au moins autant sous le prix moyen"];
  champsEcarts.forEach((champ, i) => { champ.title = infos[i] + " (wikibidous)"; });
  const pastille = (texte, classe, titre) => { const p = creer("span", texte, "wmd-pastille-ecart " + classe); p.title = titre; return p; };
  ligneSeuils.append(pastille("+", "", infos[0]), champsEcarts[0], pastille("++", "wmd-pastille-jaune", infos[1]), champsEcarts[1],
    pastille("+++", "wmd-pastille-rouge", infos[2]), champsEcarts[2]);
  caseEcarts.append(titreEcarts, ligneSeuils, ligneCoche);
  reperes.insertBefore(caseEcarts, seuils);

  // 1.17 : signaler les prix peut-être gonflés artificiellement (🎈), à partir de « × N » le prix habituel.
  const casePic = creer("label", undefined, "wmd-case");
  casePic.id = "wmd-case-pic";
  const cochePic = creer("input");
  cochePic.type = "checkbox";
  cochePic.checked = reglagePic.actif;
  const ratioPic = creer("input");
  ratioPic.type = "number";
  ratioPic.min = String(PIC_MINIMUM);
  ratioPic.step = "0.5";
  ratioPic.id = "wmd-ratio-pic";
  ratioPic.value = String(reglagePic.ratio);
  const changerPic = () => {
    reglagePic = lireReglagePic({ actif: cochePic.checked, ratio: Number(ratioPic.value) });
    ratioPic.value = String(reglagePic.ratio);
    api.storage.local.set({ marchePic: reglagePic }).catch(() => {});
    versionPage++;
  };
  cochePic.addEventListener("change", changerPic);
  ratioPic.addEventListener("change", () => { cochePic.checked = true; changerPic(); });
  casePic.title = "Une semaine (parmi les 8 dernières) où la carte s'est vendue bien plus cher que d'habitude : "
    + "le prix moyen peut être faussé. Calculé avec l'historique des prix du site (onglet « Marché » de la fiche d'une carte).";
  casePic.append(cochePic, document.createTextNode(" 🎈 Signaler les prix gonflés (pic à × "), ratioPic, document.createTextNode(" le prix habituel)"));
  reperes.appendChild(casePic);

  // 1.14 : cacher les enchères qui ne finissent pas dans les N prochaines minutes (5 par défaut, réglable en 1.16).
  const caseBientot = creer("label", undefined, "wmd-case");
  caseBientot.id = "wmd-case-bientot";
  const cocheBientot = creer("input");
  cocheBientot.type = "checkbox";
  cocheBientot.checked = marcheBientotFini;
  cocheBientot.addEventListener("change", () => {
    marcheBientotFini = cocheBientot.checked;
    api.storage.local.set({ marcheBientotFini: cocheBientot.checked }).catch(() => {});
    filtrerEncheresBientotFinies();
  });
  // 1.16 : la durée est choisie (en minutes), 5 par défaut.
  const minutesBientot = creer("input");
  minutesBientot.type = "number";
  minutesBientot.min = "1";
  minutesBientot.step = "1";
  minutesBientot.id = "wmd-minutes-bientot";
  minutesBientot.value = String(marcheBientotMinutes);
  minutesBientot.addEventListener("change", () => {
    marcheBientotMinutes = lireMinutesBientot(Math.round(Number(minutesBientot.value)));
    minutesBientot.value = String(marcheBientotMinutes);
    if (!cocheBientot.checked) { cocheBientot.checked = true; marcheBientotFini = true; }
    api.storage.local.set({ marcheBientotFini: true, marcheBientotMinutes: marcheBientotMinutes }).catch(() => {});
    filtrerEncheresBientotFinies();
  });
  const texteBientot = creer("span", " min");
  texteBientot.id = "wmd-texte-bientot";
  caseBientot.append(cocheBientot, document.createTextNode(" Seulement les enchères qui finissent dans "), minutesBientot, texteBientot);
  filtres.appendChild(caseBientot);

  // 1.14 : cacher les cartes dont la mise dépasse un montant choisi.
  const casePrix = creer("label", undefined, "wmd-case");
  casePrix.id = "wmd-case-prixmax";
  const cochePrix = creer("input");
  cochePrix.type = "checkbox";
  cochePrix.checked = filtrePrixMax.actif;
  const montantPrix = creer("input");
  montantPrix.type = "number";
  montantPrix.min = "0";
  montantPrix.step = "10";
  montantPrix.id = "wmd-montant-prixmax";
  montantPrix.value = String(filtrePrixMax.montant);
  montantPrix.style.width = "6em";
  const changerPrix = () => {
    const montant = Math.max(0, Math.round(Number(montantPrix.value)) || 0);
    filtrePrixMax = { actif: cochePrix.checked, montant: montant };
    api.storage.local.set({ marchePrixMax: filtrePrixMax }).catch(() => {});
    filtrerEncheresTropCheres();
  };
  cochePrix.addEventListener("change", changerPrix);
  montantPrix.addEventListener("change", () => { if (montantPrix.value !== "") cochePrix.checked = true; changerPrix(); });
  const textePrix = creer("span", " wikibidous");
  textePrix.id = "wmd-texte-prixmax";
  casePrix.append(cochePrix, document.createTextNode(" Seulement les mises jusqu'à "), montantPrix, textePrix);
  filtres.appendChild(casePrix);

  // 1.16 : cacher les cartes dont la mise dépasse le prix moyen connu (les cartes sans prix moyen restent).
  const caseMoyenne = creer("label", undefined, "wmd-case");
  caseMoyenne.id = "wmd-case-sousmoyenne";
  const cocheMoyenne = creer("input");
  cocheMoyenne.type = "checkbox";
  cocheMoyenne.checked = marcheSousMoyenne;
  cocheMoyenne.addEventListener("change", () => {
    marcheSousMoyenne = cocheMoyenne.checked;
    api.storage.local.set({ marcheSousMoyenne: cocheMoyenne.checked }).catch(() => {});
    filtrerEncheresAuDessusMoyenne();
  });
  // 1.16 : marge en % au-dessus du prix moyen (0 = dès que la mise dépasse le prix moyen).
  const pctMoyenne = creer("input");
  pctMoyenne.type = "number";
  pctMoyenne.min = "0";
  pctMoyenne.step = "5";
  pctMoyenne.id = "wmd-pct-sousmoyenne";
  pctMoyenne.value = String(margeSousMoyenne);
  pctMoyenne.addEventListener("change", () => {
    margeSousMoyenne = Math.max(0, Math.round(Number(pctMoyenne.value)) || 0);
    pctMoyenne.value = String(margeSousMoyenne);
    if (!cocheMoyenne.checked) { cocheMoyenne.checked = true; marcheSousMoyenne = true; }
    api.storage.local.set({ marcheSousMoyenne: true, marcheSousMoyenneMarge: margeSousMoyenne }).catch(() => {});
    filtrerEncheresAuDessusMoyenne();
  });
  const texteMoyenne = creer("span", " % au-dessus du prix moyen");
  texteMoyenne.id = "wmd-texte-sousmoyenne";
  caseMoyenne.append(cocheMoyenne, document.createTextNode(" Cacher les cartes à plus de "), pctMoyenne, texteMoyenne);
  filtres.appendChild(caseMoyenne);

  construireLegende(legende);    // 1.17

  const echange = creer("div");
  echange.id = "wmd-echange";
  const resultats = creer("div");
  resultats.id = "wmd-resultats";
  // 1.15 : les mises de la page du Marché ont leur propre bloc (repliable) : elles n'effacent plus ta liste.
  const prixPage = creer("details", undefined, "wmd-bloc wmd-prix-page");
  prixPage.id = "wmd-prix-page";
  prixPage.hidden = true;
  prixPage.addEventListener("click", evenement => {
    if (evenement.target instanceof Element && evenement.target.closest("summary")) prixPage.dataset.choisi = "1"; // ton choix est gardé
  });
  panneau.append(echange, prixPage, resultats);

  document.body.appendChild(panneau);
  actualiserPanneau();
  restaurerVue(); // 1.15 : la dernière liste affichée revient (après un changement de page ou un retour en jeu)
}

// Nouveau en 1.3 : chaque bouton n'apparaît que sur la bonne page, et si sa fonction est activée.
function actualiserPanneau() {
  const page = pageActuelle();
  const marcheFiltrable = optionsMarcheActives(); // 1.16 : seulement « Parcourir » et « Mes enchères »
  ongletOptionsVu = marcheFiltrable;
  const visibles = {
    "wmd-doublons": page === "collection",
    "wmd-csv": page === "collection",
    "wmd-stop": tacheEnCours, // 1.7.4 : le bouton Stop n'apparaît que pendant une tâche automatique
    // 1.8 : « Reprendre » après une lecture interrompue, sur la page où elle avait lieu.
    "wmd-reprendre": !tacheEnCours && !enCours && lecture !== null && !lecture.complet && lecture.page === page,
    "wmd-case-minmax": reglages.marche,
    "wmd-case-compact": marcheFiltrable, // 1.13
    "wmd-case-bientot": marcheFiltrable, // 1.14
    "wmd-case-prixmax": marcheFiltrable, // 1.14
    "wmd-case-sousmoyenne": marcheFiltrable, // 1.16
    "wmd-seuils": marcheFiltrable && reglages.marche, // 1.14
    "wmd-case-encadrees": marcheFiltrable && reglages.marche, // 1.16
    "wmd-case-ecarts": marcheFiltrable && reglages.marche, // 1.16
    "wmd-case-pic": marcheFiltrable && reglages.marche, // 1.17
    "wmd-auto": marcheFiltrable, // 1.17
    "wmd-legende": marcheFiltrable, // 1.17
    "wmd-manquantes": page === "toutes-les-cartes" && reglages.manquantes,
    "wmd-animees-jeu": page === "toutes-les-cartes" && reglages.animeesJeu,
    "wmd-animees-revoir": (page === "toutes-les-cartes" || page === "collection") && reglages.animeesJeu && aDesAnimeesJeu,
    "wmd-encheres": reglages.encheres && (page === "marche" || nombreEncheresSuivies > 0),
    "wmd-remise": REMISE_EN_VENTE && (Boolean(remiseEnVente) || ((page === "marche" || page === "collection") && ventesInvendues().length > 0)), // 1.17.3
    "wmd-estimer": (page === "marche" || page === "collection") && reglages.marche,
    // 1.14 : quand le fichier partagé est réglé, « Mettre à jour les prix » remplace l'export classique.
    "wmd-maj-prix": (page === "marche" || page === "collection") && reglages.marche,
    "wmd-prix-csv": (page === "marche" || page === "collection") && reglages.marche && !partageConfigure,
    "wmd-importer": (page === "marche" || page === "collection") && !tacheEnCours,
    "wmd-souhaits-resultats": aDesResultatsSouhaits,
    "wmd-prix-page": page === "marche" && reglages.marche && aDesPrixDePage // 1.15
  };
  for (const [id, visible] of Object.entries(visibles)) {
    const bouton = document.getElementById(id);
    if (bouton) bouton.hidden = !visible;
  }
  // 1.16 : le sous-menu « Options du Marché » n'apparaît que s'il contient au moins une option visible.
  // 1.17 : pareil pour ses sous-menus et pour les groupes de boutons.
  const aDuContenu = bloc => [...bloc.children].some(enfant => enfant.tagName !== "SUMMARY" && !enfant.classList.contains("wmd-groupe-titre") && !enfant.hidden);
  for (const bloc of document.querySelectorAll("#wmd-panneau .wmd-sous-menu, #wmd-panneau .wmd-groupe")) {
    if (bloc.id === "wmd-auto" || bloc.id === "wmd-legende") continue; // gérés par la liste ci-dessus
    const cacher = !aDuContenu(bloc);
    if (bloc.hidden !== cacher) bloc.hidden = cacher;
  }
  const optionsMarche = document.getElementById("wmd-options-marche");
  if (optionsMarche) {
    const cacher = !aDuContenu(optionsMarche);
    if (optionsMarche.hidden !== cacher) optionsMarche.hidden = cacher;
  }
}

// Écrit un message dans le panneau ET dans la console (F12).
function afficherStatut(texte) {
  const zone = document.getElementById("wmd-statut");
  if (zone) zone.textContent = texte;
  console.log("[WikiMasters Doublons]", texte);
}


// ---------------------------------------------------------------------
//  1.15 : MES LISTES, RETROUVÉES APRÈS UN CHANGEMENT DE PAGE OU UN RETOUR EN JEU
//  La dernière liste ouverte dans le panneau (doublons, collection, cartes manquantes, cartes
//  animées du jeu, souhaits, enchères suivies, valeur estimée) est notée dans la mémoire
//  « vuePanneau ». Sur toute nouvelle page (ou un nouvel onglet), elle revient toute seule
//  dans le panneau, avec ses noms de cartes cliquables. Le bouton « 📋 » (dans le titre du
//  panneau, même réduit) et « 📋 Mes listes » ouvrent le menu de toutes les listes gardées.
//  Tout vient de la mémoire de l'extension : rien n'est relu ni demandé au site.
// ---------------------------------------------------------------------
let vueMemorisee = ""; // la dernière liste notée (pour ne pas réécrire la mémoire pour rien)

function memoriserVue(type, options = {}) {
  const zone = document.getElementById("wmd-resultats");
  if (zone) {
    zone.dataset.vue = type;
    ajouterBarreListe(zone);
  }
  const json = JSON.stringify({ type: type, options: options });
  if (json === vueMemorisee) return;
  vueMemorisee = json;
  api.storage.local.set({ vuePanneau: { type: type, options: options, quand: Date.now() } }).catch(() => {});
}

// En haut de chaque liste : « 📋 Mes listes » et « ✕ Fermer la liste ».
function ajouterBarreListe(zone) {
  if (zone.querySelector(":scope > .wmd-barre-liste")) return;
  const barre = creer("div", undefined, "wmd-barre-liste");
  const listes = creer("button", "📋 Mes listes", "wmd-mini");
  listes.type = "button";
  listes.addEventListener("click", () => afficherMesListes());
  const fermer = creer("button", "✕ Fermer la liste", "wmd-mini");
  fermer.type = "button";
  fermer.title = "Cette liste ne reviendra plus toute seule (elle reste dans « 📋 Mes listes »)";
  fermer.addEventListener("click", () => fermerListe());
  barre.append(listes, fermer);
  zone.prepend(barre);
}

function fermerListe() {
  const zone = document.getElementById("wmd-resultats");
  if (zone) {
    zone.replaceChildren();
    delete zone.dataset.vue;
  }
  vueMemorisee = "";
  api.storage.local.remove("vuePanneau").catch(() => {});
  afficherStatut("Liste fermée. Le bouton « 📋 » la rouvre quand tu veux.");
}

// Ouvre une liste gardée en mémoire.
async function ouvrirVue(type, options = {}) {
  if (type === "collection") return afficherMaCollection(options);
  if (type === "manquantes") return afficherManquantesMemoire();
  if (type === "animees-jeu") {
    if ("seulementManquantes" in options) seulementAnimeesManquantes = Boolean(options.seulementManquantes);
    return afficherAnimeesJeu();
  }
  if (type === "souhaits") return afficherResultatsSouhaits();
  if (type === "encheres") return afficherEncheresSuivies();
  if (type === "estimation") return estimerMesCartes();
}

// Au chargement d'une page (ou quand le panneau est recréé) : la dernière liste ouverte revient.
async function restaurerVue() {
  try {
    await reglagesPrets;
    const zone = document.getElementById("wmd-resultats");
    if (!zone || zone.childElementCount || pageOccupee()) return;
    const { vuePanneau: vue } = await api.storage.local.get("vuePanneau");
    if (!vue || !vue.type || zone.childElementCount || pageOccupee()) return;
    vueMemorisee = JSON.stringify({ type: vue.type, options: vue.options || {} });
    await ouvrirVue(vue.type, vue.options || {});
  } catch (erreur) {
    if (extensionValide()) console.warn("[WikiMasters Doublons]", erreur);
  }
}

// Le menu de toutes les listes gardées en mémoire.
async function afficherMesListes() {
  const zone = document.getElementById("wmd-resultats");
  if (!zone) return;
  const lu = await api.storage.local.get(["collection", "comparaison", "manquantes", "animeesJeu", "souhaitsChezAmis", "encheres", "marche"]);
  zone.replaceChildren();
  delete zone.dataset.vue;
  const bloc = creer("div", undefined, "wmd-bloc wmd-mes-listes");
  bloc.appendChild(creer("h4", "📋 Mes listes"));
  bloc.appendChild(creer("div", "Gardées en mémoire : la dernière ouverte revient toute seule quand tu changes de page ou reviens en jeu. "
    + "Clique ensuite sur le nom d'une carte pour la trouver (collection, Marché ou « Toutes les cartes »).", "wmd-discret"));
  const choix = (titre, detail, action, disponible = true) => {
    const bouton = creer("button", undefined, "wmd-choix-liste");
    bouton.type = "button";
    bouton.append(creer("span", titre), creer("small", detail));
    bouton.disabled = !disponible;
    bouton.addEventListener("click", action);
    bloc.appendChild(bouton);
  };
  const collection = lu.collection || null;
  const cartes = collection ? collection.cartes : [];
  const quand = collection ? `lecture du ${dateLisible(collection.date)}` : "lis d'abord ta collection (page Collection, « Trouver mes doublons »)";
  choix("📚 Mes doublons", collection ? `${cartes.filter(c => c[2] >= 2).length} carte(s) en double · ${quand}` : quand,
    () => ouvrirVue("collection", { afficherTout: false, seulementAnimees: false }), Boolean(collection));
  choix("🗂 Toute ma collection", collection ? `${cartes.length} carte(s) différente(s) · ${quand}` : quand,
    () => ouvrirVue("collection", { afficherTout: true, seulementAnimees: false }), Boolean(collection));
  choix("✨ Mes cartes animées", collection ? `${cartes.filter(c => c[3] === 1).length} carte(s) · ${quand}` : quand,
    () => ouvrirVue("collection", { seulementAnimees: true }), Boolean(collection));
  const comparaison = lu.comparaison && collection && lu.comparaison.lecture === collection.date && lu.comparaison.date ? lu.comparaison : null;
  if (comparaison) {
    choix("🆕 Mes nouvelles cartes", `${comparaison.nouvelles.length} depuis la lecture du ${dateLisible(comparaison.date)} (en haut de la liste des doublons)`,
      () => ouvrirVue("collection", { afficherTout: false, seulementAnimees: false }));
  }
  const manquantes = lu.manquantes || null;
  choix("❓ Mes cartes manquantes", manquantes ? `${manquantes.cartes.length} carte(s) · recherche du ${dateLisible(manquantes.date)}`
    : "à chercher sur « Toutes les cartes »", () => ouvrirVue("manquantes"), Boolean(manquantes));
  const animees = lu.animeesJeu && lu.animeesJeu.cartes ? lu.animeesJeu.cartes.length : 0;
  choix("🌟 Cartes animées du jeu", animees ? `${animees} carte(s) connue(s)` : "à chercher sur « Toutes les cartes »",
    () => ouvrirVue("animees-jeu"), animees > 0);
  const souhaits = lu.souhaitsChezAmis || null;
  choix("👥 Mes souhaits chez mes amis", souhaits ? `recherche du ${dateLisible(souhaits.date)}` : "aucune recherche faite",
    () => ouvrirVue("souhaits"), Boolean(souhaits));
  const encheres = Object.keys(lu.encheres || {}).length;
  choix("🔔 Mes enchères suivies", `${encheres} enchère(s)`, () => ouvrirVue("encheres"), encheres > 0);
  const prix = lu.marche && (Object.keys(lu.marche.annonces || {}).length || Object.keys(lu.marche.moyennes || {}).length);
  choix("💰 Valeur estimée de mes cartes", collection && prix ? "d'après les prix relevés au Marché" : "il faut ta collection et des prix du Marché",
    () => ouvrirVue("estimation"), Boolean(collection && prix));
  zone.appendChild(bloc);
  afficherStatut("📋 Choisis une liste : elle reviendra toute seule sur les autres pages.");
}


// ---------------------------------------------------------------------
//  PARTIE 5 : LIRE LES CARTES AFFICHÉES À L'ÉCRAN
// ---------------------------------------------------------------------

// Renvoie le « cadre » de chaque carte affichée : [{ cadre, imageRarete }, ...]
function trouverCadresDeCartes() {
  const resultats = [];
  // Chaque carte du site contient une image de rareté dont l'adresse contient "/rarity/".
  for (const imageRarete of document.querySelectorAll('img[src*="/rarity/"]')) {
    if (estDansLePanneau(imageRarete)) continue;
    // On remonte les parents jusqu'au premier qui contient aussi le nom de la carte.
    let cadre = imageRarete.parentElement;
    while (cadre && !cadre.querySelector(CONFIG.selecteurNomCarte)) {
      cadre = cadre.parentElement;
    }
    if (cadre) resultats.push({ cadre: cadre, imageRarete: imageRarete });
  }
  return resultats;
}

// Renvoie la liste des cartes visibles : [{ nom, rarete, quantite, animee }, ...]
// Elle est « async » : savoir si une image bouge demande de regarder le fichier (voir plus bas).
// animee vaut true, false, ou null si l'image n'a pas pu être vérifiée (1.8 : on garde alors son
// adresse dans « image », pour réessayer plus tard).
// 1.8 : les images d'une page sont vérifiées plusieurs à la fois (avant : une par une), ce qui va
// bien plus vite sur « Toutes les cartes », où les images ne sont pas encore dans le cache.
async function lireCartesAffichees() {
  const cadres = trouverCadresDeCartes();
  return executerAvecLimite(cadres, CONFIG.verificationsImagesSimultanees, async ({ cadre, imageRarete }) => {
    const nom = cadre.querySelector(CONFIG.selecteurNomCarte).textContent.trim();
    const trouve = imageRarete.getAttribute("src").match(/rarity\/([a-z_]+)\./);
    const rarete = trouve ? trouve[1] : "inconnue";
    const { animee, adresse } = await infoAnimation(cadre);
    const carte = { nom: nom, rarete: rarete, quantite: lireQuantite(cadre), animee: animee };
    if (animee === null) carte.image = adresse;
    return carte;
  });
}

// Nouveau en 1.8 : applique « tache » à chaque élément de « liste », au plus « limite » à la fois,
// et renvoie les résultats DANS L'ORDRE de la liste (comme un Parallel.ForEach limité en C#).
async function executerAvecLimite(liste, limite, tache) {
  const resultats = new Array(liste.length);
  let suivant = 0;
  const ouvrier = async () => {
    while (suivant < liste.length) {
      const i = suivant++;
      resultats[i] = await tache(liste[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, liste.length) }, ouvrier));
  return resultats;
}

// Cherche dans la carte un petit élément dont le texte est du genre "x3".
// S'il n'y en a pas, la carte compte pour 1 exemplaire.
function lireQuantite(cadre) {
  for (const element of cadre.querySelectorAll("*")) {
    if (element.children.length > 0) continue; // on ne regarde que les éléments sans enfant
    const trouve = element.textContent.trim().match(CONFIG.regexQuantite);
    if (trouve) return parseInt(trouve[1], 10);
  }
  return 1;
}

// Vrai si l'image de la carte bouge : une vidéo, ou un GIF qui contient plusieurs images.
// Corrigé en 1.3 : avant, tout GIF comptait comme animé, même un logo fixe.
// 1.8 : renvoie null (et non plus false) quand l'image n'a pas pu être vérifiée.
async function estAnimee(cadre) {
  return (await infoAnimation(cadre)).animee;
}

// Nouveau en 1.8 : { animee: true | false | null, adresse } (adresse = celle du GIF vérifié).
async function infoAnimation(cadre) {
  if (cadre.querySelector("video")) return { animee: true, adresse: "" };
  for (const image of cadre.querySelectorAll("img")) {
    const adresse = image.currentSrc || image.getAttribute("src") || "";
    if (adresse.includes("/rarity/")) continue; // l'image de rareté ne compte pas
    if (CONFIG.regexImageGif.test(cheminImage(adresse))) {
      const complete = new URL(adresse, location.href).href;
      return { animee: await imageBouge(complete), adresse: complete };
    }
  }
  return { animee: false, adresse: "" };
}

// Un fichier GIF est une suite de « blocs ». Chaque image (une « frame » de l'animation)
// commence par l'octet 0x2C. On les compte, en s'arrêtant à 2 : une seule = image fixe.
// "octets" peut être le début du fichier seulement : on compte ce qu'on a déjà reçu.
function compterImagesGif(octets) {
  // Un GIF commence par les lettres « GIF » (0x47 0x49 0x46).
  if (octets.length < 13 || octets[0] !== 0x47 || octets[1] !== 0x49 || octets[2] !== 0x46) return 0;
  let i = 13;                                                  // on saute l'en-tête
  if (octets[10] & 0x80) i += 3 * (2 << (octets[10] & 0x07));  // et la palette de couleurs
  let images = 0;
  // Les données sont rangées en petits paquets : un octet de longueur, puis les données ; 0 = fin.
  const sauterLesPaquets = () => {
    while (i < octets.length && octets[i] !== 0) i += octets[i] + 1;
    i++;
  };
  while (i < octets.length) {
    if (octets[i] === 0x2C) {            // une image
      images++;
      if (images >= 2) return images;
      const options = octets[i + 9];
      i += 10;
      if (options & 0x80) i += 3 * (2 << (options & 0x07)); // sa palette à elle
      i++;                               // un octet de réglage de la compression
      sauterLesPaquets();
    } else if (octets[i] === 0x21) {     // une « extension » (durée d'affichage, commentaire...)
      i += 2;
      sauterLesPaquets();
    } else {
      break;                             // 0x3B = fin du fichier
    }
  }
  return images;
}

// Colle deux morceaux de fichier bout à bout.
function coller(debut, suite) {
  const tout = new Uint8Array(debut.length + suite.length);
  tout.set(debut);
  tout.set(suite, debut.length);
  return tout;
}

// Télécharge l'image morceau par morceau et s'arrête dès la 2e image trouvée
// (inutile de télécharger les 3 Mo d'une longue animation). Renvoie true, false, ou null si impossible.
// 1.8 : en cas d'erreur passagère (réseau, serveur occupé), on réessaie 2 fois avant d'abandonner.
async function telechargerEtCompter(adresse) {
  for (let essai = 1; essai <= 3; essai++) {
    try {
      const reponse = await fetch(adresse); // souvent instantané : le navigateur a déjà l'image en cache
      if (reponse.status === 404 || reponse.status === 410) return false; // l'image n'existe pas : elle ne bouge pas
      if (!reponse.ok) throw new Error(`réponse ${reponse.status}`);
      const lecteur = reponse.body.getReader();
      let octets = new Uint8Array(0);
      while (true) {
        const { done, value } = await lecteur.read();
        if (value) octets = coller(octets, value);
        if (compterImagesGif(octets) >= 2) {
          lecteur.cancel(); // on a la réponse : on arrête le téléchargement
          return true;
        }
        if (done) return false;
      }
    } catch (erreur) {
      if (essai === 3) {
        console.warn("[WikiMasters Doublons] Impossible de vérifier l'image", adresse, erreur);
        return null;
      }
      await pause(essai * 1500); // on laisse un peu de temps au serveur avant de réessayer
    }
  }
  return null;
}

// Les réponses déjà connues (adresse → true/false), gardées en mémoire pour ne vérifier
// chaque image qu'une fois, même d'une visite à l'autre.
let imagesConnues = {};
const verificationsEnCours = new Map(); // adresse → promesse de réponse
let sauvegardePrevue = false;
api.storage.local.get("animations").then(({ animations }) => {
  imagesConnues = { ...animations, ...imagesConnues };
});

function imageBouge(adresse) {
  if (adresse in imagesConnues) return Promise.resolve(imagesConnues[adresse]);
  if (!verificationsEnCours.has(adresse)) {
    const verification = telechargerEtCompter(adresse).then(bouge => {
      verificationsEnCours.delete(adresse);
      if (bouge === null) return null; // pas pu vérifier : on réessaiera plus tard (1.8 : null, plus false)
      imagesConnues[adresse] = bouge;
      if (!sauvegardePrevue) {          // une seule sauvegarde pour plusieurs images
        sauvegardePrevue = true;
        setTimeout(() => {
          sauvegardePrevue = false;
          api.storage.local.set({ animations: imagesConnues });
        }, 2000);
      }
      return bouge;
    });
    verificationsEnCours.set(adresse, verification);
  }
  return verificationsEnCours.get(adresse);
}

// Renvoie le chemin du fichier d'une image, même quand le site passe par son
// « optimiseur d'images » (une adresse du genre /_next/image?url=/cards/chat.gif).
function cheminImage(adresse) {
  try {
    const url = new URL(adresse, location.href);
    return url.searchParams.get("url") || url.pathname;
  } catch (erreur) {
    return adresse;
  }
}

// Entoure d'un cadre doré les cartes animées affichées sur la page (si le réglage est coché).
let surlignageEnCours = false; // évite de lancer deux vérifications en même temps
async function surlignerCartesAnimees() {
  if (surlignageEnCours) return;
  surlignageEnCours = true;
  try {
    for (const { cadre } of trouverCadresDeCartes()) {
      const animee = reglages.surlignerAnimees && await estAnimee(cadre);
      cadre.classList.toggle("wmd-carte-animee", animee === true);
    }
  } finally {
    surlignageEnCours = false;
  }
}


// ---------------------------------------------------------------------
//  PARTIE 6 : PARCOURIR TOUTES LES PAGES D'UNE LISTE (et le bouton Stop)
// ---------------------------------------------------------------------

let enCours = false; // vrai pendant une lecture page par page

// Nouveau en 1.7.4 : le bouton Stop n'est visible que pendant une tâche automatique
// (lecture page par page, ou recherche de mes souhaits chez mes amis).
let tacheEnCours = false;
// 1.10 (optimisation) : la mémoire « chasse » est gardée en copie, mise à jour par storage.onChanged,
// au lieu d'être relue deux fois par seconde sur toutes les pages.
let chasseConnue = null;
let chasseChargee = false;
api.storage.local.get("chasse").then(({ chasse }) => { chasseConnue = chasse || null; chasseChargee = true; }).catch(() => {});
api.storage.onChanged.addListener(changements => {
  if (changements.chasse) chasseConnue = changements.chasse.newValue || null;
});

async function surveillerStop() {
  if (!chasseChargee) return;
  const chasse = chasseConnue;

  // Corrigé en 1.8 : une recherche des souhaits restée en mémoire (vieille de plus de 30 minutes, ou
  // sans date) ne laisse plus le bouton Stop affiché pour rien sur toutes les pages : on l'oublie.
  const chasseActive = Boolean(chasse) && Date.now() - (Number(chasse.quand) || 0) <= 30 * 60 * 1000;
  if (chasse && !chasseActive && !chasseEnCours) await api.storage.local.remove("chasse");
  const active = enCours || chasseEnCours || chasseActive;
  if (active !== tacheEnCours) {
    tacheEnCours = active;
    actualiserPanneau();
  }
}

// 1.14 : le fichier des prix partagé est-il réglé (adresse du script et code dans les réglages) ?
let partageConfigure = false;
const estPartageConfigure = partage => !!(partage && partage.adresse && partage.code);
api.storage.local.get("partage").then(({ partage }) => { partageConfigure = estPartageConfigure(partage); actualiserPanneau(); }).catch(() => {});
api.storage.onChanged.addListener(changements => {
  if (!changements.partage) return;
  partageConfigure = estPartageConfigure(changements.partage.newValue);
  actualiserPanneau();
});

// 1.14 : sur la liste du Marché, cacher les enchères dont le temps restant dépasse 5 minutes.
// Rien n'est retiré de la page (la carte est seulement cachée) et rien n'est demandé au site :
// on lit le compte à rebours affiché sur chaque carte. Une carte sans compte à rebours lisible reste affichée.
// 1.16 : la durée (en minutes) est choisie dans le panneau ; 5 par défaut.
let marcheBientotFini = false;
let marcheBientotMinutes = 5;
function lireMinutesBientot(valeur) {
  return Number.isFinite(valeur) && valeur >= 1 ? valeur : 5;
}
function afficherFiltreBientot() {
  const coche = document.querySelector("#wmd-case-bientot input[type=checkbox]");
  if (coche) coche.checked = marcheBientotFini;
  const minutes = document.getElementById("wmd-minutes-bientot");
  if (minutes && document.activeElement !== minutes) minutes.value = String(marcheBientotMinutes);
}
api.storage.local.get(["marcheBientotFini", "marcheBientotMinutes"]).then(valeurs => {
  marcheBientotFini = valeurs.marcheBientotFini === true;
  marcheBientotMinutes = lireMinutesBientot(valeurs.marcheBientotMinutes);
  afficherFiltreBientot();
  filtrerEncheresBientotFinies();
}).catch(() => {});
api.storage.onChanged.addListener(changements => {
  if (!changements.marcheBientotFini && !changements.marcheBientotMinutes) return;
  if (changements.marcheBientotFini) marcheBientotFini = changements.marcheBientotFini.newValue === true;
  if (changements.marcheBientotMinutes) marcheBientotMinutes = lireMinutesBientot(changements.marcheBientotMinutes.newValue);
  afficherFiltreBientot();
  filtrerEncheresBientotFinies();
});
// Le temps restant d'une carte du Marché, en ms (null s'il n'est pas lisible).
function tempsRestantAnnonce(annonce) {
  const candidats = [...annonce.querySelectorAll(".tabular-nums"), ...annonce.querySelectorAll("span")];
  for (const element of candidats) {
    if (element.children.length > 0 && !element.classList.contains("tabular-nums")) continue;
    const texte = element.textContent.trim();
    if (texte && estSeulementUneDuree(texte)) return lireDuree(texte).ms;
  }
  return null;
}
function filtrerEncheresBientotFinies() {
  const actif = marcheBientotFini && optionsMarcheActives();
  let cachees = 0;
  for (const annonce of document.querySelectorAll("[id^='marketplace-auction-']")) {
    const reste = actif ? tempsRestantAnnonce(annonce) : null;
    const cacher = reste !== null && reste > marcheBientotMinutes * MINUTE;
    if (annonce.classList.contains("wmd-fin-lointaine") !== cacher) annonce.classList.toggle("wmd-fin-lointaine", cacher);
    if (cacher) cachees++;
  }
  const texte = document.getElementById("wmd-texte-bientot");
  const voulu = " min" + (actif ? ` (${cachees} cachée(s))` : "");
  if (texte && texte.textContent !== voulu) texte.textContent = voulu;
}

// 1.14 : sur la liste du Marché, cacher les cartes dont la mise (actuelle ou de départ) dépasse un montant.
// Comme le filtre « 5 min » : la carte est seulement cachée, rien n'est demandé au site.
let filtrePrixMax = { actif: false, montant: 500 };
function lireFiltrePrixMax(valeur) {
  return { actif: !!(valeur && valeur.actif), montant: valeur && Number.isFinite(valeur.montant) ? valeur.montant : 500 };
}
api.storage.local.get("marchePrixMax").then(({ marchePrixMax: valeur }) => {
  filtrePrixMax = lireFiltrePrixMax(valeur);
  const coche = document.querySelector("#wmd-case-prixmax input[type=checkbox]");
  const montant = document.getElementById("wmd-montant-prixmax");
  if (coche) coche.checked = filtrePrixMax.actif;
  if (montant) montant.value = String(filtrePrixMax.montant);
  filtrerEncheresTropCheres();
}).catch(() => {});
api.storage.onChanged.addListener(changements => {
  if (!changements.marchePrixMax) return;
  filtrePrixMax = lireFiltrePrixMax(changements.marchePrixMax.newValue);
  const coche = document.querySelector("#wmd-case-prixmax input[type=checkbox]");
  const montant = document.getElementById("wmd-montant-prixmax");
  if (coche) coche.checked = filtrePrixMax.actif;
  if (montant && document.activeElement !== montant) montant.value = String(filtrePrixMax.montant);
  filtrerEncheresTropCheres();
});
// 1.16 : sur la liste du Marché, cacher les cartes dont la mise (actuelle ou de départ) est AU-DESSUS
// du prix moyen du site connu pour cette carte dans cette rareté. Une carte dont on ne connaît pas
// le prix moyen reste affichée. Rien n'est demandé au site : on compare à la mémoire de l'extension.
let marcheSousMoyenne = false;
let margeSousMoyenne = 0; // en % au-dessus du prix moyen
let moyennesFiltre = null; // les prix moyens en mémoire, relus quand ils changent
function lireMargeSousMoyenne(valeur) {
  return Number.isFinite(valeur) && valeur >= 0 ? valeur : 0;
}
function afficherFiltreMoyenne() {
  const coche = document.querySelector("#wmd-case-sousmoyenne input[type=checkbox]");
  if (coche) coche.checked = marcheSousMoyenne;
  const pct = document.getElementById("wmd-pct-sousmoyenne");
  if (pct && document.activeElement !== pct) pct.value = String(margeSousMoyenne);
}
api.storage.local.get(["marcheSousMoyenne", "marcheSousMoyenneMarge"]).then(valeurs => {
  marcheSousMoyenne = valeurs.marcheSousMoyenne === true;
  margeSousMoyenne = lireMargeSousMoyenne(valeurs.marcheSousMoyenneMarge);
  afficherFiltreMoyenne();
  filtrerEncheresAuDessusMoyenne();
}).catch(() => {});
api.storage.onChanged.addListener(changements => {
  if (changements.marche) moyennesFiltre = null;
  if (!changements.marcheSousMoyenne && !changements.marcheSousMoyenneMarge) return;
  if (changements.marcheSousMoyenne) marcheSousMoyenne = changements.marcheSousMoyenne.newValue === true;
  if (changements.marcheSousMoyenneMarge) margeSousMoyenne = lireMargeSousMoyenne(changements.marcheSousMoyenneMarge.newValue);
  afficherFiltreMoyenne();
  filtrerEncheresAuDessusMoyenne();
});
let filtreMoyenneEnCours = false;
async function filtrerEncheresAuDessusMoyenne() {
  if (filtreMoyenneEnCours) return;
  filtreMoyenneEnCours = true;
  try {
    const actif = marcheSousMoyenne && optionsMarcheActives();
    const auDessus = new Set();
    if (actif) {
      if (!moyennesFiltre) {
        const { marche } = await api.storage.local.get("marche");
        moyennesFiltre = (marche && marche.moyennes) || {};
      }
      for (const annonce of lireAnnoncesMarche(true)) {
        const moyenne = moyennesFiltre[`${annonce.nom}|${annonce.rarete}`];
        if (moyenne && moyenne.prix > 0 && annonce.prix > moyenne.prix * (1 + margeSousMoyenne / 100)) {
          auDessus.add(annonce.cadre.closest("[id^='marketplace-auction-']") || annonce.cadre);
        }
      }
    }
    for (const element of document.querySelectorAll(".wmd-au-dessus-moyenne")) {
      if (!auDessus.has(element)) element.classList.remove("wmd-au-dessus-moyenne");
    }
    for (const element of auDessus) element.classList.add("wmd-au-dessus-moyenne");
    const texte = document.getElementById("wmd-texte-sousmoyenne");
    const voulu = " % au-dessus du prix moyen" + (actif ? ` (${auDessus.size} cachée(s))` : "");
    if (texte && texte.textContent !== voulu) texte.textContent = voulu;
  } finally {
    filtreMoyenneEnCours = false;
  }
}

function filtrerEncheresTropCheres() {
  const actif = filtrePrixMax.actif && optionsMarcheActives();
  const tropCheres = new Set();
  if (actif) {
    for (const annonce of lireAnnoncesMarche(true)) {
      if (annonce.prix > filtrePrixMax.montant) tropCheres.add(annonce.cadre.closest("[id^='marketplace-auction-']") || annonce.cadre);
    }
  }
  for (const element of document.querySelectorAll(".wmd-trop-cher")) {
    if (!tropCheres.has(element)) element.classList.remove("wmd-trop-cher");
  }
  for (const element of tropCheres) element.classList.add("wmd-trop-cher");
  const texte = document.getElementById("wmd-texte-prixmax");
  const voulu = " wikibidous" + (actif ? ` (${tropCheres.size} cachée(s))` : "");
  if (texte && texte.textContent !== voulu) texte.textContent = voulu;
  aideFiltrePrixMax(actif, tropCheres.size);
}

// ---------------------------------------------------------------------
//  1.15 : QUAND LE FILTRE « SEULEMENT LES MISES JUSQU'À … » CACHE TOUT
//  Le site charge les annonces 50 par 50 (« Charger la suite ») et ne sait pas filtrer par prix.
//  Avec le tri « Mise la plus haute », les 50 premières annonces sont les plus chères : sous 2 000
//  environ, elles dépassent toutes le montant choisi, et la page paraissait vide.
//  Maintenant, un encart le dit à la place de la liste et propose :
//   - « ⏬ Charger la suite jusqu'aux mises ≤ … » : l'extension clique sur « Charger la suite »
//     (une requête par clic, comme toi) jusqu'à ce qu'une annonce s'affiche, 20 fois au plus, avec Stop ;
//   - « Trier par mise la plus basse » : choisit ce tri dans le menu du site ;
//   - « Afficher quand même » : décoche le filtre.
// ---------------------------------------------------------------------
const CHARGEMENTS_SUITE_MAX = 20;

function selectTriMarche() {
  const zone = document.querySelector("main") || document.body;
  return [...zone.querySelectorAll("select")].find(select => !estDansLePanneau(select)
    && [...select.options].some(option => option.value === "price_asc" || /mise la plus basse/i.test(option.textContent))) || null;
}

// Le tri choisi sur le site : "price_desc", "price_asc", "recent", "ending_soon"… (ou null).
function triMarcheActuel() {
  const select = selectTriMarche();
  if (select && select.value) return select.value;
  return triDuSite;
}

// Choisit un tri dans le menu du site, comme si tu l'avais choisi (le site recharge alors la liste : une requête).
function trierMarche(valeur) {
  const select = selectTriMarche();
  const option = select && [...select.options].find(o => o.value === valeur || (valeur === "price_asc" && /mise la plus basse/i.test(o.textContent)));
  if (!option) return false;
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(select, option.value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function boutonChargerSuite() {
  return boutonExact("Charger la suite") || trouverBoutonParTexte("Charger la suite");
}

function annoncesVisibles() {
  return [...document.querySelectorAll("[id^='marketplace-auction-']")]
    .filter(bloc => !bloc.classList.contains("wmd-trop-cher") && !bloc.classList.contains("wmd-fin-lointaine")
      && !bloc.classList.contains("wmd-au-dessus-moyenne") && !bloc.classList.contains("wmd-pas-encadree")
      && !bloc.classList.contains("wmd-autre-rarete"));
}

let chargementSuiteEnCours = false;
function aideFiltrePrixMax(actif, cachees) {
  let aide = document.getElementById("wmd-aide-prixmax");
  const blocs = [...document.querySelectorAll("[id^='marketplace-auction-']")];
  const toutCache = actif && cachees > 0 && blocs.length > 0 && annoncesVisibles().length === 0;
  if (!toutCache) {
    if (aide) aide.remove();
    return;
  }
  const grille = blocs[0].parentElement;
  if (!grille || !grille.parentElement) return;
  const montant = filtrePrixMax.montant;
  const prix = lireAnnoncesMarche(true).map(a => a.prix).filter(Number.isFinite);
  const plusBasse = prix.length ? Math.min(...prix) : null;
  const tri = triMarcheActuel();
  const decroissant = tri === "price_desc" || (!tri && prixDecroissants(prix));
  const bouton = boutonChargerSuite();
  const signature = JSON.stringify([blocs.length, montant, plusBasse, tri, Boolean(bouton), chargementSuiteEnCours, marcheBientotFini, marcheBientotMinutes]);
  if (aide && aide.dataset.signature === signature && aide.nextElementSibling === grille) return;
  if (!aide) {
    aide = creer("div", undefined, "wmd-aide-prixmax");
    aide.id = "wmd-aide-prixmax";
  }
  aide.dataset.signature = signature;
  const boutons = [];
  const ajouter = (texte, action, classe = "") => {
    const b = creer("button", texte, classe);
    b.type = "button";
    b.addEventListener("click", action);
    boutons.push(b);
  };
  if (chargementSuiteEnCours) ajouter("Stop", () => arreter(), "wmd-aide-stop");
  else if (bouton) ajouter(`⏬ Charger la suite jusqu'aux mises ≤ ${nombreLisible(montant)}`, () => chargerSuiteJusquAuxMises());
  if (tri !== "price_asc" && selectTriMarche()) ajouter("Trier par « Mise la plus basse »", () => {
    if (trierMarche("price_asc")) afficherStatut("Tri du Marché : « Mise la plus basse ». Les mises jusqu'à "
      + `${nombreLisible(montant)} arrivent en premier.`);
  });
  ajouter("Afficher quand même (décocher le filtre)", () => {
    filtrePrixMax = { ...filtrePrixMax, actif: false };
    const coche = document.querySelector("#wmd-case-prixmax input[type=checkbox]");
    if (coche) coche.checked = false;
    api.storage.local.set({ marchePrixMax: filtrePrixMax }).catch(() => {});
    filtrerEncheresTropCheres();
  });
  const explication = decroissant
    ? `Le tri du site est « Mise la plus haute » : les annonces arrivent de la plus chère à la moins chère, 50 à la fois. `
      + `Les mises jusqu'à ${nombreLisible(montant)} sont plus loin dans la liste.`
    : `Le site charge les annonces 50 à la fois : les suivantes ont peut-être des mises jusqu'à ${nombreLisible(montant)}.`;
  aide.replaceChildren(
    creer("b", `🔎 Aucune carte affichée : les ${blocs.length} annonces chargées dépassent ${nombreLisible(montant)} wikibidous`
      + (marcheBientotFini ? ` (ou finissent dans plus de ${marcheBientotMinutes} min)` : "") + "."),
    creer("div", explication + (plusBasse !== null ? ` La moins chère ici : ${nombreLisible(plusBasse)}.` : "")
      + (bouton ? "" : " Il n'y a plus d'annonce à charger."), "wmd-aide-texte"),
    ...boutons
  );
  if (aide.nextElementSibling !== grille) grille.before(aide);
}

// Clique sur « Charger la suite » (comme tu le ferais) jusqu'à ce qu'au moins une annonce passe le filtre.
async function chargerSuiteJusquAuxMises() {
  if (chargementSuiteEnCours || enCours) return;
  chargementSuiteEnCours = true;
  enCours = true; // le bouton Stop du panneau (et celui de l'encart) arrête le chargement
  surveillerStop().catch(() => {});
  const montant = filtrePrixMax.montant;
  let message = "";
  try {
    for (let tour = 1; tour <= CHARGEMENTS_SUITE_MAX && enCours; tour++) {
      if (annoncesVisibles().length) break;
      const bouton = boutonChargerSuite();
      if (!bouton) { message = "Toutes les annonces sont chargées : aucune n'a une mise jusqu'à " + nombreLisible(montant) + "."; break; }
      const avant = document.querySelectorAll("[id^='marketplace-auction-']").length;
      afficherStatut(`⏬ Chargement ${tour} / ${CHARGEMENTS_SUITE_MAX} : ${avant} annonces chargées, aucune mise ≤ ${nombreLisible(montant)} pour l'instant… (Stop pour arrêter)`);
      bouton.click();
      const arrivees = await attendre(() => document.querySelectorAll("[id^='marketplace-auction-']").length > avant, 10000);
      if (!arrivees) { message = "Le site n'a pas chargé la suite à temps : réessaie dans un instant."; break; }
      versionPage++;
      filtrerEncheresTropCheres(); // tout de suite : les nouvelles annonces trop chères ne s'affichent pas
      await pause(400);            // le temps que tout soit affiché, puis une deuxième passe
      versionPage++;
      filtrerEncheresTropCheres();
      if (annoncesVisibles().length) break;
      await pause(1100); // on laisse respirer le site entre deux chargements
    }
    const visibles = annoncesVisibles();
    if (visibles.length) {
      visibles[0].scrollIntoView({ block: "center", behavior: "smooth" });
      message = `${visibles.length} annonce(s) avec une mise jusqu'à ${nombreLisible(montant)} affichée(s).`;
    } else if (!message) {
      message = enCours ? `Toujours rien après ${CHARGEMENTS_SUITE_MAX} chargements : essaie « Trier par mise la plus basse ».` : "Chargement arrêté.";
    }
  } finally {
    enCours = false;
    chargementSuiteEnCours = false;
    surveillerStop().catch(() => actualiserPanneau());
    afficherStatut(message);
    filtrerEncheresTropCheres();
  }
}

// ---------------------------------------------------------------------
//  1.17 : LE CHARGEMENT AUTOMATIQUE DU MARCHÉ (à activer dans « ⚙️ Options du Marché »)
//  Pour relever beaucoup de prix sans rien faire : sur l'onglet « Parcourir » du Marché, l'extension
//  choisit le tri voulu (récemment listées, mise la plus haute, mise la plus basse, fin imminente) et
//  le filtre de rareté, puis clique sur « Charger la suite » du site, comme toi, toutes les 2 à 3 s
//  (au hasard), jusqu'à la fin de la liste ou au nombre maximum de chargements choisi.
//  Option : recharger la page toutes les X minutes, pour repartir de zéro (les nouvelles annonces).
//  Les prix sont relevés comme d'habitude (mises actuelles seulement). Rien n'est acheté ni misé.
//  Chaque chargement est une requête au site : c'est une automatisation, à utiliser avec modération.
//  Pause automatique quand une fenêtre du site est ouverte ou que tu écris dans un champ.
// ---------------------------------------------------------------------
const TRIS_MARCHE = [["recent", "Récemment listées"], ["price_desc", "Mise la plus haute"], ["price_asc", "Mise la plus basse"], ["ending_soon", "Fin imminente"]];
const AUTO_PAR_DEFAUT = { actif: false, tri: "recent", raretes: [], actualiser: false, minutes: 10, maxChargements: 100,
  majPartage: false, minutesPartage: 30 }; // 1.17 : + mise à jour du fichier des prix partagés toutes les X minutes
let autoMarche = { ...AUTO_PAR_DEFAUT };
let autoEtat = null;      // le cycle en cours : { debut, prochain, chargements, prepare, fini, absences }
let autoOccupe = false;
function lireAutoMarche(valeur) {
  const v = { ...AUTO_PAR_DEFAUT, ...(valeur || {}) };
  return {
    actif: false, // version sans chargement automatique : jamais actif
    tri: TRIS_MARCHE.some(([t]) => t === v.tri) ? v.tri : "recent",
    raretes: Array.isArray(v.raretes) ? v.raretes.filter(r => RARETES[r]) : [],
    actualiser: v.actualiser === true,
    minutes: Number.isFinite(Number(v.minutes)) && Number(v.minutes) >= 1 ? Math.round(Number(v.minutes)) : 10,
    maxChargements: Number.isFinite(Number(v.maxChargements)) && Number(v.maxChargements) >= 1 ? Math.round(Number(v.maxChargements)) : 100,
    majPartage: v.majPartage === true,
    minutesPartage: Number.isFinite(Number(v.minutesPartage)) && Number(v.minutesPartage) >= 5 ? Math.round(Number(v.minutesPartage)) : 30
  };
}
api.storage.local.get(["autoMarche", "derniereMajPartageAuto"]).then(({ autoMarche: valeur, derniereMajPartageAuto }) => {
  autoMarche = lireAutoMarche(valeur);
  derniereMajAuto = Number(derniereMajPartageAuto) || 0;
  afficherReglageAuto();
}).catch(() => {});
// 1.17 : l'heure de la dernière mise à jour automatique du fichier partagé (gardée en mémoire : elle survit
// au rechargement de la page, et un autre onglet ne la refait pas juste après). null = pas encore lue.
let derniereMajAuto = null;
api.storage.onChanged.addListener(changements => {
  if (changements.derniereMajPartageAuto) derniereMajAuto = Number(changements.derniereMajPartageAuto.newValue) || 0;
});
api.storage.onChanged.addListener(changements => {
  if (!changements.autoMarche) return;
  const avant = autoMarche;
  autoMarche = lireAutoMarche(changements.autoMarche.newValue);
  // Un autre tri ou d'autres raretés : on repart de zéro (le tri et le filtre sont rechoisis).
  if (!autoMarche.actif || avant.tri !== autoMarche.tri || avant.raretes.join() !== autoMarche.raretes.join()) autoEtat = null;
  afficherReglageAuto();
  versionPage++;
});
function enregistrerAutoMarche(modifs) {
  autoMarche = lireAutoMarche({ ...autoMarche, ...modifs });
  api.storage.local.set({ autoMarche: autoMarche }).catch(() => {});
  afficherReglageAuto();
}
function afficherReglageAuto() {
  const coche = document.getElementById("wmd-auto-actif");
  if (coche) coche.checked = autoMarche.actif;
  const tri = document.getElementById("wmd-auto-tri");
  if (tri && document.activeElement !== tri) tri.value = autoMarche.tri;
  for (const r of Object.keys(RARETES)) {
    const c = document.getElementById(`wmd-auto-rarete-${r}`);
    if (c) c.checked = autoMarche.raretes.includes(r);
  }
  const actualiser = document.getElementById("wmd-auto-actualiser");
  if (actualiser) actualiser.checked = autoMarche.actualiser;
  const minutes = document.getElementById("wmd-auto-minutes");
  if (minutes && document.activeElement !== minutes) minutes.value = String(autoMarche.minutes);
  const partage = document.getElementById("wmd-auto-partage");
  if (partage) partage.checked = autoMarche.majPartage;
  const minutesPartage = document.getElementById("wmd-auto-minutes-partage");
  if (minutesPartage && document.activeElement !== minutesPartage) minutesPartage.value = String(autoMarche.minutesPartage);
  const max = document.getElementById("wmd-auto-max");
  if (max && document.activeElement !== max) max.value = String(autoMarche.maxChargements);
  const bloc = document.getElementById("wmd-auto");
  if (bloc) bloc.classList.toggle("wmd-auto-actif", autoMarche.actif);
}
const delaiAuto = () => 2000 + Math.round(Math.random() * 1000); // entre 2 et 3 secondes, au hasard

// Les boutons de rareté du site (L, UR, SR, R, PC, C) au-dessus de la liste du Marché.
function boutonsRareteMarche() {
  const lettres = new Map(Object.keys(RARETES).map(r => [lettreRarete(r), r]));
  const zone = document.querySelector("main") || document.body;
  return [...zone.querySelectorAll("button")].filter(b => !estDansLePanneau(b) && estVisible(b) && lettres.has(b.textContent.trim()))
    .map(b => ({ bouton: b, rarete: lettres.get(b.textContent.trim()) }));
}
const filtreChoisi = b => b.classList.contains(CONFIG.classeFiltreChoisi) || b.getAttribute("aria-pressed") === "true" || !b.classList.contains("opacity-50");

// Choisit le tri et le filtre de rareté sur le site (comme si tu cliquais : une requête par changement).
// Une seule rareté : le filtre du site. Plusieurs : pas de filtre du site, les autres raretés sont cachées par l'extension.
async function preparerAutoMarche() {
  if (triMarcheActuel() !== autoMarche.tri && trierMarche(autoMarche.tri)) await pause(1500);
  const voulue = autoMarche.raretes.length === 1 ? autoMarche.raretes[0] : null;
  for (const { bouton, rarete } of boutonsRareteMarche()) {
    if (filtreChoisi(bouton) !== (rarete === voulue)) {
      bouton.click();
      await pause(1200);
    }
  }
  if (voulue && !boutonsRareteMarche().some(({ bouton, rarete }) => rarete === voulue && filtreChoisi(bouton))) {
    const b = boutonsRareteMarche().find(({ rarete }) => rarete === voulue);
    if (b) { b.bouton.click(); await pause(1200); }
  }
}

// Plusieurs raretés choisies : les annonces des autres raretés sont cachées (seulement pendant le chargement automatique).
function filtrerRaretesAuto() {
  const actif = autoMarche.actif && autoMarche.raretes.length > 1 && optionsMarcheActives();
  for (const bloc of document.querySelectorAll("[id^='marketplace-auction-']")) {
    const cacher = actif && !autoMarche.raretes.includes(rareteDuCadre(bloc));
    if (bloc.classList.contains("wmd-autre-rarete") !== cacher) bloc.classList.toggle("wmd-autre-rarete", cacher);
  }
}

// Un temps restant lisible : « 8 min 12 s », « 2 s ».
function compteARebours(ms) {
  const secondes = Math.max(0, Math.round(ms / 1000));
  return secondes >= 60 ? `${Math.floor(secondes / 60)} min ${String(secondes % 60).padStart(2, "0")} s` : `${secondes} s`;
}
function afficherEtatAuto(texte) {
  const zone = document.getElementById("wmd-auto-etat");
  if (zone && zone.textContent !== texte) zone.textContent = texte;
}

// Tourne toutes les secondes.
async function boucleAutoMarche() {
  const onglet = pageActuelle() === "marche" && !REGEX_PAGE_ENCHERE.test(location.pathname) ? ongletMarcheOuvert() : "pas le Marché";
  const surParcourir = onglet === null || /^parcourir/i.test(onglet || "");
  if (!autoMarche.actif) { autoEtat = null; afficherEtatAuto("Arrêté."); return; }
  if (!surParcourir) { autoEtat = null; afficherEtatAuto("En pause : ouvre l'onglet « Parcourir » du Marché."); return; }
  if (autoOccupe || enCours || rechercheEnCours) return;
  const maintenant = Date.now();
  if (!autoEtat) autoEtat = { debut: maintenant, prochain: maintenant, chargements: 0, prepare: false, fini: "", absences: 0 };
  // Une fenêtre du site ouverte, ou un champ où tu écris : on attend (et le rechargement aussi).
  const actif = document.activeElement;
  const occupe = document.querySelector(".sheet-overlay, [role='dialog']")
    || (actif && /^(INPUT|TEXTAREA|SELECT)$/.test(actif.tagName) && !estDansLePanneau(actif));
  const rechargement = autoMarche.actualiser ? autoEtat.debut + autoMarche.minutes * MINUTE : null;
  // 1.17 : la mise à jour du fichier des prix partagés, toutes les X minutes (même pendant une pause ou après la fin de la liste).
  const majPartage = autoMarche.majPartage && derniereMajAuto !== null ? derniereMajAuto + autoMarche.minutesPartage * MINUTE : null;
  const finTexte = (rechargement ? ` · rechargement de la page dans ${compteARebours(rechargement - maintenant)}` : "")
    + (!autoMarche.majPartage ? "" : !partageConfigure ? " · ☁️ fichier partagé pas réglé (Réglages, « Prix partagés »)"
      : majPartageEnCours ? " · ☁️ mise à jour des prix partagés…" : majPartage ? ` · ☁️ prix partagés dans ${compteARebours(majPartage - maintenant)}` : "");
  if (majPartage && partageConfigure && !majPartageEnCours && maintenant >= majPartage) {
    derniereMajAuto = maintenant;
    api.storage.local.set({ derniereMajPartageAuto: maintenant }).catch(() => {});
    mettreAJourPrixPartages(true).catch(() => {});
  }
  if (occupe) {
    autoEtat.prochain = Math.max(autoEtat.prochain, maintenant + 1000);
    afficherEtatAuto(`⏸ En pause (fenêtre ouverte ou champ en cours de saisie) · ${autoEtat.chargements} chargement(s)${finTexte}`);
    return;
  }
  if (rechargement && maintenant >= rechargement && !majPartageEnCours) { // pas pendant l'envoi des prix partagés
    afficherEtatAuto("🔄 Rechargement de la page…");
    afficherStatut("🤖 Chargement automatique : rechargement de la page pour repartir de zéro.");
    location.reload();
    return;
  }
  if (!autoEtat.prepare) {
    // On attend que la liste du site soit là (le menu de tri et au moins une annonce).
    if (!selectTriMarche() || !document.querySelector("[id^='marketplace-auction-']")) {
      afficherEtatAuto("En attente de la liste du Marché…");
      return;
    }
    autoOccupe = true;
    afficherEtatAuto("Choix du tri et de la rareté…");
    try {
      await preparerAutoMarche();
    } finally {
      autoOccupe = false;
    }
    autoEtat.prepare = true;
    autoEtat.prochain = Date.now() + delaiAuto();
    return;
  }
  const annonces = document.querySelectorAll("[id^='marketplace-auction-']").length;
  if (autoEtat.fini) {
    afficherEtatAuto(`⏹ ${autoEtat.fini} · ${autoEtat.chargements} chargement(s), ${annonces} annonce(s)`
      + (rechargement ? finTexte : " · coche « Recharger la page » pour repartir tout seul."));
    return;
  }
  if (maintenant < autoEtat.prochain) {
    afficherEtatAuto(`▶ ${autoEtat.chargements} / ${autoMarche.maxChargements} chargement(s), ${annonces} annonce(s) · suivant dans ${compteARebours(autoEtat.prochain - maintenant)}${finTexte}`);
    return;
  }
  if (autoEtat.chargements >= autoMarche.maxChargements) {
    autoEtat.fini = `Maximum de ${autoMarche.maxChargements} chargements atteint`;
    return;
  }
  const bouton = boutonChargerSuite();
  if (!bouton) {
    // Le bouton disparaît aussi pendant un chargement : la fin de la liste n'est retenue qu'après 3 essais.
    autoEtat.absences++;
    autoEtat.prochain = maintenant + delaiAuto();
    if (autoEtat.absences >= 3) autoEtat.fini = "Fin de la liste : plus d'annonce à charger";
    return;
  }
  autoEtat.absences = 0;
  bouton.click();
  autoEtat.chargements++;
  autoEtat.prochain = maintenant + delaiAuto();
}

// 1.13 : l'affichage allégé du Marché. Les cartes de la liste ne montrent plus que la rareté, le nom,
// la mise et la durée, pour en voir beaucoup plus à la fois ; les cadres de l'extension restent.
// Rien n'est retiré de la page : l'image et la description sont seulement cachées (style.css),
// et le nom est écrit dans un attribut « data-wmd-nom » (affiché par le CSS, sans ajouter de texte à la page).
let marcheCompact = false;
api.storage.local.get("marcheCompact").then(({ marcheCompact: valeur }) => {
  marcheCompact = valeur === true;
  const coche = document.querySelector("#wmd-case-compact input");
  if (coche) coche.checked = marcheCompact;
  appliquerMarcheCompact();
}).catch(() => {});
api.storage.onChanged.addListener(changements => {
  if (!changements.marcheCompact) return;
  marcheCompact = changements.marcheCompact.newValue === true;
  const coche = document.querySelector("#wmd-case-compact input");
  if (coche) coche.checked = marcheCompact;
  appliquerMarcheCompact();
});
function appliquerMarcheCompact() {
  const actif = marcheCompact && optionsMarcheActives();
  document.documentElement.classList.toggle("wmd-marche-compact", actif);
  if (!actif) return;
  for (const annonce of document.querySelectorAll("[id^='marketplace-auction-']")) {
    const contenu = annonce.querySelector("a > div") || annonce.firstElementChild;
    const titre = annonce.querySelector(CONFIG.selecteurNomCarte);
    if (!contenu || !titre) continue;
    let lettre = "";
    for (const element of annonce.querySelectorAll("div, span")) {
      if (estPetitBadge(element) && rareteDepuisLettre(element.textContent.trim())) { lettre = element.textContent.replace(/\s*shiny/i, "").trim(); break; }
    }
    const nom = (lettre ? lettre + " · " : "") + titre.textContent.trim();
    if (contenu.dataset.wmdNom !== nom) {
      contenu.dataset.wmdNom = nom;
      if (lettre) contenu.style.setProperty("--wmd-couleur-rarete", `var(--color-rarity-${lettre.toLowerCase()})`);
    }
  }
  marquerAnimeesMarche(); // 1.15 : le « A » doré des cartes animées
}

// 1.15 : en affichage allégé, l'image de la carte est cachée (et son cadre doré avec elle). Une carte
// animée reçoit donc un petit « A » doré qui tourne, à côté de son nom (style.css, « data-wmd-anime »).
// L'image n'est vérifiée qu'une fois (même mémoire que le cadre doré) : rien de plus n'est demandé au site.
let animeesMarcheEnCours = false;
async function marquerAnimeesMarche() {
  if (animeesMarcheEnCours || !document.documentElement.classList.contains("wmd-marche-compact")) return;
  animeesMarcheEnCours = true;
  try {
    const annonces = [...document.querySelectorAll("[id^='marketplace-auction-']")];
    await executerAvecLimite(annonces, CONFIG.verificationsImagesSimultanees, async annonce => {
      const contenu = annonce.querySelector("a > div") || annonce.firstElementChild;
      if (!contenu) return;
      const animee = (await infoAnimation(annonce)).animee === true;
      if ((contenu.dataset.wmdAnime === "1") !== animee) {
        if (animee) {
          contenu.dataset.wmdAnime = "1";
          contenu.title = "Carte animée (WikiMasters Doublons)";
        } else {
          delete contenu.dataset.wmdAnime;
          contenu.removeAttribute("title");
        }
      }
    });
  } finally {
    animeesMarcheEnCours = false;
  }
}

// Nouveau en 1.7.4 : afficher ou non les prix min / max trouvés au Marché (case du panneau).
let afficherMinMax = true;
api.storage.local.get("afficherMinMax").then(({ afficherMinMax: valeur }) => {
  afficherMinMax = valeur !== false;
  const coche = document.querySelector("#wmd-case-minmax input");
  if (coche) coche.checked = afficherMinMax;
}).catch(() => {});
api.storage.onChanged.addListener(changements => {
  if (!changements.afficherMinMax) return;
  afficherMinMax = changements.afficherMinMax.newValue !== false;
  const coche = document.querySelector("#wmd-case-minmax input");
  if (coche) coche.checked = afficherMinMax;
  rafraichirAffichagePrix();
});
function rafraichirAffichagePrix() {
  const fiche = document.getElementById("wmd-prix-fiche");
  if (fiche) fiche.dataset.cle = ""; // la fiche d'une carte sera recalculée
}

function arreter() {
  enCours = false;
  api.storage.local.remove("chasse").catch(() => {}); // nouveau en 1.5 : arrête aussi la recherche chez les amis
  afficherStatut("Arrêt demandé…");
}

// Lit l'indicateur "Page 3 / 280" de la liste.
// Renvoie { actuelle: 3, total: 280 }, ou null s'il n'est pas sur la page.
function lirePagination() {
  for (const element of document.querySelectorAll("main *")) {
    if (element.children.length > 0) continue;
    const trouve = element.textContent.trim().match(/^Page\s+(\d+)\s*\/\s*(\d+)$/);
    if (trouve) return { actuelle: parseInt(trouve[1], 10), total: parseInt(trouve[2], 10) };
  }
  return null;
}

// Les noms de toutes les cartes affichées, collés ensemble : sert à savoir quand la nouvelle page est arrivée.
function signaturePage() {
  return trouverCadresDeCartes().map(({ cadre }) => cadre.querySelector(CONFIG.selecteurNomCarte).textContent.trim()).join("|");
}

// ---- Nouveau en 1.8 : LA PATIENCE ----
// Avant, si une page mettait plus de 5 secondes à arriver, la lecture s'arrêtait net
// (« La page suivante n'a pas répondu à temps »). Maintenant, quand une page tarde :
//   1) on attend plus longtemps à chaque essai (5 s, 10 s, 20 s, puis 30 s) ;
//   2) si le site n'a pas pris le clic en compte, on reclique (si un clic en trop a fait
//      dépasser la page voulue, on revient en arrière) ;
//   3) si le site affiche un bouton « Réessayer » ou « Recharger », on clique dessus ;
//   4) on continue ainsi pendant la durée choisie dans les réglages (3 minutes par défaut).
// Si la page ne vient toujours pas, la lecture s'arrête SANS perdre ce qui a été lu : le bouton
// « Reprendre la lecture » repart de la page où elle s'est arrêtée.

function patienceMs() {
  const minutes = Number(reglages.patienceMinutes);
  return (minutes >= 1 && minutes <= 30 ? minutes : REGLAGES_PAR_DEFAUT.patienceMinutes) * 60 * 1000;
}

// Le bouton « Réessayer » / « Recharger » que le site affiche parfois après une erreur de chargement.
const REGEX_BOUTON_REESSAYER = /^(r[ée]essayer|recharger|actualiser|rafra[îi]chir|retry|reload|try again)\b/i;
function cliquerReessayer() {
  const zone = document.querySelector("main") || document.body;
  for (const bouton of zone.querySelectorAll("button, [role='button']")) {
    if (estDansLePanneau(bouton) || !estVisible(bouton) || bouton.disabled) continue;
    const texte = bouton.textContent.trim();
    if (!REGEX_BOUTON_REESSAYER.test(texte) || MOTS_PAYANTS.some(mot => texte.toLowerCase().includes(mot))) continue;
    bouton.click();
    return true;
  }
  return false;
}

// Attend (au plus "ms") que la page "cible" soit affichée : bon numéro ET nouvelles cartes.
async function attendrePage(cible, signatureAvant, ms) {
  const debut = Date.now();
  while (enCours && Date.now() - debut < ms) {
    await pause(250);
    const apres = lirePagination();
    const signatureApres = signaturePage();
    if (apres && apres.actuelle === cible && signatureApres !== "" && signatureApres !== signatureAvant) return true;
  }
  return false;
}

// Attend que la pagination « Page 3 / 280 » soit affichée (la page est peut-être encore en chargement).
async function attendrePagination() {
  const finPatience = Date.now() + patienceMs();
  let page = lirePagination();
  let attente = CONFIG.attenteMaxMs;
  while (enCours && !page && Date.now() < finPatience) {
    afficherStatut("La page tarde à s'afficher : on attend…");
    const debut = Date.now();
    while (enCours && !page && Date.now() - debut < attente) {
      await pause(250);
      page = lirePagination();
    }
    if (!page) cliquerReessayer();
    attente = Math.min(attente * 2, CONFIG.attenteEssaiMaxMs);
  }
  return page;
}

// Clique sur "Suivant" ou "Précédent", puis attend que la nouvelle page soit affichée :
// le numéro de page a changé ET les cartes aussi. 1.8 : avec patience (voir plus haut).
// Renvoie false seulement si la page n'est pas venue pendant toute la durée de patience.
async function changerDePage(texteBouton) {
  const avant = lirePagination();
  if (!avant) return false; // pas de pagination
  const sens = texteBouton === CONFIG.texteBoutonPagePrecedente ? -1 : 1;
  const cible = avant.actuelle + sens;
  if (cible < 1 || cible > avant.total) return false;
  const signatureAvant = signaturePage();
  const finPatience = Date.now() + patienceMs();
  let attente = CONFIG.attenteMaxMs;
  let reessaye = false; // vrai si on vient de cliquer sur « Réessayer » : on lui laisse sa chance

  for (let essai = 1; enCours; essai++) {
    const etat = lirePagination();
    if ((!etat || etat.actuelle !== cible) && !reessaye) {
      // Le site n'a pas (encore) changé de page : on clique, dans le bon sens pour rejoindre la cible.
      // Un bouton grisé (le site est en train de charger) n'est pas cliqué : trouverBoutonParTexte l'ignore.
      const vers = !etat || etat.actuelle < cible ? CONFIG.texteBoutonPageSuivante : CONFIG.texteBoutonPagePrecedente;
      const bouton = trouverBoutonParTexte(vers);
      if (bouton) bouton.click();
    }
    if (await attendrePage(cible, signatureAvant, Math.max(1000, Math.min(attente, finPatience - Date.now())))) return true;
    if (Date.now() >= finPatience) break;
    reessaye = cliquerReessayer();
    afficherStatut(`La page ${cible} tarde à répondre : nouvel essai (${essai + 1})…`);
    attente = Math.min(attente * 2, CONFIG.attenteEssaiMaxMs);
  }
  return false;
}

// Nouveau en 1.8 : la lecture en cours ou interrompue, pour pouvoir la reprendre.
// lecture = { type: "doublons" | "manquantes" | "animees", page, pages: Map(numéro → cartes),
//             total, filtre, lues, complet }
let lecture = null;

// La première page pas encore lue (1 si rien n'a été lu).
function premierePageNonLue(total) {
  for (let numero = 1; numero <= total; numero++) {
    if (!lecture.pages.has(numero)) return numero;
  }
  return total + 1;
}

// Nouveau en 1.3 : la boucle de lecture, partagée par « doublons », « cartes manquantes »
// et (1.8) « cartes animées ». Lit chaque page jusqu'à la dernière, et renvoie { cartes, message, complet }.
// "message" est vide si tout a été lu, sinon il explique pourquoi la lecture est partielle.
// 1.8 : reprendre = true continue la lecture précédente du même type au lieu de repartir de zéro
// (les pages déjà lues ne sont pas relues). garder = une fonction qui choisit les cartes à garder
// (pour la recherche des cartes animées, inutile de garder en mémoire les milliers d'autres).
async function lireToutesLesPages(type, { reprendre = false, garder = null } = {}) {
  let message = "";
  if (!reprendre || !lecture || lecture.type !== type || lecture.page !== pageActuelle()) {
    lecture = { type: type, page: pageActuelle(), pages: new Map(), total: null,
      filtre: type === "doublons" ? filtreActif() : null, rarete: filtreRareteChoisi(), lues: 0, complet: false };
  }
  lecture.complet = false;

  // 1) Aller à la première page pas encore lue (la page 1 pour une nouvelle lecture).
  let page = await attendrePagination();
  if (page) {
    const cible = Math.min(premierePageNonLue(page.total), page.total);
    while (enCours && page && page.actuelle !== cible) {
      afficherStatut(`${page.actuelle > cible ? "Retour" : "Passage"} à la page ${cible} (page ${page.actuelle})…`);
      const bouton = page.actuelle > cible ? CONFIG.texteBoutonPagePrecedente : CONFIG.texteBoutonPageSuivante;
      if (!(await changerDePage(bouton))) break;
      page = lirePagination();
    }
    if (enCours && (!page || page.actuelle !== cible)) message = `Impossible d'aller à la page ${cible}.`;
  }

  // Le site affiche parfois les cartes un peu après le reste de la page : on les attend.
  const debut = Date.now();
  while (enCours && !message && signaturePage() === "" && Date.now() - debut < CONFIG.attenteMaxMs * 2) {
    await pause(250);
  }

  // 2) Lire chaque page, puis passer à la suivante, jusqu'à la dernière.
  while (enCours && !message) {
    page = lirePagination() || await attendrePagination();
    if (!page) {
      message = "Pagination introuvable.";
      break;
    }
    lecture.total = page.total;
    if (!lecture.pages.has(page.actuelle)) {
      const cartes = await lireCartesAffichees();
      lecture.lues += cartes.length;
      lecture.pages.set(page.actuelle, garder ? cartes.filter(garder) : cartes);
    }
    const gardees = [...lecture.pages.values()].reduce((total, liste) => total + liste.length, 0);
    afficherStatut(`Page ${page.actuelle} / ${page.total} lue : ${lecture.lues} cartes`
      + (garder ? `, ${gardees} retenue(s).` : "."));
    if (page.actuelle >= page.total) break; // dernière page : c'est fini
    // On laisse respirer le site entre deux pages (pas besoin pour une page déjà lue qu'on traverse).
    await pause(lecture.pages.has(page.actuelle + 1) ? 300 : CONFIG.pauseMs);
    if (!enCours) break;
    if (!(await changerDePage(CONFIG.texteBoutonPageSuivante))) {
      if (enCours) message = `La page ${page.actuelle + 1} ne répond pas, même après ${Math.round(patienceMs() / 60000)} min d'essais.`;
      break;
    }
  }

  const arrete = !enCours;
  enCours = false;
  const total = lecture.total || 0;
  const nonLues = total - [...lecture.pages.keys()].filter(numero => numero <= total).length;
  lecture.complet = !arrete && !message && total > 0 && nonLues === 0;
  if (arrete) message = "Arrêté avant la fin.";
  if (!lecture.complet) {
    message = `${message || "Lecture incomplète."} ${nonLues} page(s) sur ${total} non lue(s) : `
      + "clique sur « Reprendre la lecture » pour continuer là où elle s'est arrêtée.";
  }
  // 1.12 : surveillerStop remet tout de suite à jour l'état « tâche en cours » (et le panneau) :
  // le bouton « Reprendre la lecture » apparaît en même temps que le message, plus 2 s après.
  surveillerStop().catch(() => actualiserPanneau());
  actualiserPanneau();
  const numeros = [...lecture.pages.keys()].sort((a, b) => a - b);
  return { cartes: numeros.flatMap(numero => lecture.pages.get(numero)), message: lecture.complet ? "" : message, complet: lecture.complet };
}

// Nouveau en 1.8 : le bouton « Reprendre la lecture ».
function reprendreLecture() {
  if (enCours || !lecture) return;
  if (lecture.type === "doublons") trouverMesDoublons(true);
  else if (lecture.type === "manquantes") trouverMesCartesManquantes(true);
  else if (lecture.type === "animees") trouverCartesAnimees(true);
}

// Nouveau en 1.8 : le filtre de rareté choisi avec les boutons du site (« L », « UR »...), ou null.
function filtreRareteChoisi() {
  const zone = document.querySelector("main") || document.body;
  for (const bouton of zone.querySelectorAll("button")) {
    if (estDansLePanneau(bouton)) continue;
    const rarete = rareteDepuisLettre(bouton.textContent.trim());
    if (rarete && bouton.classList.contains(CONFIG.classeFiltreChoisi)) return rarete;
  }
  return null;
}


// ---------------------------------------------------------------------
//  PARTIE 7 : LIRE TOUTE LA COLLECTION ET TROUVER LES DOUBLONS
// ---------------------------------------------------------------------

let derniereCollection = [];  // les cartes lues lors du dernier scan
let modeTri = "quantite";     // "quantite", "rarete", "nom" ou "animee"
let afficherTout = false;     // false = seulement les doublons
let seulementAnimees = false; // true = seulement les cartes animées

// 1.8 : reprendre = true continue une lecture interrompue (bouton « Reprendre la lecture »).
async function trouverMesDoublons(reprendre = false) {
  if (enCours) return; // une autre tâche est déjà en cours
  // Nouveau en 1.3 : « Toutes les cartes » a aussi des pages ; on ne doit lire que TA collection.
  if (pageActuelle() !== "collection" || !lirePagination()) {
    afficherStatut("Va d'abord sur la page Collection.");
    return;
  }
  enCours = true;
  derniereCollection = [];
  derniereComparaison = null;
  lectureEnAttente = null;

  // Le filtre du site est regardé AVANT de changer de page (lireToutesLesPages le garde dans « lecture »).
  const { cartes, message } = await lireToutesLesPages("doublons", { reprendre: reprendre });
  const filtre = lecture.filtre;
  derniereCollection = cartes;
  collectionAffichee = null; // 1.15 : le tableau montre cette lecture (et non plus celle en mémoire)
  dateCollectionAffichee = null;
  if (cartes.length === 0) {
    afficherStatut(message || "Aucune carte trouvée. Es-tu bien sur la page de ta collection ?");
    return;
  }

  // Nouveau en 1.3 : une lecture complète et sans filtre est gardée en mémoire
  // (pour l'historique, les cartes manquantes et les échanges).
  let avertissement = message;
  if (!avertissement && filtre) {
    avertissement = "Un filtre du site est actif : cette lecture n'est pas gardée en mémoire.";
  }
  if (!avertissement) avertissement = await enregistrerLecture(regrouperParNom(cartes));

  afficherTableau();
  if (avertissement) afficherStatut(avertissement);
}

// Nouveau en 1.3 : vrai si un filtre du site est actif (recherche, rareté ou étiquette).
// Une lecture filtrée ne contient qu'une partie de ta collection.
function filtreActif() {
  const zone = document.querySelector("main") || document.body;
  for (const champ of zone.querySelectorAll("input[type='text'], input[type='search']")) {
    if (!estDansLePanneau(champ) && champ.value.trim() !== "") return true; // une recherche est tapée
  }
  const boutons = [...zone.querySelectorAll("button")].filter(bouton => !estDansLePanneau(bouton));
  const boutonsRarete = boutons.filter(bouton => rareteDepuisLettre(bouton.textContent.trim()));
  if (boutonsRarete.some(bouton => bouton.classList.contains(CONFIG.classeFiltreChoisi))) return true;
  const etiquetteChoisie = boutonsRarete.length > 0
    && !boutons.some(bouton => bouton.textContent.trim() === CONFIG.texteToutesEtiquettes);
  return etiquetteChoisie;
}

// Regroupe les cartes qui ont le même nom et additionne leurs quantités.
// C'est l'équivalent d'un Dictionary<string, Carte> en C#.
function regrouperParNom(cartes) {
  const parNom = new Map();
  for (const carte of cartes) {
    if (parNom.has(carte.nom)) {
      const deja = parNom.get(carte.nom);
      deja.quantite += carte.quantite;
      deja.animee = deja.animee || carte.animee;
    } else {
      parNom.set(carte.nom, { nom: carte.nom, rarete: carte.rarete, quantite: carte.quantite, animee: carte.animee });
    }
  }
  return Array.from(parNom.values());
}

// Trie la liste sur place selon le mode choisi.
function trierCartes(liste, mode) {
  liste.sort((a, b) => {
    if (mode === "nom") {
      return a.nom.localeCompare(b.nom, "fr");
    }
    if (mode === "rarete") {
      return ordreRarete(b.rarete) - ordreRarete(a.rarete) || a.nom.localeCompare(b.nom, "fr");
    }
    if (mode === "animee") { // les cartes animées d'abord, puis les plus nombreuses
      return Number(b.animee) - Number(a.animee) || b.quantite - a.quantite || a.nom.localeCompare(b.nom, "fr");
    }
    // par défaut : la plus grande quantité d'abord, puis la plus rare, puis par nom
    return b.quantite - a.quantite
      || ordreRarete(b.rarete) - ordreRarete(a.rarete)
      || a.nom.localeCompare(b.nom, "fr");
  });
}

// Crée une case à cocher avec son texte ; "quandChange" reçoit true ou false.
function creerCaseACocher(id, texte, cochee, quandChange) {
  const etiquette = creer("label");
  const caseACocher = creer("input");
  caseACocher.type = "checkbox";
  caseACocher.id = id;
  caseACocher.checked = cochee;
  caseACocher.addEventListener("change", () => quandChange(caseACocher.checked));
  etiquette.append(caseACocher, " " + texte);
  return etiquette;
}

// 1.15 : la collection affichée par le tableau quand elle vient de la mémoire (dernière lecture complète),
// par exemple après un changement de page : [{ nom, rarete, quantite, animee }] et la date de cette lecture.
let collectionAffichee = null;
let dateCollectionAffichee = null;

// 1.15 : ta dernière lecture complète, affichée sans relire la Collection (bouton « 📋 Mes listes »,
// ou retour automatique de la dernière liste). options : { afficherTout, seulementAnimees, modeTri }.
async function afficherMaCollection(options = {}) {
  const zone = document.getElementById("wmd-resultats");
  if (!zone) return;
  // Une lecture faite à l'instant dans cet onglet passe avant la mémoire.
  if (derniereCollection.length === 0) {
    const { collection, comparaison } = await api.storage.local.get(["collection", "comparaison"]);
    if (!collection) {
      zone.replaceChildren(creer("p", "Aucune lecture de ta collection en mémoire : va sur la page Collection et clique sur "
        + "« Trouver mes doublons ».", "wmd-discret"));
      afficherStatut("Aucune lecture de ta collection en mémoire.");
      return;
    }
    collectionAffichee = collection.cartes.map(([nom, rarete, quantite, animee]) =>
      ({ nom: nom, rarete: rarete, quantite: quantite, animee: animee === 1 }));
    dateCollectionAffichee = collection.date;
    // Les nouvelles cartes depuis la lecture précédente, si elles vont avec cette lecture.
    derniereComparaison = comparaison && comparaison.lecture === collection.date ? comparaison : null;
  }
  if ("afficherTout" in options) afficherTout = Boolean(options.afficherTout);
  if ("seulementAnimees" in options) seulementAnimees = Boolean(options.seulementAnimees);
  if (options.modeTri) modeTri = options.modeTri;
  afficherTableau();
}

function afficherTableau() {
  const toutes = collectionAffichee ? collectionAffichee.map(c => ({ ...c })) : regrouperParNom(derniereCollection);
  const doublons = toutes.filter(c => c.quantite >= 2);
  const enTrop = doublons.reduce((total, c) => total + (c.quantite - 1), 0);
  const animees = toutes.filter(c => c.animee);

  // Corrigé en 1.3 : « seulement les cartes animées » montre TOUTES tes cartes animées,
  // pas seulement celles qui sont en double.
  let liste = afficherTout || seulementAnimees ? toutes : doublons;
  if (seulementAnimees) liste = liste.filter(c => c.animee);
  trierCartes(liste, modeTri);

  const zone = document.getElementById("wmd-resultats");
  zone.replaceChildren(); // vide la zone

  const resume = creer("p", `${toutes.length} cartes différentes, ${doublons.length} en double ou plus, `
    + `${enTrop} exemplaire(s) en trop à échanger, ${animees.length} carte(s) animée(s).`);
  resume.id = "wmd-resume";
  zone.appendChild(resume);

  // Nouveau en 1.3 : les blocs « Statistiques » et « Depuis ta dernière lecture »,
  // seulement si leur fonction est cochée dans les réglages.
  const statistiques = blocStatistiques(toutes);
  if (statistiques) zone.appendChild(statistiques);
  const historique = blocHistorique();
  if (historique) zone.appendChild(historique);

  // Les deux cases à cocher : toute la collection, et seulement les cartes animées.
  const caseTout = creerCaseACocher("wmd-tout", "Afficher toute la collection", afficherTout, coche => {
    afficherTout = coche;
    afficherTableau();
  });
  const caseAnimees = creerCaseACocher("wmd-animees", "Seulement les cartes animées (de toute la collection)", seulementAnimees, coche => {
    seulementAnimees = coche;
    afficherTableau();
  });

  // Le tableau : cliquer sur un titre de colonne change le tri.
  const tableau = creer("table");
  tableau.id = "wmd-tableau";
  const ligneTitres = tableau.createTHead().insertRow();
  const colonnes = [["Carte", "nom"], ["Rareté", "rarete"], ["Qté", "quantite"], ["En trop", null], ["Animée", "animee"]];
  for (const [texte, tri] of colonnes) {
    const titre = creer("th", texte);
    if (tri) {
      titre.dataset.tri = tri;
      titre.addEventListener("click", () => {
        modeTri = tri;
        afficherTableau();
      });
    }
    ligneTitres.appendChild(titre);
  }
  const corps = tableau.createTBody();
  for (const carte of liste) {
    const ligne = corps.insertRow();
    ligne.className = `wmd-${carte.rarete}` + (carte.animee ? " wmd-animee" : "");
    // 1.11 : le nom est cliquable (trouver la carte dans ma collection, au Marché ou dans « Toutes les cartes »).
    ligne.insertCell().appendChild(lienCarte(carte.nom, carte.rarete));
    const valeurs = [lettreRarete(carte.rarete), carte.quantite, carte.quantite - 1, carte.animee ? "✨" : ""];
    for (const valeur of valeurs) {
      ligne.insertCell().textContent = valeur;
    }
  }
  if (liste.length === 0) { // un tableau vide mérite une explication
    const cellule = corps.insertRow().insertCell();
    cellule.colSpan = colonnes.length;
    cellule.textContent = seulementAnimees ? "Aucune carte animée." : "Aucun doublon.";
  }

  zone.append(caseTout, creer("br"), caseAnimees, tableau);
  const exemplaires = toutes.reduce((total, c) => total + c.quantite, 0);
  if (collectionAffichee && dateCollectionAffichee) {
    resume.textContent = `Ta lecture du ${dateLisible(dateCollectionAffichee)} : ` + resume.textContent;
    afficherStatut(`Ta collection en mémoire (lecture du ${dateLisible(dateCollectionAffichee)}, cartes des paquets ouverts depuis comprises) : `
      + `${exemplaires} carte(s). Clique sur un nom pour la trouver.`);
  } else {
    afficherStatut(`Collection lue : ${derniereCollection.length} carte(s) au total.`);
  }
  memoriserVue("collection", { afficherTout: afficherTout, seulementAnimees: seulementAnimees, modeTri: modeTri }); // 1.15
}


// ---------------------------------------------------------------------
//  PARTIE 8 : LES STATISTIQUES PAR RARETÉ (nouveau en 1.3)
// ---------------------------------------------------------------------

// Pour chaque rareté : nombre d'exemplaires, de cartes différentes, de cartes en double.
function statistiquesParRarete(liste) {
  const stats = {};
  for (const rarete of Object.keys(RARETES)) {
    stats[rarete] = { exemplaires: 0, differentes: 0, enDouble: 0 };
  }
  for (const carte of liste) {
    const ligne = stats[carte.rarete];
    if (!ligne) continue; // rareté inconnue
    ligne.exemplaires += carte.quantite;
    ligne.differentes += 1;
    if (carte.quantite >= 2) ligne.enDouble += 1;
  }
  return stats;
}

function blocStatistiques(toutes) {
  if (!reglages.statistiques) return null;
  const bloc = creer("div", undefined, "wmd-bloc");
  bloc.id = "wmd-stats";
  bloc.appendChild(creer("h4", "Statistiques"));

  const stats = statistiquesParRarete(toutes);
  // Le pourcentage du jeu demande les totaux lus sur « Toutes les cartes » (fonction « cartes manquantes »).
  const totaux = reglages.manquantes && catalogue ? catalogue.totaux : null;
  const titres = ["Rareté", "Exemplaires", "Différentes", "En double"];
  if (totaux) titres.push("% du jeu");

  const lignes = [];
  const somme = { exemplaires: 0, differentes: 0, enDouble: 0 };
  for (const [rarete, ligne] of Object.entries(stats)) {
    const valeurs = [RARETES[rarete].lettre, ligne.exemplaires, ligne.differentes, ligne.enDouble];
    if (totaux) valeurs.push(totaux[rarete] ? nombreLisible(ligne.differentes / totaux[rarete] * 100, 2) + " %" : "");
    lignes.push({ valeurs: valeurs, classe: `wmd-${rarete}` });
    somme.exemplaires += ligne.exemplaires;
    somme.differentes += ligne.differentes;
    somme.enDouble += ligne.enDouble;
  }
  const total = ["Total", somme.exemplaires, somme.differentes, somme.enDouble];
  if (totaux) total.push("");
  lignes.push({ valeurs: total, classe: "wmd-total" });
  bloc.appendChild(creerTableau(titres, lignes));

  const animees = toutes.filter(c => c.animee);
  const exemplairesAnimes = animees.reduce((total, c) => total + c.quantite, 0);
  bloc.appendChild(creer("p", `✨ Cartes animées : ${animees.length} différente(s), ${exemplairesAnimes} exemplaire(s).`));
  if (reglages.manquantes && !catalogue) {
    bloc.appendChild(creer("p", "Passe une fois sur la page « Toutes les cartes » du site pour voir ton pourcentage par rareté.", "wmd-discret"));
  }
  return bloc;
}


// ---------------------------------------------------------------------
//  PARTIE 9 : L'HISTORIQUE DE TA COLLECTION (nouveau en 1.3)
// ---------------------------------------------------------------------

let derniereComparaison = null; // ce qui a changé depuis la lecture précédente
let lectureEnAttente = null;    // une lecture refusée, qu'on peut enregistrer quand même

// Garde la lecture en mémoire (dans le navigateur, nulle part ailleurs) et la compare à la précédente.
// Renvoie "" si tout va bien, ou un avertissement.
async function enregistrerLecture(liste, forcer = false) {
  const { collection: precedente } = await api.storage.local.get("collection");

  // Sécurité : beaucoup moins de cartes qu'avant, c'est sans doute un filtre que le script n'a pas vu.
  if (precedente && !forcer && liste.length < precedente.cartes.length / 2) {
    lectureEnAttente = liste;
    return `Cette lecture a beaucoup moins de cartes que la précédente (${liste.length} contre ${precedente.cartes.length}) : `
      + "un filtre est sans doute actif. Elle n'est pas gardée en mémoire.";
  }
  lectureEnAttente = null;

  // Format compact pour prendre peu de place : [nom, rareté, quantité, animée (1 ou 0)].
  const date = Date.now();
  const cartes = liste.map(c => [c.nom, c.rarete, c.quantite, c.animee ? 1 : 0]);
  await api.storage.local.set({ collection: { date: date, cartes: cartes } });

  if (reglages.historique) {
    derniereComparaison = precedente
      ? { date: precedente.date, ...comparerLectures(precedente, liste) }
      : { date: null }; // première lecture : rien à comparer
    // 1.15 : gardée en mémoire avec la lecture, pour la réafficher après un changement de page.
    await api.storage.local.set({ comparaison: { lecture: date, date: derniereComparaison.date,
      nouvelles: (derniereComparaison.nouvelles || []).slice(0, 2000),
      enPlus: (derniereComparaison.enPlus || []).length, enMoins: derniereComparaison.enMoins || 0 } });
    const { historique = [] } = await api.storage.local.get("historique");
    historique.push({
      date: date,
      exemplaires: liste.reduce((total, c) => total + c.quantite, 0),
      differentes: liste.length,
      doublons: liste.filter(c => c.quantite >= 2).length,
      animees: liste.filter(c => c.animee).length,
      nouvelles: precedente ? derniereComparaison.nouvelles.length : null
    });
    await api.storage.local.set({ historique: historique.slice(-CONFIG.lecturesGardees) });
  }
  return "";
}

// Compare deux lectures : les cartes nouvelles, celles qui ont plus d'exemplaires, celles qui sont parties.
function comparerLectures(precedente, liste) {
  const avant = new Map(precedente.cartes.map(([nom, rarete, quantite]) => [nom, quantite]));
  const maintenant = new Set(liste.map(c => c.nom));
  const nouvelles = liste.filter(c => !avant.has(c.nom));
  const enPlus = liste.filter(c => avant.has(c.nom) && c.quantite > avant.get(c.nom));
  let enMoins = 0;
  for (const nom of avant.keys()) {
    if (!maintenant.has(nom)) enMoins++;
  }
  return { nouvelles: nouvelles, enPlus: enPlus, enMoins: enMoins };
}

function blocHistorique() {
  if (!reglages.historique) return null;
  const bloc = creer("div", undefined, "wmd-bloc");
  bloc.id = "wmd-historique";
  bloc.appendChild(creer("h4", "Depuis ta dernière lecture"));

  if (lectureEnAttente) {
    bloc.appendChild(creer("p", "Cette lecture n'est pas gardée en mémoire. Si tu as vraiment vendu ou échangé beaucoup de cartes :"));
    const bouton = creer("button", "Garder quand même cette lecture");
    bouton.id = "wmd-forcer";
    bouton.addEventListener("click", async () => {
      await enregistrerLecture(lectureEnAttente, true);
      afficherTableau();
      afficherStatut("Lecture gardée en mémoire.");
    });
    bloc.appendChild(bouton);
    return bloc;
  }
  if (!derniereComparaison) return null; // lecture partielle ou filtrée : rien à comparer
  if (derniereComparaison.date === null) {
    bloc.appendChild(creer("p", "Première lecture gardée en mémoire. La prochaine fois, tu verras ici tes nouvelles cartes."));
    return bloc;
  }

  const { date, nouvelles, enPlus, enMoins } = derniereComparaison;
  const nombreEnPlus = Array.isArray(enPlus) ? enPlus.length : Number(enPlus) || 0; // 1.15 : un nombre quand elle vient de la mémoire
  bloc.appendChild(creer("p", `Depuis le ${dateLisible(date)} : ${nouvelles.length} nouvelle(s) carte(s), `
    + `${nombreEnPlus} carte(s) avec des exemplaires en plus, ${enMoins} carte(s) en moins.`));
  const triees = [...nouvelles];
  trierCartes(triees, "rarete"); // les plus rares d'abord
  if (triees.length) bloc.appendChild(creerListeDeCartes(triees, CONFIG.nouvellesAffichees));
  return bloc;
}


// ---------------------------------------------------------------------
//  PARTIE 10 : LES CARTES MANQUANTES (nouveau en 1.3)
// ---------------------------------------------------------------------

let derniereListeManquantes = []; // pour l'export CSV

// Sur « Toutes les cartes », le site affiche le nombre de cartes du jeu par rareté : « L: 1634 », etc.
// Renvoie { legendaire: 1634, ... }, ou null si les 6 nombres ne sont pas tous affichés.
function lireTotauxDuJeu() {
  const totaux = {};
  for (const element of document.querySelectorAll("main span")) {
    if (element.children.length > 0 || estDansLePanneau(element)) continue;
    const trouve = element.textContent.trim().match(/^(L|UR|SR|R|PC|C)\s*:$/);
    const suivant = element.nextElementSibling;
    if (!trouve || !suivant) continue;
    const nombre = parseInt(suivant.textContent.replace(/\D/g, ""), 10); // « 11 279 » → 11279
    if (nombre > 0) totaux[rareteDepuisLettre(trouve[1])] = nombre;
  }
  return Object.keys(totaux).length === 6 ? totaux : null;
}

// Toutes les 5 secondes, sur « Toutes les cartes » : on garde les totaux en mémoire s'ils ont changé.
let derniersTotaux = "";
function surveillerTotaux() {
  if (pageActuelle() !== "toutes-les-cartes" || !reglages.manquantes) return;
  const totaux = lireTotauxDuJeu();
  if (!totaux || JSON.stringify(totaux) === derniersTotaux) return;
  derniersTotaux = JSON.stringify(totaux);
  api.storage.local.set({ catalogue: { totaux: totaux, lu: Date.now() } });
}

// Ta dernière lecture complète, gardée en mémoire : [{ nom, rarete, quantite, animee }], ou null.
async function collectionEnMemoire() {
  const { collection } = await api.storage.local.get("collection");
  if (!collection) return null;
  return collection.cartes.map(([nom, rarete, quantite, animee]) =>
    ({ nom: nom, rarete: rarete, quantite: quantite, animee: animee === 1 }));
}

// Nouveau en 1.8 : le nombre maximum de pages se règle dans les réglages (300 par défaut).
function pagesMax() {
  const n = Number(reglages.pagesMax);
  return n >= 10 && n <= 20000 ? n : REGLAGES_PAR_DEFAUT.pagesMax;
}

async function trouverMesCartesManquantes(reprendre = false) {
  if (enCours) return;
  const page = lirePagination();
  if (pageActuelle() !== "toutes-les-cartes" || !page) {
    afficherStatut("Va d'abord sur la page « Toutes les cartes ».");
    return;
  }
  const moi = await collectionEnMemoire();
  if (!moi) {
    afficherStatut("Lis d'abord toute ta collection, sans filtre : page Collection, bouton « Trouver mes doublons ».");
    return;
  }
  // Le jeu compte des millions de cartes : on exige un filtre de rareté (L ou UR).
  if (page.total > pagesMax()) {
    afficherStatut(`Cette liste fait ${nombreLisible(page.total)} pages (maximum réglé : ${nombreLisible(pagesMax())}) : `
      + `choisis d'abord une rareté avec les filtres du site (L ou UR), puis reclique.`);
    return;
  }

  enCours = true;
  const { cartes, message, complet } = await lireToutesLesPages("manquantes", { reprendre: reprendre });
  const mesNoms = new Set(moi.map(c => c.nom));
  const liste = regrouperParNom(cartes);
  derniereListeManquantes = liste.filter(c => !mesNoms.has(c.nom));
  trierCartes(derniereListeManquantes, "rarete");
  // 1.15 : le résultat est gardé en mémoire (« 📋 Mes listes », et retour après un changement de page).
  const memo = { date: Date.now(), complet: Boolean(complet), lues: liste.length, resume: resumeManquantes(liste, mesNoms),
    cartes: derniereListeManquantes.slice(0, 20000).map(c => [c.nom, c.rarete]) };
  await api.storage.local.set({ manquantes: memo }).catch(() => {});
  afficherManquantes(memo);
  afficherStatut(message || `${derniereListeManquantes.length} carte(s) manquante(s) sur ${liste.length}.`);
}

// Une phrase par rareté présente dans la liste lue : [{ rarete, texte }].
function resumeManquantes(liste, mesNoms) {
  const phrases = [];
  for (const rarete of Object.keys(RARETES)) {
    const deCetteRarete = liste.filter(c => c.rarete === rarete);
    if (deCetteRarete.length === 0) continue;
    const possedees = deCetteRarete.filter(c => mesNoms.has(c.nom)).length;
    const pourcentage = nombreLisible(possedees / deCetteRarete.length * 100, 1);
    phrases.push({ rarete: rarete, texte: `${RARETES[rarete].nom} : ${deCetteRarete.length} carte(s) dans cette liste, `
      + `tu en as ${possedees} (${pourcentage} %), il t'en manque ${deCetteRarete.length - possedees}.` });
  }
  return phrases;
}

// 1.15 : la dernière recherche de cartes manquantes, gardée en mémoire.
async function afficherManquantesMemoire() {
  const { manquantes: memo } = await api.storage.local.get("manquantes");
  if (!memo) {
    const zone = document.getElementById("wmd-resultats");
    if (zone) zone.replaceChildren(creer("p", "Aucune recherche de cartes manquantes en mémoire : sur « Toutes les cartes », "
      + "choisis une rareté puis clique sur « Trouver mes cartes manquantes ».", "wmd-discret"));
    return;
  }
  derniereListeManquantes = memo.cartes.map(([nom, rarete]) => ({ nom: nom, rarete: rarete }));
  afficherManquantes(memo);
  afficherStatut(`${memo.cartes.length} carte(s) manquante(s) (recherche du ${dateLisible(memo.date)}).`);
}

function afficherManquantes(memo) {
  const zone = document.getElementById("wmd-resultats");
  zone.replaceChildren();
  zone.appendChild(creer("h4", "Cartes manquantes"));
  zone.appendChild(creer("div", `Recherche du ${dateLisible(memo.date)}` + (memo.complet ? "." : " (lecture incomplète)."), "wmd-discret"));
  for (const { rarete, texte } of memo.resume || []) zone.appendChild(creer("p", texte, `wmd-${rarete}`));

  if (derniereListeManquantes.length) {
    const bouton = creer("button", "Exporter les cartes manquantes (CSV)");
    bouton.id = "wmd-csv-manquantes";
    bouton.addEventListener("click", () => exporterManquantes());
    zone.appendChild(bouton);
  }
  const lignes = derniereListeManquantes.map(c => ({ valeurs: [lienCarte(c.nom, c.rarete, { catalogue: true }), lettreRarete(c.rarete)], classe: `wmd-${c.rarete}` }));
  zone.appendChild(creerTableau(["Carte manquante", "Rareté"], lignes));
  memoriserVue("manquantes"); // 1.15
}


// ---------------------------------------------------------------------
//  PARTIE 10 BIS : LES CARTES ANIMÉES DE TOUT LE JEU (nouveau en 1.8)
//  Sur « Toutes les cartes », le bouton « Trouver les cartes animées du jeu » lit la liste
//  affichée page par page (comme pour les cartes manquantes) et retient les cartes dont
//  l'image bouge. Seules les images GIF sont téléchargées pour être vérifiées.
//  Les résultats s'ajoutent d'une recherche à l'autre : les Légendaires aujourd'hui, les
//  Ultra rares demain... Ils restent dans ton navigateur (mémoire « animeesJeu »).
// ---------------------------------------------------------------------

let aDesAnimeesJeu = false;          // le bouton « Revoir » n'apparaît que s'il y a des résultats
let seulementAnimeesManquantes = false;
api.storage.local.get("animeesJeu").then(({ animeesJeu }) => {
  aDesAnimeesJeu = Boolean(animeesJeu && animeesJeu.cartes.length);
}).catch(() => {});
api.storage.onChanged.addListener(changements => {
  if (changements.animeesJeu) {
    const memo = changements.animeesJeu.newValue;
    aDesAnimeesJeu = Boolean(memo && memo.cartes.length);
  }
});

async function trouverCartesAnimees(reprendre = false) {
  if (enCours) return;
  const page = lirePagination();
  if (pageActuelle() !== "toutes-les-cartes" || !page) {
    afficherStatut("Va d'abord sur la page « Toutes les cartes ».");
    return;
  }
  if (page.total > pagesMax()) {
    afficherStatut(`Cette liste fait ${nombreLisible(page.total)} pages (maximum réglé : ${nombreLisible(pagesMax())}) : `
      + "choisis d'abord une rareté avec les filtres du site (L, UR, SR…), puis reclique. "
      + "Tu peux aussi augmenter le maximum dans les réglages (la lecture sera longue).");
    return;
  }
  enCours = true;
  afficherStatut("Recherche des cartes animées…");
  // On ne garde que les cartes animées, et celles dont l'image n'a pas pu être vérifiée (animee = null).
  const { cartes, message, complet } = await lireToutesLesPages("animees", {
    reprendre: reprendre, garder: carte => carte.animee !== false });

  // Les images qui n'ont pas pu être vérifiées pendant la lecture : un dernier essai, plus lent.
  let nonVerifiees = 0;
  const aRevoir = cartes.filter(carte => carte.animee === null && carte.image);
  for (let i = 0; i < aRevoir.length; i++) {
    afficherStatut(`Dernière vérification des images : ${i + 1} / ${aRevoir.length}…`);
    await pause(500);
    aRevoir[i].animee = await imageBouge(aRevoir[i].image);
    if (aRevoir[i].animee === null) nonVerifiees++;
  }

  const animees = cartes.filter(carte => carte.animee === true);
  await enregistrerAnimeesJeu(animees, complet);
  await afficherAnimeesJeu();
  afficherStatut((message ? message + " " : "")
    + `${animees.length} carte(s) animée(s) trouvée(s) sur ${nombreLisible(lecture.lues)} carte(s) lue(s).`
    + (nonVerifiees ? ` ${nonVerifiees} image(s) n'ont pas pu être vérifiées (relance la recherche plus tard).` : ""));
}

// Ajoute les cartes animées trouvées à celles déjà connues. Une rareté lue EN ENTIER remplace
// ce qu'on savait de cette rareté (une carte dont l'image ne bouge plus disparaît de la liste).
async function enregistrerAnimeesJeu(animees, complet) {
  const { animeesJeu: memo = { cartes: [], parcours: {} } } = await api.storage.local.get("animeesJeu");
  const parCle = new Map(memo.cartes.map(([nom, rarete]) => [`${nom}|${rarete}`, [nom, rarete]]));
  const rarete = lecture.rarete;
  if (complet && rarete) {
    for (const [cle, [, r]] of parCle) if (r === rarete) parCle.delete(cle);
  }
  for (const carte of animees) parCle.set(`${carte.nom}|${carte.rarete}`, [carte.nom, carte.rarete]);
  const parcours = { ...memo.parcours };
  parcours[rarete || "toutes"] = { date: Date.now(), complet: complet, pages: lecture.pages.size,
    total: lecture.total || 0, lues: lecture.lues, animees: animees.length };
  await api.storage.local.set({ animeesJeu: { cartes: [...parCle.values()], parcours: parcours, maj: Date.now() } });
}

async function afficherAnimeesJeu() {
  const { animeesJeu: memo } = await api.storage.local.get("animeesJeu");
  const zone = document.getElementById("wmd-resultats");
  zone.replaceChildren();
  zone.appendChild(creer("h4", "✨ Cartes animées du jeu"));
  if (!memo || memo.cartes.length === 0) {
    zone.appendChild(creer("p", "Aucune carte animée trouvée pour l'instant. Sur « Toutes les cartes », choisis une rareté "
      + "avec les filtres du site, puis clique sur « Trouver les cartes animées du jeu ».", "wmd-discret"));
    return;
  }
  // Tes cartes (dernière lecture), pour savoir lesquelles tu as déjà, et dans quelle rareté.
  const moi = (await maCollection()) || [];
  const mesRaretes = new Map();
  for (const carte of moi) {
    if (!mesRaretes.has(carte.nom)) mesRaretes.set(carte.nom, []);
    mesRaretes.get(carte.nom).push(lettreRarete(carte.rarete));
  }
  const cartes = memo.cartes.map(([nom, rarete]) => ({ nom: nom, rarete: rarete, aMoi: mesRaretes.get(nom) || null }));
  trierCartes(cartes, "rarete");
  const possedees = cartes.filter(carte => carte.aMoi).length;

  const bloc = creer("div", undefined, "wmd-bloc");
  bloc.appendChild(creer("b", `${cartes.length} carte(s) animée(s) connue(s)`
    + (moi.length ? `, tu en as ${possedees}, il t'en manque ${cartes.length - possedees}.` : ".")));
  if (!moi.length) bloc.appendChild(creer("div", "Lis ta collection (« Trouver mes doublons ») pour savoir lesquelles tu as.", "wmd-discret"));
  // Ce qui a été parcouru, rareté par rareté.
  for (const cle of [...Object.keys(RARETES), "toutes"]) {
    const p = memo.parcours[cle];
    if (!p) continue;
    const nom = cle === "toutes" ? "Sans filtre de rareté" : RARETES[cle].nom;
    bloc.appendChild(creer("div", `${nom} : ${p.animees} animée(s) sur ${nombreLisible(p.lues)} carte(s) lue(s), `
      + (p.complet ? "liste lue en entier" : `lecture partielle (${p.pages} / ${p.total} pages)`) + `, le ${dateLisible(p.date)}.`,
      cle === "toutes" ? "wmd-discret" : `wmd-${cle}`));
  }
  zone.appendChild(bloc);

  const caseManquantes = creerCaseACocher("wmd-animees-manquantes", "Seulement celles que je n'ai pas", seulementAnimeesManquantes, coche => {
    seulementAnimeesManquantes = coche;
    afficherAnimeesJeu();
  });
  const exporter = creer("button", "Exporter les cartes animées (CSV)");
  exporter.id = "wmd-csv-animees";
  exporter.addEventListener("click", () => exporterAnimeesJeu(cartes));
  zone.append(caseManquantes, exporter);

  const liste = seulementAnimeesManquantes ? cartes.filter(carte => !carte.aMoi) : cartes;
  zone.appendChild(creerTableau(["Carte animée", "Rar.", "À moi"], liste.map(carte => ({
    classe: `wmd-${carte.rarete} wmd-animee`,
    valeurs: [lienCarte(carte.nom, carte.rarete, { catalogue: true }), lettreRarete(carte.rarete), carte.aMoi ? "✓ " + carte.aMoi.join(", ") : "—"]
  }))));
  afficherStatut(`${cartes.length} carte(s) animée(s) connue(s) dans le jeu.`);
  memoriserVue("animees-jeu", { seulementManquantes: seulementAnimeesManquantes }); // 1.15
}

function exporterAnimeesJeu(cartes) {
  const lignes = ["Carte;Rareté;À moi"];
  for (const carte of cartes) {
    lignes.push(`${champCSV(carte.nom)};${lettreRarete(carte.rarete)};${carte.aMoi ? carte.aMoi.join(" ") : "non"}`);
  }
  telechargerFichier("cartes-animees-wikimasters.csv", MARQUE_EXCEL + lignes.join("\r\n"), "text/csv;charset=utf-8");
  afficherStatut("Fichier CSV des cartes animées téléchargé.");
}


// ---------------------------------------------------------------------
//  PARTIE 11 : L'AIDE AUX ÉCHANGES (nouveau en 1.3)
// ---------------------------------------------------------------------

let derniereProposition = null; // { jeDonne, ilDonne } après la comparaison avec un ami

// Ta collection : celle lue tout à l'heure, sinon la dernière lecture gardée en mémoire.
async function maCollection() {
  if (derniereCollection.length > 0) return regrouperParNom(derniereCollection);
  return collectionEnMemoire();
}

// Une ligne de texte par carte, prête pour Discord.
function ligneDiscord(carte, avecQuantite) {
  const quantite = avecQuantite ? ` : ${carte.quantite - 1} à échanger` : "";
  return `• ${carte.nom} (${lettreRarete(carte.rarete)})${quantite}${carte.animee ? " ✨" : ""}`;
}

// Assemble des lignes sans dépasser "limite" caractères. Renvoie { texte, coupees }.
function texteLimite(lignes, limite) {
  let texte = "";
  for (let i = 0; i < lignes.length; i++) {
    const suite = texte ? texte + "\n" + lignes[i] : lignes[i];
    if (suite.length > limite - 40) { // on garde la place de la dernière ligne
      const coupees = lignes.slice(i).filter(ligne => ligne.startsWith("•")).length;
      return { texte: `${texte}\n… et ${coupees} autre(s) carte(s)`, coupees: coupees };
    }
    texte = suite;
  }
  return { texte: texte, coupees: 0 };
}

// Copie un texte dans le presse-papiers. Renvoie true si ça a marché.
async function copier(texte) {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch (erreur) {
    // Plan B : l'ancienne méthode, avec une zone de texte cachée.
    const zone = creer("textarea");
    zone.value = texte;
    document.body.appendChild(zone);
    zone.select();
    const reussi = document.execCommand("copy");
    zone.remove();
    return reussi;
  }
}

// Si la copie a échoué, on montre le texte pour que tu le copies toi-même (Ctrl + A puis Ctrl + C).
async function copierOuMontrer(texte) {
  if (await copier(texte)) return true;
  const zone = document.getElementById("wmd-echange");
  const champ = creer("textarea");
  champ.value = texte;
  champ.rows = 6;
  zone.replaceChildren(creer("p", "Copie impossible : sélectionne ce texte et copie-le toi-même."), champ);
  return false;
}

async function copierDoublons() {
  const liste = await maCollection();
  if (!liste) {
    afficherStatut("Clique d'abord sur « Trouver mes doublons ».");
    return;
  }
  const doublons = liste.filter(c => c.quantite >= 2);
  if (doublons.length === 0) {
    afficherStatut("Aucun doublon à copier.");
    return;
  }
  trierCartes(doublons, "rarete"); // les plus rares d'abord
  const lignes = [`**Mes doublons WikiMasters** (${doublons.length} cartes)`];
  for (const carte of doublons) lignes.push(ligneDiscord(carte, true));
  const { texte, coupees } = texteLimite(lignes, CONFIG.limiteDiscord);
  if (!(await copierOuMontrer(texte))) return;
  afficherStatut(coupees
    ? `Copié : les ${doublons.length - coupees} doublons les plus rares (un message Discord est limité à 2 000 caractères).`
    : `Copié : ${doublons.length} doublons. Colle-les dans Discord avec Ctrl + V.`);
}

function choisirFichierAmi() {
  document.getElementById("wmd-fichier-ami").click();
}

// Compare ta collection au fichier JSON exporté par un ami (bouton « Exporter en JSON »).
async function comparerAvecAmi(fichier) {
  const moi = await maCollection();
  if (!moi) {
    afficherStatut("Clique d'abord sur « Trouver mes doublons ».");
    return;
  }
  let ami;
  try {
    const lu = JSON.parse(await fichier.text());
    if (!Array.isArray(lu) || !lu.every(c => c && typeof c.nom === "string" && Number.isInteger(c.quantite))) {
      throw new Error("format inconnu");
    }
    ami = regrouperParNom(lu.map(c => ({ nom: c.nom, rarete: c.rarete in RARETES ? c.rarete : "inconnue",
      quantite: c.quantite, animee: c.animee === true })));
  } catch (erreur) {
    afficherStatut("Ce fichier n'est pas un export JSON de WikiMasters Doublons.");
    return;
  }
  const nomsAmi = new Set(ami.map(c => c.nom));
  const mesNoms = new Set(moi.map(c => c.nom));
  const jeDonne = moi.filter(c => c.quantite >= 2 && !nomsAmi.has(c.nom)); // mes doublons qu'il n'a pas
  const ilDonne = ami.filter(c => c.quantite >= 2 && !mesNoms.has(c.nom)); // ses doublons que je n'ai pas
  trierCartes(jeDonne, "rarete");
  trierCartes(ilDonne, "rarete");
  derniereProposition = { jeDonne: jeDonne, ilDonne: ilDonne };
  afficherEchange();
  afficherStatut(`Comparaison faite avec « ${fichier.name} ».`);
}

function afficherEchange() {
  const { jeDonne, ilDonne } = derniereProposition;
  const zone = document.getElementById("wmd-echange");
  const copierBouton = creer("button", "Copier la proposition pour Discord");
  copierBouton.id = "wmd-copier-proposition";
  copierBouton.addEventListener("click", () => copierProposition());
  const fermer = creer("button", "Fermer la comparaison");
  fermer.addEventListener("click", () => zone.replaceChildren());

  zone.replaceChildren(
    creer("h4", "Échange avec ton ami"),
    creer("p", `Tu peux lui donner ${jeDonne.length} carte(s) : tes doublons qu'il n'a pas.`),
    creerListeDeCartes(jeDonne, 100),
    creer("p", `Il peut te donner ${ilDonne.length} carte(s) : ses doublons que tu n'as pas.`),
    creerListeDeCartes(ilDonne, 100),
    copierBouton,
    fermer
  );
  zone.className = "wmd-bloc";
}

async function copierProposition() {
  const { jeDonne, ilDonne } = derniereProposition;
  // Chaque moitié du message a droit à la moitié de la limite de Discord.
  const moitie = Math.floor((CONFIG.limiteDiscord - 60) / 2);
  const partie1 = texteLimite([`**Je peux te donner (${jeDonne.length}) :**`, ...jeDonne.map(c => ligneDiscord(c, false))], moitie);
  const partie2 = texteLimite([`**Tu peux me donner (${ilDonne.length}) :**`, ...ilDonne.map(c => ligneDiscord(c, false))], moitie);
  const texte = `**Proposition d'échange WikiMasters**\n${partie1.texte}\n\n${partie2.texte}`;
  if (await copierOuMontrer(texte)) afficherStatut("Proposition copiée : colle-la dans Discord avec Ctrl + V.");
}


// ---------------------------------------------------------------------
//  PARTIE 12 : EXPORTER (CSV pour Excel, JSON pour le programme C# ou un ami)
// ---------------------------------------------------------------------

// Un caractère invisible (le n° 0xFEFF) placé au début permet à Excel d'afficher correctement les accents.
const MARQUE_EXCEL = String.fromCharCode(0xFEFF);

function telechargerFichier(nomFichier, contenu, typeFichier) {
  const blob = new Blob([contenu], { type: typeFichier });
  const adresse = URL.createObjectURL(blob);
  const lien = creer("a");
  lien.href = adresse;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(adresse), 1000);
}

// Met un texte entre guillemets pour le CSV (et double les guillemets qu'il contient).
function champCSV(texte) {
  return `"${String(texte).replace(/"/g, '""')}"`;
}

async function exporterCSV() {
  const liste = await maCollection();
  if (!liste) {
    afficherStatut("Clique d'abord sur « Trouver mes doublons ».");
    return;
  }
  trierCartes(liste, modeTri);
  const lignes = ["Carte;Rareté;Quantité;En trop;Animée"];
  for (const carte of liste) {
    lignes.push(`${champCSV(carte.nom)};${lettreRarete(carte.rarete)};${carte.quantite};${carte.quantite - 1};${carte.animee ? "oui" : "non"}`);
  }
  telechargerFichier("collection-wikimasters.csv", MARQUE_EXCEL + lignes.join("\r\n"), "text/csv;charset=utf-8");
  afficherStatut("Fichier CSV téléchargé.");
}

async function exporterJSON() {
  const liste = await maCollection();
  if (!liste) {
    afficherStatut("Clique d'abord sur « Trouver mes doublons ».");
    return;
  }
  telechargerFichier("collection-wikimasters.json", JSON.stringify(liste, null, 2), "application/json");
  afficherStatut("Fichier JSON téléchargé.");
}

function exporterManquantes() {
  const lignes = ["Carte;Rareté"];
  for (const carte of derniereListeManquantes) {
    lignes.push(`${champCSV(carte.nom)};${lettreRarete(carte.rarete)}`);
  }
  telechargerFichier("cartes-manquantes-wikimasters.csv", MARQUE_EXCEL + lignes.join("\r\n"), "text/csv;charset=utf-8");
  afficherStatut("Fichier CSV des cartes manquantes téléchargé.");
}


// ---------------------------------------------------------------------
//  PARTIE 13 : SURVEILLER LE STOCK DE PAQUETS (badge et notifications)
// ---------------------------------------------------------------------

// Lit le stock sur la page Paquets : « 2 / 10 » et « Prochain dans 9:32 ».
// Renvoie { stock: 2, max: 10, secondes: 572 }, ou null si le stock n'est pas affiché.
function lireStockPaquets() {
  let stock = null, max = null, secondes = null;
  // 1.13 : test rapide d'abord. Sans « paquets disponibles » dans la page, il n'y a pas de stock à lire,
  // inutile de passer chaque élément en revue (c'était la vérification la plus coûteuse sur les autres pages).
  const principal = document.querySelector("main");
  if (!principal || !/paquets? disponibles?/i.test(principal.textContent)) return null;
  for (const element of principal.querySelectorAll("*")) {
    if (element.children.length > 3 || estDansLePanneau(element)) continue;
    const texte = element.textContent.replace(/\s+/g, " ").trim();

    // Le compteur « 2 / 10 », juste à côté du texte « paquets disponibles ».
    const compteur = texte.match(/^(\d+) ?\/ ?(\d+)$/);
    if (compteur && stock === null && /paquets? disponibles?/i.test(element.parentElement.textContent)) {
      stock = parseInt(compteur[1], 10);
      max = parseInt(compteur[2], 10);
    }

    // Le minuteur « Prochain dans 9:32 » (ou 1:09:32 s'il y a des heures).
    const minuteur = texte.match(/^Prochain dans (?:(\d+):)?(\d+):(\d{2})$/i);
    if (minuteur && secondes === null) {
      secondes = parseInt(minuteur[1] || "0", 10) * 3600 + parseInt(minuteur[2], 10) * 60 + parseInt(minuteur[3], 10);
    }
  }
  if (stock === null) return null;
  return { stock: stock, max: max, secondes: secondes };
}

// Calcule l'heure (en millisecondes) à laquelle le stock sera plein.
// Le prochain paquet arrive dans "secondes", puis un paquet toutes les X minutes (réglage).
function heureStockPlein(lecture) {
  const paquetsManquants = lecture.max - lecture.stock;
  return Date.now() + lecture.secondes * 1000 + (paquetsManquants - 1) * reglages.minutesParPaquet * 60 * 1000;
}

// Toutes les 5 secondes : si le stock a changé, on prévient background.js.
let dernierEnvoi = null; // { plein, pleinA } envoyé la dernière fois
function surveillerPaquets() {
  const lecture = lireStockPaquets();
  if (!lecture) return; // on n'est pas sur la page Paquets (ou un paquet est en cours d'ouverture)
  const plein = lecture.stock >= lecture.max;
  if (!plein && lecture.secondes === null) return; // minuteur pas encore affiché
  const pleinA = plein ? null : heureStockPlein(lecture);

  const aChange = dernierEnvoi === null
    || plein !== dernierEnvoi.plein
    || (!plein && Math.abs(pleinA - dernierEnvoi.pleinA) > 60 * 1000); // plus d'une minute d'écart
  if (!aChange) return;

  dernierEnvoi = { plein: plein, pleinA: pleinA };
  api.runtime.sendMessage({ type: "etat-paquets", plein: plein, pleinA: pleinA, max: lecture.max }).catch(() => {});
}


// ---------------------------------------------------------------------
//  PARTIE 13 BIS : LE MARCHÉ (nouveau en 1.4)
//  Quand tu es sur la page Marché, l'extension relève les annonces qui
//  affichent une « MISE ACTUELLE » (jamais la « MISE DE DÉPART », qui n'est
//  que le prix demandé par le vendeur). Avec ces prix, elle estime la valeur
//  de tes propres cartes. Elle ne mise JAMAIS et ne clique sur aucune enchère.
// ---------------------------------------------------------------------

const MARCHE = {
  regexMiseActuelle: /^mise\s+actuelle$/i, // le site l'affiche en majuscules, mais le texte peut être en minuscules
  regexMiseDepart: /^mise\s+de\s+d[ée]part$/i, // comptée seulement, pour te dire combien ont été ignorées
  regexVendeur: /^vendu par\s+(.+)$/i,
  regexTerminee: /termin/i,
  annoncesMax: 5000,      // au-delà, on oublie les plus anciennes
  joursGardes: 60,        // une annonce plus vieille que ça est oubliée
  releveMs: 3000          // relevé automatique toutes les 3 secondes sur la page Marché
};

// Un prix écrit « 1 250 » ou « 1.250 » → 1250. Renvoie null si ce n'est pas un nombre.
// Corrigé en 1.6.5 : un séparateur n'est accepté que devant un groupe de 3 chiffres. Avant, « 100.00 »
// donnait 10000 et deux nombres côte à côte (« 100 00 ») étaient collés en un seul.
function lirePrix(texte) {
  const t = texte.trim();
  if (!/^(\d+|\d{1,3}([\s  .,]\d{3})+)$/.test(t)) return null;
  return parseInt(t.replace(/\D/g, ""), 10);
}

// Nouveau en 1.6.5 : un prix suivi d'un mot court (une unité, « 300 pièces »).
function lirePrixAvecUnite(texte) {
  const m = texte.trim().match(/^(\d[\d\s  .,]*?)\s*([^\d]{0,15})$/);
  return m ? lirePrix(m[1]) : null;
}

// Nouveau en 1.6.5 : le prix écrit juste après une étiquette (« Mise actuelle », « Vendue pour »),
// dans « liste » (des feuilles). On s'arrête au PREMIER texte qui contient un chiffre : s'il ne se lit
// pas comme un prix, on n'en cherche pas un autre plus loin (avant, on pouvait attraper un nombre
// sans rapport, par exemple un solde ou une mise maximale affichés plus bas).
// Renvoie { trouve: bool, prix: nombre | null }.
function prixApres(liste, etiquette) {
  for (const { element, texte } of liste) {
    if (!(element.compareDocumentPosition(etiquette) & Node.DOCUMENT_POSITION_PRECEDING)) continue;
    if (element.contains(etiquette) || !/\d/.test(texte)) continue;
    return { trouve: true, prix: lirePrixAvecUnite(texte) };
  }
  return { trouve: false, prix: null };
}

// Les éléments « feuilles » (sans enfant élément) d'une zone, avec leur texte nettoyé.
// 1.17.1 : la rareté d'un badge shiny (« L✦ shiny ») dans une zone, ou null.
function rareteBadgeShiny(zone) {
  for (const badge of zone.querySelectorAll(".shiny-badge, div, span")) {
    if (badge.children.length === 0 || estDeLExtension(badge) || !estPetitBadge(badge)) continue;
    const rarete = rareteDepuisLettre(badge.textContent);
    if (rarete) return rarete;
  }
  return null;
}

function feuilles(zone) {
  return [...zone.querySelectorAll("*")]
    .filter(element => element.children.length === 0 || element.matches("h1,h2,h3,h4,p,span"))
    .filter(element => !element.closest(".wmd-tendance, .wmd-ecart, .wmd-icones")) // 1.16 : nos flèches, « + » et icônes ne sont pas des prix
    .map(element => ({ element: element, texte: element.textContent.replace(/\s+/g, " ").trim() }));
}

// Nouveau en 1.4.1 : combien d'annonces « mise de départ » sont affichées (elles sont ignorées).
function compterMisesDeDepart() {
  const zone = document.querySelector("main") || document.body;
  return feuilles(zone).filter(({ element, texte }) => MARCHE.regexMiseDepart.test(texte) && !estDansLePanneau(element)).length;
}

// Nouveau en 1.4.5 : la page d'UNE enchère (adresse /marketplace/<identifiant>), par exemple
// une carte « Vendue pour 130 ». On y lit le nom (titre h1), la rareté (le badge « R », « UR »...)
// et le prix : « Vendue pour » (enchère terminée, le vrai prix de vente) ou « Mise actuelle »
// (enchère en cours). Une enchère qui n'a qu'une « Mise de départ » est ignorée, comme sur la liste.
const REGEX_PAGE_ENCHERE = /^\/marketplace\/([0-9a-f-]{36})/i;
function lireAnnonceDetail(identifiant) {
  const zone = document.querySelector("main") || document.body;
  const titre = zone.querySelector("h1");
  if (!titre) return [];
  let rarete = null, prix = null, terminee = false;
  const toutes = feuilles(zone).filter(({ element }) => !estDansLePanneau(element));
  for (const { element, texte } of toutes) {
    if (!rarete && element.children.length === 0 && rareteDepuisLettre(texte)) rarete = rareteDepuisLettre(texte);
    if (!rarete && element.tagName === "SPAN" && element.parentElement && estPetitBadge(element.parentElement)) rarete = rareteDepuisLettre(element.parentElement.textContent); // 1.17.1 : badge shiny
    if (prix === null && /^(vendue pour|mise actuelle)$/i.test(texte)) {
      terminee = /vendue/i.test(texte);
      // Le prix est écrit juste après l'étiquette, dans le même bloc.
      prix = prixApres(feuilles(element.parentElement), element).prix;
    }
    if (/^(vendue|termin[ée]e)$/i.test(texte)) terminee = true; // la ligne « Statut : Vendue »
  }
  // Enchère en cours sans étiquette reconnue : on prend la dernière mise de l'« Historique des mises »
  // (la plus haute). S'il n'y a encore aucune mise, il n'y a que la mise de départ : on ignore.
  if (prix === null) {
    const titreHistorique = [...zone.querySelectorAll("h2, h3")].find(h => /^historique des mises/i.test(h.textContent.trim()));
    const liste = titreHistorique && (titreHistorique.nextElementSibling || titreHistorique.parentElement.querySelector("ul"));
    for (const ligne of liste ? liste.querySelectorAll("li") : []) {
      const nombres = feuilles(ligne).map(({ texte }) => lirePrix(texte)).filter(n => n !== null);
      if (nombres.length) prix = Math.max(prix ?? 0, nombres[nombres.length - 1]);
    }
  }
  if (prix === null) return [];
  return [{ cle: "marketplace-auction-" + identifiant, nom: titre.textContent.trim(), rarete: rarete || "inconnue",
    prix: prix, terminee: terminee, vendeur: "" }];
}

// Lit les annonces « mise actuelle » affichées. Renvoie [{ cle, nom, rarete, prix, terminee, vendeur }].
// Nouveau en 1.6.1 : avecDepart = true lit AUSSI les « mises de départ » (seulement pour repérer
// les bonnes affaires : elles ne sont jamais enregistrées comme prix).
// 1.10 (optimisation) : trois boucles lisent les annonces du Marché ; tant que la page n'a pas changé,
// la lecture précédente est réutilisée au lieu de reparcourir toute la page.
const annoncesLues = { cle: null, liste: null };
function lireAnnoncesMarche(avecDepart = false) {
  const cle = `${versionPage}|${location.href}|${avecDepart}`;
  if (annoncesLues.cle !== cle || !annoncesLues.liste.every(a => a.cadre === undefined || a.cadre.isConnected)) {
    annoncesLues.liste = lireAnnoncesMarcheSansCache(avecDepart);
    annoncesLues.cle = cle;
  }
  return annoncesLues.liste.map(a => ({ ...a }));
}
// 1.17.1 (optimisation) : chaque annonce du Marché (id="marketplace-auction-…") est lue une fois, puis gardée
// tant que son texte ne change pas (les comptes à rebours mis à part). Avant, toute la page était relue
// élément par élément à chaque passage : avec le chargement automatique, des milliers de cartes.
const annoncesParBloc = { true: new WeakMap(), false: new WeakMap() };
function signatureBloc(bloc) {
  const morceaux = [];
  const parcours = document.createTreeWalker(bloc, NodeFilter.SHOW_TEXT);
  for (let n = parcours.nextNode(); n; n = parcours.nextNode()) {
    const t = n.nodeValue;
    if (t && t.trim() && !REGEX_MINUTEUR.test(t)) morceaux.push(t);
  }
  const image = bloc.querySelector('img[src*="/rarity/"]');
  return morceaux.join("\u0001") + "\u0002" + (image ? image.getAttribute("src") : "");
}
function lireAnnoncesMarcheSansCache(avecDepart = false) {
  const enchere = location.pathname.match(REGEX_PAGE_ENCHERE);
  if (enchere) return avecDepart ? [] : lireAnnonceDetail(enchere[1].toLowerCase()); // nouveau en 1.4.5
  const zone = document.querySelector("main") || document.body;
  const blocs = zone.querySelectorAll("[id^='marketplace-auction-']");
  if (!blocs.length) return lireAnnoncesDans(zone, zone, avecDepart);
  const cache = annoncesParBloc[avecDepart];
  const annonces = [];
  for (const bloc of blocs) {
    if (!bloc.parentElement || estDansLePanneau(bloc)) continue;
    const signature = signatureBloc(bloc);
    let lu = cache.get(bloc);
    if (!lu || lu.signature !== signature || lu.liste.some(a => !a.cadre.isConnected || !bloc.contains(a.cadre))) {
      lu = { signature: signature, liste: lireAnnoncesDans(bloc.parentElement, bloc, avecDepart) };
      cache.set(bloc, lu);
    }
    annonces.push(...lu.liste);
  }
  return annonces;
}
// Lit les annonces dont l'étiquette « Mise actuelle » est dans « source » (sans sortir de « zone »).
function lireAnnoncesDans(zone, source, avecDepart) {
  const annonces = [];
  const dejaVus = new Set();
  for (const { element: etiquette, texte } of feuilles(source)) {
    const depart = avecDepart && MARCHE.regexMiseDepart.test(texte);
    if (!(MARCHE.regexMiseActuelle.test(texte) || depart) || estDansLePanneau(etiquette)) continue;

    // On remonte jusqu'au cadre de l'annonce : le premier parent qui contient le nom ET « Vendu par ».
    let cadre = etiquette.parentElement;
    while (cadre && cadre !== zone && zone.contains(cadre) && !(cadre.querySelector(CONFIG.selecteurNomCarte) && /vendu par/i.test(cadre.textContent))) {
      cadre = cadre.parentElement;
    }
    if (!cadre || cadre === zone || !zone.contains(cadre) || !cadre.querySelector(CONFIG.selecteurNomCarte) || dejaVus.has(cadre)) continue;
    dejaVus.add(cadre);

    // Le prix : le premier nombre écrit après « MISE ACTUELLE », dans le même bloc.
    let prix = null;
    for (let bloc = etiquette.parentElement; bloc && cadre.contains(bloc); bloc = bloc.parentElement) {
      const lu = prixApres(feuilles(bloc), etiquette);
      if (lu.trouve) { prix = lu.prix; break; }
      if (bloc === cadre) break;
    }
    if (prix === null) continue;

    const nom = cadre.querySelector(CONFIG.selecteurNomCarte).textContent.trim();
    // La rareté : l'image « /rarity/… » comme sur la Collection, sinon le petit badge « PC », « UR »…
    let rarete = null;
    const imageRarete = cadre.querySelector('img[src*="/rarity/"]');
    const trouve = imageRarete && imageRarete.getAttribute("src").match(/rarity\/([a-z_]+)\./);
    if (trouve) rarete = trouve[1];
    let vendeur = "";
    if (!rarete) rarete = rareteBadgeShiny(cadre); // 1.17.1 : « L✦ shiny » n'est pas une feuille
    for (const { texte: t } of feuilles(cadre)) {
      if (!rarete && rareteDepuisLettre(t)) rarete = rareteDepuisLettre(t);
      const v = t.match(MARCHE.regexVendeur);
      if (v) vendeur = v[1];
    }
    // Si le site donne un lien vers l'annonce, c'est le meilleur identifiant ; sinon carte + vendeur.
    // Corrigé en 1.4.1 : chaque annonce du site a un identifiant (id="marketplace-auction-…"),
    // et toute l'annonce est un lien vers /marketplace/… : c'est le meilleur moyen de la reconnaître.
    const bloc = cadre.closest("[id^='marketplace-auction-']");
    const lien = cadre.closest("a[href*='/marketplace/']") || cadre.querySelector("a[href*='/marketplace/']");
    const cle = bloc ? bloc.id : lien ? new URL(lien.getAttribute("href"), location.href).pathname
      : `${nom}|${rarete || "?"}|${vendeur}`;
    annonces.push({ cle: cle, nom: nom, rarete: rarete || "inconnue", prix: prix,
      terminee: MARCHE.regexTerminee.test(cadre.textContent), vendeur: vendeur, depart: depart, cadre: cadre });
  }
  return annonces;
}

// Enregistre les annonces lues. La même annonce revue plus tard est mise à jour, pas comptée deux fois.
// Renvoie le nombre d'annonces nouvelles.
let releveEnCours = false;
function enregistrerAnnonces(annonces) {
  return modifierMemoire(() => enregistrerAnnoncesMaintenant(annonces)); // 1.17 : chacun son tour
}
async function enregistrerAnnoncesMaintenant(annonces) {
  const { marche = { annonces: {} } } = await api.storage.local.get("marche");
  const maintenant = Date.now();
  let nouvelles = 0, modifiees = 0;
  // Nouveau en 1.4.1 : la 1.4 reconnaissait une annonce à « carte|rareté|vendeur ». Maintenant que l'on
  // utilise l'identifiant du site, on oublie ces anciennes entrées (sinon elles compteraient deux fois).
  if (annonces.some(annonce => !annonce.cle.includes("|"))) {
    for (const cle of Object.keys(marche.annonces)) {
      if (cle.includes("|")) {
        delete marche.annonces[cle];
        modifiees++;
      }
    }
  }
  for (const annonce of annonces) {
    const ancienne = marche.annonces[annonce.cle];
    if (!ancienne) nouvelles++;
    if (!ancienne || ancienne.prix !== annonce.prix || ancienne.terminee !== annonce.terminee) modifiees++;
    marche.annonces[annonce.cle] = { nom: annonce.nom, rarete: annonce.rarete, prix: annonce.prix,
      terminee: annonce.terminee, vu: maintenant };
  }
  if (modifiees === 0) return 0;
  // Ménage : on oublie les annonces trop vieilles, et les plus anciennes au-delà du maximum.
  const limite = maintenant - MARCHE.joursGardes * 24 * 3600 * 1000;
  let gardees = Object.entries(marche.annonces).filter(([, a]) => a.vu >= limite);
  // 1.17.1 : le tri (coûteux sur des milliers d'annonces) seulement quand il y en a trop.
  if (gardees.length > MARCHE.annoncesMax) gardees = gardees.sort((a, b) => b[1].vu - a[1].vu).slice(0, MARCHE.annoncesMax);
  await api.storage.local.set({ marche: { annonces: Object.fromEntries(gardees), moyennes: marche.moyennes || {} } });
  return nouvelles;
}

// Toutes les 3 secondes sur la page Marché : on relève ce qui est affiché.
// Nouveau en 1.4.3 : dès que les annonces affichées changent (arrivée sur le marché, une recherche,
// un filtre, une autre page), leurs prix s'affichent tout seuls dans le panneau.
let signatureMarche = "";
// 1.17.1 (optimisation) : ce qui a déjà été enregistré (clé → « nom|rareté|prix|fini », et quand).
// Une annonce inchangée n'est plus réenregistrée à chaque passage : la mémoire n'est relue et réécrite
// que s'il y a du nouveau (sa date « vu » est quand même rafraîchie toutes les 10 minutes).
const dejaEnregistrees = new Map();
const RAFRAICHIR_VU_MS = 10 * 60 * 1000;
api.storage.onChanged.addListener(changements => { if (changements.marche) dejaEnregistrees.clear(); });
async function releverMarche() {
  if (pageActuelle() !== "marche" || !reglages.marche || releveEnCours) return 0;
  releveEnCours = true;
  try {
    const annonces = lireAnnoncesMarche();
    const maintenant = Date.now();
    const empreinte = a => `${a.nom}|${a.rarete}|${a.prix}|${a.terminee}`;
    const aEnregistrer = annonces.filter(a => {
      const deja = dejaEnregistrees.get(a.cle);
      return !deja || deja.empreinte !== empreinte(a) || maintenant - deja.le > RAFRAICHIR_VU_MS;
    });
    const nouvelles = aEnregistrer.length ? await enregistrerAnnonces(aEnregistrer) : 0;
    for (const a of aEnregistrer) dejaEnregistrees.set(a.cle, { empreinte: empreinte(a), le: maintenant });
    const signature = annonces.map(a => a.cle + a.prix).join("|") + "#" + compterMisesDeDepart();
    if (signature !== signatureMarche && !enCours) {
      signatureMarche = signature;
      await prixDeCettePage(annonces, compterMisesDeDepart());
    }
    return nouvelles;
  } finally {
    releveEnCours = false;
  }
}

// Montre dans le panneau les mises actuelles de la page affichée (ta recherche, tes filtres...),
// carte par carte. Appelée toute seule par releverMarche (nouveau en 1.4.3).
// 1.15 : dans son propre bloc repliable (« 🛒 Mises de cette page »), sous le statut : ta liste (doublons,
// collection…) reste affichée en dessous. Le bloc est ouvert si aucune liste n'est affichée, sinon replié
// (un clic sur son titre l'ouvre ou le replie, et ce choix est gardé).
async function prixDeCettePage(annonces, ignorees) {
  const bloc = document.getElementById("wmd-prix-page");
  if (!bloc) return;
  const resultats = document.getElementById("wmd-resultats");
  if (!bloc.dataset.choisi) bloc.open = !(resultats && resultats.childElementCount);
  const titreBloc = creer("summary", "🛒 Mises de cette page");
  if (annonces.length === 0) {
    aDesPrixDePage = false;
    bloc.replaceChildren(titreBloc);
    actualiserPanneau();
    afficherStatut(ignorees
      ? `Aucune mise actuelle sur cette page : ${ignorees} annonce(s) n'ont qu'une mise de départ (personne n'a encore misé).`
      : "Marché : aucune annonce trouvée sur cette page pour l'instant.");
    return;
  }
  aDesPrixDePage = true;
  titreBloc.textContent = `🛒 Mises de cette page (${annonces.length})`;
  const zone = creer("div");

  // Tes cartes, pour te dire lesquelles tu possèdes (dans quelle rareté).
  const collection = (await maCollection()) || [];
  const tesRaretes = new Map();
  for (const carte of collection) {
    if (!tesRaretes.has(carte.nom)) tesRaretes.set(carte.nom, []);
    tesRaretes.get(carte.nom).push(`${carte.quantite} ${lettreRarete(carte.rarete)}`);
  }

  // Une ligne par carte (nom + rareté), avec toutes ses mises actuelles, de la plus basse à la plus haute.
  const groupes = new Map();
  for (const annonce of annonces) {
    const cle = `${annonce.nom}|${annonce.rarete}`;
    if (!groupes.has(cle)) groupes.set(cle, { nom: annonce.nom, rarete: annonce.rarete, prix: [] });
    groupes.get(cle).prix.push(annonce.terminee ? `${annonce.prix} (fini)` : annonce.prix);
  }
  const lignes = [...groupes.values()].sort((a, b) => ordreRarete(b.rarete) - ordreRarete(a.rarete) || a.nom.localeCompare(b.nom, "fr"));
  zone.appendChild(creer("div", `${ignorees} mise(s) de départ ignorée(s). « fini » = enchère terminée (prix de vente). `
    + "Les autres enchères sont en cours : le prix peut encore monter.", "wmd-discret"));
  // 1.17 : au plus 150 lignes (avec le chargement automatique, la page peut avoir des milliers d'annonces).
  const LIGNES_MAX = 150;
  if (lignes.length > LIGNES_MAX) zone.appendChild(creer("div", `Les ${LIGNES_MAX} premières cartes sur ${lignes.length} (des plus rares aux plus communes).`, "wmd-discret"));
  zone.appendChild(creerTableau(["Carte", "Rar.", "Mises actuelles", "Min", "Max", "À toi"], lignes.slice(0, LIGNES_MAX).map(g => {
    const nombres = g.prix.map(p => parseInt(p, 10)).sort((a, b) => a - b);
    const textes = [...g.prix].sort((a, b) => parseInt(a, 10) - parseInt(b, 10)).map(p => typeof p === "number" ? nombreLisible(p) : p);
    return { classe: `wmd-${g.rarete}`, valeurs: [lienCarte(g.nom, g.rarete), lettreRarete(g.rarete), textes.join(" · "),
      nombreLisible(nombres[0]), nombreLisible(nombres[nombres.length - 1]), (tesRaretes.get(g.nom) || ["—"]).join(", ")] };
  })));
  bloc.replaceChildren(titreBloc, zone);
  actualiserPanneau();
  afficherStatut(`Marché : ${annonces.length} mise(s) actuelle(s), ${ignorees} mise(s) de départ ignorée(s).`);
}

function mediane(nombres) {
  const tries = [...nombres].sort((a, b) => a - b);
  const milieu = Math.floor(tries.length / 2);
  return tries.length % 2 ? tries[milieu] : (tries[milieu - 1] + tries[milieu]) / 2;
}

// L'estimation à partir d'une liste de prix [{ prix, terminee }] : le prix le plus HAUT trouvé (1.6.3),
// le plus bas à côté. 1.6.9 : AUCUN prix n'est écarté (la règle « prix aberrant » des 1.6.5 à 1.6.8
// est supprimée). Un prix faux s'efface avec le bouton « Oublier ces prix » de la fiche.
function calculerEstimation(liste) {
  if (!liste.length) return null;
  const tries = [...liste].sort((a, b) => b.prix - a.prix);
  const terminees = tries.filter(p => p.terminee).map(p => p.prix);
  const enCours = tries.filter(p => !p.terminee).map(p => p.prix);
  const plusHautVendu = Math.max(0, ...terminees), plusHautEnCours = Math.max(0, ...enCours);
  return {
    estimation: tries[0].prix,
    minimum: enCours.length > 0 && plusHautEnCours >= plusHautVendu, // vrai = « au moins » (≥)
    min: tries[tries.length - 1].prix,
    max: tries[0].prix,
    minVendu: terminees.length ? Math.min(...terminees) : null, // 1.7.0 : le prix de vente terminée le plus bas
    nbTerminees: terminees.length,
    nbEnCours: enCours.length
  };
}

// Les prix relevés regroupés par carte : Map "nom|rarete" → { nom, rarete, estimation, terminees, enCours, min, max }.
// Depuis la 1.6.3, l'estimation est le prix le plus HAUT trouvé (ventes terminées et enchères en cours),
// le plus bas (min) est affiché à côté. « minimum » = ce prix le plus haut vient d'une enchère en cours (≥).
async function prixParCarte() {
  const { marche } = await api.storage.local.get("marche");
  const groupes = new Map();
  for (const annonce of Object.values(marche ? marche.annonces : {})) {
    const cle = `${annonce.nom}|${annonce.rarete}`;
    if (!groupes.has(cle)) groupes.set(cle, { nom: annonce.nom, rarete: annonce.rarete, terminees: [], enCours: [], liste: [] });
    const groupe = groupes.get(cle);
    groupe[annonce.terminee ? "terminees" : "enCours"].push(annonce.prix);
    groupe.liste.push({ prix: annonce.prix, terminee: annonce.terminee });
  }
  for (const groupe of groupes.values()) Object.assign(groupe, calculerEstimation(groupe.liste));
  // 1.7.2 : le prix moyen affiché par le site remplace TOUJOURS l'estimation (même si le plus haut est plus élevé).
  for (const [cle, m] of Object.entries(marche && marche.moyennes ? marche.moyennes : {})) {
    if (!groupes.has(cle)) groupes.set(cle, { nom: m.nom, rarete: m.rarete, terminees: [], enCours: [], liste: [],
      min: null, max: null, minVendu: null, nbTerminees: 0, nbEnCours: 0 });
    appliquerMoyenne(groupes.get(cle), m);
  }
  return groupes;
}

// Nouveau en 1.7.2 : remplace l'estimation par le prix moyen du site.
function appliquerMoyenne(estime, moyenne) {
  estime.plusHaut = estime.max;
  estime.estimation = moyenne.prix;
  estime.minimum = false;
  estime.moyenne = true;
  return estime;
}

// « ≈ 461 (prix moyen du site) » ou « ≥ 530 » / « ≈ 530 ».
function texteEstimation(estime) {
  return estime.moyenne ? `≈ ${nombreLisible(estime.estimation)} (prix moyen du site)`
    : `${estime.minimum ? "≥ " : "≈ "}${nombreLisible(estime.estimation)}`;
}

// Nouveau en 1.7.3 : les prix trouvés au Marché, À PART du prix moyen du site.
// « Marché : min 120 · max 530 » (ou "" si aucun prix relevé au Marché).
function texteMarche(estime) {
  if (!afficherMinMax) return ""; // 1.7.4 : la case « Afficher les prix min / max » est décochée
  if (!estime || estime.max === null || estime.max === undefined) return "";
  return `Marché : min ${nombreLisible(estime.min)} · max ${nombreLisible(estime.max)}`;
}

// Un nombre lisible, ou « — » s'il n'y en a pas.
function nombreOuTiret(n) {
  return n === null || n === undefined ? "—" : nombreLisible(n);
}

// ---------------------------------------------------------------------
//  Nouveau en 1.7.2 : LE PRIX MOYEN DU SITE
//  Dans la fiche d'une carte, l'onglet « Marché » du site affiche parfois « Prix moyen · Super Rare »
//  (la moyenne du mois). L'extension le relève et l'utilise comme estimation de cette carte
//  dans cette rareté. Elle ne fait que lire la page.
// ---------------------------------------------------------------------
//
//  Nouveau (1.16) : LES PRIX MOYENS DE TOUTES LES RARETÉS
//  Quand tu ouvres l'onglet « Marché » d'une fiche, le site charge de lui-même l'historique des
//  prix de la carte (price-history), avec les ventes de CHAQUE rareté, semaine par semaine.
//  reponses-site.js recopie cette réponse ; ici, on en tire un prix moyen pour chaque rareté :
//  la moyenne des ventes des 4 dernières semaines (chaque semaine compte selon son nombre de
//  ventes). S'il n'y a eu aucune vente depuis, c'est la moyenne du dernier mois connu.
//  Le prix est daté du jour de ces ventes : un vieux prix garde donc son « 🕒 » sur les cadres.
//  Le prix affiché sur la fiche (la rareté que tu regardes) reste prioritaire.
//  Aucune requête ni aucun clic de plus : l'extension lit seulement ce que le site a reçu.
// ---------------------------------------------------------------------
const nomsDesCartes = new Map(); // identifiant de carte → nom (appris dans les réponses du Marché)
let historiqueEnAttente = null;  // le dernier historique reçu dont on ne connaît pas encore le nom de la carte

function recevoirHistorique(historique) {
  if (!historique || !historique.carteId || !historique.parRarete) return;
  historiqueEnAttente = { ...historique, recuLe: Date.now() };
  versionPage++; // releverPrixMoyen repasse tout de suite
}

// { prix, ventes, vu } pour une rareté de l'historique, ou null.
function prixDepuisHistorique(rarete, calcule) {
  const fin = periode => Date.parse(periode.debut + "T00:00:00Z");
  const depuis = calcule - 28 * JOUR;
  const semaines = (rarete.semaines || []).filter(s => s.moyenne > 0 && s.nb > 0 && fin(s) + 7 * JOUR > depuis);
  if (semaines.length) {
    const ventes = semaines.reduce((total, s) => total + s.nb, 0);
    const prix = Math.round(semaines.reduce((total, s) => total + s.moyenne * s.nb, 0) / ventes);
    const derniere = Math.max(...semaines.map(fin));
    return { prix, ventes, vu: Math.min(derniere + 7 * JOUR, calcule) };
  }
  const mois = (rarete.mois || []).filter(m => m.moyenne > 0 && Number.isFinite(fin(m)));
  if (!mois.length) return null;
  const dernier = mois.reduce((a, b) => (fin(b) > fin(a) ? b : a));
  const finDuMois = new Date(fin(dernier));
  finDuMois.setUTCMonth(finDuMois.getUTCMonth() + 1);
  return { prix: Math.round(dernier.moyenne), ventes: dernier.nb || 0, vu: Math.min(finDuMois.getTime(), calcule) };
}

// Range les prix de toutes les raretés d'un historique sous le nom de la carte. true si quelque chose a changé.
function rangerHistorique(marche, nom, historique) {
  let modifie = false;
  for (const [code, donnees] of Object.entries(historique.parRarete)) {
    const rarete = rareteDuSite(code);
    if (!rarete) continue;
    const trouve = prixDepuisHistorique(donnees, historique.calcule);
    if (!trouve) continue;
    const cle = `${nom}|${rarete}`;
    const ancienne = marche.moyennes[cle];
    // Un prix lu sur la fiche, ou importé, plus récent que ces ventes est gardé.
    if (ancienne && ancienne.source !== "historique" && ancienne.vu >= trouve.vu) continue;
    if (ancienne && ancienne.prix === trouve.prix && ancienne.vu === trouve.vu) continue;
    marche.moyennes[cle] = { nom: nom, rarete: rarete, prix: trouve.prix, vu: trouve.vu, source: "historique", ventes: trouve.ventes };
    modifie = true;
  }
  return modifie;
}

// 1.16 : les variations de prix d'une rareté, en % entiers (ou null si on ne peut pas les calculer).
//  - semaine : la dernière semaine complète comparée à la semaine juste avant ;
//  - deuxMois : les 4 dernières semaines complètes comparées aux 4 semaines d'il y a 2 mois.
// La semaine en cours (pas finie) n'est pas comptée. Chaque semaine pèse selon son nombre de ventes.
// Sans vente la semaine dernière, pas de flèche (la variation serait trop vieille).
function tendancesDepuisHistorique(rarete, calcule) {
  const SEMAINE = 7 * JOUR;
  const debut = periode => Date.parse(periode.debut + "T00:00:00Z");
  const semaines = (rarete.semaines || []).filter(x => x.moyenne > 0 && x.nb > 0 && Number.isFinite(debut(x))
    && debut(x) + SEMAINE <= calcule);
  if (!semaines.length) return { semaine: null, deuxMois: null };
  const moyenneEntre = (de, a) => {
    const choisies = semaines.filter(x => debut(x) >= de && debut(x) <= a);
    const ventes = choisies.reduce((total, x) => total + x.nb, 0);
    return ventes ? choisies.reduce((total, x) => total + x.moyenne * x.nb, 0) / ventes : null;
  };
  const ecart = (nouveau, ancien) => (nouveau && ancien ? Math.round((nouveau / ancien - 1) * 100) : null);
  const derniere = Math.max(...semaines.map(debut));
  if (derniere + 2 * SEMAINE <= calcule) return { semaine: null, deuxMois: null }; // pas de vente la semaine dernière : pas de flèche
  return {
    semaine: ecart(moyenneEntre(derniere, derniere), moyenneEntre(derniere - SEMAINE, derniere - SEMAINE)),
    deuxMois: ecart(moyenneEntre(derniere - 3 * SEMAINE, derniere), moyenneEntre(derniere - 11 * SEMAINE, derniere - 8 * SEMAINE))
  };
}

// 1.17 : UN PRIX GONFLÉ ARTIFICIELLEMENT ?
// Certains joueurs font monter le prix d'une carte d'un coup (ventes entre eux à un prix très haut),
// puis le prix retombe à la normale. Le prix moyen du site (et celui de l'extension, la moyenne des
// 4 dernières semaines) est alors faussé, et des enchères ont l'air de bonnes affaires sans en être.
// On compare chaque semaine des 8 dernières au prix HABITUEL de la carte : la médiane des moyennes
// hebdomadaires des 16 dernières semaines (une semaine folle ne la fait presque pas bouger).
// Il faut au moins 4 semaines avec des ventes. La semaine la plus haute, si elle dépasse 1,5 × le prix
// habituel, est gardée ; elle n'est SIGNALÉE (🎈) que si elle dépasse le seuil choisi (× 2 par défaut).
// Renvoie { ratio, prix, normal, jour, ventes, retombe, dansMoyenne, sansPic } ou null.
//  - retombe : une semaine plus récente est revenue sous 1,5 × le prix habituel ;
//  - dansMoyenne : le pic est dans les 4 dernières semaines, il gonfle donc le prix moyen ;
//  - sansPic : la moyenne des 4 dernières semaines SANS les semaines anormales (ou le prix habituel).
const PIC_MINIMUM = 1.5;
function picDepuisHistorique(rarete, calcule) {
  const SEMAINE = 7 * JOUR;
  const debut = periode => Date.parse(periode.debut + "T00:00:00Z");
  const semaines = (rarete.semaines || []).filter(x => x.moyenne > 0 && x.nb > 0 && Number.isFinite(debut(x))
    && debut(x) > calcule - 16 * SEMAINE && debut(x) <= calcule).sort((a, b) => debut(a) - debut(b));
  if (semaines.length < 4) return null;
  const normal = mediane(semaines.map(x => x.moyenne));
  if (!(normal > 0)) return null;
  let pic = null;
  for (const x of semaines) {
    if (debut(x) <= calcule - 8 * SEMAINE) continue;
    const ratio = x.moyenne / normal;
    if (ratio >= PIC_MINIMUM && (!pic || ratio > pic.ratio)) pic = { semaine: x, ratio: ratio };
  }
  if (!pic) return null;
  const dansFenetre = x => debut(x) + SEMAINE > calcule - 28 * JOUR; // les 4 semaines du prix moyen
  const saines = semaines.filter(x => dansFenetre(x) && x.moyenne < PIC_MINIMUM * normal);
  const ventesSaines = saines.reduce((total, x) => total + x.nb, 0);
  return {
    ratio: Math.round(pic.ratio * 10) / 10,
    prix: Math.round(pic.semaine.moyenne),
    normal: Math.round(normal),
    jour: pic.semaine.debut,
    ventes: pic.semaine.nb,
    retombe: semaines.some(x => debut(x) > debut(pic.semaine) && x.moyenne < PIC_MINIMUM * normal),
    dansMoyenne: dansFenetre(pic.semaine),
    sansPic: ventesSaines ? Math.round(saines.reduce((total, x) => total + x.moyenne * x.nb, 0) / ventesSaines) : Math.round(normal)
  };
}

// 1.17 : le réglage des prix gonflés (« ⚙️ Options du Marché ») : signaler ou non, et à partir de quel multiple.
let reglagePic = { actif: true, ratio: 2 };
function lireReglagePic(valeur) {
  const ratio = valeur && Number(valeur.ratio);
  return { actif: !valeur || valeur.actif !== false, ratio: Number.isFinite(ratio) && ratio >= PIC_MINIMUM ? ratio : 2 };
}
api.storage.local.get("marchePic").then(({ marchePic }) => {
  reglagePic = lireReglagePic(marchePic);
  afficherReglagePic();
  versionPage++;
}).catch(() => {});
api.storage.onChanged.addListener(changements => {
  if (!changements.marchePic) return;
  reglagePic = lireReglagePic(changements.marchePic.newValue);
  afficherReglagePic();
  const encart = document.getElementById("wmd-prix-fiche");
  if (encart) encart.dataset.cle = "";
  versionPage++;
});
function afficherReglagePic() {
  const coche = document.querySelector("#wmd-case-pic input[type=checkbox]");
  if (coche) coche.checked = reglagePic.actif;
  const champ = document.getElementById("wmd-ratio-pic");
  if (champ && document.activeElement !== champ) champ.value = String(reglagePic.ratio);
}
// Le pic à signaler pour une carte (d'après la mémoire « tendances »), ou null.
function picASignaler(tendance) {
  const pic = tendance && tendance.pic;
  return reglagePic.actif && pic && pic.ratio >= reglagePic.ratio ? pic : null;
}
function jourCourt(jour) {
  const d = dateDepuisJour(jour);
  return d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) : String(jour || "?");
}
// L'explication d'un pic, en une phrase (infobulles, fiche, page d'une enchère).
function textePic(pic) {
  return `🎈 Prix peut-être gonflé : la semaine du ${jourCourt(pic.jour)}, ${pic.ventes} vente(s) à ${nombreLisible(pic.prix)} en moyenne, `
    + `soit × ${String(pic.ratio).replace(".", ",")} le prix habituel (≈ ${nombreLisible(pic.normal)}). `
    + (pic.retombe ? "Le prix est retombé depuis. " : "Le prix n'est pas encore retombé. ")
    + (pic.dansMoyenne ? `Ce pic fausse le prix moyen : sans lui, il serait d'environ ${nombreLisible(pic.sansPic)}.` : "");
}

// Range les variations de toutes les raretés d'un historique (mémoire « tendances », à part des prix).
// 1.17 : avec le pic de prix éventuel (picDepuisHistorique).
async function rangerTendances(nom, historique) {
  const { tendances = {} } = await api.storage.local.get("tendances");
  for (const [code, donnees] of Object.entries(historique.parRarete)) {
    const rarete = rareteDuSite(code);
    if (!rarete) continue;
    tendances[`${nom}|${rarete}`] = { ...tendancesDepuisHistorique(donnees, historique.calcule),
      pic: picDepuisHistorique(donnees, historique.calcule), calcule: historique.calcule };
  }
  await api.storage.local.set({ tendances: tendances });
}

let moyenneEnCours = false;
async function releverPrixMoyen() {
  if (moyenneEnCours || !reglages.marche) return;
  if (historiqueEnAttente && Date.now() - historiqueEnAttente.recuLe > 30 * SECONDE) historiqueEnAttente = null; // trop vieux
  // La fiche du site s'ouvre par-dessus la page, hors de <main> : on cherche dans toute la page.
  const etiquettes = [...document.body.querySelectorAll("p")].filter(p => !estDansLePanneau(p) && /^prix moyen\s*·/i.test(p.textContent.trim()));
  if (!etiquettes.length && !(historiqueEnAttente && nomsDesCartes.has(historiqueEnAttente.carteId))) return;
  moyenneEnCours = true;
  try {
    await modifierMemoire(() => releverPrixMoyenMaintenant(etiquettes)); // 1.17 : chacun son tour
  } finally {
    moyenneEnCours = false;
  }
}
async function releverPrixMoyenMaintenant(etiquettes) {
  {
    const { marche = { annonces: {} } } = await api.storage.local.get("marche");
    marche.moyennes = marche.moyennes || {};
    let modifie = false;
    const fichesVues = new Map(); // nom de la carte → raretés affichées sur sa fiche
    for (const p of etiquettes) {
      const rarete = rareteDepuisNom(p.textContent.trim().replace(/^prix moyen\s*·\s*/i, ""));
      if (!rarete) continue;
      let fiche = p.parentElement;
      while (fiche && !fiche.querySelector("h2")) fiche = fiche.parentElement;
      if (!fiche) continue;
      const nom = fiche.querySelector("h2").textContent.trim();
      if (nom) fichesVues.set(nom, [...(fichesVues.get(nom) || []), rarete]);
      const prix = prixApres(feuilles(p.parentElement), p).prix;
      if (!nom || prix === null) continue;
      const cle = `${nom}|${rarete}`;
      const ancienne = marche.moyennes[cle];
      if (ancienne && ancienne.prix === prix && Date.now() - ancienne.vu < 3600 * 1000) continue;
      marche.moyennes[cle] = { nom: nom, rarete: rarete, prix: prix, vu: Date.now() };
      modifie = true;
    }
    // 1.16 : l'historique des prix reçu du site. Le nom de la carte vient des réponses du Marché ou,
    // à défaut, de la seule fiche ouverte (et seulement si l'historique connaît la rareté qu'elle affiche).
    const historique = historiqueEnAttente;
    if (historique) {
      let nom = nomsDesCartes.get(historique.carteId) || null;
      if (!nom && fichesVues.size === 1) {
        const [[nomFiche, raretes]] = [...fichesVues];
        const connues = Object.keys(historique.parRarete).map(rareteDuSite);
        if (raretes.some(r => connues.includes(r))) nom = nomFiche;
      }
      if (nom) {
        historiqueEnAttente = null;
        nomsDesCartes.set(historique.carteId, nom);
        if (rangerHistorique(marche, nom, historique)) modifie = true;
        await rangerTendances(nom, historique);
        historiqueEnregistre = { nom: nom, quand: Date.now() }; // 1.17.3 : la pastille rouge de la fiche
      }
    }
    if (modifie) await api.storage.local.set({ marche: marche });
  }
}

// ---------------------------------------------------------------------
//  Nouveau en 1.10 : IMPORTER UN FICHIER CSV EXPORTÉ PAR L'EXTENSION
//  Le bouton « 📥 Importer un fichier CSV » reconnaît tout seul le fichier choisi :
//  - « collection-wikimasters.csv » (Exporter en CSV) : il REMPLACE ta collection en mémoire
//    (après confirmation), comme une lecture complète ;
//  - « prix-marche-wikimasters.csv » (Exporter les prix du marché) : il AJOUTE seulement ce qui
//    manque. Un prix moyen du site n'est repris que si la carte (dans cette rareté) n'en a pas
//    encore ; les prix du Marché ne sont repris que pour les cartes qui n'en ont aucun (sinon ils
//    compteraient deux fois). Ce qui est déjà dans l'extension n'est jamais modifié.
//    1.16 : SAUF si le fichier est plus récent. Chaque donnée est datée au jour près (prix moyen,
//    prix du Marché, variations) ; celle du fichier remplace celle de l'extension si elle date d'un
//    jour plus récent. Les prix du Marché d'une carte sont alors remplacés en bloc (jamais additionnés).
//  Plusieurs fichiers peuvent être choisis d'un coup : ils sont importés l'un après l'autre, et un
//  fichier ne reprend donc que ce que ni l'extension ni les fichiers précédents n'avaient.
//  Le fichier est lu dans ton navigateur et n'est envoyé nulle part.
// ---------------------------------------------------------------------

// Découpe un texte CSV en lignes de champs (guillemets, "" doublés, retours à la ligne dans un champ).
function lireCSV(texte) {
  texte = texte.replace(/^﻿/, "");
  const premiere = texte.split(/\r?\n/, 1)[0];
  const separateur = (premiere.match(/;/g) || []).length >= (premiere.match(/,/g) || []).length ? ";" : ",";
  const lignes = [];
  let ligne = [], champ = "", entreGuillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (entreGuillemets) {
      if (c === '"' && texte[i + 1] === '"') { champ += '"'; i++; }
      else if (c === '"') entreGuillemets = false;
      else champ += c;
    } else if (c === '"') entreGuillemets = true;
    else if (c === separateur) { ligne.push(champ); champ = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texte[i + 1] === "\n") i++;
      ligne.push(champ); champ = "";
      if (ligne.some(v => v.trim() !== "")) lignes.push(ligne);
      ligne = [];
    } else champ += c;
  }
  ligne.push(champ);
  if (ligne.some(v => v.trim() !== "")) lignes.push(ligne);
  return lignes.map(l => l.map(v => v.trim()));
}

// « 1 250 » ou « 1250 » → 1250 ; vide ou illisible → null.
function nombreCSV(texte) {
  const t = String(texte || "").replace(/[\s  ]/g, "");
  return /^\d+$/.test(t) ? parseInt(t, 10) : null;
}

// 1.16 : un nombre entier qui peut être négatif (« -12 », « −12 », « +5 »), ou null.
function entierSigneCSV(texte) {
  const t = String(texte || "").replace(/[\s  %]/g, "").replace("−", "-");
  return /^[+-]?\d+$/.test(t) ? parseInt(t, 10) : null;
}

function rareteCSV(texte) {
  const t = String(texte || "").trim();
  return rareteDepuisLettre(t.toUpperCase()) || rareteDepuisNom(t) || (RARETES[t] ? t : "inconnue");
}

function choisirFichierImport() {
  let champ = document.getElementById("wmd-fichier-import");
  if (!champ) {
    champ = creer("input");
    champ.type = "file";
    champ.accept = ".csv,text/csv";
    champ.multiple = true; // plusieurs fichiers d'un coup
    champ.id = "wmd-fichier-import";
    champ.hidden = true;
    champ.addEventListener("change", () => {
      const fichiers = [...(champ.files || [])];
      champ.value = "";
      if (fichiers.length) importerFichiersCSV(fichiers);
    });
    document.body.appendChild(champ);
  }
  champ.click();
}

// Plusieurs fichiers : l'un après l'autre, puis un bilan de chacun dans le panneau.
async function importerFichiersCSV(fichiers) {
  const bilans = [];
  for (const fichier of fichiers) {
    try {
      await importerFichierCSV(fichier);
    } catch (erreur) {
      afficherStatut(`« ${fichier.name} » : import impossible (${erreur.message}).`);
    }
    bilans.push(document.getElementById("wmd-statut").textContent);
  }
  if (fichiers.length < 2) return;
  afficherStatut(`${fichiers.length} fichiers traités.`);
  const zone = document.getElementById("wmd-resultats");
  if (!zone) return;
  zone.replaceChildren();
  const bloc = creer("div", undefined, "wmd-bloc");
  bloc.appendChild(creer("b", `Import de ${fichiers.length} fichiers`));
  const liste = creer("ul");
  for (const texte of bilans) liste.appendChild(creer("li", texte));
  bloc.appendChild(liste);
  zone.appendChild(bloc);
}

async function importerFichierCSV(fichier) {
  return importerTexteCSV(fichier.name, await fichier.text());
}
// 1.14 : le même import à partir d'un texte (fichier choisi, ou fichier lu dans Google Drive).
// seulementPrix = true refuse un fichier de collection. Renvoie true si des prix ont été importés.
async function importerTexteCSV(nomFichier, texte, seulementPrix = false) {
  const lignes = lireCSV(texte);
  if (lignes.length < 2) { afficherStatut(`« ${nomFichier} » est vide ou n'est pas un fichier CSV.`); return false; }
  const titres = lignes[0].map(t => t.toLowerCase());
  const colonne = nom => titres.indexOf(nom.toLowerCase());
  if (colonne("Carte") === -1 || colonne("Rareté") === -1) {
    afficherStatut(`« ${nomFichier} » n'est pas un export de WikiMasters Doublons (colonnes « Carte » et « Rareté » introuvables).`);
    return false;
  }
  if (colonne("Prix estimé") !== -1) { await importerPrixCSV(nomFichier, lignes.slice(1), colonne); return true; }
  if (colonne("Quantité") !== -1 && !seulementPrix) { await importerCollectionCSV(nomFichier, lignes.slice(1), colonne); return false; }
  afficherStatut(`« ${nomFichier} » : type de fichier non reconnu (ce n'est pas un fichier de prix du marché).`);
  return false;
}

async function importerCollectionCSV(nomFichier, lignes, colonne) {
  const [cNom, cRarete, cQuantite, cAnimee] = ["Carte", "Rareté", "Quantité", "Animée"].map(colonne);
  const liste = [];
  for (const l of lignes) {
    const nom = l[cNom];
    const quantite = nombreCSV(l[cQuantite]);
    if (!nom || !quantite) continue;
    liste.push({ nom: nom, rarete: rareteCSV(l[cRarete]), quantite: quantite,
      animee: cAnimee !== -1 && /^(oui|1|true|vrai)$/i.test(l[cAnimee] || "") });
  }
  if (!liste.length) return afficherStatut(`« ${nomFichier} » : aucune carte lisible.`);
  const { collection: actuelle } = await api.storage.local.get("collection");
  const avant = actuelle ? `ta collection en mémoire (${actuelle.cartes.length} cartes différentes, lue le ${dateLisible(actuelle.date)})`
    : "aucune collection en mémoire";
  if (!window.confirm(`Importer « ${nomFichier} » : ${liste.length} cartes différentes.\n`
    + `Cela remplace ${avant}.\nContinuer ?`)) return afficherStatut("Import annulé.");
  derniereCollection = [];
  await enregistrerLecture(regrouperParNom(liste), true);
  afficherStatut(`Collection importée depuis « ${nomFichier} » : ${liste.length} cartes différentes, `
    + `${liste.reduce((t, c) => t + c.quantite, 0)} exemplaires.`);
}

// 1.14 : la date d'un prix moyen, au jour près. jourDe(heure) → "2026-11-22" (jour local), "" si inconnue.
// dateDepuisJour lit "2026-11-22" (ou une date complète des fichiers 1.10 à 1.13) → l'heure, 0 si illisible.
function jourDe(heure) {
  if (!heure) return "";
  const d = new Date(heure);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateDepuisJour(texte) {
  const t = String(texte || "").trim();
  const jour = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (jour) return new Date(Number(jour[1]), Number(jour[2]) - 1, Number(jour[3]), 12).getTime(); // midi : jamais à cheval sur deux jours
  const heure = Date.parse(t);
  return Number.isFinite(heure) ? heure : 0;
}

async function importerPrixCSV(nomFichier, lignes, colonne) {
  const c = { nom: colonne("Carte"), rarete: colonne("Rareté"), estime: colonne("Prix estimé"),
    moyenne: colonne("Prix moyen du site"), moyenneLe: colonne("Prix moyen relu le"), tous: colonne("Tous les prix"),
    semaine: colonne("Variation 1 semaine (%)"), deuxMois: colonne("Variation 2 mois (%)"), tendanceLe: colonne("Variations du"),
    marcheLe: colonne("Prix du Marché relevés le"), pic: colonne("Pic de prix") };
  await attendre(() => !moyenneEnCours && !releveEnCours, 5000);
  moyenneEnCours = true;
  releveEnCours = true;
  try {
    await modifierMemoire(() => importerPrixMaintenant(nomFichier, lignes, c)); // 1.17 : chacun son tour
  } finally {
    moyenneEnCours = false;
    releveEnCours = false;
  }
}
async function importerPrixMaintenant(nomFichier, lignes, c) {
  {
    const { marche = { annonces: {} } } = await api.storage.local.get("marche");
    marche.annonces = marche.annonces || {};
    marche.moyennes = marche.moyennes || {};
    const avecAnnonces = new Set(Object.values(marche.annonces).map(a => `${a.nom}|${a.rarete}`));
    // 1.16 : le relevé le plus récent des prix du Marché de chaque carte, dans l'extension.
    const marcheVuLe = new Map();
    const clesParCarte = new Map(); // 1.17.1 : les clés des annonces de chaque carte (avant : toute la mémoire relue pour chaque carte)
    for (const [cleAnnonce, a] of Object.entries(marche.annonces)) {
      const cle = `${a.nom}|${a.rarete}`;
      if ((Number(a.vu) || 0) > (marcheVuLe.get(cle) || 0)) marcheVuLe.set(cle, Number(a.vu));
      if (clesParCarte.has(cle)) clesParCarte.get(cle).push(cleAnnonce); else clesParCarte.set(cle, [cleAnnonce]);
    }
    const { tendances = {} } = await api.storage.local.get("tendances"); // 1.16
    let moyennes = 0, annonces = 0, ignorees = 0, plusRecentes = 0, variations = 0, marchesRemplaces = 0;
    const maintenant = Date.now();
    for (const l of lignes) {
      const nom = l[c.nom];
      if (!nom) continue;
      const rarete = rareteCSV(l[c.rarete]);
      const cle = `${nom}|${rarete}`;
      // Les prix relevés au Marché : « 300 (fini) · 450 ».
      const prix = (c.tous !== -1 ? (l[c.tous] || "").split("·") : []).map(p => p.trim()).filter(Boolean)
        .map(p => ({ prix: nombreCSV(p.replace(/\(fini\)/i, "")), terminee: /\(fini\)/i.test(p) }))
        .filter(p => p.prix !== null);
      // Le prix moyen du site : sa colonne (fichiers 1.10). Dans un fichier plus ancien, le prix estimé
      // est le prix moyen quand il ne vient pas des prix du Marché (aucun prix, ou différent du plus haut).
      let moyenne = c.moyenne !== -1 ? nombreCSV(l[c.moyenne]) : null;
      if (c.moyenne === -1) {
        const estime = nombreCSV(l[c.estime]);
        if (estime !== null && (!prix.length || estime !== Math.max(...prix.map(p => p.prix)))) moyenne = estime;
      }
      if (moyenne !== null) {
        const vu = c.moyenneLe !== -1 ? dateDepuisJour(l[c.moyenneLe]) : 0; // 0 : date inconnue
        const connue = marche.moyennes[cle];
        // 1.14 : un prix moyen déjà connu est remplacé seulement si celui du fichier a été relu un jour
        // PLUS RÉCENT (au jour près). Sans date dans le fichier, ce qui est connu n'est jamais remplacé.
        if (!connue) {
          marche.moyennes[cle] = { nom: nom, rarete: rarete, prix: moyenne, vu: vu };
          moyennes++;
        } else if (vu && jourDe(vu) > jourDe(connue.vu)) {
          marche.moyennes[cle] = { nom: nom, rarete: rarete, prix: moyenne, vu: vu };
          plusRecentes++;
        } else ignorees++;
      }
      // 1.16 : les variations du prix. Reprises si l'extension n'en a pas pour cette carte,
      // ou si celles du fichier sont datées d'un jour plus récent.
      if (c.tendanceLe !== -1) {
        const le = dateDepuisJour(l[c.tendanceLe]);
        const semaine = c.semaine !== -1 ? entierSigneCSV(l[c.semaine]) : null;
        const deuxMois = c.deuxMois !== -1 ? entierSigneCSV(l[c.deuxMois]) : null;
        const connues = tendances[cle];
        const pic = c.pic !== -1 ? picDepuisCSV(l[c.pic]) : null; // 1.17
        if (le && (semaine !== null || deuxMois !== null || pic) && (!connues || jourDe(le) > jourDe(connues.calcule))) {
          tendances[cle] = { semaine: semaine, deuxMois: deuxMois, pic: pic, calcule: le };
          variations++;
        }
      }
      if (prix.length) {
        // 1.16 : la date des prix du Marché dans le fichier (0 si le fichier n'en a pas).
        const leMarche = c.marcheLe !== -1 ? dateDepuisJour(l[c.marcheLe]) : 0;
        if (avecAnnonces.has(cle)) {
          // Déjà des prix du Marché pour cette carte : remplacés seulement par des prix relevés un jour plus récent.
          if (!leMarche || !(jourDe(leMarche) > jourDe(marcheVuLe.get(cle) || 0))) { ignorees++; continue; }
          for (const cleAnnonce of clesParCarte.get(cle) || []) delete marche.annonces[cleAnnonce];
          clesParCarte.delete(cle);
          marchesRemplaces++;
        }
        prix.forEach((p, i) => {
          // Clé sans « | » (les anciennes clés « carte|rareté|vendeur » sont effacées par le relevé).
          const cleImport = `import-${encodeURIComponent(nom)}-${rarete}-${i}`;
          marche.annonces[cleImport] = { nom: nom, rarete: rarete, prix: p.prix, terminee: p.terminee, vu: leMarche || maintenant };
          if (clesParCarte.has(cle)) clesParCarte.get(cle).push(cleImport); else clesParCarte.set(cle, [cleImport]);
          annonces++;
        });
        avecAnnonces.add(cle);
        marcheVuLe.set(cle, leMarche || maintenant);
      }
    }
    // 1.17.1 : rien de nouveau dans le fichier : la mémoire n'est pas réécrite (ni relue par tous les onglets).
    if (moyennes || annonces || plusRecentes || marchesRemplaces || variations) {
      await api.storage.local.set(variations ? { marche: marche, tendances: tendances } : { marche: marche });
    }
    afficherStatut(`Prix importés depuis « ${nomFichier} » : ${moyennes} prix moyen(s) du site et ${annonces} prix du Marché ajoutés`
      + (variations ? `, ${variations} variation(s) de prix reprise(s)` : "")
      + (marchesRemplaces ? `, les prix du Marché de ${marchesRemplaces} carte(s) remplacés par des plus récents` : "")
      + (plusRecentes ? `, ${plusRecentes} prix moyen(s) remplacé(s) par un plus récent` : "")
      + (ignorees ? ` ; ${ignorees} donnée(s) laissée(s) de côté (déjà connues, et pas plus récentes).` : "."));
  }
}

// Le prix d'une de TES cartes : même nom et même rareté (ou même nom si la rareté n'a pas pu être lue).
function prixDe(groupes, carte) {
  return groupes.get(`${carte.nom}|${carte.rarete}`) || groupes.get(`${carte.nom}|inconnue`) || null;
}

// Le bouton « Estimer la valeur de mes cartes ».
async function estimerMesCartes() {
  const collection = await maCollection();
  if (!collection) {
    afficherStatut("Lis d'abord ta collection (« Trouver mes doublons » sur la page Collection).");
    return;
  }
  const groupes = await prixParCarte();
  if (groupes.size === 0) {
    afficherStatut("Aucun prix relevé : passe d'abord sur la page Marché.");
    return;
  }
  // 1.7.5 : seulement le prix moyen du site et le prix le plus bas du Marché.
  // La valeur totale additionne les prix moyens du site (les cartes sans prix moyen n'y comptent pas).
  const estimees = [];
  let total = 0, sansMoyenne = 0;
  for (const carte of collection) {
    const prix = prixDe(groupes, carte);
    if (!prix) continue;
    estimees.push({ carte: carte, prix: prix });
    if (prix.moyenne) total += prix.estimation * carte.quantite;
    else sansMoyenne++;
  }
  const moy = p => (p.moyenne ? p.estimation : -1);
  estimees.sort((a, b) => moy(b.prix) - moy(a.prix) || (b.prix.min ?? 0) - (a.prix.min ?? 0));
  const nomsAuMarche = new Set([...groupes.values()].map(g => g.nom));
  const autreRarete = collection.filter(carte => !prixDe(groupes, carte) && nomsAuMarche.has(carte.nom)).length;

  const zone = document.getElementById("wmd-resultats");
  zone.replaceChildren();
  const bloc = creer("div", undefined, "wmd-bloc");
  bloc.appendChild(creer("b", `Valeur estimée (prix moyens du site) : environ ${nombreLisible(Math.round(total))}`));
  bloc.appendChild(creer("div", `${estimees.length - sansMoyenne} carte(s) avec un prix moyen du site`
    + (sansMoyenne ? `, ${sansMoyenne} seulement vue(s) au Marché (non comptées dans le total)` : "") + `, sur ${collection.length}. `
    + "Clique sur le nom d'une carte pour la trouver (collection, Marché ou « Toutes les cartes »)."
    + (autreRarete ? ` ${autreRarete} de tes cartes ont été vues dans une autre rareté (prix non comparable).` : ""), "wmd-discret"));
  zone.appendChild(bloc);
  zone.appendChild(creerTableau(["Carte", "Rar.", "Qté", "Moy. site", "Min marché"], estimees.map(({ carte, prix }) => {
    return { classe: `wmd-${carte.rarete}`,
      valeurs: [lienCarte(carte.nom, carte.rarete), lettreRarete(carte.rarete), carte.quantite,
        prix.moyenne ? nombreLisible(prix.estimation) : "—", nombreOuTiret(prix.min)] };
  })));
  afficherStatut(`${estimees.length} de tes cartes ont un prix relevé.`);
  memoriserVue("estimation"); // 1.15
}

// ---------------------------------------------------------------------
//  PARTIE 13 UNDECIES : TROUVER UNE CARTE (nouveau en 1.11, généralise le clic de la 1.7.5)
//  Dans le panneau, le nom de chaque carte listée (doublons, nouvelles cartes, cartes
//  manquantes, cartes animées du jeu, mises du Marché, valeur estimée, échanges, souhaits,
//  enchères suivies) est cliquable. Le clic propose où la trouver :
//    📚 dans ma Collection        → la recherche du site, puis la fiche de la carte s'ouvre ;
//    🛒 au Marché                 → la recherche du Marché, filtrée sur sa rareté ;
//    🌐 dans « Toutes les cartes » → la recherche du site, puis la fiche de la carte s'ouvre ;
//    (🔨 ouvrir l'enchère, pour une enchère suivie).
//  Si tu es déjà sur la bonne page (et qu'aucune lecture ne tourne), la recherche se fait sur
//  place ; sinon un nouvel onglet s'ouvre : les résultats affichés dans le panneau restent là.
//  Le site n'a pas d'adresse propre à chaque carte : la demande passe par la mémoire de
//  l'extension (« trouverCarte »), comme « Chercher au marché » (1.4.4).
//  Seuls le champ de recherche, le bouton « Rechercher », le filtre de rareté (Marché) et la carte
//  trouvée sont cliqués : jamais rien qui achète, mise, échange ou défausse.
// ---------------------------------------------------------------------

const ADRESSES_PAGES = { "collection": "/collection", "toutes-les-cartes": "/global-collection" };

// Écrit dans un champ du site comme si on avait tapé (le site, en React, écoute « input »).
function ecrireDansChamp(champ, texte) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  champ.focus();
  setter.call(champ, texte);
  champ.dispatchEvent(new Event("input", { bubbles: true }));
}

// Vrai si une tâche automatique tourne dans cet onglet : on ne touche alors pas à la page.
function pageOccupee() {
  return enCours || tacheEnCours || chasseEnCours;
}

// --- Le petit menu ---

let lienDuMenu = null; // le nom cliqué, pour garder le menu collé à lui
function fermerMenuCarte() {
  const menu = document.getElementById("wmd-menu-carte");
  if (menu) menu.remove();
  lienDuMenu = null;
}

// Place le menu sous le nom cliqué (ou au-dessus s'il n'y a pas la place), sans sortir de l'écran.
// Si le nom est sorti de la partie visible du panneau (défilement), le menu se ferme.
function placerMenuCarte() {
  const menu = document.getElementById("wmd-menu-carte");
  if (!menu || !lienDuMenu) return;
  const panneau = document.getElementById("wmd-panneau");
  const rect = lienDuMenu.getBoundingClientRect();
  const cadre = panneau ? panneau.getBoundingClientRect() : null;
  if (!lienDuMenu.isConnected || (cadre && (rect.bottom < cadre.top || rect.top > cadre.bottom))) {
    fermerMenuCarte();
    return;
  }
  const largeur = menu.offsetWidth, hauteur = menu.offsetHeight;
  const gauche = Math.max(8, Math.min(rect.left, window.innerWidth - largeur - 8));
  const haut = rect.bottom + 4 + hauteur <= window.innerHeight - 8 ? rect.bottom + 4 : Math.max(8, rect.top - hauteur - 4);
  menu.style.left = `${gauche}px`;
  menu.style.top = `${haut}px`;
}

// Un clic sur un nom de carte du panneau ouvre le menu ; un clic ailleurs, Échap ou un défilement le ferment.
document.addEventListener("click", evenement => {
  const cible = evenement.target instanceof Element ? evenement.target : null;
  if (!cible) return;
  const lien = cible.closest("#wmd-panneau .wmd-carte-cliquable");
  if (lien) {
    evenement.preventDefault();
    const ouvert = document.getElementById("wmd-menu-carte");
    if (ouvert && ouvert.dataset.pour === lien.dataset.nom + "|" + (lien.dataset.rarete || "")) fermerMenuCarte(); // 2e clic : on referme
    else ouvrirMenuCarte(lien);
    return;
  }
  if (!cible.closest("#wmd-menu-carte")) fermerMenuCarte();
});
document.addEventListener("keydown", evenement => {
  if (evenement.key === "Escape") fermerMenuCarte();
});
window.addEventListener("resize", placerMenuCarte);
// Un défilement (du panneau ou de la page) : le menu suit le nom cliqué (ou se ferme s'il n'est plus visible).
document.addEventListener("scroll", placerMenuCarte, true);

async function ouvrirMenuCarte(lien) {
  fermerMenuCarte();
  const nom = lien.dataset.nom;
  const rarete = lien.dataset.rarete || null;
  const catalogue = lien.dataset.catalogue === "1";
  const enchere = lien.dataset.enchere || null;

  const menu = creer("div", undefined, "wmd-menu-carte");
  menu.id = "wmd-menu-carte";
  menu.dataset.pour = nom + "|" + (rarete || "");
  menu.setAttribute("role", "menu");
  menu.appendChild(creer("div", `${nom}${rarete ? ` (${catalogue ? "catalogue : " : ""}${lettreRarete(rarete)})` : ""}`, "wmd-menu-titre"));

  // Tes exemplaires de cette carte (dernière lecture de ta collection), pour l'indice sous « Dans ma collection ».
  const moi = await maCollection();
  const miennes = moi ? moi.filter(carte => carte.nom === nom) : null;
  const indiceCollection = miennes === null ? "lis ta collection pour savoir si tu l'as"
    : miennes.length ? "tu l'as : " + miennes.map(c => lettreRarete(c.rarete) + (c.quantite > 1 ? ` ×${c.quantite}` : "")).join(", ")
    : "pas dans ta dernière lecture";
  const ici = ou => pageActuelle() === ou && !pageOccupee() && !(ou === "marche" && REGEX_PAGE_ENCHERE.test(location.pathname));

  const ajouterChoix = (texte, indice, action) => {
    const bouton = creer("button", undefined, "wmd-menu-choix");
    bouton.type = "button";
    bouton.setAttribute("role", "menuitem");
    bouton.append(creer("span", texte), creer("small", indice));
    bouton.addEventListener("click", evenement => {
      evenement.stopPropagation();
      fermerMenuCarte();
      action(); // tout de suite, pendant le clic : un nouvel onglet n'est permis que pendant un clic
    });
    menu.appendChild(bouton);
  };
  ajouterChoix("📚 Dans ma collection", `${indiceCollection} · ${ici("collection") ? "sur cette page" : "nouvel onglet"}`,
    () => trouverCarte("collection", nom, rarete, catalogue));
  // Au Marché : le filtre de rareté seulement si c'est la rareté d'un exemplaire (pas celle du catalogue).
  ajouterChoix("🛒 Au Marché", `${!catalogue && rarete ? `filtre ${lettreRarete(rarete)} · ` : ""}${ici("marche") ? "sur cette page" : "nouvel onglet"}`,
    () => trouverAuMarche(nom, catalogue ? null : rarete));
  ajouterChoix("🌐 Dans « Toutes les cartes »", ici("toutes-les-cartes") ? "sur cette page" : "nouvel onglet",
    () => trouverCarte("toutes-les-cartes", nom, rarete, true));
  if (enchere) ajouterChoix("🔨 Ouvrir l'enchère", "nouvel onglet", () => window.open(adresseEnchere(enchere), "_blank"));

  document.getElementById("wmd-panneau").appendChild(menu);
  lienDuMenu = lien;
  placerMenuCarte();
  const premier = menu.querySelector("button");
  if (premier) premier.focus({ preventScroll: true });
}

// --- Les recherches ---

// « collection » ou « toutes-les-cartes » : sur cette page si on y est (et rien ne tourne), sinon dans un nouvel onglet.
function trouverCarte(ou, nom, rarete, rareteSouple) {
  const demande = { ou: ou, nom: nom, rarete: rarete, rareteSouple: Boolean(rareteSouple), quand: Date.now() };
  if (pageActuelle() === ou && !pageOccupee()) {
    chercherEtOuvrirIci(demande);
    return;
  }
  window.open(ADRESSES_PAGES[ou], "_blank"); // tout de suite, pendant le clic (sinon le navigateur bloque l'onglet)
  api.storage.local.set({ trouverCarte: demande });
}

// Au Marché : sur cette page si on est sur la liste du Marché (et rien ne tourne), sinon « Chercher au marché » (nouvel onglet).
function trouverAuMarche(nom, rarete) {
  if (pageActuelle() === "marche" && !REGEX_PAGE_ENCHERE.test(location.pathname) && !pageOccupee()) {
    rechercherAuMarcheIci({ nom: nom, rarete: rarete });
    return;
  }
  chercherAuMarche(nom, rarete);
}

// Dans un onglet ouvert pour ça : la demande en attente est appliquée une fois la page prête.
// Une demande trop vieille, ou faite AVANT l'ouverture de cet onglet (un autre onglet du même genre
// déjà ouvert), est ignorée : c'est le nouvel onglet qui s'en charge.
let carteATrouverEnCours = false;
async function appliquerCarteATrouver() {
  if (carteATrouverEnCours || pageOccupee()) return;
  const { trouverCarte: demande } = await api.storage.local.get("trouverCarte");
  if (!demande) return;
  if (Date.now() - demande.quand > 60 * 1000) {
    await api.storage.local.remove("trouverCarte");
    return;
  }
  if (pageActuelle() !== demande.ou || performance.timeOrigin < demande.quand - 5000) return;
  if (!champDeRecherche()) return; // la page n'est pas encore chargée : on réessaiera
  await api.storage.local.remove("trouverCarte");
  await chercherEtOuvrirIci(demande);
}

// Le champ « Rechercher par titre ou catégorie... » de la Collection et de « Toutes les cartes ».
function champDeRecherche() {
  return [...document.querySelectorAll("input")].find(element =>
    !estDansLePanneau(element) && estVisible(element) && /rechercher par titre/i.test(element.placeholder || "")) || null;
}

// Les cartes affichées qui portent ce nom (exactement), celles de la bonne rareté d'abord.
// 1.15 : si aucune ne porte exactement ce nom, le même nom aux espaces et signes près
// (« Bob Marley (chanson) » = « Bob Marley(chanson) »), voir memeCarte (commun.js).
function cartesDuNom(nom, rarete) {
  const fiche = fenetreDeCarte();
  const affichees = trouverCadresDeCartes().filter(({ cadre }) => !(fiche && fiche.element.contains(cadre))); // pas celle de la fiche ouverte
  const nomDe = ({ cadre }) => cadre.querySelector(CONFIG.selecteurNomCarte).textContent.trim();
  let trouvees = affichees.filter(c => nomDe(c) === nom);
  if (!trouvees.length) trouvees = affichees.filter(c => memeCarte(nomDe(c), nom));
  const deLaRarete = ({ imageRarete }) => {
    const trouve = imageRarete.getAttribute("src").match(/rarity\/([a-z_]+)\./);
    return Boolean(rarete && trouve && trouve[1] === rarete);
  };
  return [...trouvees.filter(deLaRarete), ...trouvees.filter(c => !deLaRarete(c))].map(c => ({ ...c, bonneRarete: deLaRarete(c) }));
}

// Sur la Collection ou « Toutes les cartes » : tape le nom dans la recherche du site (et clique
// « Rechercher » sur « Toutes les cartes », où la recherche ne part pas toute seule), attend la
// carte, puis l'ouvre. Dans ta Collection, seule la bonne rareté est ouverte ; sur « Toutes les
// cartes » (rareteSouple), la rareté du catalogue peut différer : le même nom suffit.
async function chercherEtOuvrirIci(demande) {
  if (carteATrouverEnCours) return;
  carteATrouverEnCours = true;
  const lieu = demande.ou === "collection" ? "ta collection" : "« Toutes les cartes »";
  try {
    let champ = champDeRecherche();
    for (let essai = 0; !champ && essai < 40; essai++) { // la page se charge peut-être encore
      await pause(250);
      champ = champDeRecherche();
    }
    if (!champ) {
      afficherStatut(`Recherche de « ${demande.nom} » impossible : le champ de recherche du site est introuvable.`);
      return;
    }
    // Une fiche de carte déjà ouverte cache la grille : on la ferme (Échap, comme au clavier).
    if (fenetreDeCarte()) {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
      await pause(300);
    }
    // 1.15 : la recherche du site ne gère pas les parenthèses : « Bob Marley (chanson) » est cherchée
    // comme « Bob Marley », puis la carte au nom exact est choisie parmi les résultats.
    const cherche = texteDeRecherche(demande.nom);
    afficherStatut(`Recherche de « ${demande.nom} » dans ${lieu}…` + (cherche !== demande.nom ? ` (tapé : « ${cherche} »)` : ""));
    ecrireDansChamp(champ, cherche);
    if (demande.ou === "toutes-les-cartes") {
      let lance = false;
      for (let essai = 0; essai < 20 && !lance; essai++) {
        await pause(150);
        const bouton = boutonExact("Rechercher");
        if (bouton && !bouton.disabled) {
          bouton.click();
          lance = true;
        }
      }
      if (!lance) champ.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
    }
    // On attend la carte, puis on ouvre sa fiche. 1.15 : avec un nom raccourci (« Bob Marley »), la carte
    // voulue peut être sur une page suivante des résultats : on en regarde jusqu'à PAGES_MAX_RECHERCHE.
    let autreRarete = false;
    for (let pageLue = 1; pageLue <= PAGES_MAX_RECHERCHE; pageLue++) {
      const carte = await attendreCarteDansResultats(demande, cherche, pageLue === 1 ? 8000 : 6000);
      if (carte) {
        carte.cadre.scrollIntoView({ block: "center" });
        carte.cadre.classList.add("wmd-carte-trouvee");
        setTimeout(() => carte.cadre.classList.remove("wmd-carte-trouvee"), 4000);
        // Le clic part de l'image de la carte (comme un vrai clic) et remonte jusqu'à son cadre.
        const image = [...carte.cadre.querySelectorAll("img")].find(img => !(img.getAttribute("src") || "").includes("/rarity/"));
        (image || carte.cadre).click();
        afficherStatut(`« ${demande.nom} » trouvée dans ${lieu}`
          + (!carte.bonneRarete && demande.rarete ? ` (rareté ${lettreRarete(trouverRarete(carte))} ici)` : "")
          + (pageLue > 1 ? ` (page ${pageLue} des résultats)` : "") + ".");
        return;
      }
      autreRarete = autreRarete || cartesDuNom(demande.nom, null).length > 0;
      // Pas sur cette page : la page suivante des résultats, s'il y en a une.
      const page = lirePagination();
      if (!page || page.actuelle >= page.total || pageLue === PAGES_MAX_RECHERCHE) break;
      const bouton = trouverBoutonParTexte(CONFIG.texteBoutonPageSuivante);
      if (!bouton) break;
      const signatureAvant = signaturePage();
      afficherStatut(`« ${demande.nom} » n'est pas sur la page ${page.actuelle} des résultats : page suivante…`);
      bouton.click();
      const arrivee = await attendre(() => {
        const p = lirePagination();
        return p && p.actuelle === page.actuelle + 1 && signaturePage() !== "" && signaturePage() !== signatureAvant;
      }, 10000);
      if (!arrivee) break;
    }
    afficherStatut(demande.ou === "collection"
      ? (autreRarete ? `« ${demande.nom} » est dans ta collection, mais pas en ${lettreRarete(demande.rarete)}.`
        : `« ${demande.nom} » n'apparaît pas dans ta collection : tu ne l'as peut-être plus.`)
      : `« ${demande.nom} » n'est pas dans les ${PAGES_MAX_RECHERCHE} premières pages de résultats de « ${cherche} » : regarde les suivantes.`);
  } finally {
    carteATrouverEnCours = false;
  }
}

// 1.15 : on regarde au plus 5 pages de résultats (une page de plus = une requête de plus au site).
const PAGES_MAX_RECHERCHE = 5;

// Attend (au plus "ms") la carte voulue dans les résultats affichés. Renvoie la carte, ou null quand les
// résultats de la recherche sont là (des cartes dont le nom contient le texte tapé) sans elle.
async function attendreCarteDansResultats(demande, cherche, ms) {
  const debut = Date.now();
  let resultatsDepuis = null;
  while (Date.now() - debut < ms) {
    await pause(200);
    const [carte] = cartesDuNom(demande.nom, demande.rarete);
    if (carte && (carte.bonneRarete || demande.rareteSouple || !demande.rarete)) return carte;
    const resultats = trouverCadresDeCartes().some(({ cadre }) =>
      nomContient(cadre.querySelector(CONFIG.selecteurNomCarte).textContent, cherche));
    if (!resultats) { resultatsDepuis = null; continue; }
    resultatsDepuis = resultatsDepuis || Date.now();
    if (Date.now() - resultatsDepuis > 1500) return null; // les résultats sont stables, sans la carte
  }
  return null;
}

function trouverRarete({ imageRarete }) {
  const trouve = imageRarete.getAttribute("src").match(/rarity\/([a-z_]+)\./);
  return trouve ? trouve[1] : null;
}

// Le bouton « Exporter les prix du marché (CSV) » : une ligne par carte vue au marché,
// avec une colonne « À moi » si elle est dans ta collection.
async function exporterPrixMarche() {
  const contenu = await csvPrixMarche();
  if (!contenu) {
    afficherStatut("Aucun prix relevé : passe d'abord sur la page Marché.");
    return;
  }
  telechargerFichier("prix-marche-wikimasters.csv", contenu, "text/csv;charset=utf-8");
  afficherStatut("Fichier CSV des prix du marché téléchargé.");
}

// 1.17 : le pic de prix dans le fichier CSV : « ×3.2 | 4200 | 2026-11-03 | habituel 1300 | sans pic 1350 | 2 ventes | retombé | dans la moyenne ».
function textePicCSV(pic) {
  return [`×${pic.ratio}`, pic.prix, pic.jour, `habituel ${pic.normal}`, `sans pic ${pic.sansPic}`, `${pic.ventes} ventes`,
    pic.retombe ? "retombé" : "pas retombé", pic.dansMoyenne ? "dans la moyenne" : "hors moyenne"].join(" | ");
}
function picDepuisCSV(texte) {
  const morceaux = String(texte || "").split("|").map(m => m.trim());
  if (morceaux.length < 8) return null;
  const nombre = m => { const n = Number(String(m).replace(/[^\d.]/g, "")); return Number.isFinite(n) && n > 0 ? n : null; };
  const pic = { ratio: nombre(morceaux[0]), prix: nombre(morceaux[1]), jour: morceaux[2], normal: nombre(morceaux[3]),
    sansPic: nombre(morceaux[4]), ventes: nombre(morceaux[5]) || 0, retombe: morceaux[6] === "retombé", dansMoyenne: morceaux[7] === "dans la moyenne" };
  return pic.ratio && pic.prix && pic.normal && /^\d{4}-\d{2}-\d{2}$/.test(pic.jour) ? pic : null;
}

// 1.14 : le contenu du fichier des prix (null s'il n'y a aucun prix), pour le téléchargement et pour Google Drive.
async function csvPrixMarche() {
  const groupes = await prixParCarte();
  if (groupes.size === 0) return null;
  const collection = (await maCollection()) || [];
  const aMoi = new Map(collection.map(carte => [`${carte.nom}|${carte.rarete}`, carte.quantite]));
  // 1.10 : deux colonnes de plus (prix moyen du site et sa date), pour pouvoir réimporter le fichier.
  const { marche } = await api.storage.local.get("marche");
  const moyennes = (marche && marche.moyennes) || {};
  const { tendances = {} } = await api.storage.local.get("tendances"); // 1.16 : variations du prix (1 semaine, 2 mois)
  // 1.16 : le jour du relevé le plus récent des prix du Marché de chaque carte (pour garder le plus récent à l'import).
  const marcheVuLe = new Map();
  for (const a of Object.values((marche && marche.annonces) || {})) {
    const cle = `${a.nom}|${a.rarete}`;
    if ((Number(a.vu) || 0) > (marcheVuLe.get(cle) || 0)) marcheVuLe.set(cle, Number(a.vu));
  }
  const lignes = ["Carte;Rareté;Prix estimé;Minimum seulement;Ventes terminées;Enchères en cours;Prix le plus bas;Prix le plus haut;À moi;Tous les prix;Prix moyen du site;Prix moyen relu le;Variation 1 semaine (%);Variation 2 mois (%);Variations du;Prix du Marché relevés le;Pic de prix"];
  for (const g of [...groupes.values()].sort((a, b) => b.estimation - a.estimation)) {
    const m = moyennes[`${g.nom}|${g.rarete}`];
    const t = tendances[`${g.nom}|${g.rarete}`];
    lignes.push([champCSV(g.nom), lettreRarete(g.rarete), g.estimation, g.minimum ? "oui" : "non",
      g.terminees.length, g.enCours.length, g.min ?? "", g.max ?? "", aMoi.get(`${g.nom}|${g.rarete}`) || 0,
      champCSV(g.liste.map(p => p.prix + (p.terminee ? " (fini)" : "")).join(" · ")),
      m ? m.prix : "", m && m.vu ? jourDe(m.vu) : "", // 1.14 : la date au jour près (2026-11-22)
      t && Number.isFinite(t.semaine) ? t.semaine : "", t && Number.isFinite(t.deuxMois) ? t.deuxMois : "",
      t && t.calcule ? jourDe(t.calcule) : "", jourDe(marcheVuLe.get(`${g.nom}|${g.rarete}`)),
      champCSV(t && t.pic ? textePicCSV(t.pic) : "")].join(";")); // 1.17 : le pic de prix (prix gonflé ?)
  }
  return MARQUE_EXCEL + lignes.join("\r\n");
}

// 1.14 : le bouton « ☁️ Mettre à jour les prix » : lire le fichier des prix partagé (Google Drive,
// à travers le script Google réglé dans les réglages), ajouter ce qui manque aux prix de l'extension
// (comme l'import), puis renvoyer le fichier complet. Rien n'est envoyé à WikiMasters.
let majPartageEnCours = false;
// 1.17.1 (optimisation) : l'empreinte du dernier fichier envoyé. En automatique, si rien n'a changé
// depuis, le fichier n'est pas renvoyé (l'envoi est la partie la plus lente : tout le fichier part chez Google).
// Il est quand même renvoyé au moins toutes les 6 heures, et toujours avec le bouton.
const RENVOI_PARTAGE_MAX_MS = 6 * 60 * 60 * 1000;
function empreinteTexte(texte) {
  let h1 = 0x811c9dc5, h2 = 0;
  for (let i = 0; i < texte.length; i++) {
    const c = texte.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = (Math.imul(h2, 31) + c) | 0;
  }
  return `${texte.length}-${(h1 >>> 0).toString(36)}-${(h2 >>> 0).toString(36)}`;
}
async function mettreAJourPrixPartages(automatique = false) {
  if (majPartageEnCours) return;
  majPartageEnCours = true;
  const demander = async contenu => {
    const reponse = await api.runtime.sendMessage(contenu);
    if (reponse && reponse.erreur === "pas-configure") throw new Error("pas-configure");
    if (!reponse || reponse.erreur) throw new Error(reponse ? reponse.erreur : "pas de réponse de l'extension");
    return reponse;
  };
  try {
    afficherStatut("☁️ Lecture du fichier des prix partagé…");
    const lu = await demander({ type: "partage-lire" });
    let bilanImport = "";
    if (lu.texte && lu.texte.trim()) {
      if (!(await importerTexteCSV("le fichier partagé", lu.texte, true))) return; // illisible : on n'envoie rien
      bilanImport = document.getElementById("wmd-statut").textContent + " ";
    }
    const contenu = await csvPrixMarche();
    if (!contenu) return afficherStatut(bilanImport + "Aucun prix à envoyer : passe d'abord sur la page Marché.");
    const empreinte = empreinteTexte(contenu);
    const { partageDernierEnvoi: dernier } = await api.storage.local.get("partageDernierEnvoi");
    if (automatique && lu.texte && lu.texte.trim() && dernier && dernier.empreinte === empreinte
      && Date.now() - dernier.le < RENVOI_PARTAGE_MAX_MS) {
      return afficherStatut(bilanImport + `☁️ Rien de nouveau à envoyer (${dateLisible(Date.now())}) : le fichier partagé a déjà tes prix.`);
    }
    afficherStatut(bilanImport + "☁️ Envoi du fichier complet…");
    const envoi = await demander({ type: "partage-ecrire", texte: contenu });
    await api.storage.local.set({ partageDernierEnvoi: { empreinte: empreinte, le: Date.now() } }).catch(() => {});
    afficherStatut(bilanImport + `☁️ Fichier partagé mis à jour (${dateLisible(Date.now())}) : ${envoi.lignes} carte(s)`
      + (envoi.ajoutees ? `, dont ${envoi.ajoutees} nouvelle(s) apportée(s) par toi.` : "."));
  } catch (erreur) {
    if (erreur.message === "pas-configure") {
      afficherStatut("☁️ Le fichier partagé n'est pas encore réglé : ouvre « Réglages et notifications », partie « Prix partagés ».");
    } else {
      afficherStatut(`☁️ Mise à jour impossible : ${erreur.message}.`);
    }
  } finally {
    majPartageEnCours = false;
  }
}

// ---------------------------------------------------------------------
//  PARTIE 13 TER : LE PRIX ESTIMÉ DANS LA FICHE D'UNE CARTE (nouveau en 1.4.2)
//  Quand tu cliques sur une de tes cartes, le site ouvre sa fiche avec le bouton
//  « Mettre aux enchères ». Juste au-dessus, l'extension affiche le prix estimé
//  de CETTE carte dans CETTE rareté (une Légendaire et une Ultra rare du même nom
//  sont deux cartes différentes, avec des prix très différents).
// ---------------------------------------------------------------------

// Nouveau en 1.6.5 : efface les prix relevés d'une carte dans une rareté.
function oublierPrix(nom, rarete) {
  return modifierMemoire(() => oublierPrixMaintenant(nom, rarete)); // 1.17 : chacun son tour
}
async function oublierPrixMaintenant(nom, rarete) {
  const { marche } = await api.storage.local.get("marche");
  if (!marche || !marche.annonces) return;
  let effacees = 0;
  for (const [cle, annonce] of Object.entries(marche.annonces)) {
    if (annonce.nom === nom && annonce.rarete === rarete) { delete marche.annonces[cle]; effacees++; }
  }
  // 1.7.3 : le prix moyen du site est gardé (il ne dépend pas des prix trouvés au Marché).
  await api.storage.local.set({ marche: marche });
  afficherStatut(`${effacees} prix oublié(s) pour ${nom}. Ils seront relus au Marché.`);
}

// Le nom en clair affiché par le site (« Légendaire ») → la rareté (« legendaire »).
function rareteDepuisNom(texte) {
  const cherche = texte.trim().toLowerCase();
  return Object.keys(RARETES).find(rarete => RARETES[rarete].nom.toLowerCase() === cherche) || null;
}

let ficheEnCours = false;
async function afficherPrixDansFiche() {
  if (ficheEnCours) return;
  // Le bouton « Mettre aux enchères » de la fiche (on ne fait que le repérer, on ne clique jamais dessus).
  const bouton = [...document.querySelectorAll("button")].find(element =>
    !estDansLePanneau(element) && estVisible(element) && /mettre aux ench[èe]res/i.test(element.textContent));
  if (!bouton) return;
  // La fiche : le premier parent qui contient le titre h2 (le nom de la carte).
  let fiche = bouton.parentElement;
  while (fiche && !fiche.querySelector("h2")) fiche = fiche.parentElement;
  if (!fiche) return;
  const nom = fiche.querySelector("h2").textContent.trim();
  let rarete = null;
  for (const element of fiche.querySelectorAll("span")) {
    if (element.children.length === 0 && (rarete = rareteDepuisNom(element.textContent))) break;
  }
  // Corrigé en 1.6.7 : la nouvelle fiche du site n'écrit plus la rareté en toutes lettres (« Ultra rare »),
  // seulement le petit badge « UR » sur l'image de la carte, et le fond « …/ultra_rare.webp ».
  if (!rarete) {
    for (const element of fiche.querySelectorAll("div, span")) {
      if (estPetitBadge(element) && !estDansLePanneau(element)
        && (rarete = rareteDepuisLettre(element.textContent.trim()))) break;
    }
  }
  if (!rarete) {
    for (const image of fiche.querySelectorAll("img[src]")) {
      const trouve = image.getAttribute("src").match(/([a-z_]+)\.(webp|png|jpe?g|gif|svg)(\?|$)/);
      if (trouve && RARETES[trouve[1]]) { rarete = trouve[1]; break; }
    }
  }
  if (!rarete) return;

  const ligne = bouton.parentElement; // la rangée « Mettre aux enchères » + « Défausser »
  // Corrigé en 1.8 : l'encart est cherché dans toute la page (il peut être rangé hors de la fiche) :
  // avant, il pouvait être recréé toutes les secondes et s'empiler.
  let encart = document.getElementById("wmd-prix-fiche");
  const cle = `${nom}|${rarete}`;
  if (encart && encart.dataset.cle === cle && encart.nextElementSibling === ligne) return; // déjà à jour

  ficheEnCours = true;
  try {
    const groupes = await prixParCarte();
    if (!encart) {
      encart = creer("div", undefined, "wmd-prix-fiche");
      encart.id = "wmd-prix-fiche";
    }
    encart.dataset.cle = cle;
    encart.replaceChildren();
    // Nouveau en 1.4.4 : le bouton « Chercher au marché » (toujours là, même si le relevé des prix est coupé).
    // 1.16 : remplacé par le bloc « 🛒 Voir au Marché » (le même partout : fiches, « Toutes les cartes », enchères).
    encart.appendChild(blocVoirAuMarche(nom, rarete));
    // 1.10 : « Vérifier si un de mes amis la possède » (la recherche des souhaits, pour cette seule carte).
    const amis = creer("button", "👥 Vérifier si un de mes amis la possède", "wmd-chercher-marche");
    amis.type = "button";
    amis.title = "Va sur la page Amis et cherche cette carte (même rareté) chez chacun de tes amis. Chaque ami demande plusieurs requêtes au site : à utiliser avec modération.";
    amis.addEventListener("click", () => verifierChezAmis(nom, rarete));
    const blocAmis = creer("div", undefined, "wmd-amis");
    blocAmis.append(amis, creer("div", texteDerniereRechercheAmis(), "wmd-discret"));
    // Nouveau en 1.6.5 : « Oublier ces prix » efface les prix relevés pour cette carte dans cette rareté.
    if (reglages.marche && groupes.has(cle)) {
      const oublier = creer("button", "🗑 Oublier ces prix", "wmd-chercher-marche");
      oublier.type = "button";
      oublier.title = "Efface les prix relevés pour cette carte dans cette rareté (ils seront relus au Marché)";
      oublier.addEventListener("click", () => oublierPrix(nom, rarete));
      encart.appendChild(oublier);
    }
    const prix = reglages.marche ? groupes.get(cle) : null;
    if (!reglages.marche) {
      // Relevé coupé dans les réglages : seulement le bouton.
    } else if (prix) {
      // 1.7.3 : le prix moyen du site et les prix trouvés au Marché sont affichés À PART.
      const nomR = RARETES[rarete] ? RARETES[rarete].nom : "?";
      encart.appendChild(creer("b", prix.moyenne ? `Prix moyen du site (${nomR}) : ${nombreLisible(prix.estimation)}` : `Pas de prix moyen du site relevé (${nomR}).`));
      if (texteMarche(prix)) encart.appendChild(creer("div", texteMarche(prix)));
      // 1.7.1 : le prix le plus bas auquel la carte a été vue VENDUE.
      encart.appendChild(creer("div", prix.minVendu !== null ? `Vendue au minimum : ${nombreLisible(prix.minVendu)}` : "Pas encore vue vendue."));
      encart.appendChild(creer("div", `${prix.terminees.length} vente(s) terminée(s), ${prix.enCours.length} enchère(s) en cours relevées au Marché.`, "wmd-discret"));
    } else {
      encart.appendChild(creer("b", `Aucun prix relevé pour ${nom} en ${RARETES[rarete] ? RARETES[rarete].nom : "cette rareté"}.`));
    }
    // 1.17 : prix peut-être gonflé artificiellement (🎈), d'après l'historique des prix du site.
    const pic = reglages.marche ? picASignaler(await tendanceDe(nom, rarete)) : null;
    if (pic) encart.appendChild(creer("div", textePic(pic), "wmd-alerte-pic"));
    // 1.10 : le prix d'achat, si tu as remporté cette carte aux enchères.
    for (const achat of achatsDe(nom, rarete)) {
      encart.appendChild(creer("div", `🛒 Achetée aux enchères : ${texteAchat(achat)}${dateAchat(achat)}`
        + (achat.incertain ? " (probable : prix final non lu, c'était ta dernière mise)" : ""), "wmd-achat-fiche"));
    }
    // La même carte vue dans d'autres raretés : à titre indicatif seulement.
    encart.appendChild(blocAmis); // 1.10 : le bouton « amis », sous les prix
    const autres = Object.keys(RARETES).filter(r => reglages.marche && r !== rarete && groupes.has(`${nom}|${r}`))
      .map(r => `${RARETES[r].nom} : ${groupes.get(`${nom}|${r}`).minimum ? "≥ " : ""}${nombreLisible(groupes.get(`${nom}|${r}`).estimation)}`);
    if (autres.length) encart.appendChild(creer("div", `Vue au marché dans une autre rareté (prix non comparable) : ${autres.join(", ")}.`, "wmd-discret"));
    ligne.parentElement.insertBefore(encart, ligne);
  } finally {
    ficheEnCours = false;
  }
}

// Si les prix changent (un relevé au marché dans un autre onglet), on recalcule l'encart.
// 1.17 : aussi quand les variations (et le pic de prix) changent, et pour l'encart des cartes que tu n'as pas.
api.storage.onChanged.addListener(changements => {
  if (!changements.marche && !changements.tendances) return;
  tendancesFiche = null;
  for (const id of ["wmd-prix-fiche", "wmd-amis-fiche"]) {
    const encart = document.getElementById(id);
    if (encart) encart.dataset.cle = "";
  }
});
// 1.17 : la mémoire « tendances » (variations et pic de prix), gardée en copie pour les fiches.
let tendancesFiche = null;
async function tendanceDe(nom, rarete) {
  if (!tendancesFiche) tendancesFiche = (await api.storage.local.get("tendances")).tendances || {};
  return tendancesFiche[`${nom}|${rarete}`] || null;
}



// ---------------------------------------------------------------------
//  PARTIE 13 QUATER : CHERCHER UNE CARTE AU MARCHÉ (nouveau en 1.4.4)
//  Dans la fiche d'une de tes cartes, le bouton « Chercher au marché » ouvre le
//  marché dans un nouvel onglet. Là, l'extension tape le nom de la carte dans la
//  recherche du site, clique sur « Rechercher », puis sur le filtre de sa rareté.
//  Le site ne met pas la recherche dans l'adresse : on passe donc la demande par
//  la mémoire de l'extension (« rechercheMarche »).
// ---------------------------------------------------------------------

const PAGE_MARCHE = "https://www.wiki-masters.com/marketplace";

// 1.16 : "depuis" = l'identifiant de l'enchère d'où vient la demande (elle n'est pas comptée parmi « les autres »).
function chercherAuMarche(nom, rarete, depuis = null) {
  // window.open doit partir tout de suite, pendant le clic (sinon le navigateur bloque l'onglet).
  window.open(PAGE_MARCHE, "_blank");
  api.storage.local.set({ rechercheMarche: { nom: nom, rarete: rarete, depuis: depuis, quand: Date.now() } });
}

// ---------------------------------------------------------------------
//  1.16 : « 🛒 VOIR AU MARCHÉ », EN UN CLIC, PARTOUT OÙ L'ON REGARDE UNE CARTE
//  Dans la fiche d'une carte (la tienne, celle de « Toutes les cartes », une carte de ta liste de
//  souhaits…) et sur la page d'une enchère : un clic ouvre le Marché dans un nouvel onglet, y cherche
//  la carte, et le panneau dit combien d'annonces de CETTE carte sont en vente (encadrées en bleu).
//  - rarete : la rareté de TON exemplaire ou de l'enchère regardée : la recherche est filtrée sur elle,
//    et un lien « toutes raretés » est proposé à côté ;
//  - catalogue = true (« Toutes les cartes », liste de souhaits) : la rareté du catalogue peut différer de
//    celle des exemplaires vendus, la recherche se fait donc dans toutes les raretés, avec un lien « seulement … ».
//  C'est une recherche du site, comme si tu la tapais (une requête) ; rien n'est acheté ni misé.
// ---------------------------------------------------------------------
function blocVoirAuMarche(nom, rarete, { catalogue = false, depuis = null } = {}) {
  const bloc = creer("div", undefined, "wmd-voir-marche");
  const lettre = rarete && RARETES[rarete] ? lettreRarete(rarete) : null;
  const filtre = catalogue ? null : lettre ? rarete : null;
  const principal = creer("button", depuis ? "🛒 Voir les autres ventes au Marché" : "🛒 Voir au Marché si elle est en vente", "wmd-voir-marche-bouton");
  principal.type = "button";
  principal.title = `Ouvre le Marché dans un nouvel onglet et y cherche « ${nom} »`
    + (filtre ? ` en ${RARETES[filtre].nom}` : " (toutes raretés)") + ". Rien n'est acheté ni misé.";
  principal.addEventListener("click", () => chercherAuMarche(nom, filtre, depuis));
  const details = creer("span", (filtre ? `${lettre} seulement` : "toutes raretés") + " · nouvel onglet", "wmd-discret");
  bloc.append(principal, details);
  // L'autre choix : toutes raretés (si on filtre), ou seulement la rareté affichée (si on ne filtre pas).
  const autre = filtre ? null : lettre;
  const lien = creer("a", filtre ? "toutes raretés" : `seulement ${autre}`, "wmd-lien-carte");
  if (filtre || autre) {
    lien.href = "#";
    lien.title = filtre ? "La même recherche, sans filtre de rareté" : `La même recherche, filtrée sur la rareté ${autre}`;
    lien.addEventListener("click", evenement => {
      evenement.preventDefault();
      chercherAuMarche(nom, filtre ? null : rarete, depuis);
    });
    bloc.append(" · ", lien);
  }
  return bloc;
}

// ---------------------------------------------------------------------
//  « 🛒 CHERCHER AU MARCHÉ » SOUS CHAQUE CARTE DE LA LISTE DE SOUHAITS DE LA GUILDE
//  Sur la page Guilde (/guild), le site n'ouvre pas la fiche des cartes souhaitées. Sous chacune,
//  l'extension ajoute un bouton : c'est seulement quand TU cliques dessus que le Marché s'ouvre dans
//  un nouvel onglet et y cherche la carte, dans la rareté affichée (lien « toutes raretés » à côté).
//  Rien n'est fait tout seul sur la page Guilde ; rien n'est acheté ni misé.
// ---------------------------------------------------------------------
function cartesSouhaitsGuilde() {
  const titreListe = [...document.querySelectorAll("h3")].find(titre =>
    !estDansLePanneau(titre) && titre.textContent.trim() === "Liste de souhaits");
  if (!titreListe) return [];
  const section = titreListe.closest(".card-frame") || (titreListe.parentElement && titreListe.parentElement.parentElement);
  if (!section) return [];
  const titres = [...section.querySelectorAll("h3")].filter(titre => titre !== titreListe && !estDeLExtension(titre) && titre.textContent.trim());
  if (!titres.length) return [];
  // La grille des cartes : le bloc « flex-wrap » qui contient les titres ; chaque enfant = une carte + ses liens.
  const grille = [...section.querySelectorAll("div.flex-wrap")].find(div => titres.every(titre => div.contains(titre)));
  const cartes = [];
  for (const titre of titres) {
    let element = titre;
    if (grille) {
      while (element.parentElement && element.parentElement !== grille) element = element.parentElement;
      if (element.parentElement !== grille) continue;
    } else {
      // Sans grille reconnue : le plus grand bloc qui ne contient que CE titre de carte.
      while (element.parentElement && element.parentElement !== section
        && titres.filter(autre => element.parentElement.contains(autre)).length === 1) element = element.parentElement;
    }
    const rarete = rareteDuCadre(element);
    cartes.push({ nom: titre.textContent.trim(), rarete: RARETES[rarete] ? rarete : null, cadre: element });
  }
  return cartes;
}

function boutonsMarcheSouhaitsGuilde() {
  if (!location.pathname.startsWith("/guild")) return;
  for (const { nom, rarete, cadre } of cartesSouhaitsGuilde()) {
    const signature = JSON.stringify([nom, rarete]);
    const ancien = [...cadre.children].find(enfant => enfant.classList.contains("wmd-souhait-marche"));
    if (ancien && ancien.dataset.signature === signature && ancien === cadre.lastElementChild) continue; // déjà là
    if (ancien) ancien.remove();
    const bloc = creer("div", undefined, "wmd-souhait-marche");
    bloc.dataset.signature = signature;
    const lettre = rarete ? lettreRarete(rarete) : null;
    const bouton = creer("button", "🛒 Chercher au Marché", "wmd-souhait-marche-bouton");
    bouton.type = "button";
    bouton.title = `Ouvre le Marché dans un nouvel onglet et y cherche « ${nom} »`
      + (rarete ? ` en ${RARETES[rarete].nom}` : " (toutes raretés)") + ". Rien n'est acheté ni misé.";
    bouton.addEventListener("click", evenement => {
      evenement.stopPropagation();
      chercherAuMarche(nom, rarete);
    });
    bloc.appendChild(bouton);
    if (lettre) {
      const toutes = creer("a", "toutes raretés", "wmd-lien-carte");
      toutes.href = "#";
      toutes.title = "La même recherche, sans filtre de rareté";
      toutes.addEventListener("click", evenement => {
        evenement.preventDefault();
        evenement.stopPropagation();
        chercherAuMarche(nom, null);
      });
      const details = creer("div", undefined, "wmd-souhait-marche-details");
      details.append(`${lettre} seulement · `, toutes);
      bloc.appendChild(details);
    }
    cadre.appendChild(bloc);
  }
}

// Un bouton du site dont le texte est EXACTEMENT celui-ci (pas seulement « contient »).
function boutonExact(texte) {
  return [...document.querySelectorAll("button")].find(bouton =>
    !estDansLePanneau(bouton) && estVisible(bouton) && bouton.textContent.trim() === texte) || null;
}

// Sur la page Marché : s'il y a une recherche en attente, on l'applique (une seule fois).
let rechercheEnCours = false;
async function appliquerRechercheEnAttente() {
  if (pageActuelle() !== "marche" || rechercheEnCours) return;
  const { rechercheMarche: demande } = await api.storage.local.get("rechercheMarche");
  if (!demande) return;
  // Trop vieille, ou faite AVANT l'ouverture de cet onglet (un autre onglet Marché déjà ouvert) : on ignore.
  if (Date.now() - demande.quand > 60 * 1000) {
    await api.storage.local.remove("rechercheMarche");
    return;
  }
  if (performance.timeOrigin < demande.quand - 5000) return;
  if (!champRechercheMarche()) return; // la page n'est pas encore chargée : on réessaiera dans une seconde
  await api.storage.local.remove("rechercheMarche");
  await rechercherAuMarcheIci(demande);
}

function champRechercheMarche() {
  return [...document.querySelectorAll("input")].find(element =>
    !estDansLePanneau(element) && /rechercher une carte/i.test(element.placeholder || "")) || null;
}

// 1.11 : la recherche elle-même, séparée pour servir aussi sur place (clic sur une carte du panneau).
async function rechercherAuMarcheIci(demande) {
  const champ = champRechercheMarche();
  if (!champ || rechercheEnCours) return;
  rechercheEnCours = true;
  try {
    // 1.15 : sans les parenthèses (« Bob Marley (chanson) » → « Bob Marley »), que la recherche du site ne gère pas.
    const cherche = texteDeRecherche(demande.nom);
    afficherStatut(`Recherche de « ${demande.nom} » au marché…` + (cherche !== demande.nom ? ` (tapé : « ${cherche} »)` : ""));
    // On écrit le nom comme si tu l'avais tapé (le site écoute l'évènement « input »).
    // 1.15 : par le « vrai » réglage de la valeur (ecrireDansChamp), que React voit à coup sûr.
    ecrireDansChamp(champ, cherche);
    // Puis on clique sur « Rechercher » dès qu'il devient cliquable.
    let lance = false;
    for (let essai = 0; essai < 20 && !lance; essai++) {
      await pause(150);
      const bouton = boutonExact("Rechercher");
      if (bouton && !bouton.disabled) {
        bouton.click();
        lance = true;
      }
    }
    if (!lance) champ.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
    // Enfin, le filtre de rareté (L, UR, SR...), pour ne voir que la carte dans TA rareté.
    await pause(800);
    const filtre = demande.rarete ? boutonExact(lettreRarete(demande.rarete)) : null;
    // 1.11 : un filtre déjà choisi n'est pas recliqué (un 2e clic l'enlèverait), utile pour une recherche sur place.
    const dejaChoisi = filtre && (filtre.classList.contains(CONFIG.classeFiltreChoisi) || filtre.getAttribute("aria-pressed") === "true");
    if (filtre && !dejaChoisi) filtre.click();
    afficherStatut(`Recherche de « ${demande.nom} »${filtre ? ` (${RARETES[demande.rarete].nom})` : ""} lancée au marché.`);
    // 1.16 : on attend les résultats de la recherche (toutes les annonces affichées contiennent le texte tapé,
    // et sont de la bonne rareté s'il y a un filtre), puis on dit combien d'annonces de CETTE carte sont en vente.
    // Elles sont entourées en bleu quelques secondes (1.15 : utile quand le nom a été raccourci).
    const filtreRarete = filtre ? demande.rarete : null;
    const resultats = await attendre(() => {
      const blocs = [...document.querySelectorAll("[id^='marketplace-auction-']")];
      if (!blocs.length) return null;
      const arrives = blocs.every(bloc => {
        const titre = bloc.querySelector(CONFIG.selecteurNomCarte);
        return titre && nomContient(titre.textContent, cherche) && (!filtreRarete || rareteDuCadre(bloc) === filtreRarete);
      });
      return arrives ? blocs : null;
    }, 7000);
    const exactes = (resultats || []).filter(bloc => {
      const titre = bloc.querySelector(CONFIG.selecteurNomCarte);
      return titre && memeCarte(titre.textContent, demande.nom);
    });
    const autres = exactes.filter(bloc => !demande.depuis || bloc.id !== "marketplace-auction-" + demande.depuis);
    for (const bloc of autres) {
      bloc.classList.add("wmd-carte-trouvee");
      setTimeout(() => bloc.classList.remove("wmd-carte-trouvee"), 8000);
    }
    if (autres.length) autres[0].scrollIntoView({ block: "center", behavior: "smooth" });
    const ou = `« ${demande.nom} »${filtreRarete ? ` (${lettreRarete(filtreRarete)})` : ""}`;
    const tape = cherche !== demande.nom ? ` Tapé : « ${cherche} » (le site ne gère pas les parenthèses).` : "";
    const voisines = resultats ? resultats.length - exactes.length : 0;
    afficherStatut(autres.length
      ? `🛒 ${autres.length} ${demande.depuis ? "autre(s) " : ""}annonce(s) de ${ou} en vente au Marché, entourée(s) en bleu.`
        + (voisines ? ` ${voisines} autre(s) carte(s) au nom proche aussi affichée(s).` : "") + tape
      : resultats
        ? `Aucune ${demande.depuis ? "autre " : ""}annonce de ${ou} au Marché en ce moment.` + (voisines ? ` (${voisines} carte(s) au nom proche affichée(s).)` : "") + tape
        : `Recherche de ${ou} lancée au Marché : aucune annonce affichée pour l'instant.` + tape);
  } finally {
    rechercheEnCours = false;
  }
}


// ---------------------------------------------------------------------
//  PARTIE 13 QUINQUIES : MES CARTES SOUHAITÉES CHEZ MES AMIS (nouveau en 1.5)
//  1) L'extension va sur « Toutes les cartes », active le filtre « Liste de souhaits »
//     et retient tes cartes souhaitées (nom + rareté).
//  2) Elle va sur la page Amis. Pour chaque ami, elle ouvre « Échanger », passe sur
//     l'onglet « Cartes de … » et y cherche chacune de tes cartes souhaitées, puis
//     ferme la fenêtre avec « Annuler ».
//  3) Elle liste qui possède quoi, avec un bouton « Échanger » par carte trouvée.
//  Elle ne clique JAMAIS sur « Envoyer l'offre » : c'est toujours toi qui envoies.
// ---------------------------------------------------------------------

const SOUHAITS = {
  pageToutes: "https://www.wiki-masters.com/global-collection",
  pageAmis: "https://www.wiki-masters.com/friends",
  texteFiltre: "Liste de souhaits",
  pauseMs: 700,          // petite pause entre deux actions, pour laisser le site répondre
  attenteMaxMs: 6000,    // temps maximum pour attendre qu'une fenêtre ou un résultat s'affiche
  pagesMaxRecherche: 10  // au-delà, on arrête de feuilleter les résultats d'une recherche
};

// Attend qu'une condition devienne vraie. Renvoie sa valeur, ou null si le temps est écoulé.
async function attendre(condition, ms = SOUHAITS.attenteMaxMs) {
  const debut = Date.now();
  while (Date.now() - debut < ms) {
    const valeur = condition();
    if (valeur) return valeur;
    await pause(200);
  }
  return null;
}

// Clique sur un bouton du site, SAUF s'il sert à envoyer quelque chose : double sécurité.
function cliquer(bouton) {
  if (!bouton || /envoyer|enchér|acheter|payer/i.test(bouton.textContent)) return false;
  bouton.click();
  return true;
}

// 1.15 : aux majuscules, accents, espaces et signes près (voir memeCarte dans commun.js).
function memeNom(a, b) {
  return memeCarte(a, b);
}

// La rareté d'une carte affichée : l'image de fond (…/rarity/legendaire.webp ou legendaire.webp),
// sinon le petit badge « L », « UR »...
const REGEX_IMAGE_RARETE = /(?:^|[\/%2F._-])(legendaire|ultra_rare|super_rare|peu_commun|rare|commun)\.(?:webp|png|jpe?g|gif)/i;
function rareteDuCadre(cadre) {
  for (const image of cadre.querySelectorAll("img")) {
    const trouve = (image.getAttribute("src") || "").match(REGEX_IMAGE_RARETE);
    if (trouve) return trouve[1].toLowerCase();
  }
  for (const element of cadre.querySelectorAll("div, span")) {
    if (estPetitBadge(element) && rareteDepuisLettre(element.textContent.trim())) {
      return rareteDepuisLettre(element.textContent.trim());
    }
  }
  return "inconnue";
}

// Les cartes affichées dans une zone : [{ nom, rarete, cadre }]. Une carte = un titre h3.
function cartesDans(zone) {
  const cartes = [];
  for (const titre of zone.querySelectorAll("h3")) {
    if (estDansLePanneau(titre)) continue;
    // Le cadre : le premier parent qui contient aussi l'image de la carte.
    let cadre = titre.parentElement;
    while (cadre && cadre !== zone && !cadre.querySelector("img")) cadre = cadre.parentElement;
    if (!cadre) continue;
    cadre = titre.closest("button") || cadre; // dans la fenêtre d'échange, chaque carte est un bouton
    cartes.push({ nom: titre.textContent.trim(), rarete: rareteDuCadre(cadre), cadre: cadre });
  }
  return cartes;
}

// --- La mémoire de la recherche en cours (elle survit aux changements de page) ---
// chasse = { etape: "souhaits" | "amis", souhaits: [{ nom, rarete }], quand }
async function lireChasse() {
  if (!chasseConnue) return null; // 1.10 : rien en cours (copie à jour) : pas besoin de relire la mémoire
  const { chasse } = await api.storage.local.get("chasse");
  return chasse || null;
}


// Le bouton du panneau.
async function chercherSouhaitsChezAmis() {
  if (enCours) return;
  await api.storage.local.set({ chasse: { etape: "souhaits", quand: Date.now() } });
  afficherStatut("Lecture de ta liste de souhaits…");
  if (pageActuelle() === "toutes-les-cartes") {
    poursuivreChasse();
  } else {
    location.href = SOUHAITS.pageToutes;
  }
}

// 1.10 : la dernière carte cliquée dans une grille (pour connaître la rareté de la fiche qui s'ouvre).
let derniereCarteCliquee = null;
document.addEventListener("click", evenement => {
  try {
    const cible = evenement.target && evenement.target.closest ? evenement.target : null;
    if (!cible || estDansLePanneau(cible) || cible.closest(".sheet-overlay, [role='dialog']")) return;
    // Une carte de grille : un cadre arrondi qui contient un seul titre h3 (le nom).
    const cadre = cible.closest(".rounded-2xl");
    const titre = cadre && cadre.querySelectorAll("h3").length === 1 ? cadre.querySelector("h3") : null;
    if (!titre) return;
    const r = rareteDuCadre(cadre);
    derniereCarteCliquee = r !== "inconnue" ? { nom: titre.textContent.trim(), rarete: r } : null;
  } catch (erreur) {
    // un clic ne doit jamais être gêné
  }
}, true);

// 1.10 : sur une fiche SANS « Mettre aux enchères » (une carte que tu n'as pas, sur « Toutes les cartes »…),
// l'encart de prix n'existe pas : on ajoute seulement le bouton « Vérifier si un de mes amis la possède ».
// 1.16 : et « 🛒 Voir au Marché si elle est en vente » (toutes les fiches, y compris ta liste de souhaits).
let amisFicheEnCours = false;
async function boutonAmisSurFiche() {
  if (amisFicheEnCours) return;
  amisFicheEnCours = true;
  try {
    await majEncartAmisFiche();
  } finally {
    amisFicheEnCours = false;
  }
}
async function majEncartAmisFiche() {
  const titre = [...document.querySelectorAll(".sheet-overlay h2, [role='dialog'] h2")].find(h => !estDansLePanneau(h) && estVisible(h));
  const ancien = document.getElementById("wmd-amis-fiche");
  if (!titre || document.getElementById("wmd-prix-fiche")) { if (ancien) ancien.remove(); return; }
  const fiche = titre.closest(".sheet-overlay, [role='dialog']");
  // 1.17 : la fiche d'une de TES cartes (« Mettre aux enchères ») a déjà son encart complet, en bas
  // (afficherPrixDansFiche). Avant, ce petit encart apparaissait aussi en haut, quelques secondes,
  // le temps que l'encart du bas soit prêt : les mêmes boutons étaient affichés deux fois.
  const aMoi = [...fiche.querySelectorAll("button")].some(bouton => !estDansLePanneau(bouton) && /mettre aux ench[èe]res/i.test(bouton.textContent));
  if (aMoi) { if (ancien) ancien.remove(); return; }
  const nom = titre.textContent.trim();
  // La rareté : celle de la carte sur laquelle tu viens de cliquer (même nom), sinon le badge « L », « UR »…
  // de la fiche (jamais les boutons de rareté de l'onglet « Marché »), sinon l'image de fond.
  let rarete = derniereCarteCliquee && memeNom(derniereCarteCliquee.nom, nom) ? derniereCarteCliquee.rarete : null;
  if (!rarete) {
    for (const element of fiche.querySelectorAll("div, span")) {
      if (estPetitBadge(element) && !estDansLePanneau(element) && !element.closest("button")
        && (rarete = rareteDepuisLettre(element.textContent.trim()))) break;
    }
  }
  if (!rarete) {
    const r = rareteDuCadre(fiche);
    rarete = r !== "inconnue" ? r : null;
  }
  // 1.16 : sans rareté lisible, le bouton « Voir au Marché » est quand même proposé (toutes raretés).
  if (!nom) { if (ancien) ancien.remove(); return; }
  const cle = `${nom}|${rarete || "?"}`;
  if (ancien && ancien.dataset.cle === cle && fiche.contains(ancien)) return;
  // 1.17 : le prix moyen connu et le pic de prix éventuel, aussi pour une carte que tu n'as pas.
  const groupes = reglages.marche && rarete ? await prixParCarte() : null;
  const prix = groupes ? groupes.get(cle) : null;
  const pic = reglages.marche && rarete ? picASignaler(await tendanceDe(nom, rarete)) : null;
  const deja = document.getElementById("wmd-amis-fiche"); // il a pu être recréé pendant la lecture des prix
  // Rien n'a changé (par exemple un relevé du Marché qui ne concerne pas cette carte) : l'encart reste tel quel.
  const signature = JSON.stringify([cle, prix ? [prix.estimation, prix.moyenne, texteMarche(prix)] : null, pic, texteDerniereRechercheAmis()]);
  if (deja && deja.dataset.signature === signature && fiche.contains(deja)) { deja.dataset.cle = cle; return; }
  if (deja) deja.remove();
  const encart = creer("div", undefined, "wmd-prix-fiche");
  encart.id = "wmd-amis-fiche";
  encart.dataset.cle = cle;
  encart.dataset.signature = signature;
  // 1.16 : « 🛒 Voir au Marché si elle est en vente » — sur « Toutes les cartes » (et ta liste de souhaits),
  // la rareté affichée est celle du catalogue : la recherche se fait dans toutes les raretés.
  encart.appendChild(blocVoirAuMarche(nom, rarete, { catalogue: pageActuelle() !== "collection" }));
  if (rarete) {
    const bouton = creer("button", `👥 Vérifier si un de mes amis la possède (${lettreRarete(rarete)})`, "wmd-chercher-marche");
    bouton.type = "button";
    bouton.title = "Va sur la page Amis et cherche cette carte (même rareté) chez chacun de tes amis. Chaque ami demande plusieurs requêtes au site : à utiliser avec modération.";
    bouton.addEventListener("click", () => verifierChezAmis(nom, rarete));
    const blocAmis = creer("div", undefined, "wmd-amis");
    blocAmis.append(bouton, creer("div", texteDerniereRechercheAmis(), "wmd-discret"));
    if (prix && prix.moyenne) encart.appendChild(creer("b", `Prix moyen du site (${RARETES[rarete].nom}) : ${nombreLisible(prix.estimation)}`));
    if (prix && texteMarche(prix)) encart.appendChild(creer("div", texteMarche(prix)));
    if (pic) encart.appendChild(creer("div", textePic(pic), "wmd-alerte-pic"));
    encart.appendChild(blocAmis);
  }
  (titre.parentElement.parentElement || titre.parentElement).after(encart);
}

// 1.10 : l'heure de la dernière recherche chez les amis, affichée sous le bouton.
let rechercheAmisConnue = null;
api.storage.local.get("requetesAmis").then(({ requetesAmis }) => { rechercheAmisConnue = requetesAmis || null; }).catch(() => {});
api.storage.onChanged.addListener(changements => {
  if (!changements.requetesAmis) return;
  rechercheAmisConnue = changements.requetesAmis.newValue || null;
  const encart = document.getElementById("wmd-prix-fiche");
  if (encart) encart.dataset.cle = "";
  const amis = document.getElementById("wmd-amis-fiche");
  if (amis) amis.dataset.cle = "";
});
function texteDerniereRechercheAmis() {
  const r = rechercheAmisConnue;
  if (!r || !r.derniere) return "Dernière utilisation : jamais.";
  const quand = new Date(r.derniere).toDateString() === new Date().toDateString() ? `aujourd'hui à ${heureLisible(r.derniere)}` : dateLisible(r.derniere);
  return `Dernière utilisation : ${quand} (${r.derniereRequetes || "?"} requête(s))`
    + (r.jour === new Date().toLocaleDateString("fr-FR") ? ` · aujourd'hui : ${r.recherches} recherche(s), ${r.total} requête(s).` : ".");
}

// 1.10 : une seule carte, depuis sa fiche. On passe directement à l'étape « amis ».
async function verifierChezAmis(nom, rarete) {
  if (enCours || chasseEnCours) return;
  await api.storage.local.set({ chasse: { etape: "amis", souhaits: [{ nom: nom, rarete: rarete }], unique: true, quand: Date.now() } });
  afficherStatut(`Recherche de « ${nom} » chez tes amis…`);
  if (location.pathname.startsWith("/friends")) poursuivreChasse();
  else location.href = SOUHAITS.pageAmis;
}

// 1.10 : le nombre de requêtes de données (fetch / XHR) envoyées par la page depuis « debut »
// (performance.now()). Les images des cartes ne sont pas comptées.
function requetesDepuis(debut) {
  return performance.getEntriesByType("resource")
    .filter(e => e.startTime >= debut && (e.initiatorType === "fetch" || e.initiatorType === "xmlhttprequest")).length;
}

// 1.10 : le total des requêtes de ces recherches aujourd'hui (mémoire « requetesAmis » : { jour, total, recherches }).
async function compterRequetesDuJour(nombre) {
  const jour = new Date().toLocaleDateString("fr-FR");
  const { requetesAmis } = await api.storage.local.get("requetesAmis");
  const compte = requetesAmis && requetesAmis.jour === jour ? requetesAmis : { jour: jour, total: 0, recherches: 0 };
  compte.total += nombre;
  compte.recherches += 1;
  compte.derniere = Date.now(); // 1.10 : l'heure de la dernière utilisation
  compte.derniereRequetes = nombre;
  await api.storage.local.set({ requetesAmis: compte });
  return compte;
}

async function abandonnerChasse(message) {
  await api.storage.local.remove("chasse");
  enCours = false;
  afficherStatut(message);
}

// Appelée toutes les secondes : continue la recherche là où elle en est, sur la bonne page.
let chasseEnCours = false;
async function poursuivreChasse() {
  if (chasseEnCours) return;
  const chasse = await lireChasse();
  if (!chasse) return;
  if (Date.now() - chasse.quand > 30 * 60 * 1000) { // une recherche oubliée depuis plus de 30 min
    await api.storage.local.remove("chasse");
    return;
  }
  chasseEnCours = true;
  try {
    if (chasse.etape === "souhaits" && pageActuelle() === "toutes-les-cartes") await lireMesSouhaits(chasse);
    else if (chasse.etape === "amis" && location.pathname.startsWith("/friends")) await parcourirMesAmis(chasse);
  } finally {
    chasseEnCours = false;
  }
}

// Étape 1 : la liste de souhaits, sur « Toutes les cartes ».
async function lireMesSouhaits(chasse) {
  enCours = true;
  // Le filtre « Liste de souhaits » : le site l'entoure d'un anneau (ring-2) quand il est actif.
  const filtre = await attendre(() => boutonExact(SOUHAITS.texteFiltre));
  if (!filtre) return abandonnerChasse("Bouton « Liste de souhaits » introuvable sur « Toutes les cartes ».");
  if (!filtre.classList.contains(CONFIG.classeFiltreChoisi)) {
    cliquer(filtre);
    await pause(SOUHAITS.pauseMs);
  }
  await attendre(() => cartesDans(document.querySelector("main") || document.body).length > 0
    || /aucune carte/i.test((document.querySelector("main") || document.body).textContent));
  await pause(SOUHAITS.pauseMs);

  // On lit toutes les pages de la liste (en général une seule).
  const souhaits = [];
  const dejaVus = new Set();
  for (let tour = 0; tour < 50 && enCours; tour++) {
    for (const carte of cartesDans(document.querySelector("main") || document.body)) {
      const cle = `${carte.nom}|${carte.rarete}`;
      if (!dejaVus.has(cle)) {
        dejaVus.add(cle);
        souhaits.push({ nom: carte.nom, rarete: carte.rarete });
      }
    }
    const page = lirePagination();
    if (!page || page.actuelle >= page.total) break;
    if (!(await changerDePage(CONFIG.texteBoutonPageSuivante))) break;
  }
  if (!enCours) return abandonnerChasse("Recherche arrêtée.");
  if (souhaits.length === 0) return abandonnerChasse("Ta liste de souhaits est vide : rien à chercher.");

  await api.storage.local.set({ chasse: { etape: "amis", souhaits: souhaits, quand: Date.now() } });
  afficherStatut(`${souhaits.length} carte(s) souhaitée(s). Passage à la page Amis…`);
  await pause(SOUHAITS.pauseMs);
  location.href = SOUHAITS.pageAmis;
}

// Les amis de la page Amis : [{ nom, bouton }] (le bouton « Échanger » de chacun).
function lireMesAmis() {
  const amis = [];
  for (const bouton of document.querySelectorAll("button[title='Proposer un échange']")) {
    if (estDansLePanneau(bouton)) continue;
    let ligne = bouton.parentElement;
    while (ligne && !ligne.querySelector("a[href*='/profile/']")) ligne = ligne.parentElement;
    const lien = ligne && ligne.querySelector("a[href*='/profile/']");
    if (!lien) continue;
    const nom = decodeURIComponent(lien.getAttribute("href").split("/profile/")[1] || "").replace(/\/.*$/, "");
    // 1.15 : le nom affiché aussi (en général le même que le pseudo de l'adresse).
    const affiche = lien.textContent.replace(/\s+/g, " ").trim();
    if (nom && !amis.some(ami => ami.nom === nom)) amis.push({ nom: nom, affiche: affiche && affiche.length <= 40 ? affiche : nom, bouton: bouton });
  }
  return amis;
}

// La fenêtre « Échanger avec <ami> », ou null.
function fenetreEchange(ami) {
  const titre = [...document.querySelectorAll("h2")].find(h => /^échanger avec/i.test(h.textContent.trim())
    && (!ami || h.textContent.includes(ami)));
  if (!titre) return null;
  let fenetre = titre.parentElement;
  while (fenetre && !boutonDans(fenetre, "Annuler")) fenetre = fenetre.parentElement;
  return fenetre;
}

function boutonDans(zone, texte) {
  return [...zone.querySelectorAll("button")].find(b => b.textContent.trim() === texte) || null;
}

// Ouvre la fenêtre d'échange d'un ami et passe sur l'onglet « Cartes de <ami> ». Renvoie la fenêtre.
async function ouvrirCartesDeAmi(ami) {
  const fiche = lireMesAmis().find(a => a.nom === ami);
  if (!fiche) return null;
  cliquer(fiche.bouton);
  const fenetre = await attendre(() => fenetreEchange(ami));
  if (!fenetre) return null;
  await pause(SOUHAITS.pauseMs / 2);
  const onglet = [...fenetre.querySelectorAll("button")].find(b => {
    const texte = b.textContent.replace(/\s+/g, " ").trim();
    return texte !== "Mes cartes" && (texte === `Cartes de ${ami}` || texte === ami);
  });
  if (!onglet) return null;
  cliquer(onglet);
  await pause(SOUHAITS.pauseMs);
  return fenetre;
}

// Tape un nom dans la recherche de la fenêtre et attend les résultats.
async function rechercherDansFenetre(fenetre, nom) {
  const champ = fenetre.querySelector("input[placeholder^='Rechercher']");
  if (!champ) return false;
  // 1.15 : sans les parenthèses (« Bob Marley (chanson) » → « Bob Marley ») : la recherche du site ne les gère pas.
  // compterDansFenetre ne compte ensuite que les cartes qui portent exactement le nom voulu.
  const cherche = texteDeRecherche(nom);
  ecrireDansChamp(champ, cherche);
  await pause(SOUHAITS.pauseMs);
  // Les résultats sont là quand : « Aucune carte… », ou au moins une carte contient le texte cherché.
  await attendre(() => /aucune carte ne correspond/i.test(fenetre.textContent)
    || cartesDans(fenetre).some(carte => nomContient(carte.nom, cherche)), 4000);
  await pause(300);
  return true;
}

// La pagination « 1 / 3 » de la fenêtre : { actuelle, total } ou null.
function paginationFenetre(fenetre) {
  for (const bouton of fenetre.querySelectorAll("button")) {
    const trouve = bouton.textContent.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
    if (trouve) return { actuelle: parseInt(trouve[1], 10), total: parseInt(trouve[2], 10) };
  }
  return null;
}

// Combien d'exemplaires de cette carte (nom + rareté) sont affichés dans les résultats, toutes pages comprises.
async function compterDansFenetre(fenetre, souhait) {
  let quantite = 0;
  for (let page = 0; page < SOUHAITS.pagesMaxRecherche; page++) {
    for (const carte of cartesDans(fenetre)) {
      if (memeNom(carte.nom, souhait.nom) && (souhait.rarete === "inconnue" || carte.rarete === "inconnue" || carte.rarete === souhait.rarete)) {
        quantite += lireQuantite(carte.cadre);
      }
    }
    const pagination = paginationFenetre(fenetre);
    if (!pagination || pagination.actuelle >= pagination.total) break;
    const avant = pagination.actuelle;
    if (!cliquer(boutonDans(fenetre, "→"))) break;
    if (!(await attendre(() => { const p = paginationFenetre(fenetre); return p && p.actuelle !== avant; }, 4000))) break;
    await pause(300);
  }
  return quantite;
}

// Ferme la fenêtre d'échange avec « Annuler » (jamais « Envoyer l'offre »).
async function fermerFenetre(fenetre) {
  cliquer(boutonDans(fenetre, "Annuler") || fenetre.querySelector("button[aria-label='Fermer']"));
  await attendre(() => !document.body.contains(fenetre) || !fenetreEchange(), 4000);
  await pause(SOUHAITS.pauseMs / 2);
}

// Étape 2 : chaque ami, chaque carte souhaitée.
async function parcourirMesAmis(chasse) {
  enCours = true;
  // 1.10 : on compte les requêtes envoyées au site pendant la recherche (+ 1 pour le chargement de la page Amis).
  try { performance.setResourceTimingBufferSize(10000); } catch (erreur) {}
  const debutRequetes = performance.now();

  await attendre(() => lireMesAmis().length > 0);
  const amis = lireMesAmis().map(ami => ami.nom);
  if (amis.length === 0) return abandonnerChasse("Aucun ami trouvé sur la page Amis.");

  const resultats = {};
  let fenetresRatees = 0;
  for (let i = 0; i < amis.length && enCours; i++) {
    const ami = amis[i];
    afficherStatut(`Ami ${i + 1} / ${amis.length} : ${ami}… (Stop pour arrêter)`);
    const ouverte = fenetreEchange();
    if (ouverte) await fermerFenetre(ouverte); // une fenêtre restée ouverte
    const fenetre = await ouvrirCartesDeAmi(ami);
    if (!fenetre) {
      fenetresRatees++;
      continue;
    }
    for (let j = 0; j < chasse.souhaits.length && enCours; j++) {
      const souhait = chasse.souhaits[j];
      afficherStatut(`Ami ${i + 1} / ${amis.length} : ${ami}, carte ${j + 1} / ${chasse.souhaits.length}… (Stop pour arrêter)`);
      if (!(await rechercherDansFenetre(fenetre, souhait.nom))) break;
      const quantite = await compterDansFenetre(fenetre, souhait);
      if (quantite > 0) (resultats[ami] = resultats[ami] || []).push({ ...souhait, quantite: quantite });
    }
    await fermerFenetre(fenetre);
  }
  const arrete = !enCours;
  enCours = false;
  const requetes = requetesDepuis(debutRequetes) + 1;
  const duJour = await compterRequetesDuJour(requetes);
  const bilan = { date: Date.now(), souhaits: chasse.souhaits, amis: amis.length, resultats: resultats,
    partiel: arrete, ratees: fenetresRatees, unique: Boolean(chasse.unique),
    requetes: requetes, requetesJour: duJour.total, recherchesJour: duJour.recherches };

  await api.storage.local.set({ souhaitsChezAmis: bilan });
  await api.storage.local.remove("chasse");
  afficherResultatsSouhaits(bilan);
}

// Le tableau des résultats : qui possède quelle carte souhaitée.
async function afficherResultatsSouhaits(bilan) {
  if (!bilan) ({ souhaitsChezAmis: bilan } = await api.storage.local.get("souhaitsChezAmis"));
  if (!bilan) {
    afficherStatut("Aucune recherche faite pour l'instant.");
    return;
  }
  const zone = document.getElementById("wmd-resultats");
  zone.replaceChildren();
  const lignes = [];
  for (const [ami, cartes] of Object.entries(bilan.resultats)) {
    for (const carte of cartes) lignes.push({ ami: ami, carte: carte });
  }
  lignes.sort((a, b) => ordreRarete(b.carte.rarete) - ordreRarete(a.carte.rarete) || a.carte.nom.localeCompare(b.carte.nom, "fr"));
  const trouvees = new Set(lignes.map(l => `${l.carte.nom}|${l.carte.rarete}`));

  const bloc = creer("div", undefined, "wmd-bloc");
  const seule = bilan.unique && bilan.souhaits[0];
  const proprietaires = new Set(lignes.map(l => l.ami)).size;
  bloc.appendChild(creer("b", seule
    ? (proprietaires ? `${seule.nom} (${lettreRarete(seule.rarete)}) : ${proprietaires} ami(s) la possède(nt)` : `${seule.nom} (${lettreRarete(seule.rarete)}) : aucun de tes amis ne la possède`)
    : `${trouvees.size} carte(s) souhaitée(s) sur ${bilan.souhaits.length} trouvée(s) chez tes amis`));

  bloc.appendChild(creer("div", `Recherche du ${dateLisible(bilan.date)}, ${bilan.amis} ami(s) regardé(s)`
    + (bilan.partiel ? " (arrêtée avant la fin)" : "") + (bilan.ratees ? `, ${bilan.ratees} fenêtre(s) d'échange n'ont pas pu s'ouvrir` : "") + ".", "wmd-discret"));
  // 1.10 : combien de requêtes la recherche a envoyées au site, avec un avertissement.
  if (bilan.requetes) {
    bloc.appendChild(creer("div", `⚠ Cette recherche a envoyé environ ${bilan.requetes} requête(s) au site`
      + ` (${bilan.amis} ami(s) ouvert(s) un par un)`
      + (bilan.recherchesJour > 1 ? ` ; ${bilan.requetesJour} requête(s) en ${bilan.recherchesJour} recherches aujourd'hui` : "")
      + ". L'utiliser trop souvent peut être vu par WikiMasters comme une utilisation abusive de requêtes automatiques.", "wmd-avertissement"));
  }
  const absentes = bilan.souhaits.filter(s => !trouvees.has(`${s.nom}|${s.rarete}`));
  if (absentes.length && !seule) bloc.appendChild(creer("div", `Personne n'a : ${absentes.map(s => `${s.nom} (${lettreRarete(s.rarete)})`).join(", ")}.`, "wmd-discret"));
  zone.appendChild(bloc);
  memoriserVue("souhaits"); // 1.15
  if (lignes.length === 0) return;

  const tableau = creerTableau(["Carte", "Rar.", "Ami", "Qté", ""], []);
  const corps = tableau.tBodies[0];
  for (const { ami, carte } of lignes) {
    const rangee = corps.insertRow();
    rangee.className = `wmd-${carte.rarete}`;
    rangee.insertCell().appendChild(lienCarte(carte.nom, carte.rarete)); // 1.11 : nom cliquable
    for (const valeur of [lettreRarete(carte.rarete), ami, carte.quantite]) rangee.insertCell().textContent = valeur;
    const bouton = creer("button", "Échanger", "wmd-mini");
    bouton.title = `Ouvre l'échange avec ${ami} et y cherche ${carte.nom}. C'est toi qui choisis et envoies l'offre.`;
    bouton.addEventListener("click", () => preparerEchange(ami, carte));
    rangee.insertCell().appendChild(bouton);
  }
  zone.appendChild(tableau);
  afficherStatut(`${lignes.length} possibilité(s) d'échange. « Échanger » ouvre l'échange : à toi de choisir et d'envoyer l'offre.`);
}

// Le bouton « Échanger » d'un résultat : ouvre l'échange avec cet ami, onglet « Cartes de … »,
// la carte cherchée. On s'arrête là : tu cliques sur la carte, choisis ce que tu donnes et envoies.
async function preparerEchange(ami, carte) {
  if (!location.pathname.startsWith("/friends")) {
    await api.storage.local.set({ echangeAPreparer: { ami: ami, carte: carte, quand: Date.now() } });
    location.href = SOUHAITS.pageAmis;
    return;
  }
  const ouverte = fenetreEchange();
  if (ouverte) await fermerFenetre(ouverte);
  const fenetre = await ouvrirCartesDeAmi(ami);
  if (!fenetre) {
    afficherStatut(`Impossible d'ouvrir l'échange avec ${ami}.`);
    return;
  }
  await rechercherDansFenetre(fenetre, carte.nom);
  for (const trouvee of cartesDans(fenetre)) {
    if (memeNom(trouvee.nom, carte.nom) && (trouvee.rarete === carte.rarete || trouvee.rarete === "inconnue")) {
      trouvee.cadre.classList.add("wmd-carte-visee"); // un cadre vert autour de la bonne carte
    }
  }
  afficherStatut(`Échange avec ${ami} ouvert : clique sur ${carte.nom} pour l'ajouter, choisis ce que tu donnes, puis envoie l'offre toi-même.`);
}

// Sur la page Amis, après un « Échanger » cliqué ailleurs.
let preparationEnCours = false;
async function appliquerEchangeEnAttente() {
  if (!location.pathname.startsWith("/friends") || preparationEnCours || chasseEnCours) return;
  const { echangeAPreparer: demande } = await api.storage.local.get("echangeAPreparer");
  if (!demande) return;
  if (Date.now() - demande.quand > 60 * 1000) {
    await api.storage.local.remove("echangeAPreparer");
    return;
  }
  if (lireMesAmis().length === 0) return; // la page n'est pas encore chargée
  preparationEnCours = true;
  try {
    await api.storage.local.remove("echangeAPreparer");
    await preparerEchange(demande.ami, demande.carte);
  } finally {
    preparationEnCours = false;
  }
}

// Le bouton « Revoir les résultats » n'apparaît que s'il y a des résultats en mémoire.
let aDesResultatsSouhaits = false;
api.storage.local.get("souhaitsChezAmis").then(({ souhaitsChezAmis }) => {
  aDesResultatsSouhaits = Boolean(souhaitsChezAmis);
}).catch(() => {});
api.storage.onChanged.addListener(changements => {
  if (changements.souhaitsChezAmis) aDesResultatsSouhaits = Boolean(changements.souhaitsChezAmis.newValue);
});



// ---------------------------------------------------------------------
//  PARTIE 13 SEXIES : LE BADGE « $ » SUR TES CARTES ESTIMÉES (nouveau en 1.5.1)
//  Comme le cadre doré des cartes animées : sur ta Collection, chaque carte dont
//  l'extension connaît un prix (même nom, même rareté) reçoit un petit badge « $ ».
//  En passant la souris dessus, le prix estimé s'affiche.
// ---------------------------------------------------------------------

let prixEnCache = null; // les prix par carte, relus seulement quand ils changent
api.storage.onChanged.addListener(changements => {
  if (changements.marche) prixEnCache = null;
});

let marquageEnCours = false;
async function marquerCartesEstimees() {
  if (marquageEnCours) return;
  const actif = reglages.marche && pageActuelle() === "collection";
  const cadres = trouverCadresDeCartes();
  if (!actif) {
    for (const { cadre } of cadres) {
      cadre.classList.remove("wmd-carte-prix"); delete cadre.dataset.wmdBadge;
      const badgeMarche = cadre.querySelector(":scope > .wmd-badge-marche");
      if (badgeMarche) badgeMarche.remove();
    }
    return;
  }
  marquageEnCours = true;
  try {
    if (!prixEnCache) prixEnCache = await prixParCarte();
    for (const { cadre, imageRarete } of cadres) {
      const nom = cadre.querySelector(CONFIG.selecteurNomCarte).textContent.trim();
      const trouve = imageRarete.getAttribute("src").match(/rarity\/([a-z_]+)\./);
      const prix = trouve ? prixEnCache.get(`${nom}|${trouve[1]}`) : null;
      // 1.7.3 : le badge « $461 » = le prix moyen du site seulement. Les prix trouvés au Marché
      // ont leur propre badge, juste en dessous : « -120 / +530 » (le plus bas / le plus haut).
      // 1.17 : « 🎈 » à côté du prix moyen quand il est peut-être gonflé par un pic.
      const picCarte = trouve && prix && prix.moyenne ? picASignaler(await tendanceDe(nom, trouve[1])) : null;
      const moyenne = prix && prix.moyenne ? nombreLisible(prix.estimation) + (picCarte ? " 🎈" : "") : null;
      cadre.classList.toggle("wmd-carte-prix", moyenne !== null);
      if (moyenne === null) delete cadre.dataset.wmdBadge;
      else if (cadre.dataset.wmdBadge !== moyenne) cadre.dataset.wmdBadge = moyenne;
      const marcheTexte = afficherMinMax && prix && prix.max !== null && prix.max !== undefined
        ? `-${nombreLisible(prix.min)} / +${nombreLisible(prix.max)}` : null;
      let badgeMarche = cadre.querySelector(":scope > .wmd-badge-marche");
      if (marcheTexte === null) { if (badgeMarche) badgeMarche.remove(); }
      else {
        if (!badgeMarche) {
          badgeMarche = creer("span", undefined, "wmd-badge-marche");
          cadre.appendChild(badgeMarche);
        }
        badgeMarche.classList.toggle("wmd-badge-marche-seul", moyenne === null);
        // Le texte est dans un attribut (affiché par le CSS) : il ne gêne pas la lecture de la carte.
        if (badgeMarche.dataset.texte !== marcheTexte) badgeMarche.dataset.texte = marcheTexte;
      }
      if (prix) {
        const texte = [moyenne !== null ? `Prix moyen du site : ${nombreLisible(prix.estimation)}` : "Pas de prix moyen du site relevé",
          picCarte ? textePic(picCarte) : "",
          texteMarche(prix) || (afficherMinMax ? "aucun prix trouvé au Marché" : ""),
          prix.minVendu !== null ? `vendue min ${nombreLisible(prix.minVendu)}` : "pas encore vue vendue"].filter(Boolean).join(" · ");
        if (cadre.dataset.wmdPrix !== texte) {
          cadre.dataset.wmdPrix = texte;
          cadre.title = `${texte} (WikiMasters Doublons)`;
        }
      } else if (cadre.dataset.wmdPrix) {
        delete cadre.dataset.wmdPrix;
        cadre.removeAttribute("title");
      }
    }
  } finally {
    marquageEnCours = false;
  }
}



// ---------------------------------------------------------------------
//  PARTIE 13 SEPTIES : LES CARTES DES PAQUETS OUVERTS (nouveau en 1.6)
//  Quand tu ouvres un paquet, le site montre les cartes une par une (« Carte 3 / 10 »,
//  puis « Continuer »). L'extension lit chaque carte révélée et l'ajoute à ta
//  collection en mémoire, sans avoir à relancer « Trouver mes doublons ».
//  Revenir en arrière sur une carte déjà vue ne la compte pas deux fois.
//  Limite : les cartes qui PARTENT (échange, vente, défausse) ne sont pas retirées :
//  une lecture complète de temps en temps garde la collection exacte.
// ---------------------------------------------------------------------

// Le compteur « Carte 3 / 10 » de l'ouverture d'un paquet : { numero, total } ou null.
function lireCompteurPaquet() {
  const zone = document.querySelector("main") || document.body;
  for (const element of zone.querySelectorAll("span")) {
    if (element.children.length > 0 || element.textContent.trim() !== "Carte" || estDansLePanneau(element)) continue;
    const numero = element.nextElementSibling;
    const total = numero && numero.nextElementSibling;
    const n = numero && parseInt(numero.textContent.trim(), 10);
    const t = total && total.textContent.trim().match(/^\/\s*(\d+)$/);
    if (n && t) return { numero: n, total: parseInt(t[1], 10), zone: element.parentElement.parentElement || zone };
  }
  return null;
}

let paquetEnCoursDeLecture = false;
async function lireCarteDePaquet() {
  if (paquetEnCoursDeLecture || enCours) return;
  paquetEnCoursDeLecture = true;
  try {
    const { paquetOuvert: etat } = await api.storage.local.get("paquetOuvert");
    const compteur = lireCompteurPaquet();
    if (!compteur) {
      // On n'est plus dans l'ouverture d'un paquet : le suivant sera un nouveau paquet.
      if (etat && !etat.fini) await api.storage.local.set({ paquetOuvert: { ...etat, fini: true } });
      return;
    }
    const carte = cartesDans(compteur.zone)[0];
    if (!carte) return; // la carte n'est pas encore retournée
    const cle = `${compteur.numero}/${compteur.total}|${carte.nom}|${carte.rarete}`;

    // Nouveau paquet : le précédent est terminé (ou vieux de plus de 30 minutes) et on est sur la carte 1.
    let paquet = etat;
    const nouveau = !paquet || ((paquet.fini || Date.now() - paquet.debut > 30 * 60 * 1000) && compteur.numero === 1);
    if (nouveau) paquet = { debut: Date.now(), vues: [], nouvelles: 0, doublons: 0, fini: false };
    else if (paquet.fini) return; // un ancien paquet revu en arrière-plan : on ne recompte rien
    if (paquet.vues.includes(cle)) return; // carte déjà comptée (tu es revenu en arrière)

    const { collection } = await api.storage.local.get("collection");
    if (!collection) {
      afficherStatut("Paquet : lis d'abord ta collection (« Trouver mes doublons ») pour que les cartes y soient ajoutées.");
      return;
    }
    // On ajoute la carte : +1 exemplaire si tu l'as déjà, sinon une nouvelle ligne.
    const animee = await estAnimee(carte.cadre);
    const deja = collection.cartes.find(([nom, rarete]) => nom === carte.nom && (rarete === carte.rarete || carte.rarete === "inconnue"))
      || collection.cartes.find(([nom]) => nom === carte.nom);
    if (deja) {
      deja[2] += 1;
      paquet.doublons++;
    } else {
      collection.cartes.push([carte.nom, carte.rarete, 1, animee ? 1 : 0]);
      paquet.nouvelles++;
    }
    paquet.vues.push(cle);
    await api.storage.local.set({ collection: collection, paquetOuvert: paquet });
    derniereCollection = []; // la prochaine estimation relira la collection mise à jour

    const total = paquet.nouvelles + paquet.doublons;
    afficherStatut(`Paquet : ${carte.nom} (${lettreRarete(carte.rarete)}) ${deja ? "en double" : "NOUVELLE"} ajoutée. `
      + `${total} carte(s) ajoutée(s) à ta collection (${paquet.nouvelles} nouvelle(s), ${paquet.doublons} doublon(s)).`);
  } finally {
    paquetEnCoursDeLecture = false;
  }
}



// ---------------------------------------------------------------------
//  PARTIE 13 OCTIES : LES BONNES AFFAIRES DU MARCHÉ (nouveau en 1.6.1)
//  Sur la liste du Marché, chaque enchère EN COURS dont la mise (actuelle ou de départ)
//  est à 75 % ou moins du prix estimé par l'extension (même carte, même rareté) est
//  encadrée : en jaune à 75 %, de plus en plus rouge quand l'affaire est meilleure (1.6.2).
//  L'estimation est calculée SANS l'annonce elle-même (sinon une carte vue une seule
//  fois serait toujours « au prix »). Sans autre prix connu pour la carte : pas de cadre.
// ---------------------------------------------------------------------

// Corrigé en 1.6.2 : on n'encadre qu'à partir de 75 % de l'estimation (ou moins), en JAUNE,
// et la couleur tourne au ROUGE à mesure que l'affaire est meilleure (rouge vif vers 0 %).
// 1.14 : le seuil se règle dans le panneau du Marché (seuilCadre : % ou montant sous l'estimation).
// 25 % d'écart → la mise doit être à 0,75 × l'estimation ou moins.
// 1.14 : le réglage d'un cadre (« Moyenne » ou « Max ») : { mode: "pourcent" | "montant", valeur }.
function seuilCadre(cadreDe) {
  const montant = Number(reglages[`ecart${cadreDe}Montant`]) || 0;
  const mode = reglages[`ecart${cadreDe}Mode`] || (montant > 0 ? "montant" : "pourcent");
  if (mode === "montant") return { mode: mode, valeur: montant > 0 ? montant : 100 };
  const pourcent = Number(reglages[`ecart${cadreDe}`]);
  return { mode: "pourcent", valeur: pourcent >= 1 && pourcent <= 99 ? pourcent : REGLAGES_PAR_DEFAUT[`ecart${cadreDe}`] };
}
async function changerSeuilCadre(cadreDe, mode, valeur) {
  const enregistres = await lireReglages();
  enregistres[`ecart${cadreDe}Mode`] = mode;
  const n = Math.round(Number(valeur));
  if (mode === "montant") enregistres[`ecart${cadreDe}Montant`] = n >= 1 ? n : (Number(enregistres[`ecart${cadreDe}Montant`]) || 100);
  else enregistres[`ecart${cadreDe}`] = n >= 1 && n <= 99 ? n : (Number(enregistres[`ecart${cadreDe}`]) || 25);
  reglages = { ...REGLAGES_PAR_DEFAUT, ...enregistres };
  await api.storage.local.set({ reglages: enregistres });
  versionPage++; // les cadres sont recalculés tout de suite
  afficherSeuilsPanneau();
}
// Remet les champs du panneau sur les réglages enregistrés (sauf celui où tu es en train d'écrire).
function afficherSeuilsPanneau() {
  for (const cadreDe of ["Moyenne", "Max"]) {
    const s = seuilCadre(cadreDe);
    const valeur = document.getElementById(`wmd-seuil-${cadreDe}`);
    const mode = document.getElementById(`wmd-mode-${cadreDe}`);
    if (mode && document.activeElement !== mode) mode.value = s.mode;
    if (valeur && document.activeElement !== valeur) {
      valeur.value = String(s.valeur);
      valeur.max = s.mode === "pourcent" ? "99" : "";
      valeur.step = s.mode === "pourcent" ? "1" : "10";
    }
  }
}

function couleurAffaire(rapport, seuil) {
  const force = seuil > 0 ? Math.min(1, Math.max(0, (seuil - rapport) / seuil)) : 1; // 0 = jaune, 1 = rouge
  const teinte = Math.round(52 * (1 - force)); // 52° = jaune, 0° = rouge
  return `hsl(${teinte}, 90%, ${Math.round(55 - 7 * force)}%)`;
}
// Nouveau en 1.7.6 : le cadre BLEU (comparé au prix le plus haut trouvé au Marché) :
// blanc à 75 %, de plus en plus bleu à mesure que l'affaire est meilleure.
// 1.10 : le cadre du prix le plus haut du Marché est toujours du même bleu, quel que soit l'écart,
// et blanc quand le « ⚠ » est ajouté (un prix moyen du site est connu : ce prix le plus haut est douteux).
const COULEUR_MAX = "hsl(212, 95%, 56%)";
const COULEUR_TRES_BONNE = "hsl(0, 90%, 52%)";  // 1.17 : cadre rouge = « +++ » sous le prix moyen
const COULEUR_MAX_ATTENTION = "#ffffff";

let annoncesEnCache = null; // les annonces en mémoire, relues seulement quand elles changent
let moyennesEnCache = {};   // 1.7.2 : les prix moyens du site, relus en même temps
let tendancesEnCache = null; // 1.16 : les variations de prix (flèches dans les coins des cadres)
api.storage.onChanged.addListener(changements => {
  if (changements.marche) annoncesEnCache = null;
  if (changements.tendances) { tendancesEnCache = null; versionPage++; }
});

// Le prix estimé d'une carte, sans compter l'annonce « cleExclue ».
// Renvoie { estimation, minimum, min, terminees, enCours } ou null.
// 1.17.1 (optimisation) : les annonces en mémoire rangées par « carte|rareté ». Avant, chaque carte affichée
// reparcourait TOUTES les annonces en mémoire (des milliers) : 100 cartes × 5 000 annonces à chaque passage.
const indexAnnonces = { source: null, groupes: new Map() };
function annoncesDeLaCarte(annonces, nom, rarete) {
  if (indexAnnonces.source !== annonces) {
    indexAnnonces.groupes = new Map();
    for (const entree of annonces) {
      const cle = `${entree[1].nom}|${entree[1].rarete}`;
      const groupe = indexAnnonces.groupes.get(cle);
      if (groupe) groupe.push(entree); else indexAnnonces.groupes.set(cle, [entree]);
    }
    indexAnnonces.source = annonces;
  }
  return indexAnnonces.groupes.get(`${nom}|${rarete}`) || [];
}
function estimationSans(annonces, nom, rarete, cleExclue) {
  const liste = [];
  for (const [cle, a] of annoncesDeLaCarte(annonces, nom, rarete)) {
    if (cle === cleExclue || a.nom !== nom || a.rarete !== rarete) continue;
    liste.push({ prix: a.prix, terminee: a.terminee, vu: a.vu });
  }
  // Estimation = prix le plus haut trouvé (1.6.3), aucun prix écarté (1.6.9).
  let estime = calculerEstimation(liste);
  // 1.16 : la date du prix le plus haut (le plus récent relevé à ce prix), pour l'horloge des vieux prix.
  const vuMax = estime ? Math.max(0, ...liste.filter(p => p.prix === estime.max).map(p => Number(p.vu) || 0)) || null : null;
  // 1.7.2 : le prix moyen du site, s'il est connu, remplace l'estimation.
  const moyenne = moyennesEnCache[`${nom}|${rarete}`];
  if (moyenne) estime = appliquerMoyenne(estime || { min: null, max: null, minVendu: null, nbTerminees: 0, nbEnCours: 0 }, moyenne);
  return estime && Object.assign(estime, { terminees: estime.nbTerminees, enCours: estime.nbEnCours,
    vuMax: vuMax, vuMoyenne: moyenne ? Number(moyenne.vu) || null : null });
}

// Nouveau en 1.6.4 : sur la page d'UNE enchère (/marketplace/<id>), un encart sous le titre
// donne l'estimation de la carte (même rareté), calculée sans compter cette enchère elle-même.
// L'extension ne fait que lire et afficher : elle ne mise jamais.
let encartEnchereEnCours = false;
async function afficherPrixSurEnchere() {
  if (encartEnchereEnCours) return;
  encartEnchereEnCours = true;
  try {
    await majPrixSurEnchere();
  } finally {
    encartEnchereEnCours = false;
  }
}
async function majPrixSurEnchere() {
  const enchere = location.pathname.match(REGEX_PAGE_ENCHERE);
  const ancien = document.getElementById("wmd-prix-enchere");
  if (!enchere) { if (ancien) ancien.remove(); return; }
  const zone = document.querySelector("main") || document.body;
  const titre = zone.querySelector("h1");
  if (!titre || !titre.parentElement || !titre.parentElement.parentElement) return;
  const nom = titre.textContent.trim();
  const identifiant = enchere[1].toLowerCase();
  // 1.16 : la rareté donnée par le site lui-même (reponses-site.js) d'abord, sinon le badge « L », « UR »…
  const duSite = encheresDuSite.get(identifiant);
  const rarete = (duSite && rareteDuSite(duSite.rarete)) || feuilles(zone).map(({ element, texte }) =>
    !estDeLExtension(element) && element.children.length === 0 ? rareteDepuisLettre(texte) : null).find(Boolean)
    || rareteBadgeShiny(zone);
  if (!nom) return;
  const bloc = titre.parentElement.parentElement; // le titre + « Mis en vente par »
  // 1.16 : relevé des prix coupé dans les réglages : l'encart ne garde que « 🛒 Voir les autres ventes au Marché ».
  if (!reglages.marche || !rarete) {
    const signatureSeule = JSON.stringify(["seul", identifiant, nom, rarete || null]);
    if (ancien && ancien.dataset.signature === signatureSeule && ancien.previousElementSibling === bloc) return;
    const seul = ancien || creer("div", undefined, "wmd-prix-fiche wmd-prix-enchere");
    seul.id = "wmd-prix-enchere";
    seul.dataset.signature = signatureSeule;
    seul.replaceChildren(blocVoirAuMarche(nom, rarete || null, { depuis: identifiant }));
    bloc.after(seul);
    return;
  }
  const cleAnnonce = "marketplace-auction-" + identifiant;
  const annonce = lireAnnonceDetail(identifiant)[0];

  if (!annoncesEnCache) {
    const { marche } = await api.storage.local.get("marche");
    annoncesEnCache = Object.entries(marche ? marche.annonces : {});
    moyennesEnCache = marche && marche.moyennes ? marche.moyennes : {};
  }
  const estime = estimationSans(annoncesEnCache, nom, rarete, cleAnnonce);
  const pic = picASignaler(await tendanceDe(nom, rarete)); // 1.17 : prix peut-être gonflé
  const signature = JSON.stringify([identifiant, nom, rarete, estime, annonce ? [annonce.prix, annonce.terminee] : null, afficherMinMax, pic]);
  if (ancien && ancien.dataset.signature === signature && ancien.previousElementSibling === bloc) return; // déjà à jour

  const encart = ancien || creer("div", undefined, "wmd-prix-fiche wmd-prix-enchere");
  encart.id = "wmd-prix-enchere";
  encart.dataset.signature = signature;
  encart.replaceChildren(blocVoirAuMarche(nom, rarete, { depuis: identifiant })); // 1.16 : en un clic, les autres ventes
  const nomRarete = RARETES[rarete] ? RARETES[rarete].nom : "?";
  if (estime) {
    encart.appendChild(creer("b", `Prix estimé (${nomRarete}) : ${texteEstimation(estime)}`));
    if (estime.moyenne && texteMarche(estime)) encart.appendChild(creer("div", texteMarche(estime))); // 1.7.3
    encart.appendChild(creer("div", `Prix le plus bas trouvé : ${nombreOuTiret(estime.min)}. ${estime.terminees} vente(s) terminée(s), `
      + `${estime.enCours} enchère(s) en cours, sans compter celle-ci.`, "wmd-discret"));
    if (annonce && estime.estimation > 0) {
      const pourcent = Math.round(annonce.prix / estime.estimation * 100);
      encart.appendChild(creer("div", `${annonce.terminee ? "Vendue pour" : "Mise actuelle"} ${nombreLisible(annonce.prix)} : `
        + `${pourcent} % de l'estimation.`, "wmd-discret"));
    }
  } else {
    encart.appendChild(creer("b", `Aucun autre prix relevé pour ${nom} en ${nomRarete}.`));
    encart.appendChild(creer("div", "Passez sur le Marché (par exemple avec « Voir les autres ventes au Marché ») pour relever des prix.", "wmd-discret"));
  }
  if (pic) encart.appendChild(creer("div", textePic(pic), "wmd-alerte-pic"));
  // La même carte vue dans d'autres raretés : à titre indicatif seulement.
  const autres = Object.keys(RARETES).filter(r => r !== rarete)
    .map(r => [r, estimationSans(annoncesEnCache, nom, r, cleAnnonce)]).filter(([, e]) => e)
    .map(([r, e]) => `${RARETES[r].nom} : ${e.minimum ? "≥ " : ""}${nombreLisible(e.estimation)}`);
  if (autres.length) encart.appendChild(creer("div", `Vue dans une autre rareté (prix non comparable) : ${autres.join(", ")}.`, "wmd-discret"));
  bloc.after(encart);
}

let affairesEnCours = false;
const PRIX_VIEUX_MS = 7 * 24 * 60 * 60 * 1000; // 1.16 : au-delà d'une semaine, le cadre porte « 🕒 »
// 1.16 : « Seulement les enchères encadrées » : les autres sont cachées (classe wmd-pas-encadree).
let marcheQueEncadrees = false;
// 1.17.1 : « Masquer les cadres blancs » : un cadre bleu avec « ⚠ » n'est plus affiché du tout.
let marcheSansBlanc = false;
api.storage.local.get("marcheSansBlanc").then(({ marcheSansBlanc: valeur }) => {
  marcheSansBlanc = valeur === true;
  const coche = document.querySelector("#wmd-case-blanc input");
  if (coche) coche.checked = marcheSansBlanc;
  versionPage++;
}).catch(() => {});
api.storage.onChanged.addListener(changements => {
  if (!changements.marcheSansBlanc) return;
  marcheSansBlanc = changements.marcheSansBlanc.newValue === true;
  const coche = document.querySelector("#wmd-case-blanc input");
  if (coche) coche.checked = marcheSansBlanc;
  versionPage++;
});
api.storage.local.get("marcheQueEncadrees").then(({ marcheQueEncadrees: valeur }) => {
  marcheQueEncadrees = valeur === true;
  const coche = document.querySelector("#wmd-case-encadrees input");
  if (coche) coche.checked = marcheQueEncadrees;
  versionPage++;
}).catch(() => {});
api.storage.onChanged.addListener(changements => {
  if (!changements.marcheQueEncadrees) return;
  marcheQueEncadrees = changements.marcheQueEncadrees.newValue === true;
  const coche = document.querySelector("#wmd-case-encadrees input");
  if (coche) coche.checked = marcheQueEncadrees;
  versionPage++;
});
function afficherNombreNonEncadrees(actif) {
  const texte = document.getElementById("wmd-texte-encadrees");
  const voulu = " Seulement les enchères encadrées"
    + (actif ? ` (${document.querySelectorAll(".wmd-pas-encadree").length} cachée(s))` : "");
  if (texte && texte.textContent !== voulu) texte.textContent = voulu;
}

// 1.16 : « + », « ++ » ou « +++ » en haut à droite de chaque carte du Marché dont on connaît le prix moyen du site,
// selon l'écart (en wikibidous) entre la mise et ce prix moyen : vert si la mise est plus basse, rouge si plus haute.
// Seuils réglables dans « ⚙️ Options du Marché » (100 / 500 / 1000 par défaut).
const ECARTS_PAR_DEFAUT = [100, 500, 1000];
let marcheEcarts = { actif: true, seuils: [...ECARTS_PAR_DEFAUT] };
function lireReglageEcarts(valeur) {
  const seuils = ECARTS_PAR_DEFAUT.map((defaut, i) => {
    const n = valeur && Array.isArray(valeur.seuils) ? Number(valeur.seuils[i]) : NaN;
    return Number.isFinite(n) && n >= 1 ? n : defaut;
  });
  return { actif: !valeur || valeur.actif !== false, seuils: seuils };
}
function afficherReglageEcarts() {
  const coche = document.querySelector("#wmd-case-ecarts input[type=checkbox]");
  if (coche) coche.checked = marcheEcarts.actif;
  marcheEcarts.seuils.forEach((seuil, i) => {
    const champ = document.getElementById(`wmd-ecart-${i + 1}`);
    if (champ && document.activeElement !== champ) champ.value = String(seuil);
  });
}
api.storage.local.get("marcheEcarts").then(({ marcheEcarts: valeur }) => {
  marcheEcarts = lireReglageEcarts(valeur);
  afficherReglageEcarts();
  versionPage++;
}).catch(() => {});
api.storage.onChanged.addListener(changements => {
  if (!changements.marcheEcarts) return;
  marcheEcarts = lireReglageEcarts(changements.marcheEcarts.newValue);
  afficherReglageEcarts();
  versionPage++;
});
function afficherEcart(cadre, annonce, moyenne) {
  let marque = cadre.querySelector(":scope > .wmd-ecart");
  let niveau = 0;
  const ecart = moyenne && moyenne.prix > 0 && !annonce.terminee && Number.isFinite(annonce.prix) ? annonce.prix - moyenne.prix : 0;
  if (marcheEcarts.actif) for (const seuil of marcheEcarts.seuils) if (Math.abs(ecart) >= seuil) niveau++;
  if (!niveau) {
    if (marque) marque.remove();
    cadre.classList.remove("wmd-avec-ecart");
    return;
  }
  const texte = "+".repeat(niveau);
  const sens = ecart < 0 ? "moins-cher" : "plus-cher";
  const titre = `Mise ${nombreLisible(annonce.prix)} : ${nombreLisible(Math.abs(ecart))} wikibidous `
    + (ecart < 0 ? "SOUS" : "AU-DESSUS DU") + ` prix moyen du site (${nombreLisible(moyenne.prix)})`;
  if (!marque) {
    marque = creer("span", undefined, "wmd-ecart");
    cadre.appendChild(marque);
  }
  cadre.classList.add("wmd-avec-ecart");
  if (marque.textContent !== texte) marque.textContent = texte;
  if (marque.dataset.sens !== sens) marque.dataset.sens = sens;
  if (marque.title !== titre) marque.title = titre;
}

// 1.16 : sur une carte encadrée, une flèche et un % dans les coins du bas :
// à gauche la variation du prix sur une semaine, à droite sur 2 mois (voir tendancesDepuisHistorique).
function texteTendance(pourcent) {
  if (pourcent === null || pourcent === undefined) return null;
  return `${pourcent > 0 ? "↑" : pourcent < 0 ? "↓" : "→"} ${Math.abs(pourcent)} %`;
}
function afficherTendances(cadre, tendance) {
  for (const [periode, cote, libelle] of [["semaine", "gauche", "sur une semaine"], ["deuxMois", "droite", "sur 2 mois"]]) {
    const texte = tendance ? texteTendance(tendance[periode]) : null;
    let pastille = cadre.querySelector(`:scope > .wmd-tendance-${cote}`);
    if (!texte) { if (pastille) pastille.remove(); continue; }
    const sens = tendance[periode] > 0 ? "hausse" : tendance[periode] < 0 ? "baisse" : "stable";
    if (pastille && pastille.textContent === texte && pastille.dataset.sens === sens) continue;
    if (!pastille) {
      pastille = creer("span", undefined, `wmd-tendance wmd-tendance-${cote}`);
      cadre.appendChild(pastille);
    }
    pastille.textContent = texte;
    pastille.dataset.sens = sens;
    pastille.title = `Prix moyen ${libelle} : ${texte}`
      + (tendance.calcule ? ` (historique du site du ${new Date(tendance.calcule).toLocaleDateString("fr-FR")})` : "");
  }
}

// 1.17 : les petites icônes d'alerte, en haut à gauche de la carte, chacune avec son infobulle :
// 🕒 vieux prix (ou sans date), ⚠ prix le plus haut du Marché douteux, 🎈 prix peut-être gonflé.
// Avant, 🕒 et ⚠ étaient collés au début de l'étiquette du cadre, déjà longue.
function afficherIcones(cadre, icones) {
  let zone = cadre.querySelector(":scope > .wmd-icones");
  const signature = JSON.stringify(icones);
  if (!icones.length) {
    if (zone) zone.remove();
    return;
  }
  if (zone && zone.dataset.signature === signature) return;
  if (!zone) {
    zone = creer("span", undefined, "wmd-icones");
    cadre.appendChild(zone);
  }
  zone.dataset.signature = signature;
  zone.replaceChildren(...icones.map(({ texte, titre, type }) => {
    const icone = creer("span", texte, `wmd-icone wmd-icone-${type}`);
    icone.title = titre;
    return icone;
  }));
}

async function marquerBonnesAffaires() {
  if (affairesEnCours) return;
  const actif = reglages.marche && optionsMarcheActives();
  const queEncadrees = actif && marcheQueEncadrees;
  if (!queEncadrees) {
    for (const element of document.querySelectorAll(".wmd-pas-encadree")) element.classList.remove("wmd-pas-encadree");
  }
  if (!actif) {
    for (const element of document.querySelectorAll(".wmd-bonne-affaire")) element.classList.remove("wmd-bonne-affaire");
    for (const element of document.querySelectorAll(".wmd-tendance")) element.remove();
    for (const element of document.querySelectorAll(".wmd-ecart")) element.remove();
    for (const element of document.querySelectorAll(".wmd-avec-ecart")) element.classList.remove("wmd-avec-ecart");
    for (const element of document.querySelectorAll(".wmd-icones")) element.remove(); // 1.17
    afficherNombreNonEncadrees(false);
    return;
  }
  affairesEnCours = true;
  try {
    if (!annoncesEnCache) {
      const { marche } = await api.storage.local.get("marche");
      annoncesEnCache = Object.entries(marche ? marche.annonces : {});
    moyennesEnCache = marche && marche.moyennes ? marche.moyennes : {};
    }
    if (!tendancesEnCache) tendancesEnCache = (await api.storage.local.get("tendances")).tendances || {};
    for (const annonce of lireAnnoncesMarche(true)) {
      const cadre = annonce.cadre.closest("[id^='marketplace-auction-']") || annonce.cadre;
      const estime = !annonce.terminee && annonce.rarete !== "inconnue"
        ? estimationSans(annoncesEnCache, annonce.nom, annonce.rarete, annonce.cle) : null;
      // 1.7.6 : deux sortes de cadres.
      //  - jaune → rouge : la mise est à 75 % ou moins du PRIX MOYEN du site (toujours prioritaire) ;
      //  - blanc → bleu : sinon, la mise est à 75 % ou moins du prix le plus HAUT trouvé au Marché.
      const rapportMoyen = estime && estime.moyenne && estime.estimation > 0 ? annonce.prix / estime.estimation : 1;
      const rapportMax = estime && estime.max > 0 ? annonce.prix / estime.max : 1;
      // 1.14 : chaque cadre a SOIT un seuil en % sous l'estimation, SOIT un montant en wikibidous (réglés dans le panneau).
      // Le « seuil » est le rapport mise / estimation à partir duquel le cadre apparaît (il sert aussi à la couleur).
      const seuilDe = (cadreDe, estimation) => {
        const s = seuilCadre(cadreDe);
        if (s.mode === "montant") return estimation > 0 ? Math.max(0, 1 - s.valeur / estimation) : -1;
        return 1 - s.valeur / 100;
      };
      // 1.17 : le cadre du prix moyen suit maintenant les seuils « ++ » et « +++ » (écart en wikibidous SOUS le prix moyen) :
      // JAUNE à partir de « ++ », ROUGE à partir de « +++ ». Le seuil en % / montant du prix moyen n'est plus utilisé.
      const ecartSous = estime && estime.moyenne && estime.estimation > 0 ? estime.estimation - annonce.prix : 0;
      const niveauMoyenne = ecartSous >= marcheEcarts.seuils[2] ? 3 : ecartSous >= marcheEcarts.seuils[1] ? 2 : 0;
      const seuilMax = seuilDe("Max", estime ? estime.max : 0);
      const okMoyenne = rapportMoyen < 1 && niveauMoyenne >= 2;
      const okMax = rapportMax < 1 && rapportMax <= seuilMax && !(marcheSansBlanc && estime.moyenne); // 1.17.1
      const type = okMoyenne ? "moyenne" : okMax ? "max" : null;
      const affaire = type !== null;
      const rapport = type === "moyenne" ? rapportMoyen : rapportMax;
      const tendance = annonce.rarete !== "inconnue" ? tendancesEnCache[`${annonce.nom}|${annonce.rarete}`] : null;
      const pic = picASignaler(tendance); // 1.17 : prix peut-être gonflé (🎈), sur toutes les cartes
      const icones = [];
      if (cadre.classList.contains("wmd-bonne-affaire") !== affaire) cadre.classList.toggle("wmd-bonne-affaire", affaire);
      afficherTendances(cadre, affaire ? tendance : null);
      afficherEcart(cadre, annonce, annonce.rarete !== "inconnue" ? moyennesEnCache[`${annonce.nom}|${annonce.rarete}`] : null);
      if (queEncadrees && cadre.classList.contains("wmd-pas-encadree") === affaire) cadre.classList.toggle("wmd-pas-encadree", !affaire);
      if (affaire) {
        // 1.7.7 : « ⚠ » si un prix moyen du site est connu mais que seul le cadre bleu (max du Marché) s'applique :
        // ce prix le plus haut est alors probablement trompeur.
        const attention = type === "max" && estime.moyenne;
        // 1.16 : « 🕒 » si le prix qui sert au cadre a été relevé il y a plus d'une semaine.
        const vuBase = type === "moyenne" ? estime.vuMoyenne : estime.vuMax;
        // Un prix sans date (vieux fichier importé, relevé d'avant la 1.16…) a aussi son « 🕒 ».
        const sansDate = !vuBase;
        const vieux = sansDate || Date.now() - vuBase > PRIX_VIEUX_MS;
        if (vieux) icones.push({ type: "vieux", texte: "🕒", titre: sansDate ? "🕒 Date du relevé de ce prix inconnue : il a pu changer."
          : `🕒 Prix relevé le ${new Date(vuBase).toLocaleDateString("fr-FR")}, il y a plus d'une semaine : il a pu changer.` });
        if (attention) icones.push({ type: "attention", texte: "⚠", titre: `⚠ Le prix moyen du site est ${nombreLisible(estime.estimation)} : `
          + `le prix le plus haut du Marché (${nombreLisible(estime.max)}) est probablement trompeur.` });
        // 1.17 : l'étiquette est plus courte (le prix de vente le plus bas est dans l'infobulle) : elle tient dans la carte.
        const texte = (type === "moyenne" ? "+".repeat(niveauMoyenne) + " " : "") + `−${Math.round((1 - rapport) * 100)} % · `
          + (type === "moyenne" ? `moy. ${nombreLisible(estime.estimation)}` : `max ${nombreLisible(estime.max)}`)
          + (type === "moyenne" && pic && pic.dansMoyenne ? " 🎈" : "");
        // La couleur dépend aussi du seuil réglé : elle est recalculée à chaque passage.
        // 1.17 : le cadre jaune rougit peu à peu quand l'écart se rapproche du seuil « +++ » (rouge franc à « +++ »).
        const progression = Math.min(1, Math.max(0, (ecartSous - marcheEcarts.seuils[1]) / Math.max(1, marcheEcarts.seuils[2] - marcheEcarts.seuils[1])));
        const couleur = type === "moyenne" ? (niveauMoyenne >= 3 ? COULEUR_TRES_BONNE : `hsl(${Math.round(50 - 38 * progression)}, 95%, 52%)`)
          : attention ? COULEUR_MAX_ATTENTION : COULEUR_MAX;
        if (cadre.style.getPropertyValue("--wmd-couleur-affaire") !== couleur) cadre.style.setProperty("--wmd-couleur-affaire", couleur);
        const titre = `${annonce.depart ? "Mise de départ" : "Mise actuelle"} ${nombreLisible(annonce.prix)} : `
          + (type === "moyenne"
            ? `${nombreLisible(ecartSous)} wikibidous (${Math.round((1 - rapport) * 100)} %) sous le prix moyen du site (${nombreLisible(estime.estimation)}) : `
              + (niveauMoyenne >= 3 ? `« +++ », cadre rouge (≥ ${nombreLisible(marcheEcarts.seuils[2])})` : `« ++ », cadre jaune (≥ ${nombreLisible(marcheEcarts.seuils[1])})`)
            : `${Math.round((1 - rapport) * 100)} % sous le prix le plus haut vu au Marché (${nombreLisible(estime.max)})`)
          + (estime.minVendu !== null ? `. Vendue au minimum : ${nombreLisible(estime.minVendu)}` : "")
          + (type === "moyenne" && pic && pic.dansMoyenne && pic.sansPic > 0
            ? `. 🎈 Ce prix moyen est gonflé par un pic : sans lui ≈ ${nombreLisible(pic.sansPic)} (la mise en fait ${Math.round(annonce.prix / pic.sansPic * 100)} %)` : "")
          + ". (WikiMasters Doublons)";
        if (cadre.dataset.wmdAffaire !== texte) cadre.dataset.wmdAffaire = texte;
        if (cadre.title !== titre) cadre.title = titre;
      } else if (cadre.dataset.wmdAffaire) {
        delete cadre.dataset.wmdAffaire;
        cadre.style.removeProperty("--wmd-couleur-affaire");
        cadre.removeAttribute("title");
      }
      if (pic) icones.push({ type: "pic", texte: "🎈", titre: textePic(pic) });
      afficherIcones(cadre, icones);
    }
    afficherNombreNonEncadrees(queEncadrees);
  } finally {
    affairesEnCours = false;
  }
}


// ---------------------------------------------------------------------
//  PARTIE 13 NONIES : LES ENCHÈRES SUIVIES (nouveau en 1.8)
//  Tu es prévenu avant la fin des enchères que tu suis, autant de fois que tu veux
//  (par exemple 1 h, 10 min et 2 min avant : à régler dans les réglages).
//  - Une enchère est suivie toute seule quand tu cliques sur « Enchérir » / « Miser »
//    (l'extension REGARDE ton clic ; elle ne mise jamais à ta place), ou quand sa page
//    indique que tu as misé (« Vous êtes le meilleur enchérisseur »…).
//  - Sur la page d'une enchère, le bouton « 🔔 Me prévenir avant la fin » la suit à la main.
//  - L'heure de fin est lue sur la page de l'enchère (et sur la liste du Marché) à chaque
//    passage. Si l'extension n'arrive pas à la lire, tu peux taper le temps restant.
//  Les alarmes elles-mêmes sont programmées par background.js (comme pour les paquets).
// ---------------------------------------------------------------------

const ENCHERES = {
  // Les mots qui accompagnent un compte à rebours de fin d'enchère.
  regexMotsFin: /termin|\bfin\b|finit|restant|reste|dur[ée]e|expire|cl[ôo]tur|\bends?\b|time left|remaining|rebours/i,
  // Les minuteurs qui ne sont PAS la fin de l'enchère (le minuteur des paquets, l'heure d'une mise passée).
  regexPasLaFin: /prochain|paquet|il y a|\bago\b/i,
  // Un bouton pour miser (jamais « Mettre aux enchères », qui sert à VENDRE).
  regexBoutonMise: /ench[ée]rir|^miser\b|placer (?:une |ma |mon |l')?(?:mise|ench[èe]re|offre)|(?:valider|confirmer) (?:la |ma )?mise/i,
  // Les phrases du site qui montrent que tu as misé sur cette enchère.
  regexJaiMise: /vous [êe]tes (?:le |la |l')?meilleur|votre (?:derni[èe]re |meilleure )?(?:mise|ench[èe]re|offre)|vous avez (?:mis[ée]|ench[ée]ri|surench[ée]ri|[ée]t[ée] surench[ée]ri)|vous menez|meilleure? ench[ée]risseu[rs]e? ?: ?vous/i,
  regexTerminee: /^(?:vendue?|termin[ée]e?|expir[ée]e?|annul[ée]e?|ench[èe]re termin[ée]e|cl[ôo]tur[ée]e?|non vendue)$/i,
  // Relevé sur le site (novembre 2026) : dans l'onglet « Mes enchères » du Marché, chaque annonce
  // porte « Vous menez » ou « Surenchéri ». La page d'une enchère affiche « Meneur : <pseudo> ».
  regexStatutMenez: /^vous menez$/i,
  regexStatutSurencheri: /^surench[ée]ri(?:e|s|es)?$/i,
  regexMeneur: /^meneur\s*:\s*(.+)$/i,
  ignoreesJours: 30 // « Ne plus suivre » empêche le suivi automatique de revenir pendant 30 jours
};

// --- Ton pseudo (pour savoir, sur la page d'une enchère, si tu mènes ou si tu as été surenchéri) ---
// Il est lu sur ta page Profil (/profile : titres « Mon Profil » puis ton pseudo), ou déduit d'une
// enchère marquée « Vous menez » dont la page affiche « Meneur : <pseudo> ».
let monPseudo = null;
api.storage.local.get("monPseudo").then(({ monPseudo: lu }) => { monPseudo = lu || null; }).catch(() => {});
api.storage.onChanged.addListener(changements => {
  if (changements.monPseudo) monPseudo = changements.monPseudo.newValue || null;
});
async function noterPseudo(pseudo) {
  pseudo = (pseudo || "").trim();
  if (!pseudo || pseudo === monPseudo || pseudo.length > 40) return;
  monPseudo = pseudo;
  await api.storage.local.set({ monPseudo: pseudo });
}
function apprendrePseudo() {
  if (location.pathname !== "/profile") return;
  const zone = document.querySelector("main") || document.body;
  const titres = [...zone.querySelectorAll("h1")].map(h => h.textContent.trim()).filter(t => t && !/^mon profil$/i.test(t));
  if (titres.length === 1) noterPseudo(titres[0]);
}

// « menez », « surencheri » ou null : l'étiquette d'une annonce de l'onglet « Mes enchères ».
function statutDansBloc(bloc) {
  for (const element of bloc.querySelectorAll("span, div, p")) {
    if (element.children.length > 0 || estDeLExtension(element)) continue;
    const texte = element.textContent.replace(/\s+/g, " ").trim();
    if (ENCHERES.regexStatutMenez.test(texte)) return "menez";
    if (ENCHERES.regexStatutSurencheri.test(texte)) return "surencheri";
  }
  return null;
}

// 1.15 : sur la page d'une enchère, ce que le SITE dit de toi : « Vous menez », « Surenchéri »,
// « Vous êtes le meilleur enchérisseur », « Vous avez été surenchéri »… → "menez", "surencheri" ou null.
// C'est plus sûr que de comparer le meneur à ton pseudo (qui peut être inconnu).
function statutSurPage(zone) {
  const etiquette = statutDansBloc(zone);
  if (etiquette) return etiquette;
  let menez = false;
  for (const element of zone.querySelectorAll("p, span, div, b, strong, li")) {
    if (element.children.length > 2 || estDeLExtension(element)) continue;
    const texte = element.textContent.replace(/\s+/g, " ").trim();
    // Pas les phrases d'explication du site (« Si vous êtes surenchéri, elle vous est remboursée »).
    if (!texte || texte.length > 100 || /(?:^|[.!?]\s*)si\b/i.test(texte)) continue;
    if (/vous avez [ée]t[ée] surench[ée]ri|(?:quelqu'un|un autre joueur) (?:a|vous a) surench[ée]ri|vous n'[êe]tes plus (?:le |la )?meilleur/i.test(texte)) return "surencheri";
    if (/vous [êe]tes (?:le |la |l')?meilleure? ench[ée]risseu|vous menez|meilleure? ench[ée]risseu(?:r|se) ?: ?vous/i.test(texte)) menez = true;
  }
  return menez ? "menez" : null;
}

// Sur la page d'une enchère : le pseudo du meneur (« Meneur : Jesuif »), ou null.
function lireMeneur(zone) {
  for (const element of zone.querySelectorAll("div, p, span")) {
    if (estDeLExtension(element)) continue;
    const texte = element.textContent.replace(/\s+/g, " ").trim();
    if (texte.length > 60) continue;
    const trouve = texte.match(ENCHERES.regexMeneur);
    if (trouve) return trouve[1].trim();
  }
  return null;
}

// Les pseudos de l'« Historique des mises » (pas celui du vendeur, écrit plus haut).
function pseudosHistorique(zone) {
  const titre = [...zone.querySelectorAll("h2, h3")].find(h => /^historique des mises/i.test(h.textContent.trim()));
  if (!titre || !titre.parentElement) return [];
  return [...titre.parentElement.querySelectorAll("a[href*='/profile/']")].map(lien =>
    decodeURIComponent(lien.getAttribute("href").split("/profile/")[1] || "").replace(/\/.*$/, "")).filter(Boolean);
}

function texteStatut(statut) {
  return statut === "menez" ? "tu mènes" : statut === "surencheri" ? "tu as été surenchéri !" : "";
}

async function noterStatut(id, statut) {
  const memo = encheresSuivies[id];
  if (!memo || !statut || (memo.statut === statut && Date.now() - (memo.statutVu || 0) < MINUTE)) return;
  await modifierEncheres(m => {
    if (!m.encheres[id]) return false;
    m.encheres[id].statut = statut;
    m.encheres[id].statutVu = Date.now();
    return true;
  });
}

// Vrai si l'élément a été ajouté par l'extension (panneau, encarts) : on ne lit jamais nos propres textes.
function estDeLExtension(element) {
  return element.closest("#wmd-panneau, .wmd-prix-fiche, #wmd-suivi-enchere, #wmd-alerte-amis, #wmd-aide-prixmax") !== null;
}

function adresseEnchere(id) {
  return `${location.origin}/marketplace/${id}`;
}

// --- Ce que l'extension sait des enchères suivies (copie de la mémoire « encheres ») ---
// encheres = { id: { id, nom, rarete, prix, fin, finMax, source, terminee, auto, suivieLe, vu } }
// fin = l'heure de fin la plus TÔT possible (les alertes partent sur elle : jamais en retard),
// finMax = la plus tard possible. Plus l'heure est lue précisément, plus elles sont proches.
let encheresSuivies = {};
let encheresIgnorees = {}; // id → date du « Ne plus suivre »
// 1.12 : les enchères finies depuis plus d'une minute ne sont plus suivies : background.js les range dans
// « encheresFinies » (7 jours), qui ne sert qu'à reconnaître un achat (prix d'achat, 1.10).
let encheresFinies = {};
api.storage.local.get("encheresFinies").then(({ encheresFinies: lu }) => { encheresFinies = lu || {}; }).catch(() => {});
api.storage.onChanged.addListener(changements => {
  if (changements.encheresFinies) encheresFinies = changements.encheresFinies.newValue || {};
});
// Vrai si l'enchère vient d'être retirée parce que finie : on ne la resuit pas toute seule, sauf si la page
// montre qu'elle court encore (« lue » : une fin dans plus de 2 minutes, après une prolongation par exemple).
// 1.15 : un compte à rebours qui tique sur la page suffit aussi (une enchère prolongée d'une minute par une
// mise de dernière seconde court encore, même si sa fin est à moins de 2 minutes).
function finieRecemment(id, lue) {
  if (!encheresFinies[id] || !lue) return Boolean(encheresFinies[id]);
  const maintenant = Date.now();
  return !(lue.debut > maintenant + 2 * MINUTE || (lue.tique && lue.debut > maintenant + 5 * SECONDE));
}
let nombreEncheresSuivies = 0;
function compterEncheresSuivies() {
  nombreEncheresSuivies = Object.values(encheresSuivies).filter(e => !e.terminee && !(e.fin && e.finMax < Date.now())).length;
}
api.storage.local.get(["encheres", "encheresIgnorees"]).then(({ encheres, encheresIgnorees: ignorees }) => {
  encheresSuivies = encheres || {};
  encheresIgnorees = ignorees || {};
  compterEncheresSuivies();
}).catch(() => {});
api.storage.onChanged.addListener(changements => {
  if (changements.encheresIgnorees) encheresIgnorees = changements.encheresIgnorees.newValue || {};
  if (!changements.encheres) return;
  encheresSuivies = changements.encheres.newValue || {};
  compterEncheresSuivies();
  const suivi = document.getElementById("wmd-suivi-enchere");
  if (suivi) suivi.dataset.signature = ""; // l'encart de l'enchère sera redessiné
});

// Lit, modifie et réécrit la mémoire « encheres », une modification à la fois dans cet onglet.
// "modifier" reçoit l'objet des enchères et renvoie true s'il l'a changé.
let fileEncheres = Promise.resolve();
function modifierEncheres(modifier) {
  const tache = async () => {
    const lu = await api.storage.local.get(["encheres", "encheresIgnorees"]);
    const memo = { encheres: lu.encheres || {}, ignorees: lu.encheresIgnorees || {} };
    const change = await modifier(memo);
    if (change) {
      await api.storage.local.set({ encheres: memo.encheres, encheresIgnorees: memo.ignorees });
      encheresSuivies = memo.encheres;
      encheresIgnorees = memo.ignorees;
      compterEncheresSuivies();
    }
    return change;
  };
  const resultat = fileEncheres.then(tache, tache);
  fileEncheres = resultat.catch(erreur => console.warn("[WikiMasters Doublons]", erreur));
  return resultat;
}

// Commence à suivre une enchère (ou met à jour ce qu'on sait d'elle).
// auto = suivie toute seule ; mise = tu viens de cliquer sur « Enchérir » (efface un « Ne plus suivre »).
async function suivreEnchere(id, infos, { auto = false, mise = false } = {}) {
  if (!id || !reglages.encheres) return;
  let nouvelle = false;
  await modifierEncheres(memo => {
    if (mise) delete memo.ignorees[id];
    if (auto && memo.ignorees[id]) return false; // tu as choisi de ne plus la suivre
    const ancienne = memo.encheres[id];
    if (!ancienne) nouvelle = true;
    const enchere = ancienne || { id: id, fin: null, finMax: null, source: null, terminee: false, auto: auto, suivieLe: Date.now() };
    for (const champ of ["nom", "rarete", "prix"]) {
      if (infos && infos[champ] !== undefined && infos[champ] !== null) enchere[champ] = infos[champ];
    }
    enchere.vu = Date.now();
    memo.encheres[id] = enchere;
    return true;
  });
  if (nouvelle) {
    const delais = nettoyerDelais(reglages.enchereDelais);
    afficherStatut(`🔔 Enchère suivie${infos && infos.nom ? ` : ${infos.nom}` : ""}. `
      + (delais.length ? `Tu seras prévenu ${delais.map(delaiLisible).join(", ")} avant la fin.` : "Aucune alerte n'est réglée : ajoute-en dans les réglages."));
  }
}

async function nePlusSuivre(id) {
  await modifierEncheres(memo => {
    delete memo.encheres[id];
    memo.ignorees[id] = Date.now();
    return true;
  });
  afficherStatut("Cette enchère n'est plus suivie.");
}

// Enregistre une heure de fin lue : [debut, fin] = l'intervalle où se trouve la vraie fin.
// Plusieurs lectures successives se recoupent et rendent l'heure de plus en plus précise.
// Si la nouvelle lecture ne recoupe pas l'ancienne, l'enchère a sans doute été prolongée : on la remplace.
// 1.15 : "precision" = la précision de la lecture (ms). Un compte à rebours à la seconde est suivi à
// 3 secondes près (avant : 30 secondes, d'où une heure de fin qui pouvait dériver de celle du site).
async function noterFinEnchere(id, debut, finMax, source, precision = null) {
  const ancienne = encheresSuivies[id];
  if (!ancienne) return;
  // 1.15 : l'heure donnée par le site lui-même (source « site », voir reponses-site.js) est exacte. Une lecture
  // de la page ne la remplace que si elle ne la recoupe pas (enchère prolongée, pas encore renvoyée par le site).
  if (ancienne.source === "site" && source !== "site" && ancienne.fin && ancienne.finMax
    && Date.now() - (ancienne.finLue || ancienne.vu || 0) < 10 * MINUTE
    && debut <= ancienne.finMax + 2 * SECONDE && finMax >= ancienne.fin - 2 * SECONDE) return;
  let nouveauDebut = debut, nouvelleFin = finMax;
  if (ancienne.fin && ancienne.finMax && ancienne.source !== "manuel" && debut <= ancienne.finMax && finMax >= ancienne.fin) {
    nouveauDebut = Math.max(debut, ancienne.fin);
    nouvelleFin = Math.min(finMax, ancienne.finMax);
  }
  // Rien d'important n'a changé : on n'écrit pas (la page est relue toutes les secondes).
  // 1.15 : même si la lecture vient d'ailleurs (liste ou page) ; seule une heure tapée à la main est toujours remplacée.
  const tolerance = lecturePrecise(precision) ? 3 * SECONDE : 30 * SECONDE;
  if (ancienne.fin && Math.abs(nouveauDebut - ancienne.fin) < tolerance
    && (ancienne.finMax - ancienne.fin) - (nouvelleFin - nouveauDebut) < tolerance
    && !(ancienne.source === "manuel" && source !== "manuel")) return;
  await modifierEncheres(memo => {
    const enchere = memo.encheres[id];
    if (!enchere) return false;
    enchere.fin = nouveauDebut;
    enchere.finMax = nouvelleFin;
    enchere.source = source;
    enchere.vu = Date.now();
    enchere.finLue = Date.now(); // 1.15 : l'heure de la dernière lecture de la fin (« synchro à 18:20:14 »)
    if (lecturePrecise(precision)) enchere.finPrecise = true;
    else if (nouvelleFin - nouveauDebut > 2 * MINUTE) enchere.finPrecise = false;
    return true;
  });
}

async function noterEnchereTerminee(id) {
  if (!encheresSuivies[id] || encheresSuivies[id].terminee) return;
  await modifierEncheres(memo => {
    if (!memo.encheres[id]) return false;
    memo.encheres[id].terminee = true;
    memo.encheres[id].termineeVue = Date.now(); // 1.12 : elle ne sera plus suivie une minute après
    return true;
  });
}

// --- Lire l'heure de fin sur la page ---

// Les comptes à rebours vus aux passages précédents : élément → { ms, a, tique }.
// Un texte dont la durée baisse d'une seconde chaque seconde est sûrement LE compte à rebours.
const minuteriesVues = new WeakMap();

// Cherche dans "zone" le texte qui donne la fin de l'enchère.
// Renvoie { debut, fin } (l'intervalle où se trouve la vraie heure de fin) ou null.
// 1.15 : renvoie aussi la précision de la lecture (en ms : 1 000 pour un compte à rebours à la seconde)
// et « tique » (vrai si ce compte à rebours a baissé seconde après seconde) : { debut, fin, precision, tique }.
function lireFinDans(zone) {
  const maintenant = Date.now();
  let meilleur = null;
  const proposer = (score, debut, fin, precision, tique = false) => {
    if (!meilleur || score > meilleur.score) meilleur = { score: score, debut: debut, fin: fin, precision: precision, tique: tique };
  };
  // 1) Une balise <time datetime="…"> : l'heure exacte.
  for (const element of zone.querySelectorAll("time[datetime]")) {
    if (estDeLExtension(element)) continue;
    const heure = Date.parse(element.getAttribute("datetime"));
    if (heure > maintenant - MINUTE && heure < maintenant + 60 * JOUR) proposer(4, heure - SECONDE, heure + SECONDE, SECONDE);
  }
  // 2) Les textes courts : « 2j 03:12:45 », « Se termine dans 3 h », « Fin le 22/11 à 18:00 »...
  for (const element of zone.querySelectorAll("*")) {
    if (element.matches("script, style, svg, svg *") || estDeLExtension(element)) continue;
    const texte = element.textContent.replace(/\s+/g, " ").trim();
    if (!texte || texte.length > 60 || !/\d/.test(texte)) continue;
    // On garde l'élément le plus petit : on saute un élément qui n'a qu'un enfant avec le même texte.
    if (element.children.length === 1 && element.children[0].textContent.replace(/\s+/g, " ").trim() === texte) continue;
    const autour = (element.parentElement ? element.parentElement.textContent : "").replace(/\s+/g, " ").trim();
    if (ENCHERES.regexPasLaFin.test(texte) || (autour.length <= 120 && ENCHERES.regexPasLaFin.test(autour))) continue;
    const motDansLeTexte = ENCHERES.regexMotsFin.test(texte);
    // L'étiquette (« Temps restant », « Fin de l'enchère »...) peut être à côté : on regarde jusqu'à 3 parents.
    let motAutour = false;
    for (let parent = element.parentElement, n = 0; parent && n < 3 && parent !== zone.parentElement; parent = parent.parentElement, n++) {
      const texteParent = parent.textContent.replace(/\s+/g, " ").trim();
      if (texteParent.length > 160) break;
      if (ENCHERES.regexMotsFin.test(texteParent)) { motAutour = true; break; }
    }

    // Une date complète (« Fin le 22/11/2026 à 18:00 ») : seulement à côté d'un mot de fin.
    const date = (motDansLeTexte || motAutour) ? lireDateFin(texte, maintenant) : null;
    if (date !== null && date > maintenant - MINUTE) {
      proposer(3, date - MINUTE, date + MINUTE, MINUTE);
      continue;
    }
    const duree = lireDuree(texte);
    if (!duree) continue;
    const pure = estSeulementUneDuree(texte);
    if (!pure && !motDansLeTexte) continue; // « 530 pièces », « 3 mises »... : pas un compte à rebours
    // Est-ce qu'il tique ? (la durée a baissé d'autant que le temps passé depuis la dernière fois)
    const avant = minuteriesVues.get(element);
    let tique = Boolean(avant && avant.tique);
    if (avant && avant.ms !== duree.ms) {
      const ecoule = maintenant - avant.a;
      tique = Math.abs((avant.ms - duree.ms) - ecoule) <= 1500;
    }
    minuteriesVues.set(element, { ms: duree.ms, a: maintenant, tique: tique });
    // Une heure seule (« 12:45 ») peut être l'heure d'une mise dans l'historique : on ne la prend
    // que si un mot de fin est à côté, ou si elle tique comme un compte à rebours.
    if (/^\d{1,3}:\d{2}(?::\d{2})?$/.test(texte) && !motDansLeTexte && !motAutour && !tique) continue;
    const score = (motDansLeTexte ? 3 : 2) + (motAutour ? 1 : 0) + (tique ? 4 : 0);
    // Le site peut tronquer (« 3 h » = entre 3 h et 4 h) ou arrondir (entre 2 h 30 et 3 h 30) :
    // on garde l'intervalle qui couvre les deux. Les alertes partent sur le début : jamais en retard.
    proposer(score, maintenant + duree.ms - duree.precision / 2, maintenant + duree.ms + duree.precision, duree.precision, tique);
  }
  return meilleur && { debut: meilleur.debut, fin: meilleur.fin, precision: meilleur.precision, tique: meilleur.tique };
}

// Vrai si la zone indique que l'enchère est finie (« Vendue », « Terminée »…).
function enchereTermineeDans(zone) {
  for (const element of zone.querySelectorAll("*")) {
    if (element.children.length > 0 || estDeLExtension(element)) continue;
    const texte = element.textContent.replace(/\s+/g, " ").trim();
    if (ENCHERES.regexTerminee.test(texte) || /^vendue pour$/i.test(texte)) return true;
  }
  return false;
}

// Vrai si la page dit que tu as misé sur cette enchère.
function jaiMiseDans(zone) {
  for (const element of zone.querySelectorAll("p, span, div, li, b, strong")) {
    if (estDeLExtension(element)) continue;
    const texte = element.textContent.replace(/\s+/g, " ").trim();
    if (texte.length <= 120 && ENCHERES.regexJaiMise.test(texte)) return true;
  }
  return false;
}

// Le nom, la rareté et la mise de l'enchère affichée (page /marketplace/<id>).
function infosEnchereDetail(identifiant) {
  const zone = document.querySelector("main") || document.body;
  const titre = zone.querySelector("h1");
  const rarete = feuilles(zone).map(({ element, texte }) =>
    !estDeLExtension(element) && element.children.length === 0 ? rareteDepuisLettre(texte) : null).find(Boolean)
    || rareteBadgeShiny(zone) || null;
  const annonce = lireAnnonceDetail(identifiant)[0];
  return { nom: titre ? titre.textContent.trim() : null, rarete: rarete, prix: annonce ? annonce.prix : null };
}

// --- Le suivi automatique : on regarde (sans jamais le faire nous-mêmes) tes clics sur « Enchérir » ---

// L'identifiant de l'enchère concernée par un bouton : celle de la page, ou l'annonce qui contient le bouton.
function idEnchereAutour(element) {
  const page = location.pathname.match(REGEX_PAGE_ENCHERE);
  if (page) return page[1].toLowerCase();
  const bloc = element.closest("[id^='marketplace-auction-']");
  if (bloc) return bloc.id.slice("marketplace-auction-".length).toLowerCase();
  const lien = element.closest("a[href*='/marketplace/']");
  const trouve = lien && lien.getAttribute("href").match(/\/marketplace\/([0-9a-f-]{36})/i);
  return trouve ? trouve[1].toLowerCase() : null;
}

document.addEventListener("click", evenement => {
  try {
    if (!extensionValide() || !reglages.encheres || !reglages.enchereAuto) return;
    const cible = evenement.target instanceof Element ? evenement.target : null;
    const bouton = cible && cible.closest("button, [role='button'], input[type='submit']");
    if (!bouton || estDeLExtension(bouton)) return;
    const texte = (bouton.textContent || bouton.value || "").replace(/\s+/g, " ").trim();
    if (!ENCHERES.regexBoutonMise.test(texte) || /mettre aux ench/i.test(texte)) return;
    const id = idEnchereAutour(bouton);
    if (!id) return;
    const infos = REGEX_PAGE_ENCHERE.test(location.pathname) ? infosEnchereDetail(id) : null;
    suivreEnchere(id, infos, { auto: true, mise: true });
  } catch (erreur) {
    // Un clic ne doit jamais être gêné par l'extension.
  }
}, true);

// --- Sur la page d'une enchère : lire sa fin et afficher l'encart « 🔔 » ---

let saisieFinOuverte = false; // l'utilisateur a demandé à corriger l'heure de fin
let surveillanceEnchereEnCours = false;
async function surveillerEnchere() {
  if (surveillanceEnchereEnCours) return;
  const page = location.pathname.match(REGEX_PAGE_ENCHERE);
  const ancien = document.getElementById("wmd-suivi-enchere");
  if (!page || !reglages.encheres) {
    if (ancien) ancien.remove();
    saisieFinOuverte = false;
    return;
  }
  surveillanceEnchereEnCours = true;
  try {
    const id = page[1].toLowerCase();
    const zone = document.querySelector("main") || document.body;
    const titre = zone.querySelector("h1");
    if (!titre) return; // la page n'est pas encore chargée
    const terminee = enchereTermineeDans(zone);
    const lue = terminee ? null : lireFinDans(zone);
    const meneur = lireMeneur(zone);
    // 1.15 : ce que la page dit de toi (« Vous menez », « Vous avez été surenchéri »…) passe en premier.
    const statutPage = terminee ? null : statutSurPage(zone);
    // Ton pseudo pas encore connu : une enchère vue « Vous menez » il y a peu le donne (son meneur, c'est toi).
    // 1.15 : ou la page elle-même, quand elle dit « Vous menez » à côté de « Meneur : … ».
    const memoAvant = encheresSuivies[id];
    if (!monPseudo && meneur && (statutPage === "menez"
      || (memoAvant && memoAvant.statut === "menez" && Date.now() - (memoAvant.statutVu || 0) < 10 * MINUTE))) {
      await noterPseudo(meneur);
    }
    // Tu as misé ? (texte du site, ou ton pseudo dans l'historique des mises) Tu mènes ?
    // 1.15 : d'abord les données du site lui-même (meneur et mises, voir reponses-site.js), si elles sont récentes.
    const duSite = encheresDuSite.get(id);
    const misesSite = misesDuSite.get(id);
    const siteFrais = duSite && Date.now() - duSite.vuLe < 2 * MINUTE ? duSite : null;
    const jaiMiseSite = Boolean(monId && misesSite && misesSite.mises.some(m => m.id === monId));
    const dansHistorique = jaiMiseSite || (Boolean(monPseudo) && pseudosHistorique(zone).some(p => memePseudo(p, monPseudo)));
    const statutPseudo = monPseudo && meneur ? (memePseudo(meneur, monPseudo) ? "menez" : dansHistorique ? "surencheri" : null) : null;
    const statut = statutPage || statutDepuisSite(siteFrais, misesSite && misesSite.mises, jaiMiseSite) || statutPseudo;

    // Suivi automatique : tu as misé sur cette enchère (sauf si tu as choisi « Ne plus suivre »).
    if (!encheresSuivies[id] && !encheresIgnorees[id] && !terminee && !finieRecemment(id, lue) && reglages.enchereAuto
      && (dansHistorique || statutPage || jaiMiseDans(zone))) {
      await suivreEnchere(id, infosEnchereDetail(id), { auto: true });
    }
    // Ce qu'on sait de cette enchère (si elle est suivie) : nom, mise, heure de fin, terminée, qui mène.
    if (encheresSuivies[id]) {
      const infos = infosEnchereDetail(id);
      const memo = encheresSuivies[id];
      if ((infos.nom && infos.nom !== memo.nom) || (infos.prix !== null && infos.prix !== memo.prix) || (infos.rarete && infos.rarete !== memo.rarete)) {
        await suivreEnchere(id, infos);
      }
      if (statut) await noterStatut(id, statut);
      if (terminee) await noterEnchereTerminee(id);
      else if (lue) await noterFinEnchere(id, lue.debut, lue.fin, "page", lue.precision);
    }
    // 1.10 : une enchère finie que tu as remportée → son prix d'achat est noté.
    if (terminee) {
      // 1.12 : une enchère qui n'est plus suivie (finie depuis plus d'une minute) garde sa mémoire ici.
      const achat = achatDans(zone, encheresSuivies[id] || encheresFinies[id]);
      if (achat) {
        const infos = infosEnchereDetail(id);
        const memo = encheresSuivies[id] || encheresFinies[id] || {};
        await noterAchat(id, { nom: infos.nom || memo.nom, rarete: infos.rarete || memo.rarete, ...achat });
      }
    }
    dessinerEncartEnchere(id, titre, lue, terminee, statut);
  } finally {
    surveillanceEnchereEnCours = false;
  }
}

// 1.15 : "statut" = ce qui vient d'être lu sur la page ("menez", "surencheri" ou null). Quand la page affiche
// un compte à rebours à la seconde, l'encart montre CE compte à rebours (la mémoire peut avoir quelques
// secondes de retard), et l'heure de la dernière synchronisation.
function dessinerEncartEnchere(id, titre, lue, terminee, statut = null) {
  const memo = encheresSuivies[id] || null;
  const bloc = titre.parentElement && titre.parentElement.parentElement;
  let encart = document.getElementById("wmd-suivi-enchere");
  if (!bloc || (terminee && !memo)) { // une enchère finie que tu ne suis pas : rien à afficher
    if (encart) encart.remove();
    return;
  }
  const prixEncart = document.getElementById("wmd-prix-enchere");
  const avant = prixEncart && prixEncart.previousElementSibling === bloc ? prixEncart : bloc;
  const enDirect = Boolean(lue && lecturePrecise(lue.precision));
  const fin = enDirect ? lue.debut : memo && memo.fin ? memo.fin : lue ? lue.debut : null;
  const finMax = enDirect ? lue.fin : memo && memo.finMax ? memo.finMax : lue ? lue.fin : null;
  const statutAffiche = statut || (memo && memo.statut) || null;
  const signature = JSON.stringify([id, Boolean(memo), terminee, memo && memo.terminee, fin && Math.round(fin / MINUTE),
    finMax && Math.round(finMax / MINUTE), memo && memo.source, statutAffiche, enDirect, saisieFinOuverte, reglages.enchereDelais]);
  if (encart && encart.dataset.signature === signature && encart.previousElementSibling === avant) {
    // Seul le temps restant change : on le met à jour sans tout redessiner (le champ de saisie reste intact).
    const reste = encart.querySelector(".wmd-reste");
    if (reste && fin) reste.textContent = texteFin(fin, finMax);
    const synchro = encart.querySelector(".wmd-synchro");
    if (synchro) synchro.textContent = texteSynchro(memo, enDirect, statut);
    return;
  }
  if (!encart) {
    encart = creer("div", undefined, "wmd-prix-fiche wmd-suivi-enchere");
    encart.id = "wmd-suivi-enchere";
  }
  encart.dataset.signature = signature;
  encart.replaceChildren();
  const delais = nettoyerDelais(reglages.enchereDelais);
  const texteDelais = delais.length ? delais.map(delaiLisible).join(", ") + " avant la fin" : "aucune alerte réglée (voir les réglages)";

  if (terminee || (memo && memo.terminee)) {
    encart.appendChild(creer("b", "🔔 Cette enchère est terminée."));
    if (memo) ajouterBoutonEncart(encart, "Ne plus la suivre", () => nePlusSuivre(id));
  } else if (memo) {
    ajouterBoutonEncart(encart, "Ne plus suivre", () => nePlusSuivre(id));
    const titreEncart = creer("b", "🔔 Enchère suivie");
    if (statutAffiche) titreEncart.append(" : ", creer("span", texteStatut(statutAffiche), `wmd-statut-${statutAffiche}`));
    encart.appendChild(titreEncart);
    const ligne = creer("div", fin ? undefined : "Heure de fin inconnue : indique le temps restant ci-dessous.");
    if (fin) {
      const reste = creer("span", texteFin(fin, finMax), "wmd-reste");
      ligne.append("Fin : ", reste, memo.source === "manuel" && !enDirect ? " (tapée à la main)" : "");
    }
    encart.appendChild(ligne);
    encart.appendChild(creer("div", texteSynchro(memo, enDirect, statut), "wmd-discret wmd-synchro"));
    encart.appendChild(creer("div", `Alertes : ${texteDelais}${reglages.enchereNotifPC || reglages.enchereNotifTel ? "" : " (PC et téléphone décochés dans les réglages !)"}.`, "wmd-discret"));
    if (!fin || saisieFinOuverte) encart.appendChild(champSaisieFin(id));
    else if (memo.source === "manuel" || !lue) {
      const corriger = creer("a", "Corriger l'heure de fin", "wmd-lien-carte");
      corriger.href = "#";
      corriger.addEventListener("click", evenement => {
        evenement.preventDefault();
        saisieFinOuverte = true;
        encart.dataset.signature = "";
      });
      encart.appendChild(corriger);
    }
  } else {
    ajouterBoutonEncart(encart, "🔔 Me prévenir avant la fin", () => suivreEnchere(id, infosEnchereDetail(id)));
    encart.appendChild(creer("b", "Pas suivie"));
    encart.appendChild(creer("div", (lue ? `Fin : ${texteFin(lue.debut, lue.fin)}. ` : "")
      + `Si tu la suis, tu seras prévenu ${texteDelais}.`, "wmd-discret"));
  }
  avant.after(encart);
}

function ajouterBoutonEncart(encart, texte, action) {
  const bouton = creer("button", texte, "wmd-chercher-marche");
  bouton.type = "button";
  bouton.addEventListener("click", action);
  encart.appendChild(bouton);
}

// 1.15 : d'où viennent l'heure de fin et le statut affichés, et de quand ils datent.
function texteSynchro(memo, enDirect, statutLu) {
  const morceaux = [enDirect ? "⏱ en direct avec le compte à rebours du site"
    : memo && memo.source === "site" ? "heure de fin exacte donnée par le site"
    : memo && memo.finLue ? `fin relue à ${heureSecondes(memo.finLue)}` : ""];
  if (statutLu) morceaux.push("statut lu sur cette page");
  else if (memo && memo.statut && memo.statutVu) morceaux.push(`statut vu à ${heureSecondes(memo.statutVu)}`);
  else if (memo && !monPseudo) morceaux.push("statut inconnu : passe une fois sur ta page Profil pour que l'extension connaisse ton pseudo");
  return morceaux.filter(Boolean).join(" · ");
}

function heureSecondes(ms) {
  return new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// « dans 2 h 05 (vers 18:42) », avec la marge d'erreur si l'heure est approximative.
// 1.15 : quand l'heure est connue à la seconde, la dernière heure s'affiche en minutes ET secondes
// (« dans 12 min 05 s (vers 18:42:07) »), comme le compte à rebours du site.
function texteFin(fin, finMax) {
  const maintenant = Date.now();
  if (finMax && finMax < maintenant) return "passée (l'enchère est sans doute terminée)";
  const marge = finMax ? finMax - fin : 0;
  const precise = Boolean(finMax) && marge <= 3 * SECONDE;
  const reste = fin - maintenant;
  const quand = reste > 0 ? `dans ${precise && reste < HEURE ? dureeAvecSecondes(reste) : dureeLisible(reste)}` : "imminente";
  const jour = new Date(fin).toDateString() === new Date(maintenant).toDateString() ? "" : new Date(fin).toLocaleDateString("fr-FR") + " ";
  return `${quand} (vers ${jour}${precise ? heureSecondes(fin) : heureLisible(fin)}${marge > 2 * MINUTE ? `, à ${dureeLisible(marge)} près` : ""})`;
}

// « 12 min 05 s », « 40 s ».
function dureeAvecSecondes(ms) {
  const secondes = Math.max(0, Math.floor(ms / SECONDE));
  const minutes = Math.floor(secondes / 60);
  return minutes > 0 ? `${minutes} min ${String(secondes % 60).padStart(2, "0")} s` : `${secondes} s`;
}

// Le champ « Temps restant : [2h30] [OK] » quand la fin n'a pas pu être lue (ou pour la corriger).
function champSaisieFin(id) {
  const formulaire = creer("form", undefined, "wmd-saisie-fin");
  const champ = creer("input");
  champ.type = "text";
  champ.placeholder = "temps restant, ex. 2h30, 45 min, 1j 3h";
  const valider = creer("button", "OK", "wmd-chercher-marche");
  valider.type = "submit";
  const erreur = creer("span", "", "wmd-discret");
  formulaire.append("Temps restant : ", champ, valider, erreur);
  formulaire.addEventListener("submit", async evenement => {
    evenement.preventDefault();
    const duree = lireDuree(champ.value);
    if (!duree || duree.ms <= 0) {
      erreur.textContent = " Je ne comprends pas : écris par exemple « 2h30 » ou « 45 min ».";
      return;
    }
    const fin = Date.now() + duree.ms;
    await modifierEncheres(memo => {
      const enchere = memo.encheres[id];
      if (!enchere) return false;
      Object.assign(enchere, { fin: fin - MINUTE, finMax: fin + MINUTE, source: "manuel", vu: Date.now() });
      return true;
    });
    saisieFinOuverte = false;
    afficherStatut(`Fin de l'enchère notée : vers ${heureLisible(fin)}.`);
  });
  return formulaire;
}

// ---------------------------------------------------------------------
//  Nouveau en 1.15 : UN AMI A MISÉ SUR L'ENCHÈRE QUE TU REGARDES (fenêtre bleue)
//  - Tes amis sont lus sur la page Amis du site (mémoire « amis »), quand tu y passes ; tu peux
//    en ajouter à la main dans les réglages (« amisPerso »).
//  - Sur la page d'une enchère, si un de tes amis fait partie des enchérisseurs (historique des
//    mises, ou meneur), une fenêtre bleue te prévient, avec sa mise et s'il mène.
//  - Les amis cochés « ignorer » dans les réglages (ou avec le bouton de la fenêtre) ne déclenchent
//    plus rien (« amisIgnores »).
//  La fenêtre réapparaît à chaque visite de l'enchère, et quand un nouvel ami y mise ; rien n'est demandé au site.
// ---------------------------------------------------------------------
let amisDuSite = [];   // [{ nom, affiche }] lus sur la page Amis
let amisPerso = [];    // [noms] ajoutés à la main dans les réglages
let amisIgnores = [];  // [noms]
api.storage.local.get(["amis", "amisPerso", "amisIgnores"]).then(lu => {
  amisDuSite = lu.amis && Array.isArray(lu.amis.liste) ? lu.amis.liste : [];
  amisPerso = Array.isArray(lu.amisPerso) ? lu.amisPerso : [];
  amisIgnores = Array.isArray(lu.amisIgnores) ? lu.amisIgnores : [];
}).catch(() => {});
api.storage.onChanged.addListener(changements => {
  if (changements.amis) amisDuSite = changements.amis.newValue && Array.isArray(changements.amis.newValue.liste) ? changements.amis.newValue.liste : [];
  if (changements.amisPerso) amisPerso = Array.isArray(changements.amisPerso.newValue) ? changements.amisPerso.newValue : [];
  if (changements.amisIgnores) amisIgnores = Array.isArray(changements.amisIgnores.newValue) ? changements.amisIgnores.newValue : [];
  if (changements.amis || changements.amisPerso || changements.amisIgnores) alerteAmis.signature = ""; // la fenêtre sera revue
});

// Tous tes amis : ceux du site, puis ceux ajoutés à la main.
function tousMesAmis() {
  const liste = amisDuSite.map(ami => ({ nom: ami.nom, affiche: ami.affiche || ami.nom }));
  for (const nom of amisPerso) {
    if (nom && !liste.some(ami => memePseudo(ami.nom, nom) || memePseudo(ami.affiche, nom))) liste.push({ nom: nom, affiche: nom, perso: true });
  }
  return liste;
}

// Sur la page Amis : la liste est gardée quand elle est la même deux passages de suite (page bien chargée).
let lectureAmisPrecedente = "";
async function releverMesAmis() {
  if (!location.pathname.startsWith("/friends") || chasseEnCours || enCours) return;
  const amis = lireMesAmis().map(ami => ({ nom: ami.nom, affiche: ami.affiche }));
  if (!amis.length) return;
  const signature = JSON.stringify(amis);
  if (signature !== lectureAmisPrecedente) {
    lectureAmisPrecedente = signature;
    return;
  }
  if (JSON.stringify(amisDuSite) === signature) return;
  amisDuSite = amis;
  await api.storage.local.set({ amis: { liste: amis, lu: Date.now() } });
  afficherStatut(`👥 ${amis.length} ami(s) retenu(s) pour l'alerte « un ami a misé » (réglages : choisir qui ignorer).`);
}

// Les enchérisseurs de l'enchère affichée : Map pseudo (minuscules) → { pseudo, montant (le plus haut), quand }.
function encherisseursDe(id, zone, meneur) {
  const liste = new Map();
  const ajouter = (pseudo, montant = null, quand = null) => {
    if (!pseudo) return;
    const cle = String(pseudo).trim().toLocaleLowerCase("fr");
    const deja = liste.get(cle) || { pseudo: String(pseudo).trim(), montant: null, quand: null };
    if (montant !== null && (deja.montant === null || montant > deja.montant)) { deja.montant = montant; deja.quand = quand; }
    liste.set(cle, deja);
  };
  const site = misesDuSite.get(id);
  if (site) for (const mise of site.mises) ajouter(mise.pseudo, mise.montant, mise.quand);
  // L'« Historique des mises » de la page : une ligne par mise (pseudo, date, montant).
  const titre = [...zone.querySelectorAll("h2, h3")].find(h => /^historique des mises/i.test(h.textContent.trim()));
  for (const ligne of titre && titre.parentElement ? titre.parentElement.querySelectorAll("li") : []) {
    const lien = ligne.querySelector("a[href*='/profile/']");
    if (!lien) continue;
    const pseudo = decodeURIComponent(lien.getAttribute("href").split("/profile/")[1] || "").replace(/\/.*$/, "") || lien.textContent.trim();
    const nombres = feuilles(ligne).map(({ texte }) => lirePrix(texte)).filter(n => n !== null);
    ajouter(pseudo, nombres.length ? nombres[nombres.length - 1] : null);
  }
  const duSite = encheresDuSite.get(id);
  ajouter(duSite && duSite.meneur ? duSite.meneur : meneur);
  return liste;
}

const alerteAmis = { id: null, vus: new Set(), signature: "", fermee: false };

// Toutes les secondes (si la page a changé) : sur la page d'une enchère, la fenêtre bleue ; ailleurs, on la ferme.
// Quitter l'enchère puis y revenir la fait réapparaître.
function surveillerAmisEnchere() {
  const page = location.pathname.match(REGEX_PAGE_ENCHERE);
  if (!page) {
    if (alerteAmis.id) {
      fermerAlerteAmis();
      Object.assign(alerteAmis, { id: null, vus: new Set(), signature: "", fermee: false });
    }
    return;
  }
  const zone = document.querySelector("main") || document.body;
  if (!zone.querySelector("h1")) return; // la page n'est pas encore chargée
  avertirAmisSurEnchere(page[1].toLowerCase(), zone, lireMeneur(zone), enchereTermineeDans(zone));
}

function avertirAmisSurEnchere(id, zone, meneur, terminee) {
  if (!reglages.alerteAmis || terminee) { fermerAlerteAmis(); return; }
  if (alerteAmis.id !== id) { // une autre enchère (ou une nouvelle visite) : on repart de zéro
    fermerAlerteAmis();
    Object.assign(alerteAmis, { id: id, vus: new Set(), signature: "", fermee: false });
  }
  const encherisseurs = encherisseursDe(id, zone, meneur);
  const amis = amisParmiEncherisseurs([...encherisseurs.values()].map(e => e.pseudo), tousMesAmis(), amisIgnores, monPseudo);
  const duSite = encheresDuSite.get(id);
  const meneurActuel = (duSite && duSite.meneur) || meneur;
  const lignes = amis.map(ami => {
    const infos = encherisseurs.get(String(ami.nom).toLocaleLowerCase("fr")) || encherisseurs.get(String(ami.affiche).toLocaleLowerCase("fr")) || {};
    return { ami: ami, montant: infos.montant ?? null, quand: infos.quand ?? null, mene: memePseudo(meneurActuel, ami.nom) || memePseudo(meneurActuel, ami.affiche) };
  });
  const nouveaux = lignes.filter(l => !alerteAmis.vus.has(l.ami.nom.toLocaleLowerCase("fr")));
  for (const l of nouveaux) alerteAmis.vus.add(l.ami.nom.toLocaleLowerCase("fr"));
  if (!lignes.length) { fermerAlerteAmis(); return; }
  if (nouveaux.length) alerteAmis.fermee = false; // un nouvel ami a misé : la fenêtre revient
  if (alerteAmis.fermee) return;
  const signature = JSON.stringify(lignes.map(l => [l.ami.nom, l.montant, l.mene]));
  if (signature === alerteAmis.signature && document.getElementById("wmd-alerte-amis")) return;
  alerteAmis.signature = signature;
  const titre = zone.querySelector("h1");
  dessinerAlerteAmis(id, titre ? titre.textContent.trim() : "cette carte", lignes);
}

function fermerAlerteAmis() {
  const fenetre = document.getElementById("wmd-alerte-amis");
  if (fenetre) fenetre.remove();
}

async function ignorerAmi(nom) {
  const { amisIgnores: lu = [] } = await api.storage.local.get("amisIgnores");
  if (!lu.some(n => memePseudo(n, nom))) lu.push(nom);
  amisIgnores = lu;
  await api.storage.local.set({ amisIgnores: lu });
  afficherStatut(`👥 ${nom} est maintenant ignoré pour l'alerte des enchères (réglages pour changer d'avis).`);
}

function dessinerAlerteAmis(id, nomCarte, lignes) {
  let fenetre = document.getElementById("wmd-alerte-amis");
  if (!fenetre) {
    fenetre = creer("div", undefined, "wmd-alerte-amis");
    fenetre.id = "wmd-alerte-amis";
    fenetre.setAttribute("role", "alertdialog");
    fenetre.setAttribute("aria-live", "assertive");
    fenetre.setAttribute("aria-label", "Un ami a misé sur cette enchère");
    document.body.appendChild(fenetre);
  }
  const fermer = () => { alerteAmis.fermee = true; fermerAlerteAmis(); };
  const croix = creer("button", "✕", "wmd-alerte-croix");
  croix.type = "button";
  croix.title = "Fermer";
  croix.addEventListener("click", fermer);
  const plusieurs = lignes.length > 1;
  const liste = creer("ul");
  for (const { ami, montant, quand, mene } of lignes) {
    const ligne = creer("li");
    const nom = creer("b", ami.affiche || ami.nom);
    const details = [montant !== null ? `a misé ${nombreLisible(montant)}` : "a misé",
      quand ? `le ${new Date(quand).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} à ${heureLisible(quand)}` : "",
      mene ? "et MÈNE actuellement" : ""].filter(Boolean).join(" ");
    const ignorer = creer("button", `Ne plus m'avertir pour ${ami.affiche || ami.nom}`, "wmd-alerte-ignorer");
    ignorer.type = "button";
    ignorer.addEventListener("click", async () => {
      await ignorerAmi(ami.nom);
      ligne.remove();
      if (!liste.children.length) fermer();
    });
    ligne.append(nom, ` ${details}.`, ignorer);
    liste.appendChild(ligne);
  }
  const ok = creer("button", "OK, compris", "wmd-alerte-ok");
  ok.type = "button";
  ok.addEventListener("click", fermer);
  const reglagesLien = creer("button", "Choisir les amis à ignorer", "wmd-alerte-lien");
  reglagesLien.type = "button";
  reglagesLien.addEventListener("click", () => api.runtime.sendMessage({ type: "ouvrir-reglages" }).catch(() => {}));
  const pied = creer("div", undefined, "wmd-alerte-pied");
  pied.append(ok, reglagesLien);
  fenetre.replaceChildren(
    croix,
    creer("div", plusieurs ? `👥 ${lignes.length} de tes amis ont misé sur cette enchère` : "👥 Un de tes amis a misé sur cette enchère", "wmd-alerte-titre"),
    creer("div", `« ${nomCarte} »`, "wmd-alerte-carte"),
    liste,
    pied
  );
  fenetre.classList.remove("wmd-alerte-entree");
  void fenetre.offsetWidth; // relance la petite animation d'entrée
  fenetre.classList.add("wmd-alerte-entree");
}
document.addEventListener("keydown", evenement => {
  if (evenement.key === "Escape" && document.getElementById("wmd-alerte-amis")) {
    alerteAmis.fermee = true;
    fermerAlerteAmis();
  }
});

// --- Sur la liste du Marché : mettre à jour les enchères suivies et les marquer d'une cloche ---

let listeEncheresEnCours = false;
async function surveillerEncheresListe() {
  if (listeEncheresEnCours) return;
  const actif = reglages.encheres && pageActuelle() === "marche" && !REGEX_PAGE_ENCHERE.test(location.pathname);
  const blocs = document.querySelectorAll("[id^='marketplace-auction-']");
  if (!actif) {
    for (const bloc of document.querySelectorAll(".wmd-enchere-suivie")) {
      bloc.classList.remove("wmd-enchere-suivie");
      delete bloc.dataset.wmdStatut;
    }
    return;
  }
  listeEncheresEnCours = true;
  try {
    let annonces = null; // nom, rareté et mise des annonces, lus une seule fois si besoin
    for (const bloc of blocs) {
      const id = bloc.id.slice("marketplace-auction-".length).toLowerCase();
      const terminee = enchereTermineeDans(bloc);
      // Onglet « Mes enchères » : « Vous menez » / « Surenchéri » = tu as misé dessus → suivie toute seule.
      const statut = terminee ? null : statutDansBloc(bloc);
      if (statut && !encheresSuivies[id] && !encheresIgnorees[id] && !finieRecemment(id, lireFinDans(bloc)) && reglages.enchereAuto) {
        if (!annonces) annonces = lireAnnoncesMarche(true);
        const annonce = annonces.find(a => a.cle === bloc.id);
        const titre = bloc.querySelector(CONFIG.selecteurNomCarte);
        await suivreEnchere(id, { nom: annonce ? annonce.nom : titre ? titre.textContent.trim() : null,
          rarete: annonce && annonce.rarete !== "inconnue" ? annonce.rarete : rareteDuCadre(bloc) !== "inconnue" ? rareteDuCadre(bloc) : null,
          prix: annonce && !annonce.depart ? annonce.prix : null }, { auto: true });
      }
      const memo = encheresSuivies[id];
      bloc.classList.toggle("wmd-enchere-suivie", Boolean(memo));
      if (!memo && bloc.dataset.wmdStatut) delete bloc.dataset.wmdStatut;
      // 1.12 : une enchère finie qui n'est plus suivie peut encore donner un prix d'achat.
      if (!memo && terminee && encheresFinies[id] && !achats[id]) {
        const fini = encheresFinies[id];
        const achat = achatDans(bloc, fini);
        const titre = bloc.querySelector(CONFIG.selecteurNomCarte);
        const rarete = fini.rarete || (rareteDuCadre(bloc) !== "inconnue" ? rareteDuCadre(bloc) : null);
        if (achat) await noterAchat(id, { nom: fini.nom || (titre ? titre.textContent.trim() : null), rarete: rarete, ...achat });
        continue;
      }
      if (!memo) continue;
      if (terminee) {
        // 1.10 : remportée ? On note le prix d'achat (avant de marquer l'enchère terminée).
        const achat = achatDans(bloc, memo);
        if (achat) {
          const titre = bloc.querySelector(CONFIG.selecteurNomCarte);
          const rarete = memo.rarete || (rareteDuCadre(bloc) !== "inconnue" ? rareteDuCadre(bloc) : null);
          await noterAchat(id, { nom: memo.nom || (titre ? titre.textContent.trim() : null), rarete: rarete, ...achat });
        }
        await noterEnchereTerminee(id);
        bloc.dataset.wmdSuivie = achat ? `🛒 remportée ${texteAchat(achat)}` : "🔔 terminée";
        continue;
      }
      if (statut) await noterStatut(id, statut);
      // 1.15 : la mise affichée met à jour la « dernière mise vue » (avant : seulement au premier suivi).
      if (!annonces) annonces = lireAnnoncesMarche(true);
      const annonce = annonces.find(a => a.cle === bloc.id);
      if (annonce && !annonce.depart && annonce.prix !== memo.prix) await suivreEnchere(id, { prix: annonce.prix });
      const lue = lireFinDans(bloc);
      if (lue) await noterFinEnchere(id, lue.debut, lue.fin, "liste", lue.precision);
      const apres = encheresSuivies[id] || memo;
      const fin = apres.fin;
      // 1.15 : l'étiquette dit aussi si tu mènes (vert) ou si tu as été surenchéri (rouge).
      const texte = (fin ? `🔔 fin ${heureLisible(fin)}` : "🔔 suivie")
        + (apres.statut === "menez" ? " · tu mènes" : apres.statut === "surencheri" ? " · ⚠ surenchéri" : "");
      if (bloc.dataset.wmdSuivie !== texte) bloc.dataset.wmdSuivie = texte;
      const couleur = apres.statut || "";
      if ((bloc.dataset.wmdStatut || "") !== couleur) {
        if (couleur) bloc.dataset.wmdStatut = couleur;
        else delete bloc.dataset.wmdStatut;
      }
    }
  } finally {
    listeEncheresEnCours = false;
  }
}

// ---------------------------------------------------------------------
//  Nouveau en 1.10 : LE PRIX D'ACHAT DES CARTES REMPORTÉES AUX ENCHÈRES
//  Quand une enchère est finie et que c'est toi qui l'as remportée, l'extension note le prix payé
//  (mémoire « achats » : { idEnchere: { nom, rarete, prix, date, incertain } }). Elle le sait :
//  - sur la page de l'enchère : le meneur (ou l'acheteur) affiché est ton pseudo, ou le site écrit
//    que tu l'as remportée ;
//  - sur la liste du Marché (onglet « Mes enchères ») : le site écrit « Remportée », ou tu menais
//    l'enchère au dernier passage et le prix final est ta mise (personne n'a misé après toi).
//  Si tu menais mais que le prix final n'a pas pu être lu, l'achat est noté « probable » (≈).
//  Le prix d'achat s'affiche sur tes cartes de la Collection (badge orange « 🛒 450 ») et dans leur fiche.
// ---------------------------------------------------------------------
const ACHATS = {
  // Une étiquette seule (« Remportée », « Gagnée ») ou une phrase qui te parle (« Vous avez remporté… »).
  regexGagne: /^(?:ench[èe]re )?(?:remport[ée]e?|gagn[ée]e?)\s*!?$|(?:vous avez|tu as) (?:remport[ée]|gagn[ée])|vous [êe]tes (?:l'acheteu|le gagnant|la gagnante)/i,
  regexPerdu: /^(?:perdue?|surench[ée]ri(?:e|s|es)?|non remport[ée]e?)$|(?:vous avez|tu as) (?:perdu|[ée]t[ée] surench[ée]ri)/i,
  regexGagnant: /^(?:meneur|acheteu(?:r|se)|gagnant(?:e)?|remport[ée]e? par|vendue? à)\s*:?\s*(.+)$/i,
  regexPrixFinal: /^(?:vendue? pour|achet[ée]e? pour|prix final|prix d'achat|mise finale|remport[ée]e? pour|mise actuelle|derni[èe]re mise)$/i,
  // L'onglet « Gagnées » du Marché : chaque annonce porte « Achetée pour 350 » (vérifié le 21/11/2026).
  regexAchetee: /^achet[ée]e? pour$/i
};

let achats = {};
api.storage.local.get("achats").then(({ achats: lu }) => { achats = lu || {}; }).catch(() => {});
api.storage.onChanged.addListener(changements => {
  if (!changements.achats) return;
  achats = changements.achats.newValue || {};
  const encart = document.getElementById("wmd-prix-fiche");
  if (encart) encart.dataset.cle = ""; // la fiche ouverte sera redessinée avec le prix d'achat
});

// Les achats d'une carte (même nom, même rareté), du plus récent au plus ancien.
function achatsDe(nom, rarete) {
  return Object.values(achats).filter(a => a.nom === nom && a.rarete === rarete).sort((a, b) => (b.date || 0) - (a.date || 0));
}

// « le 21/11/2026 », ou rien si la date d'achat n'est pas connue (achat relevé plus tard dans « Gagnées »).
function dateAchat(achat) {
  return achat.date ? ` le ${new Date(achat.date).toLocaleDateString("fr-FR")}` : "";
}

// L'onglet « Gagnées » du Marché : toutes les annonces « Achetée pour … » affichées sont notées d'un coup
// (même celles qui n'étaient pas suivies). Un achat noté « probable » (≈) devient sûr.
let releveGagneesEnCours = false;
async function releverAchatsGagnees() {
  if (releveGagneesEnCours || pageActuelle() !== "marche" || REGEX_PAGE_ENCHERE.test(location.pathname)) return;
  const nouveaux = [];
  for (const bloc of document.querySelectorAll("[id^='marketplace-auction-']")) {
    const etiquette = feuilles(bloc).find(({ element, texte }) => !estDeLExtension(element) && ACHATS.regexAchetee.test(texte));
    if (!etiquette) continue;
    const prix = prixApres(feuilles(etiquette.element.parentElement), etiquette.element).prix;
    const titre = bloc.querySelector(CONFIG.selecteurNomCarte);
    const rarete = rareteDuCadre(bloc);
    if (prix === null || !titre || rarete === "inconnue") continue;
    const id = bloc.id.slice("marketplace-auction-".length).toLowerCase();
    const deja = achats[id];
    if (deja && deja.prix === prix && !deja.incertain) continue;
    nouveaux.push({ id, nom: titre.textContent.trim(), rarete, prix });
  }
  if (!nouveaux.length) return;
  releveGagneesEnCours = true;
  try {
    const { achats: lu = {} } = await api.storage.local.get("achats");
    for (const { id, nom, rarete, prix } of nouveaux) {
      lu[id] = { nom, rarete, prix, date: lu[id] ? lu[id].date : null, incertain: false };
    }
    achats = lu;
    await api.storage.local.set({ achats: lu });
    afficherStatut(`🛒 ${nouveaux.length} prix d'achat noté(s) depuis l'onglet « Gagnées ».`);
  } finally {
    releveGagneesEnCours = false;
  }
}

function texteAchat(achat) {
  return `${achat.incertain ? "≈ " : ""}${nombreLisible(achat.prix)}`;
}

async function noterAchat(id, infos) {
  if (!id || !infos || !infos.nom || !infos.rarete || infos.prix === null || infos.prix === undefined) return;
  const deja = achats[id];
  if (deja && deja.prix === infos.prix && !deja.incertain) return; // déjà noté
  if (deja && !deja.incertain && infos.incertain) return;          // une lecture sûre ne devient pas « probable »
  const { achats: lu = {} } = await api.storage.local.get("achats");
  lu[id] = { nom: infos.nom, rarete: infos.rarete, prix: infos.prix, date: (deja && deja.date) || Date.now(),
    incertain: Boolean(infos.incertain) };
  achats = lu;
  await api.storage.local.set({ achats: lu });
  afficherStatut(`🛒 Enchère remportée : ${infos.nom} (${lettreRarete(infos.rarete)}) pour ${texteAchat(lu[id])}. Prix d'achat noté.`);
}

// Le texte court (≤ 80 caractères) d'une zone qui dit si tu as gagné ou perdu : "gagne", "perdu" ou null.
function issueDans(zone) {
  let issue = null;
  for (const element of zone.querySelectorAll("span, div, p, b, strong, li")) {
    if (estDeLExtension(element)) continue;
    const texte = element.textContent.replace(/\s+/g, " ").trim();
    if (!texte || texte.length > 80 || ACHATS.regexGagnant.test(texte)) continue; // « Remportée par X » : voir lireGagnant
    if (ACHATS.regexPerdu.test(texte)) return "perdu";
    if (ACHATS.regexGagne.test(texte)) issue = "gagne";
  }
  return issue;
}

// Le pseudo du gagnant ou du meneur (« Meneur : Jesuif », « Acheteur : … »), ou null.
function lireGagnant(zone) {
  for (const element of zone.querySelectorAll("div, p, span")) {
    if (estDeLExtension(element)) continue;
    const texte = element.textContent.replace(/\s+/g, " ").trim();
    if (texte.length > 60) continue;
    const trouve = texte.match(ACHATS.regexGagnant);
    if (trouve) return trouve[1].trim();
  }
  return null;
}

// Le prix final écrit dans la zone (« Vendue pour 450 »…), ou null.
function prixFinalDans(zone) {
  for (const { element, texte } of feuilles(zone)) {
    if (estDeLExtension(element) || !ACHATS.regexPrixFinal.test(texte)) continue;
    for (let bloc = element.parentElement; bloc && zone.contains(bloc); bloc = bloc.parentElement) {
      const lu = prixApres(feuilles(bloc), element);
      if (lu.trouve) return lu.prix;
      if (bloc === zone) break;
    }
  }
  return null;
}

// Une enchère terminée (page de l'enchère ou annonce de la liste) : l'as-tu remportée ?
// Renvoie { prix, incertain } ou null.
function achatDans(zone, memo) {
  const issue = issueDans(zone);
  if (issue === "perdu") return null;
  const prixFinal = prixFinalDans(zone);
  const gagnant = lireGagnant(zone);
  if (gagnant && monPseudo && gagnant !== monPseudo) return null; // quelqu'un d'autre l'a remportée
  if (issue === "gagne" || (monPseudo && gagnant && gagnant === monPseudo)) {
    const prix = prixFinal ?? (memo ? memo.prix : null);
    return prix === null || prix === undefined ? null : { prix: prix, incertain: prixFinal === null };
  }
  // Tu menais au dernier passage : gagné si le prix final est ta mise, probable s'il n'a pas pu être lu.
  if (memo && memo.statut === "menez" && memo.prix !== null && memo.prix !== undefined) {
    if (prixFinal === null) return { prix: memo.prix, incertain: true };
    if (prixFinal === memo.prix) return { prix: prixFinal, incertain: false };
  }
  return null;
}

// Sur ta Collection : le badge orange « 🛒 450 » des cartes achetées aux enchères.
let marquageAchatsEnCours = false;
function marquerAchats() {
  if (marquageAchatsEnCours) return;
  marquageAchatsEnCours = true;
  try {
    const actif = pageActuelle() === "collection";
    for (const { cadre, imageRarete } of trouverCadresDeCartes()) {
      let badge = cadre.querySelector(":scope > .wmd-badge-achat");
      const nom = cadre.querySelector(CONFIG.selecteurNomCarte).textContent.trim();
      const trouve = imageRarete.getAttribute("src").match(/rarity\/([a-z_]+)\./);
      const liste = actif && trouve ? achatsDe(nom, trouve[1]) : [];
      if (!liste.length) { if (badge) badge.remove(); continue; }
      const texte = `🛒 ${texteAchat(liste[0])}${liste.length > 1 ? ` (+${liste.length - 1})` : ""}`;
      if (!badge) {
        badge = creer("span", undefined, "wmd-badge-achat");
        cadre.appendChild(badge);
      }
      if (badge.dataset.texte !== texte) {
        badge.dataset.texte = texte;
        badge.title = "Acheté aux enchères : " + liste.map(a => `${texteAchat(a)}${dateAchat(a)}`).join(", ");
      }
    }
  } finally {
    marquageAchatsEnCours = false;
  }
}

// ---------------------------------------------------------------------
//  Nouveau en 1.15 : CE QUE LE SITE DIT LUI-MÊME DE SES ENCHÈRES
//  reponses-site.js (qui tourne dans la page) recopie l'essentiel des réponses que le site
//  reçoit déjà pour son Marché : heure de fin EXACTE, mise, meneur, statut, historique des mises,
//  et, au premier chargement du Marché, TES ventes, TES mises en cours et TES victoires.
//  Aucune requête de plus n'est envoyée. Avec ça :
//  - tes enchères en cours sont toutes suivies dès que tu passes sur le Marché (plus besoin d'ouvrir
//    « Mes enchères »), avec leur heure de fin à la seconde et « tu mènes » / « surenchéri » ;
//  - ton identifiant et ton pseudo sont connus sans passer par ta page Profil ;
//  - tes achats (« Gagnées ») sont notés avec leur prix final et leur date ;
//  - la fenêtre bleue des amis (plus bas) connaît tous les enchérisseurs de l'enchère regardée.
// ---------------------------------------------------------------------
let monId = null;
api.storage.local.get("monId").then(({ monId: lu }) => { monId = lu || null; }).catch(() => {});
api.storage.onChanged.addListener(changements => {
  if (changements.monId) monId = changements.monId.newValue || null;
});

const encheresDuSite = new Map(); // id → résumé de l'enchère (voir reponses-site.js) + vuLe
const misesDuSite = new Map();    // id → { mises: [{ id, pseudo, montant, quand }], vuLe }
let triDuSite = null;             // le tri demandé au dernier chargement de la liste (« price_desc »…)
let encoreDuSite = null;          // la liste a-t-elle encore des annonces à charger (« Charger la suite ») ?
let fileReponsesSite = Promise.resolve();

window.addEventListener("message", evenement => {
  if (evenement.source !== window || evenement.origin !== location.origin) return;
  const donnees = evenement.data;
  if (!donnees || donnees.source !== "wmd-reponses-site" || donnees.version !== 1 || !extensionValide()) return;
  if (donnees.historique) { recevoirHistorique(donnees.historique); return; } // 1.16 : prix moyens de toutes les raretés
  fileReponsesSite = fileReponsesSite.then(() => recevoirReponseSite(donnees))
    .catch(erreur => { if (extensionValide()) console.warn("[WikiMasters Doublons]", erreur); });
});

// « SR » (lettre du site) ou « super_rare » → « super_rare ».
function rareteDuSite(valeur) {
  if (!valeur) return null;
  return RARETES[valeur] ? valeur : rareteDepuisLettre(String(valeur).toUpperCase());
}

// "menez", "surencheri" ou null, d'après les données du site (il faut connaître ton identifiant).
function statutDepuisSite(enchere, mises, jaiMise) {
  if (!monId || !enchere || enchere.statut !== "active") return null;
  if (enchere.meneurId === monId) return "menez";
  return jaiMise || (mises || []).some(m => m.id === monId) ? "surencheri" : null;
}

// Tes ventes (tu en es le vendeur) et tes victoires (tu en es le gagnant) donnent ton identifiant et ton pseudo.
async function apprendreIdentite(miennes) {
  const ids = new Set(), pseudos = new Map();
  for (const vente of miennes.selling || []) {
    if (!vente.vendeurId) continue;
    ids.add(vente.vendeurId);
    if (vente.vendeur) pseudos.set(vente.vendeurId, vente.vendeur);
  }
  for (const gagnee of miennes.won || []) {
    if (!gagnee.gagnantId) continue;
    ids.add(gagnee.gagnantId);
    if (gagnee.gagnant) pseudos.set(gagnee.gagnantId, gagnee.gagnant);
  }
  if (ids.size !== 1) return; // rien, ou deux personnes différentes : on ne devine pas
  const [id] = ids;
  if (id !== monId) {
    monId = id;
    await api.storage.local.set({ monId: id });
  }
  if (pseudos.get(id) && pseudos.get(id) !== monPseudo) await noterPseudo(pseudos.get(id));
}

// ---------------------------------------------------------------------
//  1.17.3 : REMETTRE EN VENTE LES CARTES INVENDUES (versions complètes seulement)
//  L'extension note tes ventes (onglet « Mes ventes » du Marché, d'après ce que le site lui envoie) :
//  la mise de départ, et la durée choisie (lue au moment où tu cliques « Lancer l'enchère », ou
//  calculée avec le début et la fin de l'enchère). Une vente finie sans aucune mise est « invendue ».
//  Le bouton « 🔁 Remettre en vente les invendues » (après confirmation) ouvre ta Collection, cherche
//  chaque carte, clique « Mettre aux enchères », remet la même mise de départ et la même durée,
//  puis « Lancer l'enchère ». C'est la seule action de l'extension qui crée quelque chose sur le site :
//  elle ne part jamais toute seule, et s'arrête à la limite d'enchères actives du site (« 4/5 »).
// ---------------------------------------------------------------------
const REMISE_EN_VENTE = false; // false dans la version « sans chargement automatique »
const DUREES_VENTE = [[10, "10 min"], [30, "30 min"], [60, "1 h"], [180, "3 h"], [360, "6 h"], [720, "12 h"]];
const DUREE_VENTE_INCONNUE = 60; // durée utilisée si celle d'origine n'a pas pu être connue
function dureeVenteProche(minutes) {
  if (!(minutes > 0)) return null;
  return DUREES_VENTE.reduce((meilleure, [m]) => Math.abs(Math.log(m / minutes)) < Math.abs(Math.log(meilleure / minutes)) ? m : meilleure, DUREES_VENTE[0][0]);
}
const texteDureeVente = minutes => (DUREES_VENTE.find(([m]) => m === minutes) || [0, `${minutes} min`])[1];

let mesVentes = {};          // id de l'enchère → { nom, rarete, depart, duree, fin, etat, vu }
let remiseEnVente = null;    // { file: [ids], faites, erreurs, quand } pendant une remise en vente
api.storage.local.get(["mesVentes", "remiseEnVente"]).then(lu => {
  mesVentes = lu.mesVentes || {};
  remiseEnVente = lu.remiseEnVente || null;
}).catch(() => {});
api.storage.onChanged.addListener(changements => {
  if (changements.mesVentes) mesVentes = changements.mesVentes.newValue || {};
  if (changements.remiseEnVente) remiseEnVente = changements.remiseEnVente.newValue || null;
});

// Au clic sur « Lancer l'enchère » (le tien ou celui de l'extension) : la mise et la durée choisies.
function fenetreMiseEnVente() {
  const titre = [...document.querySelectorAll("h2")].find(h => /^mettre aux ench[èe]res$/i.test(h.textContent.trim()) && !estDansLePanneau(h) && estVisible(h));
  let zone = titre ? titre.parentElement : null;
  while (zone && !zone.querySelector('input[aria-label="Mise de départ"]')) zone = zone.parentElement;
  if (!zone) return null;
  const nomCarte = zone.querySelector("p.font-semibold") || zone.querySelector("h3");
  const ligneRarete = [...zone.querySelectorAll("p")].map(p => p.textContent.trim()).find(t => /^march[ée]\s*·\s*/i.test(t));
  const actives = [...zone.querySelectorAll("p")].map(p => p.textContent.trim().match(/^ench[èe]res actives\s*:\s*(\d+)\s*\/\s*(\d+)/i)).find(Boolean);
  const boutons = [...zone.querySelectorAll("button")];
  const dureeChoisie = boutons.find(b => DUREES_VENTE.some(([, t]) => t === b.textContent.trim()) && /bg-\[var\(--color-accent\)\]/.test(b.className));
  return {
    zone: zone,
    nom: nomCarte ? nomCarte.textContent.trim() : null,
    rarete: ligneRarete ? rareteDepuisNom(ligneRarete.replace(/^march[ée]\s*·\s*/i, "")) : null,
    champ: zone.querySelector('input[aria-label="Mise de départ"]'),
    actives: actives ? Number(actives[1]) : null,
    maxActives: actives ? Number(actives[2]) : null,
    duree: dureeChoisie ? (DUREES_VENTE.find(([, t]) => t === dureeChoisie.textContent.trim()) || [null])[0] : null,
    boutonDuree: minutes => boutons.find(b => b.textContent.trim() === texteDureeVente(minutes)) || null,
    lancer: boutons.find(b => /^lancer l'ench[èe]re$/i.test(b.textContent.trim())) || null,
    annuler: boutons.find(b => b.textContent.trim() === "Annuler") || null
  };
}
let derniereMiseEnVente = null; // { nom, rarete, depart, duree, quand }
document.addEventListener("click", evenement => {
  const bouton = evenement.target instanceof Element ? evenement.target.closest("button") : null;
  if (!REMISE_EN_VENTE || !bouton || !/^lancer l'ench[èe]re$/i.test(bouton.textContent.trim())) return;
  const fenetre = fenetreMiseEnVente();
  if (!fenetre || !fenetre.nom) return;
  derniereMiseEnVente = { nom: fenetre.nom, rarete: fenetre.rarete, depart: lirePrix(fenetre.champ.value), duree: fenetre.duree, quand: Date.now() };
  api.storage.local.set({ derniereMiseEnVente: derniereMiseEnVente }).catch(() => {});
}, true);

// Les enchères reçues du site dont tu es le vendeur : rangées dans « mesVentes ».
async function noterMesVentes(encheres) {
  if (!REMISE_EN_VENTE || !monId) return;
  const miennes = encheres.filter(e => e.vendeurId === monId && e.nom && e.fin);
  if (!miennes.length) return;
  const { mesVentes: memo = {}, derniereMiseEnVente: derniere } = await api.storage.local.get(["mesVentes", "derniereMiseEnVente"]);
  const maintenant = Date.now();
  let change = false;
  for (const e of miennes) {
    const ancienne = memo[e.id] || {};
    let duree = ancienne.duree || dureeVenteProche(e.dureeMin) || (e.debut ? dureeVenteProche((e.fin - e.debut) / MINUTE) : null);
    // La mise en vente vue au clic : même carte, même mise de départ, fin ≈ clic + durée.
    if (!duree && derniere && derniere.duree && memeNom(derniere.nom, e.nom) && derniere.depart === e.depart
      && Math.abs(e.fin - (derniere.quand + derniere.duree * MINUTE)) < 5 * MINUTE) duree = derniere.duree;
    const vendue = Boolean(e.gagnantId) || e.prixFinal > 0 || e.mise > 0;
    const finie = e.statut !== "active" || e.fin < maintenant - 30 * SECONDE;
    const etat = vendue ? (finie ? "vendue" : "active") : finie ? (ancienne.etat === "remise" ? "remise" : "invendue") : "active";
    const nouvelle = { nom: e.nom, rarete: rareteDuSite(e.rarete) || ancienne.rarete || "inconnue", depart: e.depart, duree: duree || null,
      fin: e.fin, etat: etat, vu: maintenant };
    if (JSON.stringify({ ...ancienne, vu: 0 }) !== JSON.stringify({ ...nouvelle, vu: 0 })) change = true;
    memo[e.id] = nouvelle;
  }
  // Une invendue que tu as déjà remise en vente toi-même (même carte, enchère plus récente) n'est plus proposée.
  for (const v of Object.values(memo)) {
    if (v.etat === "invendue" && Object.values(memo).some(w => w !== v && w.fin > v.fin && w.nom === v.nom && w.rarete === v.rarete)) { v.etat = "remise"; change = true; }
  }
  for (const [id, v] of Object.entries(memo)) if (maintenant - v.fin > 14 * 24 * 3600 * 1000) { delete memo[id]; change = true; }
  if (change) await api.storage.local.set({ mesVentes: memo });
}

function ventesInvendues() {
  return Object.entries(mesVentes).filter(([, v]) => v.etat === "invendue" && v.depart > 0 && RARETES[v.rarete])
    .sort((a, b) => a[1].fin - b[1].fin);
}

// Le bouton du panneau : lancer (après confirmation) ou arrêter.
async function boutonRemiseEnVente() {
  if (remiseEnVente) {
    await api.storage.local.remove("remiseEnVente");
    remiseEnVente = null;
    afficherStatut("🔁 Remise en vente arrêtée.");
    return;
  }
  const liste = ventesInvendues();
  if (!liste.length) return afficherStatut("🔁 Aucune carte invendue connue. Ouvre l'onglet « Mes ventes » ou « Historique » du Marché.");
  // 1.17.4 : sans confirmation (demandé) : le clic lance directement ; le même bouton l'arrête.
  const inconnues = liste.filter(([, v]) => !v.duree).length;
  afficherStatut(`🔁 Remise en vente de ${liste.length} carte(s) invendue(s), même mise de départ et même durée`
    + (inconnues ? ` (${inconnues} à durée d'origine inconnue : ${texteDureeVente(DUREE_VENTE_INCONNUE)})` : "") + "…");
  remiseEnVente = { file: liste.map(([id]) => id), faites: 0, erreurs: [], quand: Date.now() };
  await api.storage.local.set({ remiseEnVente: remiseEnVente });
  if (pageActuelle() !== "collection") location.assign(ADRESSES_PAGES.collection);
}

// Sur la Collection, une carte à la fois. Tourne toutes les secondes, ne fait rien sans remise en cours.
let remiseOccupee = false;
async function poursuivreRemiseEnVente() {
  if (!REMISE_EN_VENTE || !remiseEnVente || remiseOccupee || pageActuelle() !== "collection" || pageOccupee() || carteATrouverEnCours) return;
  if (Date.now() - remiseEnVente.quand > 30 * MINUTE) { await api.storage.local.remove("remiseEnVente"); return; }
  if (!champDeRecherche()) return; // la page se charge encore
  remiseOccupee = true;
  const finir = async texte => {
    await api.storage.local.remove("remiseEnVente");
    remiseEnVente = null;
    afficherStatut(texte);
  };
  try {
    const etat = remiseEnVente;
    const id = etat.file[0];
    if (!id) {
      return finir(`🔁 Remise en vente terminée : ${etat.faites} carte(s) remise(s) aux enchères`
        + (etat.erreurs.length ? ` ; pas remises : ${etat.erreurs.join(" ; ")}.` : "."));
    }
    const v = mesVentes[id];
    const suivante = async (reussie, erreur) => {
      if (!remiseEnVente) return; // Stop pendant ce temps
      if (reussie) {
        etat.faites++;
        const { mesVentes: memo = {} } = await api.storage.local.get("mesVentes");
        if (memo[id]) { memo[id].etat = "remise"; await api.storage.local.set({ mesVentes: memo }); }
      } else if (erreur) etat.erreurs.push(erreur);
      etat.file.shift();
      etat.quand = Date.now();
      await api.storage.local.set({ remiseEnVente: etat });
    };
    if (!v || v.etat !== "invendue") return suivante(false, null);
    const reste = etat.file.length;
    afficherStatut(`🔁 Remise en vente (${reste} restante(s)) : recherche de « ${v.nom} »…`);
    await chercherEtOuvrirIci({ ou: "collection", nom: v.nom, rarete: v.rarete, rareteSouple: false, quand: Date.now() });
    // La fiche de la carte, avec son bouton « Mettre aux enchères » (clic voulu : c'est la remise en vente demandée).
    const boutonFiche = await attendre(() => [...document.querySelectorAll("button")].find(b => !estDansLePanneau(b) && estVisible(b)
      && /^mettre aux ench[èe]res$/i.test(b.textContent.trim()) && (() => {
        let fiche = b.parentElement;
        while (fiche && !fiche.querySelector("h2")) fiche = fiche.parentElement;
        return fiche && memeNom(fiche.querySelector("h2").textContent.trim(), v.nom);
      })()), 8000);
    if (!remiseEnVente) return;
    if (!boutonFiche) return suivante(false, `${v.nom} (introuvable dans ta collection en ${lettreRarete(v.rarete)})`);
    boutonFiche.click();
    const fenetre = await attendre(() => { const f = fenetreMiseEnVente(); return f && f.champ && f.lancer ? f : null; }, 8000);
    if (!fenetre) return suivante(false, `${v.nom} (la fenêtre « Mettre aux enchères » ne s'est pas ouverte)`);
    if (fenetre.rarete && fenetre.rarete !== v.rarete) {
      if (fenetre.annuler) fenetre.annuler.click();
      return suivante(false, `${v.nom} (la fiche ouverte est en ${lettreRarete(fenetre.rarete)}, pas en ${lettreRarete(v.rarete)})`);
    }
    if (fenetre.actives !== null && fenetre.maxActives !== null && fenetre.actives >= fenetre.maxActives) {
      if (fenetre.annuler) fenetre.annuler.click();
      return finir(`🔁 Limite du site atteinte (${fenetre.actives}/${fenetre.maxActives} enchères actives) : ${etat.faites} carte(s) remise(s), `
        + `${etat.file.length} en attente. Relance quand une vente sera finie.`);
    }
    ecrireDansChamp(fenetre.champ, String(v.depart));
    fenetre.champ.dispatchEvent(new Event("change", { bubbles: true }));
    const duree = v.duree || DUREE_VENTE_INCONNUE;
    await pause(300);
    const boutonDuree = fenetreMiseEnVente() && fenetreMiseEnVente().boutonDuree(duree);
    if (boutonDuree) boutonDuree.click();
    await pause(400);
    const verifiee = fenetreMiseEnVente();
    if (!verifiee || lirePrix(verifiee.champ.value) !== v.depart || verifiee.duree !== duree || !verifiee.lancer || verifiee.lancer.disabled) {
      if (verifiee && verifiee.annuler) verifiee.annuler.click();
      return suivante(false, `${v.nom} (mise de départ ou durée impossible à régler)`);
    }
    if (!remiseEnVente) { if (verifiee.annuler) verifiee.annuler.click(); return; }
    verifiee.lancer.click();
    const fermee = await attendre(() => !fenetreMiseEnVente(), 8000);
    if (!fermee) {
      const encore = fenetreMiseEnVente();
      if (encore && encore.annuler) encore.annuler.click();
      return suivante(false, `${v.nom} (le site n'a pas accepté la mise en vente)`);
    }
    await suivante(true);
    afficherStatut(`🔁 « ${v.nom} » remise aux enchères : ${nombreLisible(v.depart)}, ${texteDureeVente(duree)}.`);
    await pause(2000 + Math.random() * 1500); // un rythme humain entre deux cartes
  } finally {
    remiseOccupee = false;
  }
}

async function recevoirReponseSite(donnees) {
  const maintenant = Date.now();
  const miennes = donnees.miennes || {};
  const toutes = new Map();
  for (const liste of [donnees.encheres, ...Object.values(miennes)]) {
    for (const enchere of Array.isArray(liste) ? liste : []) toutes.set(enchere.id, enchere);
  }
  if (donnees.enchere) toutes.set(donnees.enchere.id, donnees.enchere);
  for (const enchere of toutes.values()) {
    encheresDuSite.set(enchere.id, { ...enchere, vuLe: maintenant });
    if (enchere.carteId && enchere.nom) nomsDesCartes.set(enchere.carteId, enchere.nom); // 1.16
  }
  if (donnees.id && Array.isArray(donnees.mises)) misesDuSite.set(donnees.id, { mises: donnees.mises, vuLe: maintenant });
  versionPage++; // les boucles « si la page a changé » repassent (fenêtre des amis, enchères suivies…)
  if (!donnees.id && donnees.methode === "GET" && Array.isArray(donnees.encheres)) {
    triDuSite = donnees.tri || null;
    encoreDuSite = typeof donnees.encore === "boolean" ? donnees.encore : null;
  }

  await apprendreIdentite(miennes);
  await noterMesVentes([...toutes.values()]); // 1.17.3 : les ventes invendues, à remettre en vente
  // La page d'une enchère où tu mènes donne aussi ton pseudo.
  if (monId && donnees.enchere && donnees.enchere.meneurId === monId && donnees.enchere.meneur) await noterPseudo(donnees.enchere.meneur);

  await noterAchatsDuSite([...toutes.values()]);
  if (!reglages.encheres) return;

  // Tes mises en cours : suivies toutes seules (sauf « Ne plus suivre »), comme avec l'onglet « Mes enchères ».
  const mesMises = new Set((miennes.bidding || []).map(e => e.id));
  const aSuivre = reglages.enchereAuto ? (miennes.bidding || []).filter(e => e.statut === "active"
    && !encheresSuivies[e.id] && !encheresIgnorees[e.id]
    && !(encheresFinies[e.id] && !(e.fin > maintenant + 5 * SECONDE))) : [];
  const concernees = [...toutes.values()].filter(e => encheresSuivies[e.id] || aSuivre.includes(e));
  if (!concernees.length) return;

  let nouvelles = 0;
  await modifierEncheres(memo => {
    let change = false;
    for (const e of concernees) {
      let enchere = memo.encheres[e.id];
      if (!enchere) {
        if (!aSuivre.includes(e) || memo.ignorees[e.id]) continue;
        enchere = memo.encheres[e.id] = { id: e.id, fin: null, finMax: null, source: null, terminee: false, auto: true, suivieLe: maintenant };
        nouvelles++;
        change = true;
      }
      const avant = JSON.stringify([enchere.nom, enchere.rarete, enchere.prix, enchere.fin, enchere.finMax, enchere.source, enchere.statut, enchere.terminee]);
      if (e.nom) enchere.nom = e.nom;
      if (rareteDuSite(e.rarete)) enchere.rarete = rareteDuSite(e.rarete);
      if (e.mise !== null) enchere.prix = e.mise;
      // L'heure de fin exacte (à la seconde) : elle remplace toute lecture de la page.
      if (e.fin && e.statut === "active" && (enchere.source !== "site" || Math.abs((enchere.fin || 0) - e.fin) > SECONDE)) {
        Object.assign(enchere, { fin: e.fin, finMax: e.fin + SECONDE, source: "site", finPrecise: true });
      }
      if (e.fin && enchere.source === "site") enchere.finLue = maintenant;
      const mises = misesDuSite.has(e.id) ? misesDuSite.get(e.id).mises : null;
      const statut = statutDepuisSite(e, mises, mesMises.has(e.id));
      if (statut && (statut !== enchere.statut || maintenant - (enchere.statutVu || 0) > MINUTE)) {
        change = true; // au plus une écriture par minute pour rafraîchir « vu à … »
        enchere.statut = statut;
        enchere.statutVu = maintenant;
        enchere.statutSource = "site";
      }
      if (e.statut && e.statut !== "active" && !enchere.terminee) {
        enchere.terminee = true;
        enchere.termineeVue = e.regle || maintenant;
      }
      if (JSON.stringify([enchere.nom, enchere.rarete, enchere.prix, enchere.fin, enchere.finMax, enchere.source, enchere.statut, enchere.terminee]) !== avant) {
        enchere.vu = maintenant;
        change = true;
      }
    }
    return change;
  });
  if (nouvelles) {
    const delais = nettoyerDelais(reglages.enchereDelais);
    afficherStatut(`🔔 ${nouvelles} enchère(s) sur lesquelles tu as misé maintenant suivie(s), avec leur heure de fin exacte. `
      + (delais.length ? `Tu seras prévenu ${delais.map(delaiLisible).join(", ")} avant la fin.` : "Aucune alerte n'est réglée : ajoute-en dans les réglages."));
  }
}

// Les enchères finies que TU as remportées (le site le dit : gagnant = toi), avec le prix final et la date.
async function noterAchatsDuSite(encheres) {
  if (!monId) return;
  const gagnees = encheres.filter(e => e.gagnantId === monId && e.prixFinal !== null && e.statut !== "active"
    && (e.nom || (achats[e.id] && achats[e.id].nom)) && (rareteDuSite(e.rarete) || (achats[e.id] && achats[e.id].rarete)));
  const aNoter = gagnees.filter(e => {
    const deja = achats[e.id];
    return !deja || deja.prix !== e.prixFinal || deja.incertain || (!deja.date && e.regle);
  });
  if (!aNoter.length || releveGagneesEnCours) return;
  releveGagneesEnCours = true;
  try {
    const { achats: lu = {} } = await api.storage.local.get("achats");
    for (const e of aNoter) {
      const deja = lu[e.id];
      lu[e.id] = { nom: e.nom || deja.nom, rarete: rareteDuSite(e.rarete) || deja.rarete, prix: e.prixFinal,
        date: (deja && deja.date) || e.regle || null, incertain: false };
    }
    achats = lu;
    await api.storage.local.set({ achats: lu });
    if (aNoter.length === 1) afficherStatut(`🛒 Enchère remportée : ${aNoter[0].nom} pour ${nombreLisible(aNoter[0].prixFinal)}. Prix d'achat noté.`);
    else afficherStatut(`🛒 ${aNoter.length} prix d'achat noté(s) d'après le site.`);
  } finally {
    releveGagneesEnCours = false;
  }
}

// --- Le bouton du panneau « 🔔 Mes enchères suivies » ---

async function afficherEncheresSuivies() {
  const { encheres = {} } = await api.storage.local.get("encheres");
  encheresSuivies = encheres;
  compterEncheresSuivies();
  const zone = document.getElementById("wmd-resultats");
  zone.replaceChildren();
  const bloc = creer("div", undefined, "wmd-bloc");
  const delais = nettoyerDelais(reglages.enchereDelais);
  bloc.appendChild(creer("b", "🔔 Enchères suivies"));
  bloc.appendChild(creer("div", (delais.length ? `Alertes ${delais.map(delaiLisible).join(", ")} avant la fin` : "Aucune alerte réglée")
    + (reglages.enchereNotifPC ? ", sur ce PC" : "") + (reglages.enchereNotifTel ? ", sur ton téléphone" : "")
    + ". Une enchère est suivie toute seule quand tu mises dessus, ou dès que tu passes sur le Marché (le site y donne la liste de tes mises en cours, avec leur heure de fin exacte et qui mène). Une enchère finie depuis plus d'une minute n'est plus suivie.", "wmd-discret"));
  zone.appendChild(bloc);
  memoriserVue("encheres"); // 1.15

  const liste = Object.values(encheres).sort((a, b) => (a.fin || Infinity) - (b.fin || Infinity));
  if (liste.length === 0) {
    zone.appendChild(creer("p", "Aucune enchère suivie pour l'instant.", "wmd-discret"));
    afficherStatut("Aucune enchère suivie.");
    return;
  }
  const maintenant = Date.now();
  const tableau = creerTableau(["Carte", "Rar.", "Fin", ""], []);
  tableau.id = "wmd-tableau-encheres";
  const corps = tableau.tBodies[0];
  for (const enchere of liste) {
    const rangee = corps.insertRow();
    if (enchere.rarete) rangee.className = `wmd-${enchere.rarete}`;
    rangee.dataset.id = enchere.id;
    // 1.11 : le nom propose les trois endroits habituels, plus « Ouvrir l'enchère ».
    let lien;
    if (enchere.nom) {
      lien = lienCarte(enchere.nom, enchere.rarete, { enchere: enchere.id });
    } else {
      lien = creer("a", "Enchère", "wmd-lien-carte");
      lien.href = adresseEnchere(enchere.id);
      lien.title = "Ouvrir la page de cette enchère";
    }
    rangee.insertCell().appendChild(lien);
    rangee.insertCell().textContent = enchere.rarete ? lettreRarete(enchere.rarete) : "?";
    // 1.15 : le temps restant défile tout seul (rafraichirEncheresSuivies), et le statut dit de quand il date.
    const cellule = rangee.insertCell();
    cellule.classList.add("wmd-fin-vivante");
    remplirCelluleFin(cellule, enchere, maintenant);
    const retirer = creer("button", "✕", "wmd-mini");
    retirer.title = "Ne plus suivre cette enchère";
    retirer.addEventListener("click", async () => {
      await nePlusSuivre(enchere.id);
      afficherEncheresSuivies();
    });
    rangee.insertCell().appendChild(retirer);
  }
  zone.appendChild(tableau);
  const actives = liste.filter(e => !e.terminee && !(e.finMax && e.finMax < maintenant)).length;
  afficherStatut(`${actives} enchère(s) suivie(s) en cours, ${liste.length - actives} terminée(s).`);
}

// 1.15 : la cellule « Fin » d'une enchère suivie : le temps restant, puis « tu mènes » / « surenchéri »
// avec l'heure où le site l'a dit. Un statut vieux de plus de 10 minutes est signalé « à revérifier ».
function remplirCelluleFin(cellule, enchere, maintenant = Date.now()) {
  const finie = enchere.terminee || (enchere.finMax && enchere.finMax < maintenant);
  const fin = finie ? "terminée" : enchere.fin ? texteFin(enchere.fin, enchere.finMax) : "inconnue : ouvre l'enchère";
  const morceaux = [creer("span", fin)];
  if (!finie && enchere.statut) {
    const age = enchere.statutVu ? maintenant - enchere.statutVu : null;
    const quand = age === null ? "" : age < MINUTE ? " (à l'instant)" : ` (il y a ${dureeLisible(age)}${age > 10 * MINUTE ? ", à revérifier" : ""})`;
    morceaux.push(" · ", creer("span", texteStatut(enchere.statut) + quand, `wmd-statut-${enchere.statut}`));
  }
  const signature = fin + "|" + (enchere.statut || "") + "|" + (enchere.statutVu ? Math.floor((maintenant - enchere.statutVu) / MINUTE) : "");
  if (cellule.dataset.signature === signature) return;
  cellule.dataset.signature = signature;
  cellule.replaceChildren(...morceaux);
}

// Toutes les secondes, si la liste des enchères suivies est affichée dans le panneau : temps restants et statuts à jour.
function rafraichirEncheresSuivies() {
  const tableau = document.getElementById("wmd-tableau-encheres");
  if (!tableau || document.hidden) return;
  const maintenant = Date.now();
  for (const rangee of tableau.tBodies[0].rows) {
    const enchere = encheresSuivies[rangee.dataset.id];
    const cellule = rangee.querySelector(".wmd-fin-vivante");
    if (enchere && cellule) remplirCelluleFin(cellule, enchere, maintenant);
  }
}


// ---------------------------------------------------------------------
//  PARTIE 13 DECIES : LES ÉTIQUETTES SUGGÉRÉES (repris en 1.9 de la branche 1.4)
//  Sur ta Collection, l'extension lit la courte description de chaque carte (« actrice
//  française », « film français de 2016 »...) et y cherche les mots-clés de tes étiquettes
//  (réglages). Un badge bleu indique l'étiquette à poser, un badge vert « ✓ » qu'elle l'est déjà.
//  Quand tu ouvres une carte, l'étiquette est écrite dans le champ « Ajouter une étiquette… »
//  du site : c'est TOI qui appuies sur Entrée. L'extension ne pose jamais d'étiquette elle-même.
//  Si tu as déjà une étiquette équivalente sur le site (« Écrans » pour « film & série »),
//  c'est elle qui est proposée : pas de doublon d'étiquette.
// ---------------------------------------------------------------------

const descriptionsVues = new Map(); // nom de carte → sa courte description, vue sur la grille

// La courte description d'une carte de la grille : le paragraphe juste sous son nom.
function lireDescription(cadre) {
  const titre = cadre.querySelector(CONFIG.selecteurNomCarte);
  const suivant = titre ? titre.nextElementSibling : null;
  return suivant && suivant.tagName === "P" ? suivant.textContent.trim() : "";
}

// Les noms d'étiquettes d'une pastille du site, sans la petite croix « × » qui sert à l'enlever.
function texteDePastille(pastille) {
  return [...pastille.childNodes].filter(noeud => noeud.nodeType === Node.TEXT_NODE || noeud.tagName !== "BUTTON")
    .map(noeud => noeud.textContent).join("").replace("×", "").trim();
}

// Pour chaque étiquette reconnue : son nom (le tien si tu l'as déjà sur le site), son icône,
// et si elle est déjà posée sur la carte.
function suggestionsPour(carte, posees) {
  return etiquettesDeLaCarte(carte, etiquettes).map(id => {
    const etiquette = etiquettes.find(e => e.id === id);
    const nom = nomPropose(etiquette, etiquettesSurLeSite);
    // 1.9 : si elle est déjà posée, on affiche le nom de l'étiquette réellement posée (« ✓ Écrans »).
    const dejaLa = posees.find(posee => normaliser(posee) === normaliser(nom)
      || correspondances(posee, [etiquette]).length > 0);
    return { nom: dejaLa || nom, icone: etiquette.icone || "🏷️", posee: Boolean(dejaLa) };
  });
}

// Sur la grille de ta Collection : un badge sur chaque carte reconnue (« 🏷️ 🎭 comédiens », ou « ✓ » si c'est fait).
// 1.9 : le badge est un petit élément à lui (et non plus le « ::before » de la carte, déjà pris par le badge « $ »).
function badgeEtiquettes(cadre, texte, aFaire) {
  let badge = cadre.querySelector(":scope > .wmd-badge-etiquettes");
  if (!texte) {
    if (badge) badge.remove();
    return;
  }
  if (!badge) {
    badge = creer("span", undefined, "wmd-badge-etiquettes");
    cadre.appendChild(badge);
  }
  badge.classList.toggle("wmd-a-etiqueter", aFaire);
  if (badge.dataset.texte !== texte) badge.dataset.texte = texte;
  if (badge.title !== texte) badge.title = texte;
}

let marquageEtiquettesEnCours = false;
async function marquerEtiquettes() {
  if (marquageEtiquettesEnCours) return;
  marquageEtiquettesEnCours = true;
  try {
    const actif = reglages.etiquettes && pageActuelle() === "collection";
    const fenetre = fenetreDeCarte();
    for (const { cadre } of trouverCadresDeCartes()) {
      const nom = cadre.querySelector(CONFIG.selecteurNomCarte).textContent.trim();
      const dansLaFenetre = fenetre && fenetre.element.contains(cadre);
      const description = dansLaFenetre ? "" : lireDescription(cadre);
      if (description) descriptionsVues.set(nom, description);
      let texte = "", aFaire = false;
      if (actif && !dansLaFenetre) {
        const posees = [...cadre.querySelectorAll(CONFIG.selecteurPastille)].map(texteDePastille);
        const suggestions = suggestionsPour({ nom: nom, description: description, animee: (await estAnimee(cadre)) === true }, posees);
        const aPoser = suggestions.filter(s => !s.posee);
        aFaire = aPoser.length > 0;
        if (aFaire) texte = "🏷️ " + aPoser.map(s => `${s.icone} ${s.nom}`).join("  ");
        else if (suggestions.length) texte = "✓ " + suggestions.map(s => s.nom).join(", ");
      }
      badgeEtiquettes(cadre, texte, aFaire);
    }
  } finally {
    marquageEtiquettesEnCours = false;
  }
}

// La fiche ouverte quand tu cliques sur une carte : on la reconnaît à son champ « Ajouter une étiquette… ».
// Renvoie { element, champ }, ou null si aucune fiche n'est ouverte.
function fenetreDeCarte() {
  const champ = [...document.querySelectorAll("input")]
    .find(entree => (entree.placeholder || "").startsWith(CONFIG.texteChampEtiquette) && !estDansLePanneau(entree));
  if (!champ) return null;
  let element = champ.parentElement;
  while (element && !element.querySelector(CONFIG.selecteurNomCarte)) element = element.parentElement;
  return element ? { element: element, champ: champ } : null;
}

// La courte description dans la fiche (1.9) : le premier petit paragraphe sous le titre h2
// (« jeu vidéo de 2013 »), et non le long texte écrit sur l'image de la carte.
function descriptionDeLaFiche(element) {
  const titre = element.querySelector("h2");
  if (!titre) return "";
  const paragraphe = [...element.querySelectorAll("p")].find(p =>
    (p.compareDocumentPosition(titre) & Node.DOCUMENT_POSITION_PRECEDING) && !estDansLePanneau(p)
    && p.textContent.trim().length > 0 && p.textContent.trim().length <= 200
    && !/^(étiquettes|q-score|exemplaires|vues|texte de l'article|signaler)/i.test(p.textContent.trim()));
  return paragraphe ? paragraphe.textContent.trim() : "";
}

// Les étiquettes déjà posées sur la carte ouverte : les pastilles qui ont une croix, près du champ.
function etiquettesDeLaFenetre(champ) {
  let zone = champ.parentElement;
  for (let i = 0; i < 4 && zone && !zone.querySelector("span button"); i++) zone = zone.parentElement;
  if (!zone) return [];
  return [...zone.querySelectorAll("span")].filter(pastille => pastille.querySelector("button")).map(texteDePastille);
}

// Écrit un texte dans le champ du site comme si tu l'avais tapé (le site utilise React,
// qui ne voit un changement que si on passe par le « vrai » réglage de la valeur, puis un événement).
// Le texte est sélectionné : tu peux taper autre chose par-dessus. Rien n'est validé.
function remplirChamp(champ, texte) {
  const reglerValeur = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  reglerValeur.call(champ, texte);
  champ.dispatchEvent(new Event("input", { bubbles: true }));
  champ.focus();
  champ.select();
}

function viderZone(zone) {
  if (!zone) return;
  zone.replaceChildren();
  zone.className = "";
  delete zone.dataset.signature;
}

// Toutes les 0,7 seconde : si une carte est ouverte, on prépare son étiquette.
let carteDejaPreparee = ""; // pour ne pré-remplir qu'une fois par ouverture
let preparationFicheEnCours = false;
async function preparerFenetre() {
  if (preparationFicheEnCours) return;
  preparationFicheEnCours = true;
  try {
    const zone = document.getElementById("wmd-suggestions");
    const fenetre = reglages.etiquettes ? fenetreDeCarte() : null;
    if (!fenetre) {
      carteDejaPreparee = "";
      viderZone(zone);
      return;
    }
    const { element, champ } = fenetre;
    const nom = element.querySelector(CONFIG.selecteurNomCarte).textContent.trim();
    // La description vue sur la grille ; sinon celle de la fiche ; sinon la 1re phrase du texte de la carte.
    const description = descriptionsVues.get(nom) || descriptionDeLaFiche(element)
      || (lireDescription(element) || "").split(/\.\s/)[0].slice(0, 200);
    const suggestions = suggestionsPour({ nom: nom, description: description, animee: (await estAnimee(element)) === true },
      etiquettesDeLaFenetre(champ));
    const aPoser = suggestions.filter(s => !s.posee);

    // 1) Une seule fois par ouverture : la première étiquette à poser est écrite dans le champ (pas validée).
    if (nom !== carteDejaPreparee) {
      carteDejaPreparee = nom;
      if (aPoser.length && champ.value === "") remplirChamp(champ, aPoser[0].nom);
    }

    // 2) Dans le panneau (même réduit) : un bouton par étiquette, pour en choisir une autre.
    if (!zone) return;
    if (suggestions.length === 0) {
      viderZone(zone);
      return;
    }
    const signature = nom + "|" + suggestions.map(s => s.nom + s.posee).join("|");
    if (zone.dataset.signature === signature) return; // rien n'a changé : on ne redessine pas
    const boutons = suggestions.map(s => {
      const bouton = creer("button", s.posee ? `✓ ${s.nom}` : `${s.icone} ${s.nom}`, "wmd-suggestion");
      bouton.disabled = s.posee;
      bouton.addEventListener("click", () => remplirChamp(champ, s.nom));
      return bouton;
    });
    zone.dataset.signature = signature;
    zone.className = "wmd-bloc";
    zone.replaceChildren(
      creer("h4", `🏷️ Étiquettes pour « ${nom} »`),
      ...boutons,
      creer("p", aPoser.length ? "Appuie sur Entrée dans le champ « Ajouter une étiquette » pour la poser."
        : "Toutes les étiquettes suggérées sont déjà posées.", "wmd-discret")
    );
  } finally {
    preparationFicheEnCours = false;
  }
}

// Tes étiquettes déjà créées sur le site, pour les réutiliser au lieu d'en créer de nouvelles.
// 1) Quand tu ouvres le menu « Toutes les étiquettes » : la liste complète, avec le nombre de cartes.
// 2) Les pastilles des cartes de ta Collection : les noms qu'on ne connaissait pas encore.
function relireEtiquettesDuSite() {
  const liste = { ...etiquettesSurLeSite };
  const menu = [...document.querySelectorAll('[role="listbox"] [role="option"]')]
    .map(option => option.textContent.trim().match(/^#(.+?)\s*\((\d+)\)$/)).filter(Boolean);
  if (menu.length) {
    for (const nom of Object.keys(liste)) delete liste[nom]; // le menu fait foi (une étiquette a pu être supprimée)
    for (const [, nom, nombre] of menu) liste[nom.trim()] = parseInt(nombre, 10);
  }
  if (pageActuelle() === "collection") {
    for (const { cadre } of trouverCadresDeCartes()) {
      for (const pastille of cadre.querySelectorAll(CONFIG.selecteurPastille)) {
        const nom = texteDePastille(pastille);
        if (nom && !(nom in liste)) liste[nom] = 1;
      }
    }
  }
  if (JSON.stringify(liste) === JSON.stringify(etiquettesSurLeSite)) return;
  etiquettesSurLeSite = liste;
  api.storage.local.set({ etiquettesSite: { liste: liste, lu: Date.now() } });
}


// ---------------------------------------------------------------------
//  PARTIE 14 : DÉMARRAGE (tout ce qui tourne en boucle)
// ---------------------------------------------------------------------

// Le panneau : créé tout de suite, puis vérifié toutes les 2 secondes
// (le site peut l'effacer, et ses boutons changent selon la page).
// Corrigé en 1.4.7 : quand on installe ou recharge une nouvelle version, l'ANCIEN script reste actif
// dans les onglets WikiMasters déjà ouverts, mais il n'a plus le droit d'utiliser la mémoire de
// l'extension (« Extension context invalidated »). Chrome affichait alors des erreurs à répétition.
// Désormais, chaque boucle vérifie que l'extension est toujours là, sinon tout s'arrête proprement.
function extensionValide() {
  try {
    return Boolean(api.runtime && api.runtime.id);
  } catch (erreur) {
    return false;
  }
}
const boucles = [];
function arreterTout() {
  for (const boucle of boucles) clearInterval(boucle);
  boucles.length = 0;
  enCours = false;
  const panneau = document.getElementById("wmd-panneau");
  if (panneau) panneau.remove(); // l'ancien panneau disparaît : recharge la page (F5) pour avoir le nouveau
}
// Comme setInterval, mais une erreur dans une boucle ne remonte plus jamais dans Chrome :
// elle est écrite discrètement dans la console (F12), et la boucle continue.
function boucle(fonction, ms) {
  boucles.push(setInterval(() => {
    if (!extensionValide()) {
      arreterTout();
      return;
    }
    try {
      Promise.resolve(fonction()).catch(erreur => {
        if (extensionValide()) console.warn("[WikiMasters Doublons]", erreur);
      });
    } catch (erreur) {
      console.warn("[WikiMasters Doublons]", erreur);
    }
  }, ms));
}

// ---------------------------------------------------------------------
//  1.10 (optimisation) : NE RELIRE LA PAGE QUE QUAND ELLE A CHANGÉ
//  La plupart des boucles relisent toute la page (cartes, annonces, fiche) toutes les 1 à 3 secondes.
//  Un MutationObserver compte les changements du site ; ces boucles ne travaillent que si la page
//  (ou la mémoire de l'extension) a changé depuis leur dernier passage, au moins toutes les 10 s
//  par sécurité, et jamais dans un onglet caché. Ce qui change vient seulement de l'extension
//  (panneau, badges « data-wmd-… ») n'est pas compté.
// ---------------------------------------------------------------------
const OPTIMISATION = { relectureMaxMs: 10000 };
const estDeNous = n => n.nodeType === 1 && (/^wmd-/.test(n.id || "") || /(^|\s)wmd-/.test(typeof n.className === "string" ? n.className : ""));
// 1.17.1 (optimisation) : les comptes à rebours du Marché (« 59m 31s », « 5h 59m ») changent chaque seconde
// sur chaque carte. Avant, cela faisait relire toute la page à ~20 boucles chaque seconde. Ces changements
// ne sont plus comptés : rien d'autre ne change sur la carte (le prix, la rareté, le nom restent les mêmes).
const REGEX_MINUTEUR = /^\s*(?:\d+\s*(?:j|h|min|m|s)\s*)+$/i;
const estMinuteur = n => n.nodeType === 3 ? REGEX_MINUTEUR.test(n.nodeValue || "")
  : n.nodeType === 1 && n.childElementCount === 0 && REGEX_MINUTEUR.test(n.textContent || "");
function changementDuSite(mutation) {
  const cible = mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;
  if (!cible) return true;
  if (mutation.type === "characterData" && REGEX_MINUTEUR.test(mutation.target.nodeValue || "")) return false;
  if (cible.closest("#wmd-panneau, .wmd-prix-fiche, #wmd-suivi-enchere, #wmd-amis-fiche, .wmd-badge-achat, .wmd-badge-marche, .wmd-badge-etiquettes, #wmd-alerte-amis, #wmd-aide-prixmax")) return false;
  if (mutation.type === "attributes") {
    const nom = mutation.attributeName || "";
    if (nom.startsWith("data-wmd") || nom === "title" || nom === "style") return false;
    if (nom === "class") {
      // Seules nos classes « wmd-… » ont changé : ce n'est pas le site.
      const sansNous = texte => (texte || "").split(/\s+/).filter(c => c && !c.startsWith("wmd-")).sort().join(" ");
      if (sansNous(mutation.oldValue) === sansNous(cible.getAttribute("class"))) return false;
    }
  }
  if (mutation.type === "childList") {
    const noeuds = [...mutation.addedNodes, ...mutation.removedNodes];
    if (noeuds.length && noeuds.every(estDeNous)) return false;
    if (noeuds.length && noeuds.every(estMinuteur)) return false; // 1.17.1 : un compte à rebours réécrit
  }
  return true;
}
// 1.15 : de nouvelles annonces du Marché (« Charger la suite », un tri, une recherche) passent tout de suite
// dans les filtres « 5 min » et « mises jusqu'à … » : elles ne s'affichent plus une seconde avant d'être cachées.
// Appelée directement par l'observateur (avant que le navigateur n'affiche la page) : aucune image de trop.
let filtresEnCours = false;
function planifierFiltresMarche() {
  const raretesAuto = autoMarche.actif && autoMarche.raretes.length > 1;
  if (filtresEnCours || !(filtrePrixMax.actif || marcheBientotFini || raretesAuto) || !extensionValide()) return;
  filtresEnCours = true;
  try {
    if (filtrePrixMax.actif) filtrerEncheresTropCheres();
    if (marcheBientotFini) filtrerEncheresBientotFinies();
    if (raretesAuto) filtrerRaretesAuto(); // 1.17
  } catch (erreur) {
    console.warn("[WikiMasters Doublons]", erreur);
  } finally {
    filtresEnCours = false;
  }
}
const estAnnonceMarche = n => n.nodeType === 1 && (/^marketplace-auction-/.test(n.id || "") || (n.querySelector && n.querySelector("[id^='marketplace-auction-']")));
new MutationObserver(mutations => {
  if (mutations.some(changementDuSite)) versionPage++;
  if (mutations.some(m => m.type === "childList" && [...m.addedNodes].some(estAnnonceMarche))) planifierFiltresMarche();
}).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeOldValue: true });
api.storage.onChanged.addListener(() => { versionPage++; });
window.addEventListener("popstate", () => { versionPage++; });

// Comme boucle(), mais la fonction ne tourne que si la page a changé depuis son dernier passage.
// 1.17.3 : une pastille rouge à côté de la croix « Fermer » de la fiche d'une carte, onglet « Marché »
// (« Évolution des prix ») : l'extension a bien reçu et enregistré l'historique des prix de CETTE carte.
// Tu peux fermer la fiche : les prix moyens et les variations de la carte sont à jour.
let historiqueEnregistre = null; // { nom, quand }
function pastilleHistorique() {
  const titre = [...document.querySelectorAll("h3")].find(h => /^[ée]volution des prix$/i.test(h.textContent.trim()) && !estDeLExtension(h));
  let fiche = titre ? titre.parentElement : null;
  while (fiche && !fiche.querySelector('button[aria-label="Fermer"]')) fiche = fiche.parentElement;
  const fermer = fiche ? fiche.querySelector('button[aria-label="Fermer"]') : null;
  const nom = fiche && fiche.querySelector("h2") ? fiche.querySelector("h2").textContent.trim() : null;
  const voulu = !!(fermer && nom && reglages.marche && historiqueEnregistre && memeNom(historiqueEnregistre.nom, nom));
  for (const ancienne of document.querySelectorAll(".wmd-pastille-historique")) {
    if (!voulu || ancienne.parentElement !== fermer) ancienne.remove();
  }
  if (!voulu || fermer.querySelector(".wmd-pastille-historique")) return;
  const pastille = creer("span", undefined, "wmd-pastille-historique");
  pastille.setAttribute("aria-hidden", "true");
  fermer.title = `Prix de « ${nom} » enregistrés par l'extension (${new Date(historiqueEnregistre.quand).toLocaleTimeString("fr-FR")}) : tu peux fermer.`;
  if (getComputedStyle(fermer).position === "static") fermer.style.position = "relative";
  fermer.appendChild(pastille);
}

function boucleSiChangement(fonction, ms) {
  let derniereVersion = -1, dernierPassage = 0, derniereAdresse = "";
  boucle(() => {
    if (document.hidden) return;
    const maintenant = Date.now();
    if (versionPage === derniereVersion && location.href === derniereAdresse
      && maintenant - dernierPassage < OPTIMISATION.relectureMaxMs) return;
    derniereVersion = versionPage;
    derniereAdresse = location.href;
    dernierPassage = maintenant;
    return fonction();
  }, ms);
}

creerPanneau();
boucle(() => {
  creerPanneau();
  actualiserPanneau();
}, 2000);

// 1.17.5 : LES PRIX DU MARCHÉ OFFERTS AVEC L'EXTENSION (fichier « prix-marche-wikimasters.csv »).
// Une fois par version de l'extension (à l'installation, puis après chaque mise à jour), le fichier
// livré avec elle est ajouté aux prix, exactement comme avec « 📥 Importer un fichier CSV » : seulement
// ce qui manque, ou ce qui est daté d'un jour plus récent. Tes propres relevés ne sont jamais écrasés
// par un prix plus ancien. Un seul onglet s'en charge. Rien n'est envoyé ni demandé au site.
const PRIX_OFFERTS_VERROU_MS = 2 * 60 * 1000;
async function chargerPrixOfferts() {
  const version = api.runtime.getManifest().version;
  const lu = await api.storage.local.get(["prixOffertsCharges", "prixOffertsEnCours"]);
  if (lu.prixOffertsCharges === version) return;
  if (lu.prixOffertsEnCours && Date.now() - lu.prixOffertsEnCours < PRIX_OFFERTS_VERROU_MS) return; // un autre onglet s'en occupe
  await api.storage.local.set({ prixOffertsEnCours: Date.now() });
  try {
    const reponse = await api.runtime.sendMessage({ type: "prix-offerts-lire" });
    if (!reponse || reponse.erreur || !reponse.texte) {
      console.log("[WikiMasters Doublons] Prix offerts non chargés :", reponse ? reponse.erreur : "pas de réponse");
      return; // réessayé à la prochaine page
    }
    afficherStatut("🎁 Ajout des prix du marché offerts avec l'extension…");
    try {
      await importerTexteCSV("les prix offerts avec l'extension", reponse.texte, true);
    } catch (erreur) {
      afficherStatut(`🎁 Prix offerts : ajout impossible (${erreur.message || erreur}). Tu peux réessayer avec « 📥 Importer un fichier CSV ».`);
    }
    // Tenté une fois pour cette version, même en cas d'échec (pas de nouvel essai à chaque page).
    await api.storage.local.set({ prixOffertsCharges: version });
  } finally {
    await api.storage.local.remove("prixOffertsEnCours").catch(() => {});
  }
}
setTimeout(() => {
  chargerPrixOfferts().catch(erreur => console.log("[WikiMasters Doublons] Prix offerts :", erreur));
}, 3000);

// Les boucles qui relisent la page : seulement quand elle a changé (1.10).
boucleSiChangement(surlignerCartesAnimees, 1500); // les cadres dorés
boucleSiChangement(surveillerTotaux, 5000);       // les totaux de « Toutes les cartes »
boucleSiChangement(releverMarche, MARCHE.releveMs); // nouveau en 1.4 : les mises actuelles du marché
boucleSiChangement(afficherPrixDansFiche, 1000);  // nouveau en 1.4.2 : le prix estimé dans la fiche d'une carte
boucleSiChangement(boutonAmisSurFiche, 1000);     // 1.10 : « Vérifier si un de mes amis la possède » sur toute fiche
boucleSiChangement(marquerAchats, 2000);          // 1.10 : le badge « 🛒 » des cartes achetées aux enchères
boucleSiChangement(releverAchatsGagnees, 3000);   // 1.10 : les prix d'achat de l'onglet « Gagnées » du Marché
boucleSiChangement(marquerCartesEstimees, 2000);  // nouveau en 1.5.1 : le badge « $ » sur tes cartes estimées
boucleSiChangement(lireCarteDePaquet, 700);       // nouveau en 1.6 : les cartes des paquets ouverts
boucleSiChangement(marquerBonnesAffaires, 2000);
// 1.16 : en changeant d'onglet du Marché, le panneau montre ou cache les options du Marché.
boucleSiChangement(() => { if (optionsMarcheActives() !== ongletOptionsVu) actualiserPanneau(); }, 700);
boucleSiChangement(appliquerMarcheCompact, 700);  // 1.13 : l'affichage allégé du Marché
boucleSiChangement(filtrerEncheresBientotFinies, 1000); // 1.14 : seulement les enchères qui finissent bientôt
// 1.17.1 : les comptes à rebours ne réveillent plus les boucles : ce filtre-là, qui en dépend, repasse toutes les 3 s.
boucle(() => { if (marcheBientotFini && !document.hidden) filtrerEncheresBientotFinies(); }, 3000);
boucleSiChangement(filtrerEncheresTropCheres, 1000);    // 1.14 : seulement les mises jusqu'à un montant  // nouveau en 1.6.1 : le cadre des bonnes affaires
boucleSiChangement(filtrerEncheresAuDessusMoyenne, 1000); // 1.16 : cacher les cartes au-dessus du prix moyen
boucleSiChangement(releverPrixMoyen, 1500);       // nouveau en 1.7.2 : le prix moyen affiché par le site
boucleSiChangement(pastilleHistorique, 700);      // 1.17.3 : pastille rouge « historique des prix enregistré »
boucleSiChangement(afficherPrixSurEnchere, 1500); // nouveau en 1.6.4 : l'estimation sur la page d'une enchère
boucleSiChangement(boutonsMarcheSouhaitsGuilde, 1500); // « 🛒 Chercher au Marché » sous les souhaits de la guilde
boucleSiChangement(surveillerEncheresListe, 3000); // nouveau en 1.8 : les enchères suivies sur la liste du Marché
boucleSiChangement(apprendrePseudo, 2000);        // nouveau en 1.8 : ton pseudo, lu sur ta page Profil
boucleSiChangement(marquerEtiquettes, 1500);      // 1.9 : le badge d'étiquette suggérée de chaque carte (Collection)
boucleSiChangement(preparerFenetre, 700);         // 1.9 : l'étiquette écrite dans le champ de la carte ouverte
boucleSiChangement(relireEtiquettesDuSite, 3000); // 1.9 : tes étiquettes déjà créées sur le site
boucleSiChangement(releverMesAmis, 2000);         // 1.15 : tes amis, lus sur la page Amis (alerte « un ami a misé »)
boucleSiChangement(surveillerAmisEnchere, 1000);  // 1.15 : la fenêtre bleue « un ami a misé sur cette enchère »
// Celles-ci dépendent aussi de l'heure ou de tâches en cours : elles tournent toujours.
boucle(surveillerPaquets, 5000);          // le stock de paquets
boucle(appliquerRechercheEnAttente, 1000); // nouveau en 1.4.4 : « Chercher au marché »
boucle(poursuivreChasse, 1000);           // nouveau en 1.5 : mes souhaits chez mes amis
boucle(appliquerCarteATrouver, 700);      // 1.11 : trouver une carte cliquée dans le panneau (Collection, « Toutes les cartes »)
boucle(surveillerStop, 500);              // nouveau en 1.7.4 : Stop visible seulement pendant une tâche
boucle(appliquerEchangeEnAttente, 1000);  // nouveau en 1.5 : le bouton « Échanger » d'un résultat
boucle(surveillerEnchere, 1000);          // nouveau en 1.8 : la fin de l'enchère affichée et l'encart « 🔔 »
boucle(poursuivreRemiseEnVente, 1000);     // 1.17.3 : la remise en vente des invendues (si demandée)
boucle(() => { // 1.17.3 : le texte du bouton (nombre d'invendues, ou « Arrêter » pendant la remise)
  const bouton = document.getElementById("wmd-remise");
  if (!bouton) return;
  const voulu = remiseEnVente ? `⏹ Arrêter la remise en vente (${remiseEnVente.file.length} restante(s))`
    : `🔁 Remettre en vente les invendues (${ventesInvendues().length})`;
  if (bouton.textContent !== voulu) bouton.textContent = voulu;
}, 1000);
boucle(rafraichirEncheresSuivies, 1000);  // 1.15 : le temps restant défile dans « 🔔 Mes enchères suivies »
// (version sans chargement automatique) boucle(boucleAutoMarche, 250);            // 1.17 : le chargement automatique du Marché (si activé), au quart de seconde près
// (version sans chargement automatique) boucleSiChangement(filtrerRaretesAuto, 1000); // 1.17 : plusieurs raretés choisies : les autres sont cachées
console.log("[WikiMasters Doublons] Extension chargée !");
