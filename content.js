// =====================================================================
//  WikiMasters Doublons 1.9.0 - content.js
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

// Une liste à puces de cartes, coupée après "maximum" cartes.
function creerListeDeCartes(cartes, maximum) {
  const liste = creer("ul");
  for (const carte of cartes.slice(0, maximum)) {
    liste.appendChild(creer("li", `${carte.nom} (${lettreRarete(carte.rarete)})`, `wmd-${carte.rarete}`));
  }
  if (cartes.length > maximum) liste.appendChild(creer("li", `… et ${cartes.length - maximum} autre(s).`, "wmd-discret"));
  return liste;
}


// ---------------------------------------------------------------------
//  PARTIE 3 : CE QUE L'EXTENSION A EN MÉMOIRE (réglages, totaux du jeu)
// ---------------------------------------------------------------------

let reglages = { ...REGLAGES_PAR_DEFAUT }; // remplacés dès que la mémoire a répondu
let catalogue = null;                      // les totaux par rareté lus sur « Toutes les cartes »
let etiquettes = ETIQUETTES_PAR_DEFAUT;    // 1.9 : les étiquettes que l'extension reconnaît
let etiquettesSurLeSite = {};              // 1.9 : tes étiquettes déjà créées sur le site : { nom: nombre de cartes }

lireReglages().then(lus => {
  reglages = lus;
  actualiserPanneau();
});
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

function creerPanneau() {
  if (document.getElementById("wmd-panneau")) return; // il existe déjà

  const panneau = creer("div");
  panneau.id = "wmd-panneau";
  if (!panneauOuvert) panneau.classList.add("wmd-reduit");
  const titre = creer("div", "WikiMasters Doublons", "wmd-titre");
  panneau.appendChild(titre);

  // Crée un bouton et le branche sur sa fonction (comme un OnClick dans Unity).
  const ajouterBouton = (id, texte, action) => {
    const bouton = creer("button", texte);
    bouton.id = id;
    bouton.addEventListener("click", action);
    panneau.appendChild(bouton);
    return bouton;
  };
  // Corrigé en 1.4.6 : le bouton « - » est rangé DANS le titre, qui reste collé en haut du panneau
  // quand on fait défiler (avant, titre et bouton disparaissaient avec une longue liste).
  const reduire = ajouterBouton("wmd-reduire", panneauOuvert ? "-" : "+", () => {
    panneauOuvert = panneau.classList.toggle("wmd-reduit") === false;
    reduire.textContent = panneauOuvert ? "-" : "+";
  });
  reduire.title = "Agrandir / réduire";
  titre.appendChild(reduire);
  ajouterBouton("wmd-stop", "Stop", () => arreter());
  ajouterBouton("wmd-reprendre", "Reprendre la lecture", () => reprendreLecture()); // nouveau en 1.8
  ajouterBouton("wmd-doublons", "Trouver mes doublons", () => trouverMesDoublons());
  ajouterBouton("wmd-manquantes", "Trouver mes cartes manquantes", () => trouverMesCartesManquantes());
  // Nouveau en 1.8 : les cartes animées de tout le jeu (page « Toutes les cartes »).
  ajouterBouton("wmd-animees-jeu", "✨ Trouver les cartes animées du jeu", () => trouverCartesAnimees());
  ajouterBouton("wmd-animees-revoir", "✨ Revoir les cartes animées trouvées", () => afficherAnimeesJeu());
  // Nouveau en 1.8 : les enchères suivies (alertes avant la fin).
  ajouterBouton("wmd-encheres", "🔔 Mes enchères suivies", () => afficherEncheresSuivies());
  ajouterBouton("wmd-csv", "Exporter en CSV (Excel)", () => exporterCSV());
  // 1.7.4 : les boutons « Exporter en JSON », « Copier mes doublons pour Discord » et
  // « Comparer avec un ami » sont retirés du panneau.
  // Nouveau en 1.4 : le marché. Depuis la 1.4.3, les prix de la page s'affichent tout seuls
  // (plus de bouton « Prix de cette page », et plus de parcours automatique).
  ajouterBouton("wmd-estimer", "Estimer la valeur de mes cartes", () => estimerMesCartes());
  ajouterBouton("wmd-prix-csv", "Exporter les prix du marché (CSV)", () => exporterPrixMarche());
  // Nouveau en 1.5 : tes cartes souhaitées chez tes amis (bouton visible sur toutes les pages).
  ajouterBouton("wmd-souhaits", "Chercher mes souhaits chez mes amis", () => chercherSouhaitsChezAmis());
  ajouterBouton("wmd-souhaits-resultats", "Revoir les résultats (souhaits)", () => afficherResultatsSouhaits());
  ajouterBouton("wmd-reglages", "Réglages et notifications", () => {
    api.runtime.sendMessage({ type: "ouvrir-reglages" }).catch(() => {});
  });

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
  panneau.appendChild(caseMinMax);

  const statut = creer("div", "Prêt.");
  const suggestions = creer("div"); // 1.9 : les étiquettes de la carte ouverte (visibles même panneau réduit)
  suggestions.id = "wmd-suggestions";
  statut.id = "wmd-statut";
  const echange = creer("div");
  echange.id = "wmd-echange";
  const resultats = creer("div");
  resultats.id = "wmd-resultats";
  panneau.append(statut, suggestions, echange, resultats);

  document.body.appendChild(panneau);
  actualiserPanneau();
}

// Nouveau en 1.3 : chaque bouton n'apparaît que sur la bonne page, et si sa fonction est activée.
function actualiserPanneau() {
  const page = pageActuelle();
  const visibles = {
    "wmd-doublons": page === "collection",
    "wmd-csv": page === "collection",
    "wmd-stop": tacheEnCours, // 1.7.4 : le bouton Stop n'apparaît que pendant une tâche automatique
    // 1.8 : « Reprendre » après une lecture interrompue, sur la page où elle avait lieu.
    "wmd-reprendre": !tacheEnCours && !enCours && lecture !== null && !lecture.complet && lecture.page === page,
    "wmd-case-minmax": reglages.marche,
    "wmd-manquantes": page === "toutes-les-cartes" && reglages.manquantes,
    "wmd-animees-jeu": page === "toutes-les-cartes" && reglages.animeesJeu,
    "wmd-animees-revoir": (page === "toutes-les-cartes" || page === "collection") && reglages.animeesJeu && aDesAnimeesJeu,
    "wmd-encheres": reglages.encheres && (page === "marche" || nombreEncheresSuivies > 0),
    "wmd-estimer": (page === "marche" || page === "collection") && reglages.marche,
    "wmd-prix-csv": (page === "marche" || page === "collection") && reglages.marche,
    "wmd-souhaits-resultats": aDesResultatsSouhaits
  };
  for (const [id, visible] of Object.entries(visibles)) {
    const bouton = document.getElementById(id);
    if (bouton) bouton.hidden = !visible;
  }
}

// Écrit un message dans le panneau ET dans la console (F12).
function afficherStatut(texte) {
  const zone = document.getElementById("wmd-statut");
  if (zone) zone.textContent = texte;
  console.log("[WikiMasters Doublons]", texte);
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
async function surveillerStop() {
  const { chasse } = await api.storage.local.get("chasse");
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

function afficherTableau() {
  const toutes = regrouperParNom(derniereCollection);
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
    const valeurs = [carte.nom, lettreRarete(carte.rarete), carte.quantite, carte.quantite - 1, carte.animee ? "✨" : ""];
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
  afficherStatut(`Collection lue : ${derniereCollection.length} carte(s) au total.`);
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
  bloc.appendChild(creer("p", `Depuis le ${dateLisible(date)} : ${nouvelles.length} nouvelle(s) carte(s), `
    + `${enPlus.length} carte(s) avec des exemplaires en plus, ${enMoins} carte(s) en moins.`));
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
  const { cartes, message } = await lireToutesLesPages("manquantes", { reprendre: reprendre });
  const mesNoms = new Set(moi.map(c => c.nom));
  const liste = regrouperParNom(cartes);
  derniereListeManquantes = liste.filter(c => !mesNoms.has(c.nom));
  trierCartes(derniereListeManquantes, "rarete");
  afficherManquantes(liste, mesNoms);
  afficherStatut(message || `${derniereListeManquantes.length} carte(s) manquante(s) sur ${liste.length}.`);
}

function afficherManquantes(liste, mesNoms) {
  const zone = document.getElementById("wmd-resultats");
  zone.replaceChildren();
  zone.appendChild(creer("h4", "Cartes manquantes"));

  // Une phrase par rareté présente dans la liste lue.
  for (const rarete of Object.keys(RARETES)) {
    const deCetteRarete = liste.filter(c => c.rarete === rarete);
    if (deCetteRarete.length === 0) continue;
    const possedees = deCetteRarete.filter(c => mesNoms.has(c.nom)).length;
    const pourcentage = nombreLisible(possedees / deCetteRarete.length * 100, 1);
    zone.appendChild(creer("p", `${RARETES[rarete].nom} : ${deCetteRarete.length} carte(s) dans cette liste, `
      + `tu en as ${possedees} (${pourcentage} %), il t'en manque ${deCetteRarete.length - possedees}.`, `wmd-${rarete}`));
  }

  if (derniereListeManquantes.length) {
    const bouton = creer("button", "Exporter les cartes manquantes (CSV)");
    bouton.id = "wmd-csv-manquantes";
    bouton.addEventListener("click", () => exporterManquantes());
    zone.appendChild(bouton);
  }
  const lignes = derniereListeManquantes.map(c => ({ valeurs: [c.nom, lettreRarete(c.rarete)], classe: `wmd-${c.rarete}` }));
  zone.appendChild(creerTableau(["Carte manquante", "Rareté"], lignes));
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
    valeurs: [carte.nom, lettreRarete(carte.rarete), carte.aMoi ? "✓ " + carte.aMoi.join(", ") : "—"]
  }))));
  afficherStatut(`${cartes.length} carte(s) animée(s) connue(s) dans le jeu.`);
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
  for (const element of document.querySelectorAll("main *")) {
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
function feuilles(zone) {
  return [...zone.querySelectorAll("*")]
    .filter(element => element.children.length === 0 || element.matches("h1,h2,h3,h4,p,span"))
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
function lireAnnoncesMarche(avecDepart = false) {
  const enchere = location.pathname.match(REGEX_PAGE_ENCHERE);
  if (enchere) return avecDepart ? [] : lireAnnonceDetail(enchere[1].toLowerCase()); // nouveau en 1.4.5
  const annonces = [];
  const dejaVus = new Set();
  const zone = document.querySelector("main") || document.body;
  for (const { element: etiquette, texte } of feuilles(zone)) {
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
async function enregistrerAnnonces(annonces) {
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
  const gardees = Object.entries(marche.annonces).filter(([, a]) => a.vu >= limite)
    .sort((a, b) => b[1].vu - a[1].vu).slice(0, MARCHE.annoncesMax);
  await api.storage.local.set({ marche: { annonces: Object.fromEntries(gardees), moyennes: marche.moyennes || {} } });
  return nouvelles;
}

// Toutes les 3 secondes sur la page Marché : on relève ce qui est affiché.
// Nouveau en 1.4.3 : dès que les annonces affichées changent (arrivée sur le marché, une recherche,
// un filtre, une autre page), leurs prix s'affichent tout seuls dans le panneau.
let signatureMarche = "";
async function releverMarche() {
  if (pageActuelle() !== "marche" || !reglages.marche || releveEnCours) return 0;
  releveEnCours = true;
  try {
    const annonces = lireAnnoncesMarche();
    const nouvelles = await enregistrerAnnonces(annonces);
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
async function prixDeCettePage(annonces, ignorees) {
  const zone = document.getElementById("wmd-resultats");
  zone.replaceChildren();
  if (annonces.length === 0) {
    afficherStatut(ignorees
      ? `Aucune mise actuelle sur cette page : ${ignorees} annonce(s) n'ont qu'une mise de départ (personne n'a encore misé).`
      : "Marché : aucune annonce trouvée sur cette page pour l'instant.");
    return;
  }

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
  const bloc = creer("div", undefined, "wmd-bloc");
  bloc.appendChild(creer("b", `${annonces.length} mise(s) actuelle(s) sur cette page`));
  bloc.appendChild(creer("div", `${ignorees} mise(s) de départ ignorée(s). « fini » = enchère terminée (prix de vente). `
    + "Les autres enchères sont en cours : le prix peut encore monter.", "wmd-discret"));
  zone.appendChild(bloc);
  zone.appendChild(creerTableau(["Carte", "Rar.", "Mises actuelles", "Min", "Max", "À toi"], lignes.map(g => {
    const nombres = g.prix.map(p => parseInt(p, 10)).sort((a, b) => a - b);
    const textes = [...g.prix].sort((a, b) => parseInt(a, 10) - parseInt(b, 10)).map(p => typeof p === "number" ? nombreLisible(p) : p);
    return { classe: `wmd-${g.rarete}`, valeurs: [g.nom, lettreRarete(g.rarete), textes.join(" · "),
      nombreLisible(nombres[0]), nombreLisible(nombres[nombres.length - 1]), (tesRaretes.get(g.nom) || ["—"]).join(", ")] };
  })));
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
let moyenneEnCours = false;
async function releverPrixMoyen() {
  if (moyenneEnCours || !reglages.marche) return;
  // La fiche du site s'ouvre par-dessus la page, hors de <main> : on cherche dans toute la page.
  const etiquettes = [...document.body.querySelectorAll("p")].filter(p => !estDansLePanneau(p) && /^prix moyen\s*·/i.test(p.textContent.trim()));
  if (!etiquettes.length) return;
  moyenneEnCours = true;
  try {
    const { marche = { annonces: {} } } = await api.storage.local.get("marche");
    marche.moyennes = marche.moyennes || {};
    let modifie = false;
    for (const p of etiquettes) {
      const rarete = rareteDepuisNom(p.textContent.trim().replace(/^prix moyen\s*·\s*/i, ""));
      if (!rarete) continue;
      let fiche = p.parentElement;
      while (fiche && !fiche.querySelector("h2")) fiche = fiche.parentElement;
      if (!fiche) continue;
      const nom = fiche.querySelector("h2").textContent.trim();
      const prix = prixApres(feuilles(p.parentElement), p).prix;
      if (!nom || prix === null) continue;
      const cle = `${nom}|${rarete}`;
      const ancienne = marche.moyennes[cle];
      if (ancienne && ancienne.prix === prix && Date.now() - ancienne.vu < 3600 * 1000) continue;
      marche.moyennes[cle] = { nom: nom, rarete: rarete, prix: prix, vu: Date.now() };
      modifie = true;
    }
    if (modifie) await api.storage.local.set({ marche: marche });
  } finally {
    moyenneEnCours = false;
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
    + "Clique sur le nom d'une carte pour l'ouvrir dans ta collection."
    + (autreRarete ? ` ${autreRarete} de tes cartes ont été vues dans une autre rareté (prix non comparable).` : ""), "wmd-discret"));
  zone.appendChild(bloc);
  zone.appendChild(creerTableau(["Carte", "Rar.", "Qté", "Moy. site", "Min marché"], estimees.map(({ carte, prix }) => {
    const lien = creer("a", carte.nom, "wmd-lien-carte");
    lien.href = "#";
    lien.title = "Ouvrir cette carte dans ta collection";
    lien.addEventListener("click", evenement => {
      evenement.preventDefault();
      ouvrirCarte(carte.nom, carte.rarete);
    });
    return { classe: `wmd-${carte.rarete}`,
      valeurs: [lien, lettreRarete(carte.rarete), carte.quantite,
        prix.moyenne ? nombreLisible(prix.estimation) : "—", nombreOuTiret(prix.min)] };
  })));
  afficherStatut(`${estimees.length} de tes cartes ont un prix relevé.`);
}

// ---------------------------------------------------------------------
//  Nouveau en 1.7.5 : OUVRIR UNE CARTE DANS MA COLLECTION
//  Le site n'a pas d'adresse propre à chaque carte. Un clic sur un nom (dans « Estimer la valeur
//  de mes cartes ») va donc sur la page Collection, tape le nom dans la recherche du site, puis
//  clique sur la carte de la bonne rareté pour ouvrir sa fiche. Rien d'autre n'est cliqué.
// ---------------------------------------------------------------------
async function ouvrirCarte(nom, rarete) {
  await api.storage.local.set({ ouvrirCarte: { nom: nom, rarete: rarete, quand: Date.now() } });
  if (pageActuelle() !== "collection") location.href = "/collection";
}

// Écrit dans un champ du site comme si on avait tapé (le site, en React, écoute « input »).
function ecrireDansChamp(champ, texte) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  champ.focus();
  setter.call(champ, texte);
  champ.dispatchEvent(new Event("input", { bubbles: true }));
}

let ouvertureEnCours = false;
async function appliquerOuvertureCarte() {
  if (ouvertureEnCours || pageActuelle() !== "collection") return;
  const { ouvrirCarte: demande } = await api.storage.local.get("ouvrirCarte");
  if (!demande) return;
  if (Date.now() - demande.quand > 60 * 1000) { await api.storage.local.remove("ouvrirCarte"); return; }
  const champ = [...document.querySelectorAll("input")].find(element =>
    !estDansLePanneau(element) && /rechercher par titre/i.test(element.placeholder || ""));
  if (!champ) return; // la page n'est pas encore chargée : on réessaiera
  ouvertureEnCours = true;
  try {
    await api.storage.local.remove("ouvrirCarte");
    afficherStatut(`Recherche de « ${demande.nom} » dans ta collection…`);
    ecrireDansChamp(champ, demande.nom);
    // On attend que la carte apparaisse (même nom, même rareté), puis on l'ouvre.
    for (let essai = 0; essai < 30; essai++) {
      await pause(200);
      const trouvee = trouverCadresDeCartes().find(({ cadre, imageRarete }) => {
        const nomCarte = cadre.querySelector(CONFIG.selecteurNomCarte).textContent.trim();
        const r = imageRarete.getAttribute("src").match(/rarity\/([a-z_]+)\./);
        return nomCarte === demande.nom && (!demande.rarete || (r && r[1] === demande.rarete));
      });
      if (trouvee) {
        trouvee.cadre.scrollIntoView({ block: "center" });
        trouvee.cadre.click();
        afficherStatut(`« ${demande.nom} » ouverte.`);
        return;
      }
    }
    afficherStatut(`« ${demande.nom} » est cherchée dans ta collection : clique dessus pour l'ouvrir.`);
  } finally {
    ouvertureEnCours = false;
  }
}

// Le bouton « Exporter les prix du marché (CSV) » : une ligne par carte vue au marché,
// avec une colonne « À moi » si elle est dans ta collection.
async function exporterPrixMarche() {
  const groupes = await prixParCarte();
  if (groupes.size === 0) {
    afficherStatut("Aucun prix relevé : passe d'abord sur la page Marché.");
    return;
  }
  const collection = (await maCollection()) || [];
  const aMoi = new Map(collection.map(carte => [`${carte.nom}|${carte.rarete}`, carte.quantite]));
  const lignes = ["Carte;Rareté;Prix estimé;Minimum seulement;Ventes terminées;Enchères en cours;Prix le plus bas;Prix le plus haut;À moi;Tous les prix"];
  for (const g of [...groupes.values()].sort((a, b) => b.estimation - a.estimation)) {
    lignes.push([champCSV(g.nom), lettreRarete(g.rarete), g.estimation, g.minimum ? "oui" : "non",
      g.terminees.length, g.enCours.length, g.min ?? "", g.max ?? "", aMoi.get(`${g.nom}|${g.rarete}`) || 0,
      champCSV(g.liste.map(p => p.prix + (p.terminee ? " (fini)" : "")).join(" · "))].join(";"));
  }
  telechargerFichier("prix-marche-wikimasters.csv", MARQUE_EXCEL + lignes.join("\r\n"), "text/csv;charset=utf-8");
  afficherStatut("Fichier CSV des prix du marché téléchargé.");
}

// ---------------------------------------------------------------------
//  PARTIE 13 TER : LE PRIX ESTIMÉ DANS LA FICHE D'UNE CARTE (nouveau en 1.4.2)
//  Quand tu cliques sur une de tes cartes, le site ouvre sa fiche avec le bouton
//  « Mettre aux enchères ». Juste au-dessus, l'extension affiche le prix estimé
//  de CETTE carte dans CETTE rareté (une Légendaire et une Ultra rare du même nom
//  sont deux cartes différentes, avec des prix très différents).
// ---------------------------------------------------------------------

// Nouveau en 1.6.5 : efface les prix relevés d'une carte dans une rareté.
async function oublierPrix(nom, rarete) {
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
      if (element.children.length === 0 && !estDansLePanneau(element)
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
    const chercher = creer("button", "🔎 Chercher au marché", "wmd-chercher-marche");
    chercher.type = "button";
    chercher.title = "Ouvre le marché dans un nouvel onglet et y cherche cette carte, dans sa rareté";
    chercher.addEventListener("click", () => chercherAuMarche(nom, rarete));
    encart.appendChild(chercher);
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
    // La même carte vue dans d'autres raretés : à titre indicatif seulement.
    const autres = Object.keys(RARETES).filter(r => reglages.marche && r !== rarete && groupes.has(`${nom}|${r}`))
      .map(r => `${RARETES[r].nom} : ${groupes.get(`${nom}|${r}`).minimum ? "≥ " : ""}${nombreLisible(groupes.get(`${nom}|${r}`).estimation)}`);
    if (autres.length) encart.appendChild(creer("div", `Vue au marché dans une autre rareté (prix non comparable) : ${autres.join(", ")}.`, "wmd-discret"));
    ligne.parentElement.insertBefore(encart, ligne);
  } finally {
    ficheEnCours = false;
  }
}

// Si les prix changent (un relevé au marché dans un autre onglet), on recalcule l'encart.
api.storage.onChanged.addListener(changements => {
  const encart = document.getElementById("wmd-prix-fiche");
  if (changements.marche && encart) encart.dataset.cle = "";
});



// ---------------------------------------------------------------------
//  PARTIE 13 QUATER : CHERCHER UNE CARTE AU MARCHÉ (nouveau en 1.4.4)
//  Dans la fiche d'une de tes cartes, le bouton « Chercher au marché » ouvre le
//  marché dans un nouvel onglet. Là, l'extension tape le nom de la carte dans la
//  recherche du site, clique sur « Rechercher », puis sur le filtre de sa rareté.
//  Le site ne met pas la recherche dans l'adresse : on passe donc la demande par
//  la mémoire de l'extension (« rechercheMarche »).
// ---------------------------------------------------------------------

const PAGE_MARCHE = "https://www.wiki-masters.com/marketplace";

function chercherAuMarche(nom, rarete) {
  // window.open doit partir tout de suite, pendant le clic (sinon le navigateur bloque l'onglet).
  window.open(PAGE_MARCHE, "_blank");
  api.storage.local.set({ rechercheMarche: { nom: nom, rarete: rarete, quand: Date.now() } });
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
  const champ = [...document.querySelectorAll("input")].find(element =>
    !estDansLePanneau(element) && /rechercher une carte/i.test(element.placeholder || ""));
  if (!champ) return; // la page n'est pas encore chargée : on réessaiera dans une seconde

  rechercheEnCours = true;
  try {
    await api.storage.local.remove("rechercheMarche");
    afficherStatut(`Recherche de « ${demande.nom} » au marché…`);
    // On écrit le nom comme si tu l'avais tapé (le site écoute l'évènement « input »).
    champ.focus();
    champ.value = demande.nom;
    champ.dispatchEvent(new Event("input", { bubbles: true }));
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
    if (filtre) filtre.click();
    afficherStatut(`Recherche de « ${demande.nom} »${filtre ? ` (${RARETES[demande.rarete].nom})` : ""} lancée au marché.`);
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

function memeNom(a, b) {
  return a.trim().toLocaleLowerCase("fr") === b.trim().toLocaleLowerCase("fr");
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
    if (element.children.length === 0 && rareteDepuisLettre(element.textContent.trim())) {
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
    if (nom && !amis.some(ami => ami.nom === nom)) amis.push({ nom: nom, bouton: bouton });
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
  champ.focus();
  champ.value = nom;
  champ.dispatchEvent(new Event("input", { bubbles: true }));
  await pause(SOUHAITS.pauseMs);
  // Les résultats sont là quand : « Aucune carte… », ou au moins une carte contient le texte cherché.
  await attendre(() => /aucune carte ne correspond/i.test(fenetre.textContent)
    || cartesDans(fenetre).some(carte => carte.nom.toLocaleLowerCase("fr").includes(nom.toLocaleLowerCase("fr"))), 4000);
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
  const bilan = { date: Date.now(), souhaits: chasse.souhaits, amis: amis.length, resultats: resultats,
    partiel: arrete, ratees: fenetresRatees };
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
  bloc.appendChild(creer("b", `${trouvees.size} carte(s) souhaitée(s) sur ${bilan.souhaits.length} trouvée(s) chez tes amis`));
  bloc.appendChild(creer("div", `Recherche du ${dateLisible(bilan.date)}, ${bilan.amis} ami(s) regardé(s)`
    + (bilan.partiel ? " (arrêtée avant la fin)" : "") + (bilan.ratees ? `, ${bilan.ratees} fenêtre(s) d'échange n'ont pas pu s'ouvrir` : "") + ".", "wmd-discret"));
  const absentes = bilan.souhaits.filter(s => !trouvees.has(`${s.nom}|${s.rarete}`));
  if (absentes.length) bloc.appendChild(creer("div", `Personne n'a : ${absentes.map(s => `${s.nom} (${lettreRarete(s.rarete)})`).join(", ")}.`, "wmd-discret"));
  zone.appendChild(bloc);
  if (lignes.length === 0) return;

  const tableau = creerTableau(["Carte", "Rar.", "Ami", "Qté", ""], []);
  const corps = tableau.tBodies[0];
  for (const { ami, carte } of lignes) {
    const rangee = corps.insertRow();
    rangee.className = `wmd-${carte.rarete}`;
    for (const valeur of [carte.nom, lettreRarete(carte.rarete), ami, carte.quantite]) rangee.insertCell().textContent = valeur;
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
      const moyenne = prix && prix.moyenne ? nombreLisible(prix.estimation) : null;
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
        const texte = [moyenne !== null ? `Prix moyen du site : ${moyenne}` : "Pas de prix moyen du site relevé",
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
const SEUIL_AFFAIRE = 0.75;
function couleurAffaire(rapport) {
  const force = Math.min(1, Math.max(0, (SEUIL_AFFAIRE - rapport) / SEUIL_AFFAIRE)); // 0 = jaune, 1 = rouge
  const teinte = Math.round(52 * (1 - force)); // 52° = jaune, 0° = rouge
  return `hsl(${teinte}, 90%, ${Math.round(55 - 7 * force)}%)`;
}
// Nouveau en 1.7.6 : le cadre BLEU (comparé au prix le plus haut trouvé au Marché) :
// blanc à 75 %, de plus en plus bleu à mesure que l'affaire est meilleure.
function couleurAffaireBleue(rapport) {
  const force = Math.min(1, Math.max(0, (SEUIL_AFFAIRE - rapport) / SEUIL_AFFAIRE)); // 0 = blanc, 1 = bleu
  return `hsl(212, ${Math.round(95 * force)}%, ${Math.round(96 - 40 * force)}%)`;
}

let annoncesEnCache = null; // les annonces en mémoire, relues seulement quand elles changent
let moyennesEnCache = {};   // 1.7.2 : les prix moyens du site, relus en même temps
api.storage.onChanged.addListener(changements => {
  if (changements.marche) annoncesEnCache = null;
});

// Le prix estimé d'une carte, sans compter l'annonce « cleExclue ».
// Renvoie { estimation, minimum, min, terminees, enCours } ou null.
function estimationSans(annonces, nom, rarete, cleExclue) {
  const liste = [];
  for (const [cle, a] of annonces) {
    if (cle === cleExclue || a.nom !== nom || a.rarete !== rarete) continue;
    liste.push({ prix: a.prix, terminee: a.terminee });
  }
  // Estimation = prix le plus haut trouvé (1.6.3), aucun prix écarté (1.6.9).
  let estime = calculerEstimation(liste);
  // 1.7.2 : le prix moyen du site, s'il est connu, remplace l'estimation.
  const moyenne = moyennesEnCache[`${nom}|${rarete}`];
  if (moyenne) estime = appliquerMoyenne(estime || { min: null, max: null, minVendu: null, nbTerminees: 0, nbEnCours: 0 }, moyenne);
  return estime && Object.assign(estime, { terminees: estime.nbTerminees, enCours: estime.nbEnCours });
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
  if (!enchere || !reglages.marche) { if (ancien) ancien.remove(); return; }
  const zone = document.querySelector("main") || document.body;
  const titre = zone.querySelector("h1");
  if (!titre || !titre.parentElement || !titre.parentElement.parentElement) return;
  const nom = titre.textContent.trim();
  const rarete = feuilles(zone).map(({ element, texte }) =>
    !estDansLePanneau(element) && element.children.length === 0 ? rareteDepuisLettre(texte) : null).find(Boolean);
  if (!nom || !rarete) return;
  const identifiant = enchere[1].toLowerCase();
  const cleAnnonce = "marketplace-auction-" + identifiant;
  const annonce = lireAnnonceDetail(identifiant)[0];

  if (!annoncesEnCache) {
    const { marche } = await api.storage.local.get("marche");
    annoncesEnCache = Object.entries(marche ? marche.annonces : {});
    moyennesEnCache = marche && marche.moyennes ? marche.moyennes : {};
  }
  const estime = estimationSans(annoncesEnCache, nom, rarete, cleAnnonce);
  const signature = JSON.stringify([identifiant, nom, rarete, estime, annonce ? [annonce.prix, annonce.terminee] : null, afficherMinMax]);
  const bloc = titre.parentElement.parentElement; // le titre + « Mis en vente par »
  if (ancien && ancien.dataset.signature === signature && ancien.previousElementSibling === bloc) return; // déjà à jour

  const encart = ancien || creer("div", undefined, "wmd-prix-fiche wmd-prix-enchere");
  encart.id = "wmd-prix-enchere";
  encart.dataset.signature = signature;
  encart.replaceChildren();
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
    encart.appendChild(creer("div", "Passez sur le Marché (par exemple avec « Chercher au marché ») pour relever des prix.", "wmd-discret"));
  }
  // La même carte vue dans d'autres raretés : à titre indicatif seulement.
  const autres = Object.keys(RARETES).filter(r => r !== rarete)
    .map(r => [r, estimationSans(annoncesEnCache, nom, r, cleAnnonce)]).filter(([, e]) => e)
    .map(([r, e]) => `${RARETES[r].nom} : ${e.minimum ? "≥ " : ""}${nombreLisible(e.estimation)}`);
  if (autres.length) encart.appendChild(creer("div", `Vue dans une autre rareté (prix non comparable) : ${autres.join(", ")}.`, "wmd-discret"));
  bloc.after(encart);
}

let affairesEnCours = false;
async function marquerBonnesAffaires() {
  if (affairesEnCours) return;
  const actif = reglages.marche && pageActuelle() === "marche" && !REGEX_PAGE_ENCHERE.test(location.pathname);
  if (!actif) {
    for (const element of document.querySelectorAll(".wmd-bonne-affaire")) element.classList.remove("wmd-bonne-affaire");
    return;
  }
  affairesEnCours = true;
  try {
    if (!annoncesEnCache) {
      const { marche } = await api.storage.local.get("marche");
      annoncesEnCache = Object.entries(marche ? marche.annonces : {});
    moyennesEnCache = marche && marche.moyennes ? marche.moyennes : {};
    }
    for (const annonce of lireAnnoncesMarche(true)) {
      const cadre = annonce.cadre.closest("[id^='marketplace-auction-']") || annonce.cadre;
      const estime = !annonce.terminee && annonce.rarete !== "inconnue"
        ? estimationSans(annoncesEnCache, annonce.nom, annonce.rarete, annonce.cle) : null;
      // 1.7.6 : deux sortes de cadres.
      //  - jaune → rouge : la mise est à 75 % ou moins du PRIX MOYEN du site (toujours prioritaire) ;
      //  - blanc → bleu : sinon, la mise est à 75 % ou moins du prix le plus HAUT trouvé au Marché.
      const rapportMoyen = estime && estime.moyenne && estime.estimation > 0 ? annonce.prix / estime.estimation : 1;
      const rapportMax = estime && estime.max > 0 ? annonce.prix / estime.max : 1;
      const type = rapportMoyen <= SEUIL_AFFAIRE ? "moyenne" : rapportMax <= SEUIL_AFFAIRE ? "max" : null;
      const affaire = type !== null;
      const rapport = type === "moyenne" ? rapportMoyen : rapportMax;
      cadre.classList.toggle("wmd-bonne-affaire", affaire);
      if (affaire) {
        // 1.7.0 : on ajoute le prix le plus bas auquel la carte a été vue VENDUE (s'il y en a un).
        // 1.7.7 : « ⚠ » si un prix moyen du site est connu mais que seul le cadre bleu (max du Marché) s'applique :
        // ce prix le plus haut est alors probablement trompeur.
        const attention = type === "max" && estime.moyenne;
        const texte = (attention ? "⚠ " : "") + `−${Math.round((1 - rapport) * 100)} % · `
          + (type === "moyenne" ? `moy. ${nombreLisible(estime.estimation)}` : `max ${nombreLisible(estime.max)}`)
          + (estime.minVendu !== null ? ` · vendue min ${nombreLisible(estime.minVendu)}` : "");
        if (cadre.dataset.wmdAffaire !== texte) {
          cadre.dataset.wmdAffaire = texte;
          cadre.style.setProperty("--wmd-couleur-affaire", type === "moyenne" ? couleurAffaire(rapport) : couleurAffaireBleue(rapport));
          cadre.title = `${annonce.depart ? "Mise de départ" : "Mise actuelle"} ${nombreLisible(annonce.prix)} : `
            + `sous l'estimation de l'extension (${texte.toLowerCase()})`
            + (attention ? `. Attention : le prix moyen du site est ${nombreLisible(estime.estimation)}, le prix le plus haut du Marché est probablement trompeur.` : "");
        }
      } else if (cadre.dataset.wmdAffaire) {
        delete cadre.dataset.wmdAffaire;
        cadre.style.removeProperty("--wmd-couleur-affaire");
        cadre.removeAttribute("title");
      }
    }
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
  return element.closest("#wmd-panneau, .wmd-prix-fiche, #wmd-suivi-enchere") !== null;
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
async function noterFinEnchere(id, debut, finMax, source) {
  const ancienne = encheresSuivies[id];
  if (!ancienne) return;
  let nouveauDebut = debut, nouvelleFin = finMax;
  if (ancienne.fin && ancienne.finMax && ancienne.source !== "manuel" && debut <= ancienne.finMax && finMax >= ancienne.fin) {
    nouveauDebut = Math.max(debut, ancienne.fin);
    nouvelleFin = Math.min(finMax, ancienne.finMax);
  }
  // Rien d'important n'a changé : on n'écrit pas (la page est relue toutes les secondes).
  if (ancienne.fin && Math.abs(nouveauDebut - ancienne.fin) < 30 * SECONDE
    && (ancienne.finMax - ancienne.fin) - (nouvelleFin - nouveauDebut) < 30 * SECONDE
    && ancienne.source === source) return;
  await modifierEncheres(memo => {
    const enchere = memo.encheres[id];
    if (!enchere) return false;
    enchere.fin = nouveauDebut;
    enchere.finMax = nouvelleFin;
    enchere.source = source;
    enchere.vu = Date.now();
    return true;
  });
}

async function noterEnchereTerminee(id) {
  if (!encheresSuivies[id] || encheresSuivies[id].terminee) return;
  await modifierEncheres(memo => {
    if (!memo.encheres[id]) return false;
    memo.encheres[id].terminee = true;
    return true;
  });
}

// --- Lire l'heure de fin sur la page ---

// Les comptes à rebours vus aux passages précédents : élément → { ms, a, tique }.
// Un texte dont la durée baisse d'une seconde chaque seconde est sûrement LE compte à rebours.
const minuteriesVues = new WeakMap();

// Cherche dans "zone" le texte qui donne la fin de l'enchère.
// Renvoie { debut, fin } (l'intervalle où se trouve la vraie heure de fin) ou null.
function lireFinDans(zone) {
  const maintenant = Date.now();
  let meilleur = null;
  const proposer = (score, debut, fin) => {
    if (!meilleur || score > meilleur.score) meilleur = { score: score, debut: debut, fin: fin };
  };
  // 1) Une balise <time datetime="…"> : l'heure exacte.
  for (const element of zone.querySelectorAll("time[datetime]")) {
    if (estDeLExtension(element)) continue;
    const heure = Date.parse(element.getAttribute("datetime"));
    if (heure > maintenant - MINUTE && heure < maintenant + 60 * JOUR) proposer(4, heure - SECONDE, heure + SECONDE);
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
      proposer(3, date - MINUTE, date + MINUTE);
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
    proposer(score, maintenant + duree.ms - duree.precision / 2, maintenant + duree.ms + duree.precision);
  }
  return meilleur && { debut: meilleur.debut, fin: meilleur.fin };
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
    !estDeLExtension(element) && element.children.length === 0 ? rareteDepuisLettre(texte) : null).find(Boolean) || null;
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
    // Ton pseudo pas encore connu : une enchère vue « Vous menez » il y a peu le donne (son meneur, c'est toi).
    const memoAvant = encheresSuivies[id];
    if (!monPseudo && meneur && memoAvant && memoAvant.statut === "menez" && Date.now() - (memoAvant.statutVu || 0) < 10 * MINUTE) {
      await noterPseudo(meneur);
    }
    // Tu as misé ? (texte du site, ou ton pseudo dans l'historique des mises) Tu mènes ?
    const dansHistorique = Boolean(monPseudo) && pseudosHistorique(zone).includes(monPseudo);
    const statut = monPseudo && meneur ? (meneur === monPseudo ? "menez" : dansHistorique ? "surencheri" : null) : null;

    // Suivi automatique : tu as misé sur cette enchère (sauf si tu as choisi « Ne plus suivre »).
    if (!encheresSuivies[id] && !encheresIgnorees[id] && !terminee && reglages.enchereAuto && (dansHistorique || jaiMiseDans(zone))) {
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
      else if (lue) await noterFinEnchere(id, lue.debut, lue.fin, "page");
    }
    dessinerEncartEnchere(id, titre, lue, terminee);
  } finally {
    surveillanceEnchereEnCours = false;
  }
}

function dessinerEncartEnchere(id, titre, lue, terminee) {
  const memo = encheresSuivies[id] || null;
  const bloc = titre.parentElement && titre.parentElement.parentElement;
  let encart = document.getElementById("wmd-suivi-enchere");
  if (!bloc || (terminee && !memo)) { // une enchère finie que tu ne suis pas : rien à afficher
    if (encart) encart.remove();
    return;
  }
  const prixEncart = document.getElementById("wmd-prix-enchere");
  const avant = prixEncart && prixEncart.previousElementSibling === bloc ? prixEncart : bloc;
  const fin = memo && memo.fin ? memo.fin : lue ? lue.debut : null;
  const finMax = memo && memo.finMax ? memo.finMax : lue ? lue.fin : null;
  const signature = JSON.stringify([id, Boolean(memo), terminee, memo && memo.terminee, fin && Math.round(fin / MINUTE),
    finMax && Math.round(finMax / MINUTE), memo && memo.source, memo && memo.statut, saisieFinOuverte, reglages.enchereDelais]);
  if (encart && encart.dataset.signature === signature && encart.previousElementSibling === avant) {
    // Seul le temps restant change : on le met à jour sans tout redessiner (le champ de saisie reste intact).
    const reste = encart.querySelector(".wmd-reste");
    if (reste && fin) reste.textContent = texteFin(fin, finMax);
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
    encart.appendChild(creer("b", "🔔 Enchère suivie" + (memo.statut ? ` : ${texteStatut(memo.statut)}` : "")));
    const ligne = creer("div", fin ? undefined : "Heure de fin inconnue : indique le temps restant ci-dessous.");
    if (fin) {
      const reste = creer("span", texteFin(fin, finMax), "wmd-reste");
      ligne.append("Fin : ", reste, memo.source === "manuel" ? " (tapée à la main)" : "");
    }
    encart.appendChild(ligne);
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

// « dans 2 h 05 (vers 18:42) », avec la marge d'erreur si l'heure est approximative.
function texteFin(fin, finMax) {
  const maintenant = Date.now();
  if (finMax && finMax < maintenant) return "passée (l'enchère est sans doute terminée)";
  const marge = finMax ? finMax - fin : 0;
  const quand = fin > maintenant ? `dans ${dureeLisible(fin - maintenant)}` : "imminente";
  const jour = new Date(fin).toDateString() === new Date(maintenant).toDateString() ? "" : new Date(fin).toLocaleDateString("fr-FR") + " ";
  return `${quand} (vers ${jour}${heureLisible(fin)}${marge > 2 * MINUTE ? `, à ${dureeLisible(marge)} près` : ""})`;
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

// --- Sur la liste du Marché : mettre à jour les enchères suivies et les marquer d'une cloche ---

let listeEncheresEnCours = false;
async function surveillerEncheresListe() {
  if (listeEncheresEnCours) return;
  const actif = reglages.encheres && pageActuelle() === "marche" && !REGEX_PAGE_ENCHERE.test(location.pathname);
  const blocs = document.querySelectorAll("[id^='marketplace-auction-']");
  if (!actif) {
    for (const bloc of document.querySelectorAll(".wmd-enchere-suivie")) bloc.classList.remove("wmd-enchere-suivie");
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
      if (statut && !encheresSuivies[id] && !encheresIgnorees[id] && reglages.enchereAuto) {
        if (!annonces) annonces = lireAnnoncesMarche(true);
        const annonce = annonces.find(a => a.cle === bloc.id);
        const titre = bloc.querySelector(CONFIG.selecteurNomCarte);
        await suivreEnchere(id, { nom: annonce ? annonce.nom : titre ? titre.textContent.trim() : null,
          rarete: annonce && annonce.rarete !== "inconnue" ? annonce.rarete : rareteDuCadre(bloc) !== "inconnue" ? rareteDuCadre(bloc) : null,
          prix: annonce && !annonce.depart ? annonce.prix : null }, { auto: true });
      }
      const memo = encheresSuivies[id];
      bloc.classList.toggle("wmd-enchere-suivie", Boolean(memo));
      if (!memo) continue;
      if (terminee) {
        await noterEnchereTerminee(id);
        bloc.dataset.wmdSuivie = "🔔 terminée";
        continue;
      }
      if (statut) await noterStatut(id, statut);
      const lue = lireFinDans(bloc);
      if (lue) await noterFinEnchere(id, lue.debut, lue.fin, "liste");
      const fin = encheresSuivies[id] && encheresSuivies[id].fin;
      const texte = fin ? `🔔 fin ${heureLisible(fin)}` : "🔔 suivie";
      if (bloc.dataset.wmdSuivie !== texte) bloc.dataset.wmdSuivie = texte;
    }
  } finally {
    listeEncheresEnCours = false;
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
    + ". Une enchère est suivie toute seule quand tu mises dessus, ou quand tu ouvres l'onglet « Mes enchères » du Marché. Repasse sur sa page (ou sur cet onglet) pour que l'heure de fin soit relue.", "wmd-discret"));
  zone.appendChild(bloc);

  const liste = Object.values(encheres).sort((a, b) => (a.fin || Infinity) - (b.fin || Infinity));
  if (liste.length === 0) {
    zone.appendChild(creer("p", "Aucune enchère suivie pour l'instant.", "wmd-discret"));
    afficherStatut("Aucune enchère suivie.");
    return;
  }
  const maintenant = Date.now();
  const tableau = creerTableau(["Carte", "Rar.", "Fin", ""], []);
  const corps = tableau.tBodies[0];
  for (const enchere of liste) {
    const rangee = corps.insertRow();
    if (enchere.rarete) rangee.className = `wmd-${enchere.rarete}`;
    const lien = creer("a", enchere.nom || "Enchère", "wmd-lien-carte");
    lien.href = adresseEnchere(enchere.id);
    lien.title = "Ouvrir la page de cette enchère";
    rangee.insertCell().appendChild(lien);
    rangee.insertCell().textContent = enchere.rarete ? lettreRarete(enchere.rarete) : "?";
    const finie = enchere.terminee || (enchere.finMax && enchere.finMax < maintenant);
    rangee.insertCell().textContent = (finie ? "terminée" : enchere.fin ? texteFin(enchere.fin, enchere.finMax) : "inconnue : ouvre l'enchère")
      + (!finie && enchere.statut ? ` · ${texteStatut(enchere.statut)}` : "");
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

creerPanneau();
boucle(() => {
  creerPanneau();
  actualiserPanneau();
}, 2000);

boucle(surlignerCartesAnimees, 1500); // les cadres dorés
boucle(surveillerPaquets, 5000);      // le stock de paquets
boucle(surveillerTotaux, 5000);       // les totaux de « Toutes les cartes »
boucle(releverMarche, MARCHE.releveMs); // nouveau en 1.4 : les mises actuelles du marché
boucle(afficherPrixDansFiche, 1000);    // nouveau en 1.4.2 : le prix estimé dans la fiche d'une carte
boucle(appliquerRechercheEnAttente, 1000); // nouveau en 1.4.4 : « Chercher au marché »
boucle(poursuivreChasse, 1000);           // nouveau en 1.5 : mes souhaits chez mes amis
boucle(marquerCartesEstimees, 2000);      // nouveau en 1.5.1 : le badge « $ » sur tes cartes estimées
boucle(lireCarteDePaquet, 700);           // nouveau en 1.6 : les cartes des paquets ouverts
boucle(marquerBonnesAffaires, 2000);      // nouveau en 1.6.1 : le cadre rouge des bonnes affaires
boucle(appliquerOuvertureCarte, 700);     // nouveau en 1.7.5 : ouvrir une carte depuis l'estimation
boucle(surveillerStop, 500);              // nouveau en 1.7.4 : Stop visible seulement pendant une tâche
boucle(releverPrixMoyen, 1500);           // nouveau en 1.7.2 : le prix moyen affiché par le site
boucle(afficherPrixSurEnchere, 1500);     // nouveau en 1.6.4 : l'estimation sur la page d'une enchère
boucle(appliquerEchangeEnAttente, 1000);  // nouveau en 1.5 : le bouton « Échanger » d'un résultat
boucle(surveillerEnchere, 1000);          // nouveau en 1.8 : la fin de l'enchère affichée et l'encart « 🔔 »
boucle(surveillerEncheresListe, 3000);    // nouveau en 1.8 : les enchères suivies sur la liste du Marché
boucle(apprendrePseudo, 2000);            // nouveau en 1.8 : ton pseudo, lu sur ta page Profil
boucle(marquerEtiquettes, 1500);          // 1.9 : le badge d'étiquette suggérée de chaque carte (Collection)
boucle(preparerFenetre, 700);             // 1.9 : l'étiquette écrite dans le champ de la carte ouverte
boucle(relireEtiquettesDuSite, 3000);     // 1.9 : tes étiquettes déjà créées sur le site
console.log("[WikiMasters Doublons] Extension chargée !");
