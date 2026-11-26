// =====================================================================
//  WikiMasters Doublons 1.21.0 (sans chargement automatique) - options.js
//  La page des réglages : elle lit et enregistre les réglages dans la
//  mémoire de l'extension (api.storage.local). commun.js est chargé avant
//  ce fichier : il fournit api, REGLAGES_PAR_DEFAUT, lireReglages...
// =====================================================================

// Vrai seulement dans Firefox (cette fonction n'existe pas dans Chrome).
const estFirefox = typeof globalThis.browser !== "undefined" && typeof browser.runtime.getBrowserInfo === "function";

// Les cases à cocher : leur id dans la page est le nom du réglage.
// 1.8 : les enchères et les cartes animées du jeu.
const CASES = ["surlignerAnimees", "etiquettes", "statistiques", "historique", "manquantes", "echanges", "badge",
  "notifPC", "notifTel", "alerteAvant", "marche", "animeesJeu", "encheres", "enchereAuto", "enchereNotifPC", "enchereNotifTel",
  "alerteAmis", "suiviCollection", "badgePrixMoyen", "badgePrixAchat"]; // 1.15, 1.19, 1.21
const CASES_TELEPHONE = ["notifTel", "enchereNotifTel"]; // elles demandent une autorisation dans Firefox
const champs = {};
for (const nom of [...CASES, "canalNtfy", "minutesParPaquet", "alerteA", "patienceMinutes", "pagesMax"]) {
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
  champs.patienceMinutes.value = String(r.patienceMinutes);
  champs.pagesMax.value = String(r.pagesMax);
  afficherDelais(nettoyerDelais(r.enchereDelais));
  actualiserBlocs(r);
}

// Cache ce qui ne sert à rien : le bloc ntfy si le téléphone est décoché, etc.
function actualiserBlocs(r) {
  const telephoneEncheres = r.encheres && r.enchereNotifTel;
  document.getElementById("bloc-telephone").hidden = !(r.notifTel || telephoneEncheres);
  document.getElementById("note-canal-encheres").hidden = !telephoneEncheres;
  document.getElementById("bloc-historique").hidden = !r.historique;
  document.getElementById("bloc-encheres").hidden = !r.encheres;
  document.getElementById("section-etiquettes").hidden = !r.etiquettes; // 1.9
  document.getElementById("bloc-amis").hidden = !r.alerteAmis; // 1.15
  champs.alerteA.disabled = !r.alerteAvant;
}

// À chaque changement : on enregistre (background.js reprogramme tout seul).
// 1.8 : on part des réglages enregistrés, pour ne jamais perdre un réglage absent de cette page.
async function enregistrer() {
  const reglages = await lireReglages();
  for (const nom of CASES) reglages[nom] = champs[nom].checked;
  reglages.canalNtfy = champs.canalNtfy.value.trim();
  reglages.minutesParPaquet = parseInt(champs.minutesParPaquet.value, 10);
  // Le seuil de l'alerte : un nombre entier entre 1 et 9 (sinon on garde 8).
  const seuil = parseInt(champs.alerteA.value, 10);
  reglages.alerteA = seuil >= 1 && seuil <= 9 ? seuil : REGLAGES_PAR_DEFAUT.alerteA;
  champs.alerteA.value = String(reglages.alerteA);
  // 1.8 : la patience, le nombre maximum de pages et les alertes d'enchères.
  reglages.patienceMinutes = parseInt(champs.patienceMinutes.value, 10) || REGLAGES_PAR_DEFAUT.patienceMinutes;
  const pages = parseInt(champs.pagesMax.value, 10);
  reglages.pagesMax = pages >= 10 && pages <= 20000 ? pages : REGLAGES_PAR_DEFAUT.pagesMax;
  champs.pagesMax.value = String(reglages.pagesMax);
  // 1.14 : les seuils des cadres du Marché se règlent dans le panneau (ils sont gardés tels quels ici).
  reglages.enchereDelais = lireDelais();
  afficherDelais(reglages.enchereDelais);
  actualiserBlocs(reglages);
  await api.storage.local.set({ reglages: reglages });
}

for (const nom of CASES) {
  if (!CASES_TELEPHONE.includes(nom)) champs[nom].addEventListener("change", enregistrer);
}
for (const nom of ["canalNtfy", "minutesParPaquet", "alerteA", "patienceMinutes", "pagesMax"]) {
  champs[nom].addEventListener("change", enregistrer);
}

for (const nom of CASES_TELEPHONE) {
  champs[nom].addEventListener("change", () => {
    // Dans Firefox, il faut ton accord pour envoyer des données hors du navigateur (vers ntfy.sh).
    // La demande doit partir tout de suite, pendant le clic : c'est une règle de Firefox.
    if (champs[nom].checked && estFirefox) {
      browser.permissions.request({ data_collection: ["websiteContent"] }).then(accorde => {
        if (!accorde) champs[nom].checked = false; // refusé : on décoche
        enregistrer();
      });
      return;
    }
    enregistrer();
  });
}


// ---------------------------------------------------------------------
//  1 bis) Nouveau en 1.8 : la liste des alertes d'enchères
//  Chaque ligne : [nombre] [minutes / heures / jours] avant la fin [Retirer]
// ---------------------------------------------------------------------

const UNITES = [[1440, "jour(s)"], [60, "heure(s)"], [1, "minute(s)"]];
const listeDelais = document.getElementById("liste-delais");

// Une ligne pour un délai en minutes : 90 → « 90 minute(s) », 120 → « 2 heure(s) », 1440 → « 1 jour(s) ».
function ligneDelai(minutes) {
  const ligne = document.createElement("div");
  ligne.className = "ligne-delai";
  const [unite] = UNITES.find(([taille]) => minutes % taille === 0) || UNITES[2];
  const nombre = document.createElement("input");
  nombre.type = "number";
  nombre.min = "1";
  nombre.step = "1";
  nombre.value = String(minutes / unite);
  const choix = document.createElement("select");
  for (const [taille, nom] of UNITES) {
    const option = document.createElement("option");
    option.value = String(taille);
    option.textContent = nom;
    choix.appendChild(option);
  }
  choix.value = String(unite);
  const retirer = document.createElement("button");
  retirer.type = "button";
  retirer.textContent = "Retirer";
  retirer.addEventListener("click", () => {
    ligne.remove();
    enregistrer();
  });
  nombre.addEventListener("change", enregistrer);
  choix.addEventListener("change", enregistrer);
  ligne.append(nombre, choix, document.createTextNode(" avant la fin"), retirer);
  return ligne;
}

function afficherDelais(delais) {
  listeDelais.replaceChildren(...delais.map(ligneDelai));
  document.getElementById("ajouter-delai").disabled = delais.length >= 10;
  document.getElementById("resume-delais").textContent = delais.length
    ? `Tu seras prévenu ${delais.length} fois : ${delais.map(delaiLisible).join(", puis ")} avant la fin.`
    : "Aucune alerte : ajoute-en une avec le bouton ci-dessus.";
}

// Les délais affichés, en minutes, nettoyés (de 1 minute à 3 jours, sans doublon, 10 au plus).
function lireDelais() {
  return nettoyerDelais([...listeDelais.querySelectorAll(".ligne-delai")].map(ligne => {
    const nombre = parseFloat(ligne.querySelector("input").value);
    return nombre * parseInt(ligne.querySelector("select").value, 10);
  }));
}

document.getElementById("ajouter-delai").addEventListener("click", () => {
  // Une nouvelle alerte : la moitié de la plus courte (ou 30 min s'il n'y en a pas encore).
  const delais = lireDelais();
  const proposition = delais.length ? Math.max(1, Math.floor(delais[delais.length - 1] / 2)) : 30;
  listeDelais.appendChild(ligneDelai(delais.includes(proposition) ? proposition + 1 : proposition));
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
    phrases.push("PC : aucune case « Sur ce PC » n'est cochée.");
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

// ---------------------------------------------------------------------
//  3 bis) Nouveau en 1.8 : les enchères suivies, avec leur prochaine alerte sur ce PC
// ---------------------------------------------------------------------

async function afficherEncheres() {
  const { encheres = {} } = await api.storage.local.get("encheres");
  const alarmes = await api.alarms.getAll();
  const maintenant = Date.now();
  const corps = document.querySelector("#tableau-encheres tbody");
  corps.replaceChildren();
  const liste = Object.values(encheres).sort((a, b) => (a.fin || Infinity) - (b.fin || Infinity));
  for (const enchere of liste) {
    const ligne = corps.insertRow();
    const lien = document.createElement("a");
    lien.href = `https://www.wiki-masters.com/marketplace/${enchere.id}`;
    lien.target = "_blank";
    lien.textContent = (enchere.nom || "Enchère") + (enchere.rarete && RARETES[enchere.rarete] ? ` (${lettreRarete(enchere.rarete)})` : "");
    ligne.insertCell().appendChild(lien);
    const finie = enchere.terminee || (enchere.finMax && enchere.finMax < maintenant);
    const marge = enchere.fin && enchere.finMax ? enchere.finMax - enchere.fin : 0;
    ligne.insertCell().textContent = finie ? "terminée"
      : !enchere.fin ? "inconnue (ouvre l'enchère)"
      : `${dateLisible(enchere.fin)}${marge > 2 * MINUTE ? ` (à ${dureeLisible(marge)} près)` : ""}`
        + (enchere.statut === "menez" ? " · tu mènes" : enchere.statut === "surencheri" ? " · surenchéri !" : "");
    const prochaine = alarmes.filter(alarme => alarme.name.startsWith(`enchere|${enchere.id}|`))
      .sort((a, b) => a.scheduledTime - b.scheduledTime)[0];
    ligne.insertCell().textContent = prochaine
      ? `${heureLisible(prochaine.scheduledTime)} (${delaiLisible(parseInt(prochaine.name.split("|")[2], 10))} avant)` : "—";
    const retirer = document.createElement("button");
    retirer.type = "button";
    retirer.className = "petit";
    retirer.textContent = "Ne plus suivre";
    retirer.addEventListener("click", async () => {
      const memo = await api.storage.local.get(["encheres", "encheresIgnorees"]);
      const suivies = memo.encheres || {};
      const ignorees = memo.encheresIgnorees || {};
      delete suivies[enchere.id];
      ignorees[enchere.id] = Date.now();
      await api.storage.local.set({ encheres: suivies, encheresIgnorees: ignorees });
    });
    ligne.insertCell().appendChild(retirer);
  }
  document.getElementById("tableau-encheres").hidden = liste.length === 0;
  document.getElementById("encheres-vide").hidden = liste.length > 0;
}

async function afficherMemoire() {
  const { collection, catalogue, historique = [], marche, animeesJeu } =
    await api.storage.local.get(["collection", "catalogue", "historique", "marche", "animeesJeu"]);
  // 1.8 : les cartes animées du jeu trouvées sur « Toutes les cartes ».
  document.getElementById("memoire-animees").textContent = animeesJeu
    ? `${nombreLisible(animeesJeu.cartes.length)} carte(s) animée(s), mises à jour le ${dateLisible(animeesJeu.maj)}`
    : "aucune recherche faite";
  const annonces = marche ? Object.values(marche.annonces) : [];
  document.getElementById("memoire-marche").textContent = annonces.length
    ? `${nombreLisible(annonces.length)} annonces (${nombreLisible(new Set(annonces.map(a => a.nom)).size)} cartes différentes)`
    : "aucun";
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
  await api.storage.local.remove(["collection", "historique", "animations", "comparaison", "manquantes", "vuePanneau"]); // 1.15 : et les listes gardées
  confirmation = false;
  boutonEffacer.textContent = "Effacé !";
});


// Nouveau en 1.4 : effacer les prix du marché, avec la même confirmation en deux clics.
const boutonEffacerMarche = document.getElementById("effacer-marche");
let confirmationMarche = false;
boutonEffacerMarche.addEventListener("click", async () => {
  if (!confirmationMarche) {
    confirmationMarche = true;
    boutonEffacerMarche.textContent = "Clique encore pour confirmer";
    setTimeout(() => {
      confirmationMarche = false;
      boutonEffacerMarche.textContent = "Effacer les prix du marché";
    }, 4000);
    return;
  }
  await api.storage.local.remove("marche");
  confirmationMarche = false;
  boutonEffacerMarche.textContent = "Effacé !";
});


// Nouveau en 1.8 : effacer les cartes animées trouvées, avec la même confirmation en deux clics.
const boutonEffacerAnimees = document.getElementById("effacer-animees");
let confirmationAnimees = false;
boutonEffacerAnimees.addEventListener("click", async () => {
  if (!confirmationAnimees) {
    confirmationAnimees = true;
    boutonEffacerAnimees.textContent = "Clique encore pour confirmer";
    setTimeout(() => {
      confirmationAnimees = false;
      boutonEffacerAnimees.textContent = "Effacer les cartes animées trouvées";
    }, 4000);
    return;
  }
  await api.storage.local.remove("animeesJeu");
  confirmationAnimees = false;
  boutonEffacerAnimees.textContent = "Effacé !";
});


// ---------------------------------------------------------------------
//  4 ter) Les étiquettes suggérées (repris en 1.9 de la branche 1.4)
// ---------------------------------------------------------------------

let etiquettesSite = {}; // tes étiquettes déjà créées sur le site : { nom: nombre de cartes }

// Une zone de texte avec son titre au-dessus.
function champTexte(classe, titre, valeur, lignes) {
  const etiquette = document.createElement("label");
  const champ = document.createElement(lignes ? "textarea" : "input");
  if (lignes) champ.rows = lignes;
  else champ.type = "text";
  champ.className = classe;
  champ.value = valeur || "";
  etiquette.append(titre, champ);
  return etiquette;
}

// Une case à cocher avec son texte.
function caseACocher(classe, texte, cochee) {
  const etiquette = document.createElement("label");
  const caseACocher = document.createElement("input");
  caseACocher.type = "checkbox";
  caseACocher.className = classe;
  caseACocher.checked = cochee;
  etiquette.append(caseACocher, " " + texte);
  return etiquette;
}

// Un petit paragraphe gris.
function phraseDiscrete(texte) {
  const phrase = document.createElement("p");
  phrase.className = "discret";
  phrase.textContent = texte;
  return phrase;
}

// Dessine un cadre par étiquette (sans innerHTML, comme le demande Mozilla).
function afficherEtiquettes(liste) {
  const zone = document.getElementById("liste-etiquettes");
  zone.replaceChildren();
  for (const etiquette of liste) {
    const cadre = document.createElement("fieldset");
    cadre.className = "etiquette" + (etiquette.active ? "" : " coupee");
    cadre.dataset.id = etiquette.id;

    // En titre : la case pour l'activer, son icône et son nom (modifiable).
    const titre = document.createElement("legend");
    const active = document.createElement("input");
    active.type = "checkbox";
    active.className = "active";
    active.checked = etiquette.active;
    const nom = document.createElement("input");
    nom.type = "text";
    nom.className = "nom";
    nom.value = etiquette.nom;
    titre.append(active, ` ${etiquette.icone || "🏷️"} `, nom);
    cadre.appendChild(titre);

    const phrase = phraseDiscrete("");
    phrase.classList.add("propose");
    cadre.appendChild(phrase);

    if (etiquette.id === "animee") {
      cadre.appendChild(phraseDiscrete("Reconnue par son image animée (un GIF qui bouge), pas par des mots-clés."));
    } else {
      cadre.appendChild(champTexte("motsCles", "Mots-clés (séparés par des virgules) :", etiquette.motsCles, 2));
      cadre.appendChild(caseACocher("auDebut", "La description doit commencer par un de ces mots", etiquette.auDebut));
      cadre.appendChild(champTexte("exclusions", "Sauf si la description contient (mots séparés par des virgules) : ",
        etiquette.exclusions, 0));
    }
    if (!ETIQUETTES_PAR_DEFAUT.some(defaut => defaut.id === etiquette.id)) {
      const supprimer = document.createElement("button");
      supprimer.className = "supprimer secondaire";
      supprimer.textContent = "Supprimer cette étiquette";
      supprimer.addEventListener("click", () => {
        cadre.remove();
        enregistrerEtiquettes();
      });
      cadre.appendChild(supprimer);
    }
    zone.appendChild(cadre);
  }
  actualiserCadres(liste);
}

// Met à jour le nom proposé et l'aspect (coupée ou non) de chaque cadre, sans tout redessiner
// (sinon tu perdrais ta place pendant que tu tapes).
function actualiserCadres(liste) {
  for (const cadre of document.querySelectorAll("#liste-etiquettes fieldset")) {
    const etiquette = liste.find(e => e.id === cadre.dataset.id);
    if (!etiquette) continue;
    const propose = nomPropose(etiquette, etiquettesSite);
    cadre.querySelector(".propose").textContent = propose === etiquette.nom
      ? `Proposée sous le nom « ${propose} ».`
      : `Proposée sous le nom « ${propose} » : ton étiquette déjà créée sur le site.`;
    cadre.classList.toggle("coupee", !etiquette.active);
  }
}

// Relit tous les cadres et enregistre la liste (content.js la reçoit aussitôt).
async function enregistrerEtiquettes() {
  const anciennes = await lireEtiquettes();
  const liste = [...document.querySelectorAll("#liste-etiquettes fieldset")].map(cadre => {
    const avant = anciennes.find(etiquette => etiquette.id === cadre.dataset.id) || {};
    const element = classe => cadre.querySelector("." + classe);
    return {
      ...avant, // l'icône, les synonymes... ne changent pas
      id: cadre.dataset.id,
      nom: element("nom").value.trim() || avant.nom || "étiquette",
      active: element("active").checked,
      motsCles: element("motsCles") ? element("motsCles").value : (avant.motsCles || ""),
      auDebut: element("auDebut") ? element("auDebut").checked : false,
      exclusions: element("exclusions") ? element("exclusions").value : ""
    };
  });
  await api.storage.local.set({ etiquettes: liste });
}

// Un changement dans un cadre : on enregistre, puis on met à jour le nom proposé.
document.getElementById("liste-etiquettes").addEventListener("change", async () => {
  await enregistrerEtiquettes();
  actualiserCadres(await lireEtiquettes());
});

document.getElementById("ajouter-etiquette").addEventListener("click", async () => {
  const liste = await lireEtiquettes();
  liste.push({ id: "perso-" + Date.now(), nom: "nouvelle étiquette", icone: "🏷️", active: true,
    auDebut: false, motsCles: "", exclusions: "", synonymes: "" });
  await api.storage.local.set({ etiquettes: liste });
  afficherEtiquettes(liste);
  const noms = document.querySelectorAll("#liste-etiquettes input.nom");
  noms[noms.length - 1].select(); // prêt à taper son nom
});

// Remettre les étiquettes de départ : deux clics, comme pour effacer la mémoire.
const boutonDefaut = document.getElementById("etiquettes-defaut");
let confirmationDefaut = false;
boutonDefaut.addEventListener("click", async () => {
  if (!confirmationDefaut) {
    confirmationDefaut = true;
    boutonDefaut.textContent = "Clique encore pour confirmer";
    setTimeout(() => {
      confirmationDefaut = false;
      boutonDefaut.textContent = "Remettre les étiquettes de départ";
    }, 4000);
    return;
  }
  confirmationDefaut = false;
  boutonDefaut.textContent = "Remettre les étiquettes de départ";
  await api.storage.local.remove("etiquettes");
  afficherEtiquettes(await lireEtiquettes());
});

// Les étiquettes trouvées sur le site, avec leur nombre de cartes.
async function afficherEtiquettesSite() {
  const { etiquettesSite: lu } = await api.storage.local.get("etiquettesSite");
  etiquettesSite = lu ? lu.liste : {};
  const noms = Object.entries(etiquettesSite).sort((a, b) => b[1] - a[1]).map(([nom, nombre]) => `${nom} (${nombre})`);
  document.getElementById("etiquettes-site").textContent = noms.length ? noms.join(", ") : "aucune pour l'instant";
  afficherEtiquettes(await lireEtiquettes());
}


// ---------------------------------------------------------------------
//  5) Démarrage, puis mise à jour en direct
// ---------------------------------------------------------------------

api.storage.onChanged.addListener(changements => {
  if (changements.paquets || changements.reglages) afficherEtat();
  if (changements.collection || changements.catalogue || changements.historique || changements.marche
    || changements.animeesJeu) afficherMemoire();
  setTimeout(afficherEtatPC, 500); // le temps que background.js reprogramme les alarmes
  setTimeout(afficherEncheres, 800);
  if (changements.etiquettesSite) afficherEtiquettesSite(); // 1.9
});
setInterval(afficherEtat, 30 * 1000); // l'estimation change avec le temps
setInterval(afficherEncheres, 30 * 1000);

afficherReglages();
afficherEtat();
afficherEtatPC();
afficherMemoire();
afficherEncheres();
afficherEtiquettesSite(); // 1.9 : dessine aussi la liste des étiquettes


// ---------------------------------------------------------------------
//  1.15 : les amis de l'alerte « un ami a misé sur cette enchère »
//  amis = { liste: [{ nom, affiche }], lu } (lus sur la page Amis du site) ;
//  amisPerso = [noms] (ajoutés ici à la main) ; amisIgnores = [noms] (décochés).
// ---------------------------------------------------------------------
const zoneAmis = document.getElementById("liste-amis");

async function lireAmis() {
  const lu = await api.storage.local.get(["amis", "amisPerso", "amisIgnores"]);
  return {
    site: lu.amis && Array.isArray(lu.amis.liste) ? lu.amis.liste : [],
    lu: lu.amis ? lu.amis.lu : null,
    perso: Array.isArray(lu.amisPerso) ? lu.amisPerso : [],
    ignores: Array.isArray(lu.amisIgnores) ? lu.amisIgnores : []
  };
}

async function afficherAmis() {
  const { site, lu, perso, ignores } = await lireAmis();
  document.getElementById("amis-lus").textContent = lu
    ? `${site.length} ami(s), lus le ${dateLisible(lu)}` : "jamais lus : passe une fois sur la page Amis du site";
  const lignes = site.map(ami => ({ nom: ami.nom, affiche: ami.affiche || ami.nom, perso: false }));
  for (const nom of perso) if (!lignes.some(l => memePseudo(l.nom, nom))) lignes.push({ nom: nom, affiche: nom, perso: true });
  // Un ami ignoré qui n'est plus dans la liste reste affiché, pour pouvoir le recocher.
  for (const nom of ignores) if (!lignes.some(l => memePseudo(l.nom, nom))) lignes.push({ nom: nom, affiche: nom, perso: false, ancien: true });
  lignes.sort((a, b) => a.affiche.localeCompare(b.affiche, "fr", { sensitivity: "base" }));
  zoneAmis.replaceChildren(...lignes.map(ligne => {
    const etiquette = document.createElement("label");
    const coche = document.createElement("input");
    coche.type = "checkbox";
    coche.checked = !ignores.some(nom => memePseudo(nom, ligne.nom));
    coche.addEventListener("change", () => changerIgnore(ligne.nom, !coche.checked));
    const nom = document.createElement("span");
    nom.textContent = ligne.affiche + (ligne.perso ? " (ajouté à la main)" : ligne.ancien ? " (plus dans tes amis)" : "");
    if (!coche.checked) nom.className = "ignore";
    etiquette.append(coche, nom);
    if (ligne.perso) {
      const retirer = document.createElement("button");
      retirer.type = "button";
      retirer.className = "petit";
      retirer.textContent = "Retirer";
      retirer.addEventListener("click", async evenement => {
        evenement.preventDefault();
        const { perso: actuels } = await lireAmis();
        await api.storage.local.set({ amisPerso: actuels.filter(n => !memePseudo(n, ligne.nom)) });
      });
      etiquette.appendChild(retirer);
    }
    return etiquette;
  }));
  if (!lignes.length) {
    const vide = document.createElement("p");
    vide.className = "discret";
    vide.textContent = "Aucun ami connu pour l'instant.";
    zoneAmis.appendChild(vide);
  }
}

async function changerIgnore(nom, ignorer) {
  const { ignores } = await lireAmis();
  const autres = ignores.filter(n => !memePseudo(n, nom));
  await api.storage.local.set({ amisIgnores: ignorer ? [...autres, nom] : autres });
}

document.getElementById("ami-ajouter").addEventListener("click", async () => {
  const champ = document.getElementById("ami-ajout");
  const nom = champ.value.trim();
  if (!nom) return;
  const { perso } = await lireAmis();
  if (!perso.some(n => memePseudo(n, nom))) await api.storage.local.set({ amisPerso: [...perso, nom] });
  champ.value = "";
});
document.getElementById("ami-ajout").addEventListener("keydown", evenement => {
  if (evenement.key === "Enter") {
    evenement.preventDefault();
    document.getElementById("ami-ajouter").click();
  }
});
document.getElementById("amis-tous").addEventListener("click", () => api.storage.local.set({ amisIgnores: [] }));
document.getElementById("amis-aucun").addEventListener("click", async () => {
  const { site, perso } = await lireAmis();
  await api.storage.local.set({ amisIgnores: [...site.map(ami => ami.nom), ...perso] });
});
api.storage.onChanged.addListener(changements => {
  if (changements.amis || changements.amisPerso || changements.amisIgnores) afficherAmis();
});
afficherAmis();


// ---------------------------------------------------------------------
//  1.14 : les prix partagés (adresse du script Google et code secret)
// ---------------------------------------------------------------------
const champPartageAdresse = document.getElementById("partage-adresse");
const champPartageCode = document.getElementById("partage-code");
const etatPartage = document.getElementById("partage-etat");
const REGEX_SCRIPT = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;

async function afficherPartage() {
  const { partage = {} } = await api.storage.local.get("partage");
  champPartageAdresse.value = partage.adresse || "";
  champPartageCode.value = ""; // le code n'est jamais réaffiché
  champPartageCode.placeholder = partage.code ? "•••••• (enregistré)" : "";
  etatPartage.textContent = !(partage.adresse && partage.code) ? "Pas réglé : le bouton classique « Exporter les prix du marché (CSV) » reste affiché."
    : partage.derniereMaj ? `Dernière mise à jour depuis ce navigateur : ${new Date(partage.derniereMaj).toLocaleString("fr-FR")}.`
    : "Réglé. Pas encore de mise à jour depuis ce navigateur.";
}
async function enregistrerPartage() {
  const adresse = champPartageAdresse.value.trim();
  if (adresse && !REGEX_SCRIPT.test(adresse)) {
    etatPartage.textContent = "⚠ Cette adresse n'est pas celle d'un script Google déployé (elle doit commencer par https://script.google.com/macros/s/ et finir par /exec). Non enregistrée.";
    return;
  }
  const { partage = {} } = await api.storage.local.get("partage");
  // Champ vide : on garde le code déjà enregistré (il n'est jamais réaffiché).
  const code = champPartageCode.value.trim() || partage.code || "";
  await api.storage.local.set({ partage: { ...partage, adresse: adresse, code: code } });
  afficherPartage();
}
champPartageAdresse.addEventListener("change", enregistrerPartage);
champPartageCode.addEventListener("change", enregistrerPartage);
document.getElementById("partage-tester").addEventListener("click", async () => {
  await enregistrerPartage();
  etatPartage.textContent = "Test en cours…";
  const reponse = await api.runtime.sendMessage({ type: "partage-lire" }).catch(e => ({ erreur: e.message }));
  if (reponse && reponse.erreur === "pas-configure") etatPartage.textContent = "⚠ Indique l'adresse du script ET le code secret.";
  else if (!reponse || reponse.erreur) etatPartage.textContent = `⚠ Échec : ${reponse ? reponse.erreur : "pas de réponse"}.`;
  else {
    const lignes = reponse.texte.split(/\r?\n/).filter(l => l.trim()).length;
    etatPartage.textContent = `✓ Ça marche : le fichier partagé contient ${Math.max(0, lignes - 1)} carte(s). (Le test ne modifie rien.)`;
  }
});
afficherPartage();

// ---------------------------------------------------------------------
//  1.21 : le rangement du menu (l'ordre des groupes du panneau, mémoire « ordrePanneau »)
// ---------------------------------------------------------------------
async function afficherRangement() {
  const { ordrePanneau } = await api.storage.local.get("ordrePanneau");
  const choisis = ordrePanneau && Array.isArray(ordrePanneau.groupes) ? ordrePanneau.groupes.filter(id => ORDRE_GROUPES.includes(id)) : [];
  const ordre = [...choisis, ...ORDRE_GROUPES.filter(id => !choisis.includes(id))];
  const liste = document.getElementById("rangement-liste");
  liste.replaceChildren();
  ordre.forEach((id, i) => {
    const ligne = document.createElement("li");
    ligne.className = "ligne-delai";
    ligne.append(document.createTextNode(NOMS_GROUPES[id] + " "));
    for (const [texte, sens, titre] of [["↑", -1, "Monter"], ["↓", 1, "Descendre"]]) {
      const bouton = document.createElement("button");
      bouton.type = "button";
      bouton.className = "petit";
      bouton.textContent = texte;
      bouton.title = titre;
      bouton.disabled = (sens < 0 && i === 0) || (sens > 0 && i === ordre.length - 1);
      bouton.addEventListener("click", async () => {
        const nouvel = [...ordre];
        [nouvel[i], nouvel[i + sens]] = [nouvel[i + sens], nouvel[i]];
        const { ordrePanneau: actuel } = await api.storage.local.get("ordrePanneau");
        await api.storage.local.set({ ordrePanneau: { ...(actuel || {}), groupes: nouvel } });
        afficherRangement();
      });
      ligne.append(bouton, document.createTextNode(" "));
    }
    liste.appendChild(ligne);
  });
}
document.getElementById("rangement-defaut").addEventListener("click", async () => {
  await api.storage.local.remove("ordrePanneau");
  afficherRangement();
});
api.storage.onChanged.addListener(changements => { if (changements.ordrePanneau) afficherRangement(); });
afficherRangement();
