/**
 * WikiMasters Doublons 1.16 - script Google des « prix partagés »
 *
 * À coller dans un projet Google Apps Script (script.google.com), puis à déployer en
 * « Application Web » : Exécuter en tant que « Moi », Qui a accès « Tout le monde ».
 * Le script lit et écrit LE fichier CSV des prix dans TON Google Drive, avec ton compte.
 * Les autres utilisateurs de l'extension n'ont besoin que de l'adresse du script et du code
 * secret ci-dessous : pas de compte Google, et le fichier peut rester privé (« Accès limité »).
 *
 * À modifier avant de déployer :
 *   ID_FICHIER  : l'identifiant de ton fichier (dans son lien, entre /d/ et /view) ;
 *   CODE_SECRET : un code de ton choix, à donner seulement aux personnes de confiance.
 */
const ID_FICHIER = "1n2ojYDVpDaEd8wqOkljGMaqof__M-9EK";
const CODE_SECRET = "remplace-moi-par-un-code";

// Ouvrir l'adresse dans un navigateur ne montre rien : tout passe par l'extension, en POST
// (le code secret n'apparaît ainsi jamais dans une adresse).
function doGet() {
  return repondre(() => { throw new Error("ce script s'utilise depuis l'extension WikiMasters Doublons"); });
}

// Lecture : POST { action: "lire", code }  →  { ok, csv, modifie }
function lire() {
  const fichier = DriveApp.getFileById(ID_FICHIER);
  return { csv: fichier.getBlob().getDataAsString("UTF-8"), modifie: fichier.getLastUpdated().toISOString() };
}

// Écriture : POST { action: "ecrire", code, csv }  →  { ok, lignes, ajoutees }
// Le fichier envoyé est FUSIONNÉ avec le fichier actuel, une carte (nom + rareté) par ligne :
// une carte déjà présente prend la ligne envoyée (l'extension y a déjà ajouté ce qu'elle savait),
// SAUF ce qui est plus récent dans le fichier (envoyé entre-temps par quelqu'un d'autre), au jour près :
//  - le prix moyen du site (date « Prix moyen relu le ») ;
//  - 1.16 : les prix du Marché, min / max compris (date « Prix du Marché relevés le ») ;
//  - 1.16 : les variations du prix (date « Variations du ») ;
// une carte absente de l'envoi est gardée. Le verrou empêche deux envois de s'écraser.
function doPost(e) {
  return repondre(() => {
    const donnees = JSON.parse(e.postData.contents);
    verifierCode(donnees.code);
    if (donnees.action === "lire") return lire();
    if (donnees.action !== "ecrire") throw new Error("demande inconnue : mets à jour l'extension ou le script");
    if (typeof donnees.csv !== "string" || donnees.csv.length > 20 * 1024 * 1024) throw new Error("fichier absent ou trop gros");
    const verrou = LockService.getScriptLock();
    if (!verrou.tryLock(30000)) throw new Error("une autre mise à jour est en cours, réessaie dans un instant");
    try {
      const fichier = DriveApp.getFileById(ID_FICHIER);
      const actuel = lireCsv(fichier.getBlob().getDataAsString("UTF-8"));
      const envoye = lireCsv(donnees.csv);
      if (envoye.length < 1) throw new Error("fichier envoyé vide");
      const titres = envoye[0];
      const cNom = titres.indexOf("Carte"), cRarete = titres.indexOf("Rareté");
      if (cNom === -1 || cRarete === -1) throw new Error("ce n'est pas un fichier de prix de WikiMasters Doublons");

      // Les lignes actuelles, remises dans l'ordre des colonnes envoyées.
      const lignes = new Map();
      if (actuel.length > 1) {
        const anciens = actuel[0];
        for (const ligne of actuel.slice(1)) {
          const valeur = titre => { const i = anciens.indexOf(titre); return i === -1 ? "" : (ligne[i] || ""); };
          const cle = valeur("Carte") + "|" + valeur("Rareté");
          if (valeur("Carte")) lignes.set(cle, titres.map(valeur));
        }
      }
      const cEstime = titres.indexOf("Prix estimé");
      const cMoyenne = titres.indexOf("Prix moyen du site"), cLe = titres.indexOf("Prix moyen relu le");
      // 1.16 : les groupes de colonnes qui vont ensemble, chacun avec sa date.
      const colonnes = noms => noms.map(n => titres.indexOf(n)).filter(i => i !== -1);
      const cMarcheLe = titres.indexOf("Prix du Marché relevés le");
      const colonnesMarche = colonnes(["Minimum seulement", "Ventes terminées", "Enchères en cours",
        "Prix le plus bas", "Prix le plus haut", "Tous les prix", "Prix du Marché relevés le"]);
      const cVariationsDu = titres.indexOf("Variations du");
      const colonnesVariations = colonnes(["Variation 1 semaine (%)", "Variation 2 mois (%)", "Variations du"]);
      const plusRecente = (ancienne, nouvelle, cDate) =>
        cDate !== -1 && jour(ancienne[cDate]) !== "" && jour(ancienne[cDate]) > jour(nouvelle[cDate]);

      let ajoutees = 0;
      for (const ligne of envoye.slice(1)) {
        if (!ligne[cNom]) continue;
        const cle = ligne[cNom] + "|" + ligne[cRarete];
        const nouvelle = titres.map((t, i) => ligne[i] || "");
        const ancienne = lignes.get(cle);
        if (!ancienne) ajoutees++;
        else {
          let moyenneGardee = false;
          if (cMoyenne !== -1 && cLe !== -1 && ancienne[cMoyenne]
            && (!nouvelle[cMoyenne] || jour(ancienne[cLe]) > jour(nouvelle[cLe]))) {
            // Le fichier avait un prix moyen plus récent (envoyé entre-temps par quelqu'un d'autre) : on le garde.
            nouvelle[cMoyenne] = ancienne[cMoyenne];
            nouvelle[cLe] = ancienne[cLe];
            if (cEstime !== -1) nouvelle[cEstime] = ancienne[cMoyenne];
            moyenneGardee = true;
          }
          // 1.16 : les prix du Marché du fichier, s'ils ont été relevés un jour plus récent, sont gardés en bloc.
          if (plusRecente(ancienne, nouvelle, cMarcheLe)) {
            for (const i of colonnesMarche) nouvelle[i] = ancienne[i];
            // Sans prix moyen, le prix estimé est celui des prix du Marché : on garde aussi celui du fichier.
            if (!moyenneGardee && cEstime !== -1 && !(cMoyenne !== -1 && nouvelle[cMoyenne])) nouvelle[cEstime] = ancienne[cEstime];
          }
          // 1.16 : les variations du prix, si celles du fichier sont plus récentes.
          if (plusRecente(ancienne, nouvelle, cVariationsDu)) {
            for (const i of colonnesVariations) nouvelle[i] = ancienne[i];
          }
        }
        lignes.set(cle, nouvelle);
      }
      const tri = [...lignes.values()].sort((a, b) => (Number(b[cEstime]) || 0) - (Number(a[cEstime]) || 0));
      const texte = "﻿" + [titres, ...tri].map(l => l.map(champCsv).join(";")).join("\r\n");
      fichier.setContent(texte);
      return { lignes: tri.length, ajoutees: ajoutees };
    } finally {
      verrou.releaseLock();
    }
  });
}

// "2026-11-22" (ou une date complète des anciens fichiers) → "2026-11-22" ; "" si pas de date.
function jour(texte) {
  const t = String(texte || "").trim();
  return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : "";
}

function verifierCode(code) {
  if (!code || code !== CODE_SECRET) throw new Error("code secret incorrect");
}

function repondre(action) {
  let resultat;
  try {
    resultat = Object.assign({ ok: true }, action());
  } catch (erreur) {
    resultat = { ok: false, erreur: String(erreur && erreur.message || erreur) };
  }
  return ContentService.createTextOutput(JSON.stringify(resultat)).setMimeType(ContentService.MimeType.JSON);
}

// Lecture d'un CSV « ; » (ou « , ») avec guillemets, comme l'extension.
function lireCsv(texte) {
  texte = String(texte || "").replace(/^﻿/, "");
  if (!texte.trim()) return [];
  const premiere = texte.split(/\r?\n/, 1)[0];
  const sep = (premiere.match(/;/g) || []).length >= (premiere.match(/,/g) || []).length ? ";" : ",";
  const lignes = [];
  let ligne = [], champ = "", guillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (guillemets) {
      if (c === '"' && texte[i + 1] === '"') { champ += '"'; i++; }
      else if (c === '"') guillemets = false;
      else champ += c;
    } else if (c === '"') guillemets = true;
    else if (c === sep) { ligne.push(champ); champ = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texte[i + 1] === "\n") i++;
      ligne.push(champ); champ = "";
      if (ligne.some(v => v !== "")) lignes.push(ligne);
      ligne = [];
    } else champ += c;
  }
  ligne.push(champ);
  if (ligne.some(v => v !== "")) lignes.push(ligne);
  return lignes;
}

function champCsv(valeur) {
  const texte = String(valeur == null ? "" : valeur);
  return /[;",\r\n]/.test(texte) ? '"' + texte.replace(/"/g, '""') + '"' : texte;
}
