// =====================================================================
//  WikiMasters Doublons 1.3 - content.js
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

  pagesMaxManquantes: 300,  // au-delà, la recherche des cartes manquantes refuse de démarrer
  lecturesGardees: 30,      // nombre de lectures gardées dans l'historique
  nouvellesAffichees: 50,   // nombre maximum de nouvelles cartes listées dans le panneau
  limiteDiscord: 2000,      // un message Discord fait au plus 2 000 caractères

  pauseMs: 2000,        // pause entre deux pages (2000 ms = 2 secondes)
  attenteMaxMs: 5000    // temps maximum pour attendre qu'une page se charge
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
const MOTS_PAYANTS = ["$", "€", "recharg", "abonne", "achet", "payer"];

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
    for (const valeur of ligne.valeurs) rangee.insertCell().textContent = valeur;
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

lireReglages().then(lus => {
  reglages = lus;
  actualiserPanneau();
});
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
});


// ---------------------------------------------------------------------
//  PARTIE 4 : LE PANNEAU FLOTTANT
// ---------------------------------------------------------------------

function creerPanneau() {
  if (document.getElementById("wmd-panneau")) return; // il existe déjà

  const panneau = creer("div");
  panneau.id = "wmd-panneau";
  panneau.appendChild(creer("div", "WikiMasters Doublons", "wmd-titre"));

  // Crée un bouton et le branche sur sa fonction (comme un OnClick dans Unity).
  const ajouterBouton = (id, texte, action) => {
    const bouton = creer("button", texte);
    bouton.id = id;
    bouton.addEventListener("click", action);
    panneau.appendChild(bouton);
    return bouton;
  };
  ajouterBouton("wmd-reduire", "-", () => panneau.classList.toggle("wmd-reduit")).title = "Réduire / agrandir";
  ajouterBouton("wmd-stop", "Stop", () => arreter());
  ajouterBouton("wmd-doublons", "Trouver mes doublons", () => trouverMesDoublons());
  ajouterBouton("wmd-manquantes", "Trouver mes cartes manquantes", () => trouverMesCartesManquantes());
  ajouterBouton("wmd-csv", "Exporter en CSV (Excel)", () => exporterCSV());
  ajouterBouton("wmd-json", "Exporter en JSON (pour le C# ou un ami)", () => exporterJSON());
  ajouterBouton("wmd-discord", "Copier mes doublons pour Discord", () => copierDoublons());
  ajouterBouton("wmd-ami", "Comparer avec un ami (son fichier JSON)", () => choisirFichierAmi());
  ajouterBouton("wmd-reglages", "Réglages et notifications", () => {
    api.runtime.sendMessage({ type: "ouvrir-reglages" }).catch(() => {});
  });

  // Un sélecteur de fichier invisible, ouvert par le bouton « Comparer avec un ami ».
  const fichierAmi = creer("input");
  fichierAmi.type = "file";
  fichierAmi.id = "wmd-fichier-ami";
  fichierAmi.accept = ".json,application/json";
  fichierAmi.hidden = true;
  fichierAmi.addEventListener("change", () => {
    if (fichierAmi.files[0]) comparerAvecAmi(fichierAmi.files[0]);
    fichierAmi.value = ""; // pour pouvoir choisir deux fois le même fichier
  });

  const statut = creer("div", "Prêt.");
  statut.id = "wmd-statut";
  const echange = creer("div");
  echange.id = "wmd-echange";
  const resultats = creer("div");
  resultats.id = "wmd-resultats";
  panneau.append(fichierAmi, statut, echange, resultats);

  document.body.appendChild(panneau);
  actualiserPanneau();
}

// Nouveau en 1.3 : chaque bouton n'apparaît que sur la bonne page, et si sa fonction est activée.
function actualiserPanneau() {
  const page = pageActuelle();
  const visibles = {
    "wmd-doublons": page === "collection",
    "wmd-csv": page === "collection",
    "wmd-json": page === "collection",
    "wmd-discord": page === "collection" && reglages.echanges,
    "wmd-ami": page === "collection" && reglages.echanges,
    "wmd-manquantes": page === "toutes-les-cartes" && reglages.manquantes
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
async function lireCartesAffichees() {
  const cartes = [];
  for (const { cadre, imageRarete } of trouverCadresDeCartes()) {
    const nom = cadre.querySelector(CONFIG.selecteurNomCarte).textContent.trim();
    const trouve = imageRarete.getAttribute("src").match(/rarity\/([a-z_]+)\./);
    const rarete = trouve ? trouve[1] : "inconnue";
    cartes.push({ nom: nom, rarete: rarete, quantite: lireQuantite(cadre), animee: await estAnimee(cadre) });
  }
  return cartes;
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
async function estAnimee(cadre) {
  if (cadre.querySelector("video")) return true;
  for (const image of cadre.querySelectorAll("img")) {
    const adresse = image.currentSrc || image.getAttribute("src") || "";
    if (adresse.includes("/rarity/")) continue; // l'image de rareté ne compte pas
    if (CONFIG.regexImageGif.test(cheminImage(adresse))) {
      return imageBouge(new URL(adresse, location.href).href);
    }
  }
  return false;
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
async function telechargerEtCompter(adresse) {
  try {
    const reponse = await fetch(adresse); // souvent instantané : le navigateur a déjà l'image en cache
    if (!reponse.ok) return null;
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
    console.warn("[WikiMasters Doublons] Impossible de vérifier l'image", adresse, erreur);
    return null;
  }
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
      if (bouge === null) return false; // pas pu vérifier : on réessaiera plus tard
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
      cadre.classList.toggle("wmd-carte-animee", animee);
    }
  } finally {
    surlignageEnCours = false;
  }
}


// ---------------------------------------------------------------------
//  PARTIE 6 : PARCOURIR TOUTES LES PAGES D'UNE LISTE (et le bouton Stop)
// ---------------------------------------------------------------------

let enCours = false; // vrai pendant une lecture page par page

function arreter() {
  enCours = false;
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

// Clique sur "Suivant" ou "Précédent", puis attend que la nouvelle page soit affichée :
// le numéro de page a changé ET les cartes aussi. Renvoie false si ça n'arrive pas à temps.
async function changerDePage(texteBouton) {
  const avant = lirePagination();
  const signatureAvant = signaturePage();
  const bouton = trouverBoutonParTexte(texteBouton);
  if (!avant || !bouton) return false; // pas de pagination, ou bouton grisé
  bouton.click();

  const debut = Date.now();
  while (Date.now() - debut < CONFIG.attenteMaxMs) {
    await pause(250);
    const apres = lirePagination();
    const signatureApres = signaturePage();
    if (apres && apres.actuelle !== avant.actuelle && signatureApres !== "" && signatureApres !== signatureAvant) {
      return true;
    }
  }
  return false;
}

// Nouveau en 1.3 : la boucle de lecture, partagée par « doublons » et « cartes manquantes ».
// Revient à la page 1, lit chaque page jusqu'à la dernière, et renvoie { cartes, message }.
// "message" est vide si tout a été lu, sinon il explique pourquoi la lecture est partielle.
async function lireToutesLesPages() {
  const cartes = [];
  let message = "";

  // 1) Revenir à la page 1 si besoin.
  let page = lirePagination();
  while (enCours && page && page.actuelle > 1) {
    afficherStatut(`Retour à la page 1 (page ${page.actuelle})…`);
    if (!(await changerDePage(CONFIG.texteBoutonPagePrecedente))) break;
    page = lirePagination();
  }
  if (enCours && page && page.actuelle > 1) message = "Impossible de revenir à la page 1 : résultats partiels.";

  // Le site affiche parfois les cartes un peu après le reste de la page : on les attend.
  const debut = Date.now();
  while (enCours && signaturePage() === "" && Date.now() - debut < CONFIG.attenteMaxMs) {
    await pause(250);
  }

  // 2) Lire chaque page, puis passer à la suivante, jusqu'à la dernière.
  while (enCours) {
    page = lirePagination();
    if (!page) {
      message = "Pagination introuvable : résultats partiels.";
      break;
    }
    cartes.push(...(await lireCartesAffichees()));
    afficherStatut(`Page ${page.actuelle} / ${page.total} lue : ${cartes.length} cartes.`);
    if (page.actuelle >= page.total) break; // dernière page : c'est fini
    await pause(CONFIG.pauseMs);            // on laisse respirer le site entre deux pages
    if (!(await changerDePage(CONFIG.texteBoutonPageSuivante))) {
      message = "La page suivante n'a pas répondu à temps : résultats partiels.";
      break;
    }
  }
  if (!enCours) message = "Arrêté avant la fin : résultats partiels.";
  enCours = false;
  return { cartes: cartes, message: message };
}


// ---------------------------------------------------------------------
//  PARTIE 7 : LIRE TOUTE LA COLLECTION ET TROUVER LES DOUBLONS
// ---------------------------------------------------------------------

let derniereCollection = [];  // les cartes lues lors du dernier scan
let modeTri = "quantite";     // "quantite", "rarete", "nom" ou "animee"
let afficherTout = false;     // false = seulement les doublons
let seulementAnimees = false; // true = seulement les cartes animées

async function trouverMesDoublons() {
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
  const filtre = filtreActif(); // on regarde AVANT de changer de page

  const { cartes, message } = await lireToutesLesPages();
  derniereCollection = cartes;
  if (cartes.length === 0) {
    afficherStatut("Aucune carte trouvée. Es-tu bien sur la page de ta collection ?");
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

async function trouverMesCartesManquantes() {
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
  if (page.total > CONFIG.pagesMaxManquantes) {
    afficherStatut(`Cette liste fait ${nombreLisible(page.total)} pages : choisis d'abord une rareté `
      + `avec les filtres du site (L ou UR), puis reclique.`);
    return;
  }

  enCours = true;
  const { cartes, message } = await lireToutesLesPages();
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
//  PARTIE 14 : DÉMARRAGE (tout ce qui tourne en boucle)
// ---------------------------------------------------------------------

// Le panneau : créé tout de suite, puis vérifié toutes les 2 secondes
// (le site peut l'effacer, et ses boutons changent selon la page).
creerPanneau();
setInterval(() => {
  creerPanneau();
  actualiserPanneau();
}, 2000);

setInterval(surlignerCartesAnimees, 1500); // les cadres dorés
setInterval(surveillerPaquets, 5000);      // le stock de paquets
setInterval(surveillerTotaux, 5000);       // les totaux de « Toutes les cartes »
console.log("[WikiMasters Doublons] Extension chargée !");
