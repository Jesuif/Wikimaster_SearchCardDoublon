// =====================================================================
//  WikiMasters Doublons 1.1 - options.js
//  La page des réglages : elle lit et enregistre les réglages dans la
//  mémoire de l'extension (api.storage.local).
// =====================================================================

const api = globalThis.browser ?? globalThis.chrome;

const REGLAGES_PAR_DEFAUT = { notifPC: false, notifTel: false, canalNtfy: "", surlignerAnimees: true };

// Vrai seulement dans Firefox (cette fonction n'existe pas dans Chrome).
const estFirefox = typeof globalThis.browser !== "undefined" && typeof browser.runtime.getBrowserInfo === "function";

const champs = {
  surlignerAnimees: document.getElementById("surlignerAnimees"),
  notifPC: document.getElementById("notifPC"),
  notifTel: document.getElementById("notifTel"),
  canalNtfy: document.getElementById("canalNtfy")
};

// 1) Au chargement : on affiche les réglages enregistrés.
async function afficherReglages() {
  const { reglages } = await api.storage.local.get("reglages");
  const r = { ...REGLAGES_PAR_DEFAUT, ...reglages };
  champs.surlignerAnimees.checked = r.surlignerAnimees;
  champs.notifPC.checked = r.notifPC;
  champs.notifTel.checked = r.notifTel;
  champs.canalNtfy.value = r.canalNtfy;
  document.getElementById("bloc-telephone").hidden = !r.notifTel;
}

// 2) À chaque changement : on enregistre (background.js reprogramme tout seul).
async function enregistrer() {
  const reglages = {
    surlignerAnimees: champs.surlignerAnimees.checked,
    notifPC: champs.notifPC.checked,
    notifTel: champs.notifTel.checked,
    canalNtfy: champs.canalNtfy.value.trim()
  };
  document.getElementById("bloc-telephone").hidden = !reglages.notifTel;
  await api.storage.local.set({ reglages: reglages });
}

champs.surlignerAnimees.addEventListener("change", enregistrer);
champs.notifPC.addEventListener("change", enregistrer);
champs.canalNtfy.addEventListener("change", enregistrer);

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

// 3) Le bouton qui fabrique un nom de canal au hasard.
document.getElementById("generer").addEventListener("click", () => {
  const lettres = "abcdefghijkmnpqrstuvwxyz23456789";
  const hasard = crypto.getRandomValues(new Uint8Array(12));
  champs.canalNtfy.value = "wikimasters-" + Array.from(hasard, octet => lettres[octet % lettres.length]).join("");
  enregistrer();
});

// 4) Le bouton de test : background.js envoie, puis nous dit si ça a marché.
document.getElementById("tester").addEventListener("click", async () => {
  const zone = document.getElementById("resultat-test");
  await enregistrer();
  zone.textContent = "Envoi en cours…";
  const resultat = await api.runtime.sendMessage({ type: "tester" });
  const phrases = [];
  if (resultat.pc === true) phrases.push("PC : notification affichée.");
  if (resultat.pc === false) phrases.push("PC : échec (vérifie que les notifications du navigateur sont autorisées).");
  if (resultat.telephone === true) phrases.push("Téléphone : message envoyé à ntfy, regarde ton téléphone.");
  if (resultat.telephone === false) phrases.push("Téléphone : échec (vérifie le nom du canal et ta connexion).");
  zone.textContent = phrases.length ? phrases.join(" ") : "Coche au moins une notification (PC ou téléphone).";
});

// 5) L'heure prévue du stock plein, mise à jour en direct.
async function afficherEtat() {
  const { pleinA } = await api.storage.local.get("pleinA");
  const zone = document.getElementById("etat");
  if (!pleinA) {
    zone.textContent = "inconnu (passe sur la page Paquets du site)";
  } else {
    const heure = new Date(pleinA).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    zone.textContent = pleinA > Date.now() ? heure : `déjà atteint (à ${heure})`;
  }
}
api.storage.onChanged.addListener(changements => {
  if (changements.pleinA) afficherEtat();
});

afficherReglages();
afficherEtat();
