// =====================================================================
//  WikiMasters Doublons 1.1 - content.js
//  Le navigateur injecte ce script dans chaque page de wiki-masters.com.
//  Nouveau en 1.1 : cartes animées mises en valeur, et surveillance du
//  stock de paquets pour les notifications (voir background.js).
// =====================================================================

// Chrome appelle ses outils « chrome », Firefox les appelle « browser » : on prend celui qui existe.
const api = globalThis.browser ?? globalThis.chrome;


// ---------------------------------------------------------------------
//  PARTIE 1 : LES RÉGLAGES (relevés sur ton compte, voir étape 3)
// ---------------------------------------------------------------------
const CONFIG = {
  // Où se trouve le nom d'une carte : un titre h3.
  selecteurNomCarte: "h3",

  // Badge de quantité du genre "x3" : le site n'en affiche pas aujourd'hui
  // (chaque exemplaire est une carte à part). On garde le motif au cas où.
  regexQuantite: /^[x×]\s?(\d+)$/i,

  // Une carte « animée » a une image GIF (son adresse se termine par .gif).
  regexImageAnimee: /\.gif$/i,

  // La collection est découpée en pages de 50 cartes : textes des boutons de pagination.
  texteBoutonPageSuivante: "Suivant",
  texteBoutonPagePrecedente: "Précédent",

  // Un nouveau paquet arrive toutes les 10 minutes (3 minutes avec WikiMasters PRO).
  minutesParPaquet: 10,

  pauseMs: 2000,        // pause entre deux pages (2000 ms = 2 secondes)
  attenteMaxMs: 5000    // temps maximum pour attendre qu'une page se charge
};

// Les 6 raretés du jeu : le nom utilisé dans les images, la lettre affichée, et un ordre de tri.
const RARETES = {
  commun:     { lettre: "C",  ordre: 1 },
  peu_commun: { lettre: "PC", ordre: 2 },
  rare:       { lettre: "R",  ordre: 3 },
  super_rare: { lettre: "SR", ordre: 4 },
  ultra_rare: { lettre: "UR", ordre: 5 },
  legendaire: { lettre: "L",  ordre: 6 }
};


// ---------------------------------------------------------------------
//  PARTIE 2 : LA BOÎTE À OUTILS (petites fonctions réutilisables)
// ---------------------------------------------------------------------

// Attendre un certain temps. S'utilise avec "await" : await pause(2000);
function pause(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

function lettreRarete(rarete) {
  return RARETES[rarete] ? RARETES[rarete].lettre : "?";
}

function ordreRarete(rarete) {
  return RARETES[rarete] ? RARETES[rarete].ordre : 0;
}


// ---------------------------------------------------------------------
//  PARTIE 3 : LE PANNEAU FLOTTANT
// ---------------------------------------------------------------------

function creerPanneau() {
  if (document.getElementById("wmd-panneau")) return; // il existe déjà

  // On construit le panneau élément par élément (sans innerHTML, comme le demande Mozilla).
  const panneau = document.createElement("div");
  panneau.id = "wmd-panneau";

  const titre = document.createElement("div");
  titre.className = "wmd-titre";
  titre.textContent = "WikiMasters Doublons";
  panneau.appendChild(titre);

  // Crée un bouton et le branche sur sa fonction (comme un OnClick dans Unity).
  const ajouterBouton = (id, texte, action) => {
    const bouton = document.createElement("button");
    bouton.id = id;
    bouton.textContent = texte;
    bouton.addEventListener("click", action);
    panneau.appendChild(bouton);
    return bouton;
  };
  ajouterBouton("wmd-reduire", "-", () => panneau.classList.toggle("wmd-reduit")).title = "Réduire / agrandir";
  ajouterBouton("wmd-stop", "Stop", () => arreter());
  ajouterBouton("wmd-doublons", "Trouver mes doublons", () => trouverMesDoublons());
  ajouterBouton("wmd-csv", "Exporter en CSV (Excel)", () => exporterCSV());
  ajouterBouton("wmd-json", "Exporter en JSON (pour le C#)", () => exporterJSON());
  // Nouveau : ouvre la page des réglages (notifications, cartes animées).
  ajouterBouton("wmd-reglages", "Réglages et notifications", () => {
    api.runtime.sendMessage({ type: "ouvrir-reglages" }).catch(() => {});
  });

  const statut = document.createElement("div");
  statut.id = "wmd-statut";
  statut.textContent = "Prêt.";
  const resultats = document.createElement("div");
  resultats.id = "wmd-resultats";
  panneau.append(statut, resultats);

  document.body.appendChild(panneau);
}

// Écrit un message dans le panneau ET dans la console (F12).
function afficherStatut(texte) {
  const zone = document.getElementById("wmd-statut");
  if (zone) zone.textContent = texte;
  console.log("[WikiMasters Doublons]", texte);
}

// Démarrage : on crée le panneau, puis on vérifie toutes les 2 secondes
// qu'il est toujours là (le site peut l'effacer en changeant de page).
creerPanneau();
setInterval(creerPanneau, 2000);
console.log("[WikiMasters Doublons] Extension chargée !");


// ---------------------------------------------------------------------
//  PARTIE 4 : LIRE LES CARTES AFFICHÉES À L'ÉCRAN
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
function lireCartesAffichees() {
  const cartes = [];
  for (const { cadre, imageRarete } of trouverCadresDeCartes()) {
    const nom = cadre.querySelector(CONFIG.selecteurNomCarte).textContent.trim();
    const trouve = imageRarete.getAttribute("src").match(/rarity\/([a-z_]+)\./);
    const rarete = trouve ? trouve[1] : "inconnue";
    cartes.push({ nom: nom, rarete: rarete, quantite: lireQuantite(cadre), animee: estAnimee(cadre) });
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

// Nouveau : vrai si l'image de la carte bouge (une image GIF, ou une vidéo).
function estAnimee(cadre) {
  if (cadre.querySelector("video")) return true;
  for (const image of cadre.querySelectorAll("img")) {
    const adresse = image.currentSrc || image.getAttribute("src") || "";
    if (adresse.includes("/rarity/")) continue; // l'image de rareté ne compte pas
    if (CONFIG.regexImageAnimee.test(cheminImage(adresse))) return true;
  }
  return false;
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

// Nouveau : entoure d'un cadre doré les cartes animées affichées sur la page.
let surlignerAnimees = true; // réglage modifiable dans la page des réglages
function surlignerCartesAnimees() {
  for (const { cadre } of trouverCadresDeCartes()) {
    cadre.classList.toggle("wmd-carte-animee", surlignerAnimees && estAnimee(cadre));
  }
}
api.storage.local.get("reglages").then(({ reglages }) => {
  surlignerAnimees = !reglages || reglages.surlignerAnimees !== false;
});
api.storage.onChanged.addListener(changements => {
  if (changements.reglages) {
    const reglages = changements.reglages.newValue;
    surlignerAnimees = !reglages || reglages.surlignerAnimees !== false;
  }
});
setInterval(surlignerCartesAnimees, 1500);


// ---------------------------------------------------------------------
//  PARTIE 5 : LE BOUTON STOP
// ---------------------------------------------------------------------

let enCours = false;          // vrai pendant la lecture de la collection

function arreter() {
  enCours = false;
  afficherStatut("Arrêt demandé…");
}


// ---------------------------------------------------------------------
//  PARTIE 6 : LIRE TOUTE LA COLLECTION ET TROUVER LES DOUBLONS
// ---------------------------------------------------------------------

let derniereCollection = [];  // les cartes lues lors du dernier scan
let modeTri = "quantite";     // "quantite", "rarete", "nom" ou "animee"
let afficherTout = false;     // false = seulement les doublons
let seulementAnimees = false; // true = seulement les cartes animées

// Lit l'indicateur "Page 3 / 280" de la collection.
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
// (Nouveau en 1.1 : avant, on ne comparait que la première carte, ce qui coinçait si deux pages commençaient pareil.)
function signaturePage() {
  return lireCartesAffichees().map(carte => carte.nom).join("|");
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

async function trouverMesDoublons() {
  if (enCours) return; // une autre tâche est déjà en cours
  if (!lirePagination()) {
    afficherStatut("Va d'abord sur la page Collection.");
    return;
  }
  enCours = true;
  derniereCollection = [];
  let message = "";

  // 1) Revenir à la page 1 si besoin.
  let page = lirePagination();
  while (enCours && page && page.actuelle > 1) {
    afficherStatut(`Retour à la page 1 (page ${page.actuelle})…`);
    if (!(await changerDePage(CONFIG.texteBoutonPagePrecedente))) break;
    page = lirePagination();
  }

  // 2) Lire chaque page, puis passer à la suivante, jusqu'à la dernière.
  while (enCours) {
    page = lirePagination();
    if (!page) {
      message = "Pagination introuvable : résultats partiels.";
      break;
    }
    derniereCollection = derniereCollection.concat(lireCartesAffichees());
    afficherStatut(`Page ${page.actuelle} / ${page.total} lue : ${derniereCollection.length} cartes.`);
    if (page.actuelle >= page.total) break; // dernière page : c'est fini
    await pause(CONFIG.pauseMs);            // on laisse respirer le site entre deux pages
    if (!(await changerDePage(CONFIG.texteBoutonPageSuivante))) {
      message = "La page suivante n'a pas répondu à temps : résultats partiels.";
      break;
    }
  }
  if (!enCours) message = "Arrêté avant la fin : résultats partiels.";
  enCours = false;

  if (derniereCollection.length === 0) {
    afficherStatut("Aucune carte trouvée. Es-tu bien sur la page de ta collection ?");
    return;
  }
  afficherTableau();
  if (message) afficherStatut(message);
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
  const etiquette = document.createElement("label");
  const caseACocher = document.createElement("input");
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

  let liste = afficherTout ? toutes : doublons;
  if (seulementAnimees) liste = liste.filter(c => c.animee);
  trierCartes(liste, modeTri);

  // On construit le résultat élément par élément (sans innerHTML, comme le demande Mozilla).
  const zone = document.getElementById("wmd-resultats");
  zone.replaceChildren(); // vide la zone

  const resume = document.createElement("p");
  resume.textContent = `${toutes.length} cartes différentes, ${doublons.length} en double ou plus, `
    + `${enTrop} exemplaire(s) en trop à échanger, ${animees.length} carte(s) animée(s).`;

  // Les deux cases à cocher : toute la collection, et seulement les cartes animées.
  const caseTout = creerCaseACocher("wmd-tout", "Afficher toute la collection", afficherTout, coche => {
    afficherTout = coche;
    afficherTableau();
  });
  const caseAnimees = creerCaseACocher("wmd-animees", "Seulement les cartes animées", seulementAnimees, coche => {
    seulementAnimees = coche;
    afficherTableau();
  });

  // Le tableau : cliquer sur un titre de colonne change le tri.
  const tableau = document.createElement("table");
  const ligneTitres = tableau.createTHead().insertRow();
  const colonnes = [["Carte", "nom"], ["Rareté", "rarete"], ["Qté", "quantite"], ["En trop", null], ["Animée", "animee"]];
  for (const [texte, tri] of colonnes) {
    const titre = document.createElement("th");
    titre.textContent = texte;
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

  zone.append(resume, caseTout, document.createElement("br"), caseAnimees, tableau);

  afficherStatut(`Collection lue : ${derniereCollection.length} carte(s) au total.`);
}


// ---------------------------------------------------------------------
//  PARTIE 7 : EXPORTER (CSV pour Excel, JSON pour le programme C#)
// ---------------------------------------------------------------------

function telechargerFichier(nomFichier, contenu, typeFichier) {
  const blob = new Blob([contenu], { type: typeFichier });
  const adresse = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = adresse;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(adresse), 1000);
}

function verifierCollectionLue() {
  if (derniereCollection.length === 0) {
    afficherStatut("Clique d'abord sur « Trouver mes doublons ».");
    return false;
  }
  return true;
}

function exporterCSV() {
  if (!verifierCollectionLue()) return;
  const liste = regrouperParNom(derniereCollection);
  trierCartes(liste, modeTri);
  const champ = texte => `"${String(texte).replace(/"/g, '""')}"`;
  const lignes = ["Carte;Rareté;Quantité;En trop;Animée"];
  for (const carte of liste) {
    lignes.push(`${champ(carte.nom)};${lettreRarete(carte.rarete)};${carte.quantite};${carte.quantite - 1};${carte.animee ? "oui" : "non"}`);
  }
  // Un caractère invisible (le n° 0xFEFF) placé au début permet à Excel d'afficher correctement les accents.
  const marqueExcel = String.fromCharCode(0xFEFF);
  telechargerFichier("collection-wikimasters.csv", marqueExcel + lignes.join("\r\n"), "text/csv;charset=utf-8");
  afficherStatut("Fichier CSV téléchargé.");
}

function exporterJSON() {
  if (!verifierCollectionLue()) return;
  const liste = regrouperParNom(derniereCollection);
  telechargerFichier("collection-wikimasters.json", JSON.stringify(liste, null, 2), "application/json");
  afficherStatut("Fichier JSON téléchargé.");
}


// ---------------------------------------------------------------------
//  PARTIE 8 : SURVEILLER LE STOCK DE PAQUETS (pour les notifications)
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
// Renvoie null si le stock est déjà plein, et undefined si on ne peut pas encore le savoir.
function heureStockPlein(lecture) {
  if (lecture.stock >= lecture.max) return null;
  if (lecture.secondes === null) return undefined;
  const paquetsManquants = lecture.max - lecture.stock;
  // Le prochain paquet arrive dans "secondes", puis un paquet toutes les 10 minutes.
  return Date.now() + lecture.secondes * 1000 + (paquetsManquants - 1) * CONFIG.minutesParPaquet * 60 * 1000;
}

// Toutes les 5 secondes : si l'heure du stock plein a changé, on prévient background.js.
let dernierPleinA; // undefined = rien envoyé pour l'instant
function surveillerPaquets() {
  const lecture = lireStockPaquets();
  if (!lecture) return; // on n'est pas sur la page Paquets (ou un paquet est en cours d'ouverture)
  const pleinA = heureStockPlein(lecture);
  if (pleinA === undefined) return;

  const aChange = dernierPleinA === undefined
    || (pleinA === null) !== (dernierPleinA === null)
    || (pleinA !== null && Math.abs(pleinA - dernierPleinA) > 60 * 1000); // plus d'une minute d'écart
  if (!aChange) return;

  dernierPleinA = pleinA;
  api.runtime.sendMessage({ type: "etat-paquets", pleinA: pleinA }).catch(() => {});
}
setInterval(surveillerPaquets, 5000);
