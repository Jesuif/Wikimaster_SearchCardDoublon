// =====================================================================
//  WikiMasters Doublons 1.1 - background.js
//  Le « script d'arrière-plan » : il tourne même quand aucune page
//  WikiMasters n'est ouverte, tant que le navigateur est lancé.
//  Son rôle : te prévenir quand ton stock de 10 paquets est plein.
// =====================================================================

// Chrome appelle ses outils « chrome », Firefox les appelle « browser » : on prend celui qui existe.
const api = globalThis.browser ?? globalThis.chrome;

const ALARME_PLEIN = "paquets-pleins";  // l'alarme qui affiche la notification sur le PC
const ALARME_TELEPHONE = "envoi-ntfy";   // courte attente avant d'envoyer au téléphone
const ID_MESSAGE_NTFY = "paquets-pleins"; // identifiant du message ntfy, pour le remplacer ou l'annuler
const SERVEUR_NTFY = "https://ntfy.sh";
const PAGE_PAQUETS = "https://www.wiki-masters.com/pulls";
const UNE_MINUTE = 60 * 1000;

const REGLAGES_PAR_DEFAUT = { notifPC: false, notifTel: false, canalNtfy: "", surlignerAnimees: true };


// ---------------------------------------------------------------------
//  PARTIE 1 : LIRE LA MÉMOIRE DE L'EXTENSION
//  (api.storage.local, c'est un peu les PlayerPrefs de Unity)
// ---------------------------------------------------------------------

async function lireReglages() {
  const { reglages } = await api.storage.local.get("reglages");
  return { ...REGLAGES_PAR_DEFAUT, ...reglages };
}

// L'heure (en millisecondes) à laquelle le stock sera plein, ou null.
async function lirePleinA() {
  const { pleinA } = await api.storage.local.get("pleinA");
  return pleinA ?? null;
}

// Un nom de canal ntfy : 1 à 64 lettres, chiffres, tirets ou soulignés.
function canalValide(canal) {
  return /^[-_A-Za-z0-9]{1,64}$/.test(canal || "");
}

function heureLisible(millisecondes) {
  return new Date(millisecondes).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}


// ---------------------------------------------------------------------
//  PARTIE 2 : LES MESSAGES VENUS DE content.js ET DE LA PAGE DES RÉGLAGES
// ---------------------------------------------------------------------

api.runtime.onMessage.addListener((message, expediteur, repondre) => {
  if (message.type === "etat-paquets") {
    nouvelleHeurePleine(message.pleinA);
  }
  if (message.type === "ouvrir-reglages") {
    // La page des réglages s'ouvre dans un nouvel onglet, juste à côté de l'onglet WikiMasters.
    const nouvelOnglet = { url: api.runtime.getURL("options.html") };
    if (expediteur.tab) {
      nouvelOnglet.windowId = expediteur.tab.windowId;
      nouvelOnglet.index = expediteur.tab.index + 1;
    }
    api.tabs.create(nouvelOnglet);
  }
  if (message.type === "tester") {
    envoyerTest().then(repondre);
    return true; // « je répondrai plus tard » (la réponse arrive après l'envoi)
  }
});

// content.js a lu le stock sur la page Paquets et calculé une nouvelle heure.
async function nouvelleHeurePleine(pleinA) {
  const ancienne = await lirePleinA();
  const pareil = (pleinA === null && ancienne === null)
    || (pleinA !== null && ancienne !== null && Math.abs(pleinA - ancienne) < UNE_MINUTE);
  if (pareil) return; // rien de neuf : on ne refait rien
  await api.storage.local.set({ pleinA: pleinA });
  await programmerTout();
}

// Quand tu changes un réglage dans la page des réglages, on reprogramme tout.
api.storage.onChanged.addListener(changements => {
  if (changements.reglages) programmerTout();
});


// ---------------------------------------------------------------------
//  PARTIE 3 : PROGRAMMER LES NOTIFICATIONS
// ---------------------------------------------------------------------

async function programmerTout() {
  const reglages = await lireReglages();
  const pleinA = await lirePleinA();
  const aVenir = pleinA !== null && pleinA > Date.now();

  // 1) Sur le PC : une alarme réglée à l'heure du stock plein.
  if (reglages.notifPC && aVenir) {
    await api.alarms.create(ALARME_PLEIN, { when: pleinA });
  } else {
    await api.alarms.clear(ALARME_PLEIN);
  }

  // 2) Sur le téléphone : on attend 45 secondes avant d'envoyer, au cas où tu ouvrirais
  //    plusieurs paquets d'affilée (un seul envoi au lieu de dix).
  await api.alarms.create(ALARME_TELEPHONE, { when: Date.now() + 45 * 1000 });
}

// Une alarme sonne : soit le stock est plein, soit c'est le moment d'envoyer au téléphone.
api.alarms.onAlarm.addListener(async alarme => {
  if (alarme.name === ALARME_PLEIN) {
    const reglages = await lireReglages();
    if (reglages.notifPC) {
      await notifierPC("WikiMasters : 10 paquets prêts", "Ton stock de paquets est plein : ouvre-les pour ne pas en perdre !");
    }
    await api.storage.local.set({ pleinA: null });
  }
  if (alarme.name === ALARME_TELEPHONE) {
    await synchroniserTelephone();
  }
});

// Au démarrage du navigateur : les alarmes ont pu être effacées, on rattrape.
async function rattraper() {
  const pleinA = await lirePleinA();
  if (pleinA === null) return;
  if (pleinA > Date.now()) {
    await programmerTout(); // le stock n'est pas encore plein : on remet l'alarme
    return;
  }
  // Le stock s'est rempli pendant que le navigateur était fermé.
  const reglages = await lireReglages();
  if (reglages.notifPC) {
    await notifierPC("WikiMasters : tes paquets sont sûrement pleins",
      `Ton stock devait être plein à ${heureLisible(pleinA)}. Ouvre-les vite !`);
  }
  await api.storage.local.set({ pleinA: null });
}
api.runtime.onStartup.addListener(rattraper);
api.runtime.onInstalled.addListener(rattraper);


// ---------------------------------------------------------------------
//  PARTIE 4 : LA NOTIFICATION SUR LE PC
// ---------------------------------------------------------------------

function notifierPC(titre, message) {
  return api.notifications.create("wikimasters-paquets", {
    type: "basic",
    iconUrl: api.runtime.getURL("icone-128.png"),
    title: titre,
    message: message
  });
}

// Un clic sur la notification ouvre la page Paquets.
api.notifications.onClicked.addListener(() => {
  api.tabs.create({ url: PAGE_PAQUETS });
});


// ---------------------------------------------------------------------
//  PARTIE 5 : LA NOTIFICATION SUR LE TÉLÉPHONE (application ntfy)
// ---------------------------------------------------------------------

// Firefox demande ton accord avant qu'une extension envoie des données hors du navigateur.
// Chrome n'a pas ce système : on répond alors « oui ».
async function accordEnvoiDonnees() {
  try {
    const accordes = await api.permissions.getAll();
    if (!("data_collection" in accordes)) return true; // Chrome
    return accordes.data_collection.includes("websiteContent");
  } catch (erreur) {
    return true;
  }
}

// Envoie une requête au serveur ntfy, sans jamais faire planter l'extension.
async function envoyerNtfy(adresse, methode, texte) {
  try {
    const reponse = await fetch(adresse, { method: methode, body: texte });
    // 404 sur une annulation = le message n'existait déjà plus : ce n'est pas grave.
    return reponse.ok || (methode === "DELETE" && reponse.status === 404);
  } catch (erreur) {
    console.warn("[WikiMasters Doublons] Envoi vers ntfy impossible :", erreur);
    return false;
  }
}

// Programme le message « 10 paquets prêts » chez ntfy, qui le livrera à l'heure dite,
// même si ton PC est éteint. Le même identifiant remplace le message programmé avant.
function programmerNtfy(canal, pleinA) {
  const parametres = new URLSearchParams({
    title: "WikiMasters : 10 paquets prêts",
    tags: "package",
    click: PAGE_PAQUETS
  });
  // ntfy refuse un délai de moins de 10 secondes : dans ce cas, on envoie tout de suite.
  if (pleinA - Date.now() > 15 * 1000) {
    parametres.set("delay", String(Math.round(pleinA / 1000)));
  }
  return envoyerNtfy(`${SERVEUR_NTFY}/${canal}/${ID_MESSAGE_NTFY}?${parametres}`, "POST",
    "Ton stock de paquets est plein : ouvre-les pour ne pas en perdre !");
}

function annulerNtfy(canal) {
  return envoyerNtfy(`${SERVEUR_NTFY}/${canal}/${ID_MESSAGE_NTFY}`, "DELETE");
}

// Met le message programmé chez ntfy en accord avec les réglages et l'heure du stock plein.
async function synchroniserTelephone() {
  const reglages = await lireReglages();
  const pleinA = await lirePleinA();
  const { ntfy: dejaProgramme = null } = await api.storage.local.get("ntfy"); // { canal, pleinA } ou null
  const maintenant = Date.now();
  const canal = reglages.canalNtfy;

  const voulu = reglages.notifTel && canalValide(canal)
    && pleinA !== null && pleinA > maintenant
    && await accordEnvoiDonnees();

  // Un message est déjà programmé et pas encore livré.
  if (dejaProgramme && dejaProgramme.pleinA > maintenant) {
    const toujoursBon = voulu && dejaProgramme.canal === canal
      && Math.abs(dejaProgramme.pleinA - pleinA) < UNE_MINUTE;
    if (toujoursBon) return; // rien à changer : on n'envoie rien
    if (!voulu || dejaProgramme.canal !== canal) {
      await annulerNtfy(dejaProgramme.canal); // notifications coupées, ou canal changé
    }
  }

  let nouveau = null;
  if (voulu && await programmerNtfy(canal, pleinA)) {
    nouveau = { canal: canal, pleinA: pleinA };
  }
  await api.storage.local.set({ ntfy: nouveau });
}


// ---------------------------------------------------------------------
//  PARTIE 6 : LE BOUTON « ENVOYER UNE NOTIFICATION DE TEST »
// ---------------------------------------------------------------------

async function envoyerTest() {
  const reglages = await lireReglages();
  const resultat = { pc: null, telephone: null }; // null = pas demandé

  if (reglages.notifPC) {
    try {
      await notifierPC("Test WikiMasters Doublons", "Les notifications sur ce PC fonctionnent.");
      resultat.pc = true;
    } catch (erreur) {
      resultat.pc = false;
    }
  }
  if (reglages.notifTel) {
    if (!canalValide(reglages.canalNtfy) || !(await accordEnvoiDonnees())) {
      resultat.telephone = false;
    } else {
      const parametres = new URLSearchParams({ title: "Test WikiMasters Doublons", tags: "white_check_mark" });
      resultat.telephone = await envoyerNtfy(`${SERVEUR_NTFY}/${reglages.canalNtfy}?${parametres}`, "POST",
        "Les notifications sur ton téléphone fonctionnent.");
    }
  }
  return resultat;
}
