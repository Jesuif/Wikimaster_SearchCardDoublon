// =====================================================================
//  WikiMasters Doublons - content.js
//  Chrome injecte ce script dans chaque page de wiki-masters.com.
// =====================================================================


// ---------------------------------------------------------------------
//  PARTIE 1 : LES RÉGLAGES (relevés sur ton compte, voir étape 3)
// ---------------------------------------------------------------------
const CONFIG = {
  // Où se trouve le nom d'une carte : un titre h3.
  selecteurNomCarte: "h3",

  // Badge de quantité du genre "x3" : le site n'en affiche pas aujourd'hui
  // (chaque exemplaire est une carte à part). On garde le motif au cas où.
  regexQuantite: /^[x×]\s?(\d+)$/i,

  // La collection est découpée en pages de 50 cartes : textes des boutons de pagination.
  texteBoutonPageSuivante: "Suivant",
  texteBoutonPagePrecedente: "Précédent",

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

// Comme trouverBoutonParTexte, mais attend que le bouton apparaisse (au maximum CONFIG.attenteMaxMs).
async function attendreBouton(texte) {
  if (!texte) return null;
  const debut = Date.now();
  while (Date.now() - debut < CONFIG.attenteMaxMs) {
    const bouton = trouverBoutonParTexte(texte);
    if (bouton) return bouton;
    await pause(250);
  }
  return null;
}

// Rend un texte sans danger avant de l'insérer dans du HTML.
function echapper(texte) {
  const remplacements = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(texte).replace(/[&<>"']/g, caractere => remplacements[caractere]);
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

  const panneau = document.createElement("div");
  panneau.id = "wmd-panneau";
  panneau.innerHTML = `
    <div class="wmd-titre">WikiMasters Doublons</div>
    <button id="wmd-reduire" title="Réduire / agrandir">-</button>
    <button id="wmd-stop">Stop</button>
    <button id="wmd-doublons">Trouver mes doublons</button>
    <button id="wmd-csv">Exporter en CSV (Excel)</button>
    <button id="wmd-json">Exporter en JSON (pour le C#)</button>
    <div id="wmd-statut">Prêt.</div>
    <div id="wmd-resultats"></div>
  `;
  document.body.appendChild(panneau);

  // On branche chaque bouton sur sa fonction (comme un OnClick dans Unity).
  document.getElementById("wmd-reduire").addEventListener("click", () => panneau.classList.toggle("wmd-reduit"));
  document.getElementById("wmd-stop").addEventListener("click", () => arreter());
  document.getElementById("wmd-doublons").addEventListener("click", () => trouverMesDoublons());
  document.getElementById("wmd-csv").addEventListener("click", () => exporterCSV());
  document.getElementById("wmd-json").addEventListener("click", () => exporterJSON());
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

// Renvoie la liste des cartes visibles : [{ nom, rarete, quantite }, ...]
function lireCartesAffichees() {
  const cartes = [];
  // Chaque carte du site contient une image de rareté dont l'adresse contient "/rarity/".
  const imagesRarete = document.querySelectorAll('img[src*="/rarity/"]');

  for (const image of imagesRarete) {
    if (estDansLePanneau(image)) continue;

    // On remonte les parents jusqu'au "cadre" de la carte :
    // le premier parent qui contient aussi le nom de la carte.
    let cadre = image.parentElement;
    while (cadre && !cadre.querySelector(CONFIG.selecteurNomCarte)) {
      cadre = cadre.parentElement;
    }
    if (!cadre) continue;

    const nom = cadre.querySelector(CONFIG.selecteurNomCarte).textContent.trim();
    const trouve = image.getAttribute("src").match(/rarity\/([a-z_]+)\./);
    const rarete = trouve ? trouve[1] : "inconnue";
    const quantite = lireQuantite(cadre);

    cartes.push({ nom: nom, rarete: rarete, quantite: quantite });
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
let modeTri = "quantite";     // "quantite", "rarete" ou "nom"
let afficherTout = false;     // false = seulement les doublons

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

// Le nom de la première carte affichée (sert à savoir quand la nouvelle page est arrivée).
function premierNomAffiche() {
  const cartes = lireCartesAffichees();
  return cartes.length > 0 ? cartes[0].nom : "";
}

// Clique sur "Suivant" ou "Précédent", puis attend que la nouvelle page soit affichée :
// le numéro de page a changé ET les cartes aussi. Renvoie false si ça n'arrive pas à temps.
async function changerDePage(texteBouton) {
  const avant = lirePagination();
  const nomAvant = premierNomAffiche();
  const bouton = trouverBoutonParTexte(texteBouton);
  if (!avant || !bouton) return false; // pas de pagination, ou bouton grisé
  bouton.click();

  const debut = Date.now();
  while (Date.now() - debut < CONFIG.attenteMaxMs) {
    await pause(250);
    const apres = lirePagination();
    const nomApres = premierNomAffiche();
    if (apres && apres.actuelle !== avant.actuelle && nomApres !== "" && nomApres !== nomAvant) {
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
      parNom.get(carte.nom).quantite += carte.quantite;
    } else {
      parNom.set(carte.nom, { nom: carte.nom, rarete: carte.rarete, quantite: carte.quantite });
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
    // par défaut : la plus grande quantité d'abord, puis la plus rare, puis par nom
    return b.quantite - a.quantite
      || ordreRarete(b.rarete) - ordreRarete(a.rarete)
      || a.nom.localeCompare(b.nom, "fr");
  });
}

function afficherTableau() {
  const toutes = regrouperParNom(derniereCollection);
  const doublons = toutes.filter(c => c.quantite >= 2);
  const enTrop = doublons.reduce((total, c) => total + (c.quantite - 1), 0);

  const liste = afficherTout ? toutes : doublons;
  trierCartes(liste, modeTri);

  let html = `<p>${toutes.length} cartes différentes, ${doublons.length} en double ou plus,
    ${enTrop} exemplaire(s) en trop à échanger.</p>
    <label><input type="checkbox" id="wmd-tout" ${afficherTout ? "checked" : ""}> Afficher toute la collection</label>
    <table>
      <thead><tr>
        <th data-tri="nom">Carte</th>
        <th data-tri="rarete">Rareté</th>
        <th data-tri="quantite">Qté</th>
        <th>En trop</th>
      </tr></thead>
      <tbody>`;
  for (const carte of liste) {
    html += `<tr class="wmd-${carte.rarete}">
      <td>${echapper(carte.nom)}</td>
      <td>${lettreRarete(carte.rarete)}</td>
      <td>${carte.quantite}</td>
      <td>${carte.quantite - 1}</td>
    </tr>`;
  }
  html += "</tbody></table>";

  const zone = document.getElementById("wmd-resultats");
  zone.innerHTML = html;

  // Cliquer sur un titre de colonne change le tri.
  for (const titre of zone.querySelectorAll("th[data-tri]")) {
    titre.addEventListener("click", () => {
      modeTri = titre.dataset.tri;
      afficherTableau();
    });
  }
  // La case à cocher affiche tout ou seulement les doublons.
  document.getElementById("wmd-tout").addEventListener("change", evenement => {
    afficherTout = evenement.target.checked;
    afficherTableau();
  });

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
  const lignes = ["Carte;Rareté;Quantité;En trop"];
  for (const carte of liste) {
    lignes.push(`${champ(carte.nom)};${lettreRarete(carte.rarete)};${carte.quantite};${carte.quantite - 1}`);
  }
  // "﻿" au début permet à Excel d'afficher correctement les accents.
  telechargerFichier("collection-wikimasters.csv", "﻿" + lignes.join("\r\n"), "text/csv;charset=utf-8");
  afficherStatut("Fichier CSV téléchargé.");
}

function exporterJSON() {
  if (!verifierCollectionLue()) return;
  const liste = regrouperParNom(derniereCollection);
  telechargerFichier("collection-wikimasters.json", JSON.stringify(liste, null, 2), "application/json");
  afficherStatut("Fichier JSON téléchargé.");
}
