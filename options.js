// =====================================================================
//  WikiMasters Doublons 1.3 - options.js
//  La page des réglages : elle lit et enregistre les réglages dans la
//  mémoire de l'extension (api.storage.local). commun.js est chargé avant
//  ce fichier : il fournit api, REGLAGES_PAR_DEFAUT, lireReglages...
// =====================================================================

// Vrai seulement dans Firefox (cette fonction n'existe pas dans Chrome).
const estFirefox = typeof globalThis.browser !== "undefined" && typeof browser.runtime.getBrowserInfo === "function";

// Les cases à cocher : leur id dans la page est le nom du réglage.
const CASES = ["surlignerAnimees", "statistiques", "historique", "manquantes", "echanges", "badge",
  "notifPC", "notifTel", "alerteAvant"];
const champs = {};
for (const nom of [...CASES, "canalNtfy", "minutesParPaquet", "alerteA"]) {
  champs[nom] = document.getElementById(nom);
}


// ---------------------------------------------------------------------
//  1) Afficher et enregistrer les réglages
// ---------------------------------------------------------------------

async function afficherReglages() {
  const r = await lireReglages();
  for (const nom of CASES) champs[nom].checked = r[nom];
  champs.canalNtfy.value = r.canalNtfy;
  champs.minutesParPaquet.value = String(r.minutesParPaquet);
  champs.alerteA.value = String(r.alerteA);
  actualiserBlocs(r);
}

// Cache ce qui ne sert à rien : le bloc ntfy si le téléphone est décoché, etc.
function actualiserBlocs(r) {
  document.getElementById("bloc-telephone").hidden = !r.notifTel;
  document.getElementById("bloc-historique").hidden = !r.historique;
  champs.alerteA.disabled = !r.alerteAvant;
}

// À chaque changement : on enregistre (background.js reprogramme tout seul).
async function enregistrer() {
  const reglages = {};
  for (const nom of CASES) reglages[nom] = champs[nom].checked;
  reglages.canalNtfy = champs.canalNtfy.value.trim();
  reglages.minutesParPaquet = parseInt(champs.minutesParPaquet.value, 10);
  // Le seuil de l'alerte : un nombre entier entre 1 et 9 (sinon on garde 8).
  const seuil = parseInt(champs.alerteA.value, 10);
  reglages.alerteA = seuil >= 1 && seuil <= 9 ? seuil : REGLAGES_PAR_DEFAUT.alerteA;
  champs.alerteA.value = String(reglages.alerteA);
  actualiserBlocs(reglages);
  await api.storage.local.set({ reglages: reglages });
}

for (const nom of CASES) {
  if (nom !== "notifTel") champs[nom].addEventListener("change", enregistrer);
}
champs.canalNtfy.addEventListener("change", enregistrer);
champs.minutesParPaquet.addEventListener("change", enregistrer);
champs.alerteA.addEventListener("change", enregistrer);

champs.notifTel.addEventListener("change", () => {
  // Dans Firefox, il faut ton accord pour envoyer des données hors du navigateur (vers ntfy.sh).
  // La demande doit partir tout de suite, pendant le clic : c'est une règle de Firefox.
  if (champs.notifTel.checked && estFirefox) {
    browser.permissions.request({ data_collection: ["websiteContent"] }).then(accorde => {
      if (!accorde) champs.notifTel.checked = false; // refusé : on décoche
      enregistrer();
    });
    return;
  }
  enregistrer();
});


// ---------------------------------------------------------------------
//  2) Le canal ntfy et le bouton de test
// ---------------------------------------------------------------------

// Le bouton qui fabrique un nom de canal au hasard.
document.getElementById("generer").addEventListener("click", () => {
  const lettres = "abcdefghijkmnpqrstuvwxyz23456789";
  const hasard = crypto.getRandomValues(new Uint8Array(12));
  champs.canalNtfy.value = "wikimasters-" + Array.from(hasard, octet => lettres[octet % lettres.length]).join("");
  enregistrer();
});

// Le bouton de test : background.js envoie, puis nous dit si ça a marché.
document.getElementById("tester").addEventListener("click", async () => {
  const zone = document.getElementById("resultat-test");
  await enregistrer();
  zone.textContent = "Envoi en cours…";
  const resultat = await api.runtime.sendMessage({ type: "tester" });
  const phrases = [];
  if (resultat.permission === "denied") {
    phrases.push("PC : les notifications de l'extension sont bloquées dans le navigateur.");
  } else if (resultat.pc === true) {
    phrases.push("PC : notification envoyée à Windows. Tu ne la vois pas ? Ouvre l'aide juste en dessous.");
  } else if (resultat.pc === false) {
    phrases.push("PC : échec (vérifie que les notifications du navigateur sont autorisées).");
  } else {
    phrases.push("PC : case « Sur ce PC » non cochée.");
  }
  if (resultat.telephone === true) phrases.push("Téléphone : message envoyé à ntfy, regarde ton téléphone.");
  if (resultat.telephone === false) phrases.push("Téléphone : échec (vérifie le nom du canal et ta connexion).");
  zone.textContent = phrases.join(" ");
});


// ---------------------------------------------------------------------
//  3) Le stock de paquets et les prochaines notifications, en direct
// ---------------------------------------------------------------------

async function afficherEtat() {
  const { paquets } = await api.storage.local.get("paquets");
  const reglages = await lireReglages();
  const zone = document.getElementById("etat");
  const estimation = document.getElementById("estimation");
  if (!paquets) {
    zone.textContent = "inconnu (passe sur la page Paquets du site)";
    estimation.textContent = "inconnu";
    return;
  }
  const heure = heureLisible(paquets.pleinA);
  zone.textContent = paquets.pleinA > Date.now() ? heure : `déjà atteint (à ${heure})`;
  const nombre = paquetsEstimes(paquets, reglages.minutesParPaquet, Date.now());
  estimation.textContent = `environ ${nombre} paquet(s) sur ${paquets.max}`;
}

// L'heure des prochaines notifications sur ce PC (les alarmes du navigateur).
async function afficherEtatPC() {
  const alarmes = await api.alarms.getAll();
  const textes = [];
  for (const [nom, quoi] of [["paquets-alerte", "alerte"], ["paquets-pleins", "stock plein"]]) {
    const alarme = alarmes.find(a => a.name === nom);
    if (alarme) textes.push(`${heureLisible(alarme.scheduledTime)} (${quoi})`);
  }
  document.getElementById("etat-pc").textContent = textes.length
    ? textes.join(", puis ")
    : "aucune (case non cochée, ou heure du stock plein inconnue)";
}


// ---------------------------------------------------------------------
//  4) Ce que l'extension garde en mémoire
// ---------------------------------------------------------------------

async function afficherMemoire() {
  const { collection, catalogue, historique = [] } = await api.storage.local.get(["collection", "catalogue", "historique"]);
  document.getElementById("memoire-collection").textContent = collection
    ? `le ${dateLisible(collection.date)}, ${nombreLisible(collection.cartes.length)} cartes différentes`
    : "aucune";
  document.getElementById("memoire-catalogue").textContent = catalogue
    ? `le ${dateLisible(catalogue.lu)} (${nombreLisible(catalogue.totaux.legendaire)} légendaires, `
      + `${nombreLisible(catalogue.totaux.ultra_rare)} ultra rares…)`
    : "jamais lus";

  // Le tableau de l'historique, de la lecture la plus récente à la plus ancienne.
  const corps = document.querySelector("#tableau-historique tbody");
  corps.replaceChildren();
  for (const lecture of [...historique].reverse()) {
    const ligne = corps.insertRow();
    const valeurs = [dateLisible(lecture.date), nombreLisible(lecture.exemplaires), nombreLisible(lecture.differentes),
      nombreLisible(lecture.doublons), nombreLisible(lecture.animees), lecture.nouvelles === null ? "—" : "+" + lecture.nouvelles];
    for (const valeur of valeurs) ligne.insertCell().textContent = valeur;
  }
  document.getElementById("tableau-historique").hidden = historique.length === 0;
  document.getElementById("historique-vide").hidden = historique.length > 0;
}

// Effacer demande deux clics (pas de fenêtre « Êtes-vous sûr ? »).
const boutonEffacer = document.getElementById("effacer");
let confirmation = false;
boutonEffacer.addEventListener("click", async () => {
  if (!confirmation) {
    confirmation = true;
    boutonEffacer.textContent = "Clique encore pour confirmer";
    setTimeout(() => {
      confirmation = false;
      boutonEffacer.textContent = "Effacer l'historique et la dernière lecture";
    }, 4000);
    return;
  }
  await api.storage.local.remove(["collection", "historique", "animations"]);
  confirmation = false;
  boutonEffacer.textContent = "Effacé !";
});


// ---------------------------------------------------------------------
//  5) Démarrage, puis mise à jour en direct
// ---------------------------------------------------------------------

api.storage.onChanged.addListener(changements => {
  if (changements.paquets || changements.reglages) afficherEtat();
  if (changements.collection || changements.catalogue || changements.historique) afficherMemoire();
  setTimeout(afficherEtatPC, 500); // le temps que background.js reprogramme les alarmes
});
setInterval(afficherEtat, 30 * 1000); // l'estimation change avec le temps

afficherReglages();
afficherEtat();
afficherEtatPC();
afficherMemoire();
