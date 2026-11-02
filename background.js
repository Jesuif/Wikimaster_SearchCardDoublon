// =====================================================================
//  WikiMasters Doublons 1.3 - background.js
//  Le « script d'arrière-plan » : il tourne même quand aucune page
//  WikiMasters n'est ouverte, tant que le navigateur est lancé.
//  Son rôle : estimer ton stock de paquets, l'afficher sur l'icône,
//  et te prévenir avant et quand il est plein.
// =====================================================================

// Chrome charge l'arrière-plan d'un seul fichier : on lui demande d'importer commun.js.
// (Firefox, lui, charge commun.js tout seul : il est listé dans son manifest.)
if (typeof importScripts === "function") importScripts("commun.js");

const ALARME_PLEIN = "paquets-pleins";  // notification PC : stock plein
const ALARME_ALERTE = "paquets-alerte"; // notification PC : nouveau en 1.3, « bientôt plein »
const ALARME_TELEPHONE = "envoi-ntfy";   // courte attente avant d'envoyer au téléphone
const ALARME_BADGE = "badge";            // nouveau en 1.3 : met à jour le nombre sur l'icône
const SERVEUR_NTFY = "https://ntfy.sh";
const PAGE_PAQUETS = "https://www.wiki-masters.com/pulls";
const UNE_MINUTE = 60 * 1000;
const PREFIXE_NOTIFICATION = "wikimasters-";   // début de l'identifiant de nos notifications
const MESSAGE_PLEIN = "Ton stock de paquets est plein : ouvre-les pour ne pas en perdre !";

function titrePlein(max) {
  return `WikiMasters : ${max} paquets prêts`;
}

function titreAlerte(nombre, max) {
  return `WikiMasters : ${nombre} paquets sur ${max}`;
}

function messageAlerte(paquets) {
  return `Ton stock sera plein vers ${heureLisible(paquets.pleinA)} : pense à ouvrir tes paquets.`;
}


// ---------------------------------------------------------------------
//  PARTIE 1 : LIRE LA MÉMOIRE DE L'EXTENSION
//  (api.storage.local, c'est un peu les PlayerPrefs de Unity)
// ---------------------------------------------------------------------

// Le stock : { pleinA, max, prevenuPlein }, ou null si on ne le connaît pas encore.
// pleinA = l'heure où le stock est (ou était) plein. Une heure passée veut dire « déjà plein ».
async function lirePaquets() {
  const { paquets } = await api.storage.local.get("paquets");
  return paquets ?? null;
}

// Un nom de canal ntfy : 1 à 64 lettres, chiffres, tirets ou soulignés.
function canalValide(canal) {
  return /^[-_A-Za-z0-9]{1,64}$/.test(canal || "");
}

// L'heure de l'alerte « bientôt plein », ou null si elle est coupée ou réglée trop haut.
function heureAlerte(reglages, paquets) {
  if (!reglages.alerteAvant || !(reglages.alerteA >= 1 && reglages.alerteA < paquets.max)) return null;
  return heureOuStockAtteint(paquets, reglages.alerteA, reglages.minutesParPaquet);
}

// Nouveau en 1.3 : la version 1.2 rangeait l'heure dans « pleinA » et le message ntfy
// sous une autre forme. On convertit une seule fois, après la mise à jour.
async function convertirAncienneVersion() {
  const ancien = await api.storage.local.get(["pleinA", "ntfy"]);
  if ("pleinA" in ancien) {
    if (typeof ancien.pleinA === "number") {
      await api.storage.local.set({ paquets: { pleinA: ancien.pleinA, max: 10, prevenuPlein: false } });
    }
    await api.storage.local.remove("pleinA");
  }
  if (ancien.ntfy && typeof ancien.ntfy.pleinA === "number") {
    await api.storage.local.set({ ntfy: { canal: ancien.ntfy.canal, messages: { "paquets-pleins": ancien.ntfy.pleinA } } });
  }
}


// ---------------------------------------------------------------------
//  PARTIE 2 : LES MESSAGES VENUS DE content.js ET DE LA PAGE DES RÉGLAGES
// ---------------------------------------------------------------------

api.runtime.onMessage.addListener((message, expediteur, repondre) => {
  if (message.type === "etat-paquets") {
    nouvelEtatPaquets(message);
  }
  if (message.type === "ouvrir-reglages") {
    ouvrirReglages(expediteur.tab);
  }
  if (message.type === "tester") {
    envoyerTest().then(repondre);
    return true; // « je répondrai plus tard » (la réponse arrive après l'envoi)
  }
});

// La page des réglages s'ouvre dans un nouvel onglet, juste à côté de l'onglet d'où vient la demande.
function ouvrirReglages(onglet) {
  const nouvelOnglet = { url: api.runtime.getURL("options.html") };
  if (onglet) {
    nouvelOnglet.windowId = onglet.windowId;
    nouvelOnglet.index = onglet.index + 1;
  }
  api.tabs.create(nouvelOnglet);
}

// Nouveau en 1.3 : un clic sur l'icône de l'extension ouvre aussi les réglages.
api.action.onClicked.addListener(onglet => ouvrirReglages(onglet));

// content.js a lu le stock sur la page Paquets : { plein: true } ou { plein: false, pleinA, max }.
async function nouvelEtatPaquets(message) {
  const maintenant = Date.now();
  const ancien = await lirePaquets();
  const max = message.max || 10;

  if (ancien) {
    const etaitPlein = ancien.pleinA <= maintenant;
    if (message.plein && etaitPlein) return; // toujours plein : rien de neuf
    if (!message.plein && !etaitPlein && Math.abs(message.pleinA - ancien.pleinA) < UNE_MINUTE) return; // même heure
  }

  if (message.plein) {
    // Le site affiche 10/10 alors que l'alarme n'a pas encore sonné (le site a été un peu
    // plus rapide que notre calcul) : on prévient tout de suite au lieu de se taire.
    const reglages = await lireReglages();
    const alarmeImminente = ancien && !ancien.prevenuPlein && ancien.pleinA - maintenant < 2 * UNE_MINUTE;
    if (alarmeImminente && reglages.notifPC) await notifierPC(titrePlein(max), MESSAGE_PLEIN);
    // Tu as la page sous les yeux : inutile de te prévenir une deuxième fois.
    await api.storage.local.set({ paquets: { pleinA: maintenant, max: max, prevenuPlein: true } });
  } else {
    await api.storage.local.set({ paquets: { pleinA: message.pleinA, max: max, prevenuPlein: false } });
  }
  await programmerTout();
}

// Quand tu changes un réglage dans la page des réglages, on reprogramme tout.
api.storage.onChanged.addListener(changements => {
  if (changements.reglages) programmerTout();
});


// ---------------------------------------------------------------------
//  PARTIE 3 : PROGRAMMER LES NOTIFICATIONS ET LE BADGE
// ---------------------------------------------------------------------

async function programmerTout() {
  const reglages = await lireReglages();
  const paquets = await lirePaquets();
  const maintenant = Date.now();

  // 1) Sur le PC : une alarme à l'heure du stock plein...
  if (reglages.notifPC && paquets && paquets.pleinA > maintenant) {
    await api.alarms.create(ALARME_PLEIN, { when: paquets.pleinA });
  } else {
    await api.alarms.clear(ALARME_PLEIN);
  }
  // ... et, nouveau en 1.3, une autre à l'heure de l'alerte « bientôt plein ».
  const alerte = paquets ? heureAlerte(reglages, paquets) : null;
  if (reglages.notifPC && alerte !== null && alerte > maintenant) {
    await api.alarms.create(ALARME_ALERTE, { when: alerte });
  } else {
    await api.alarms.clear(ALARME_ALERTE);
  }

  // 2) Sur le téléphone : on attend 45 secondes avant d'envoyer, au cas où tu ouvrirais
  //    plusieurs paquets d'affilée (un seul envoi au lieu de dix).
  await api.alarms.create(ALARME_TELEPHONE, { when: maintenant + 45 * 1000 });

  // 3) Le nombre sur l'icône.
  await mettreAJourBadge();
}

// Une alarme sonne.
api.alarms.onAlarm.addListener(async alarme => {
  const reglages = await lireReglages();
  const paquets = await lirePaquets();

  if (alarme.name === ALARME_PLEIN && paquets && !paquets.prevenuPlein) {
    if (reglages.notifPC) await notifierPC(titrePlein(paquets.max), MESSAGE_PLEIN);
    await api.storage.local.set({ paquets: { ...paquets, prevenuPlein: true } });
  }
  if (alarme.name === ALARME_ALERTE && paquets && reglages.notifPC && reglages.alerteAvant) {
    await notifierPC(titreAlerte(reglages.alerteA, paquets.max), messageAlerte(paquets));
  }
  if (alarme.name === ALARME_TELEPHONE) {
    await synchroniserTelephone();
  }
  await mettreAJourBadge(); // à chaque alarme, le nombre sur l'icône est remis à jour
});

// Au démarrage du navigateur (ou après une mise à jour de l'extension) : les alarmes
// ont pu être effacées, on rattrape.
async function rattraper() {
  await convertirAncienneVersion();
  const paquets = await lirePaquets();
  if (paquets && paquets.pleinA <= Date.now() && !paquets.prevenuPlein) {
    // Le stock s'est rempli pendant que le navigateur était fermé.
    const reglages = await lireReglages();
    if (reglages.notifPC) {
      await notifierPC("WikiMasters : tes paquets sont sûrement pleins",
        `Ton stock devait être plein à ${heureLisible(paquets.pleinA)}. Ouvre-les vite !`);
    }
    await api.storage.local.set({ paquets: { ...paquets, prevenuPlein: true } });
  }
  await programmerTout();
}
api.runtime.onStartup.addListener(rattraper);
api.runtime.onInstalled.addListener(rattraper);


// ---------------------------------------------------------------------
//  PARTIE 4 : LE BADGE SUR L'ICÔNE (nouveau en 1.3)
// ---------------------------------------------------------------------

async function mettreAJourBadge() {
  const reglages = await lireReglages();
  const paquets = await lirePaquets();
  if (!reglages.badge || !paquets) {
    await api.action.setBadgeText({ text: "" });
    await api.action.setTitle({ title: "WikiMasters Doublons" });
    await api.alarms.clear(ALARME_BADGE);
    return;
  }
  const nombre = paquetsEstimes(paquets, reglages.minutesParPaquet, Date.now());
  // Vert : tout va bien. Orange : bientôt plein. Rouge : plein, tu perds des paquets.
  let couleur = "#2f6f4f";
  const seuil = reglages.alerteAvant ? reglages.alerteA : paquets.max - 2;
  if (nombre >= seuil) couleur = "#c77700";
  if (nombre >= paquets.max) couleur = "#c62828";
  await api.action.setBadgeText({ text: String(nombre) });
  await api.action.setBadgeBackgroundColor({ color: couleur });
  await api.action.setTitle({ title: `WikiMasters Doublons : environ ${nombre} paquet(s) sur ${paquets.max}` });

  // Tant que le stock n'est pas plein, on recompte toutes les minutes.
  if (nombre < paquets.max) {
    await api.alarms.create(ALARME_BADGE, { periodInMinutes: 1 });
  } else {
    await api.alarms.clear(ALARME_BADGE);
  }
}


// ---------------------------------------------------------------------
//  PARTIE 5 : LA NOTIFICATION SUR LE PC
// ---------------------------------------------------------------------

// Chaque notification a son propre identifiant (l'heure en millisecondes) : sinon
// Chrome remplace l'ancienne notification en silence, sans rien afficher (le bug de la 1.1).
async function notifierPC(titre, message) {
  const id = PREFIXE_NOTIFICATION + Date.now();
  const options = {
    type: "basic",
    iconUrl: api.runtime.getURL("icone-128.png"),
    title: titre,
    message: message,
    priority: 2,              // priorité maximale
    requireInteraction: true  // reste à l'écran jusqu'à ce que tu cliques dessus (Chrome)
  };
  try {
    return await api.notifications.create(id, options);
  } catch (erreur) {
    // Firefox ne connaît pas « priority » ni « requireInteraction » : on réessaie sans.
    delete options.priority;
    delete options.requireInteraction;
    return api.notifications.create(id, options);
  }
}

// Un clic sur une de nos notifications la ferme et ouvre la page Paquets.
api.notifications.onClicked.addListener(id => {
  if (!id.startsWith(PREFIXE_NOTIFICATION)) return;
  api.notifications.clear(id);
  api.tabs.create({ url: PAGE_PAQUETS });
});


// ---------------------------------------------------------------------
//  PARTIE 6 : LA NOTIFICATION SUR LE TÉLÉPHONE (application ntfy)
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

// Les messages que ntfy doit livrer plus tard (nouveau en 1.3 : il peut y en avoir deux).
// Chacun a un identifiant fixe : le renvoyer remplace le message programmé avant.
function messagesVoulus(reglages, paquets) {
  const messages = [{ id: "paquets-pleins", quand: paquets.pleinA, titre: titrePlein(paquets.max),
    texte: MESSAGE_PLEIN, icone: "package" }];
  const alerte = heureAlerte(reglages, paquets);
  if (alerte !== null) {
    messages.push({ id: "paquets-alerte", quand: alerte, titre: titreAlerte(reglages.alerteA, paquets.max),
      texte: messageAlerte(paquets), icone: "hourglass" });
  }
  return messages.filter(message => message.quand > Date.now());
}

// Programme un message chez ntfy, qui le livrera à l'heure dite, même si ton PC est éteint.
function programmerNtfy(canal, message) {
  const parametres = new URLSearchParams({ title: message.titre, tags: message.icone, click: PAGE_PAQUETS });
  // ntfy refuse un délai de moins de 10 secondes : dans ce cas, on envoie tout de suite.
  if (message.quand - Date.now() > 15 * 1000) {
    parametres.set("delay", String(Math.round(message.quand / 1000)));
  }
  return envoyerNtfy(`${SERVEUR_NTFY}/${canal}/${message.id}?${parametres}`, "POST", message.texte);
}

function annulerNtfy(canal, id) {
  return envoyerNtfy(`${SERVEUR_NTFY}/${canal}/${id}`, "DELETE");
}

// Met les messages programmés chez ntfy en accord avec les réglages et le stock.
// La mémoire « ntfy » retient ce qui est déjà programmé : { canal, messages: { id: heure } }.
async function synchroniserTelephone() {
  const reglages = await lireReglages();
  const paquets = await lirePaquets();
  const { ntfy: deja = null } = await api.storage.local.get("ntfy");
  const maintenant = Date.now();
  const canal = reglages.canalNtfy;

  const actif = reglages.notifTel && canalValide(canal) && paquets !== null && await accordEnvoiDonnees();
  const voulus = actif ? messagesVoulus(reglages, paquets) : [];
  const programmes = deja ? deja.messages : {};

  // 1) On annule ce qui n'est plus voulu (notification coupée, canal changé, heure dépassée...).
  for (const [id, quand] of Object.entries(programmes)) {
    const encoreVoulu = deja.canal === canal && voulus.some(message => message.id === id);
    if (quand > maintenant && !encoreVoulu) await annulerNtfy(deja.canal, id);
  }

  // 2) On programme ce qui est nouveau ou dont l'heure a changé ; le reste ne bouge pas.
  const nouveaux = {};
  for (const message of voulus) {
    const dejaBon = deja && deja.canal === canal && Math.abs((programmes[message.id] ?? 0) - message.quand) < UNE_MINUTE;
    if (dejaBon || await programmerNtfy(canal, message)) nouveaux[message.id] = message.quand;
  }
  await api.storage.local.set({ ntfy: Object.keys(nouveaux).length ? { canal: canal, messages: nouveaux } : null });
}


// ---------------------------------------------------------------------
//  PARTIE 7 : LE BOUTON « ENVOYER UNE NOTIFICATION DE TEST »
// ---------------------------------------------------------------------

async function envoyerTest() {
  const reglages = await lireReglages();
  const resultat = { pc: null, telephone: null, permission: null }; // null = pas demandé

  // Chrome sait dire si tu as bloqué les notifications de l'extension (Firefox ne le dit pas).
  if (api.notifications.getPermissionLevel) {
    resultat.permission = await api.notifications.getPermissionLevel();
  }
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
