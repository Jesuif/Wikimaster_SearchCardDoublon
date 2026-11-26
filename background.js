// =====================================================================
//  WikiMasters Doublons 1.20.6 (sans chargement automatique) - background.js
//  Le « script d'arrière-plan » : il tourne même quand aucune page
//  WikiMasters n'est ouverte, tant que le navigateur est lancé.
//  Son rôle : estimer ton stock de paquets, l'afficher sur l'icône,
//  et te prévenir avant et quand il est plein.
//  Nouveau en 1.8 : te prévenir avant la fin des enchères que tu suis.
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

// Corrigé en 1.4 : trois endroits pouvaient annoncer « stock plein » (l'alarme, le rattrapage
// au démarrage de Chrome et la page Paquets). Chacun envoyait la notification AVANT de noter
// « déjà prévenu » : quand deux se déclenchaient presque en même temps, tu recevais deux
// notifications. Désormais, tout ce qui lit puis modifie le stock passe par unParUn() :
// une file d'attente qui fait passer les tâches l'une après l'autre, jamais en même temps.
let fileAttente = Promise.resolve();
function unParUn(tache) {
  const resultat = fileAttente.then(tache, tache);
  fileAttente = resultat.catch(erreur => console.warn("[WikiMasters Doublons]", erreur));
  return resultat;
}

// La SEULE fonction qui annonce « stock plein » sur le PC. À appeler depuis unParUn().
// Elle note « prévenu » AVANT d'envoyer : un deuxième appel ne fait donc plus rien.
async function prevenirPlein(paquets, titre, message) {
  if (!paquets || paquets.prevenuPlein) return;
  await api.storage.local.set({ paquets: { ...paquets, prevenuPlein: true } });
  const reglages = await lireReglages();
  if (reglages.notifPC) await notifierPC(titre, message);
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
    unParUn(() => nouvelEtatPaquets(message));
  }
  if (message.type === "ouvrir-reglages") {
    ouvrirReglages(expediteur.tab);
  }
  // 1.18 : les prix de base livrés avec l'extension (fichier prix-marche-wikimasters.csv du dossier).
  if (message.type === "prix-de-base") {
    fetch(api.runtime.getURL("prix-marche-wikimasters.csv"))
      .then(r => r.ok ? r.text() : null)
      .catch(() => null)
      .then(texte => repondre(typeof texte === "string" ? { texte: texte } : { absent: true }));
    return true;
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

  const reglages = await lireReglages();

  if (ancien) {
    const etaitPlein = ancien.pleinA <= maintenant;
    if (message.plein && etaitPlein) return; // toujours plein : rien de neuf
    if (!message.plein && !etaitPlein && Math.abs(message.pleinA - ancien.pleinA) < UNE_MINUTE) return; // même heure
  }

  if (message.plein) {
    // Le site affiche 10/10 alors que l'alarme n'a pas encore sonné (le site a été un peu
    // plus rapide que notre calcul) : on prévient tout de suite au lieu de se taire.
    const alarmeImminente = ancien && ancien.pleinA - maintenant < 2 * UNE_MINUTE;
    if (alarmeImminente) await prevenirPlein(ancien, titrePlein(max), MESSAGE_PLEIN);
    // Tu as la page sous les yeux : inutile de te prévenir une deuxième fois.
    await api.storage.local.set({ paquets: { pleinA: maintenant, max: max, prevenuPlein: true } });
  } else {
    // Corrigé en 1.4 : l'alarme a pu sonner un peu en avance sur le site (qui affiche encore
    // 9/10). Si la nouvelle heure est presque la même, tu as déjà été prévenu pour ce
    // remplissage : on ne te prévient pas une deuxième fois quelques minutes plus tard.
    const memeRemplissage = ancien && ancien.prevenuPlein
      && Math.abs(message.pleinA - ancien.pleinA) < reglages.minutesParPaquet * UNE_MINUTE / 2;
    await api.storage.local.set({ paquets: { pleinA: message.pleinA, max: max, prevenuPlein: Boolean(memeRemplissage) } });
  }
  await programmerTout();
}

// Quand tu changes un réglage dans la page des réglages, on reprogramme tout.
// Nouveau en 1.8 : pareil quand une enchère est suivie, oubliée, ou que son heure de fin change.
api.storage.onChanged.addListener(changements => {
  if (changements.reglages) programmerTout();
  else if (changements.encheres) {
    programmerEncheres().catch(erreur => console.warn("[WikiMasters Doublons]", erreur));
    // Le téléphone : un seul envoi pour plusieurs changements rapprochés.
    api.alarms.create(ALARME_TELEPHONE, { when: Date.now() + 10 * 1000 });
  }
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

  // 4) Nouveau en 1.8 : les alertes des enchères suivies.
  await programmerEncheres();
}

// Une alarme sonne.
api.alarms.onAlarm.addListener(async alarme => {
  // Nouveau en 1.8 : une alerte d'enchère, ou la vérification régulière des enchères suivies.
  if (alarme.name.startsWith(PREFIXE_ALARME_ENCHERE)) {
    await alerteEnchere(alarme.name);
    return;
  }
  if (alarme.name === ALARME_ENCHERES_MENAGE) { // 1.12 : une enchère vient de finir il y a plus d'une minute
    await nettoyerEncheres();
    return;
  }
  if (alarme.name === ALARME_ENCHERES_SYNCHRO) {
    await nettoyerEncheres();
    await programmerEncheres();
    await synchroniserTelephone();
    return;
  }
  if (alarme.name === ALARME_PLEIN) {
    await unParUn(async () => {
      const paquets = await lirePaquets();
      if (paquets) await prevenirPlein(paquets, titrePlein(paquets.max), MESSAGE_PLEIN);
    });
  }
  const reglages = await lireReglages();
  const paquets = await lirePaquets();
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
// Corrigé en 1.4 : au démarrage, Chrome fait aussi sonner l'alarme manquée. Avant, elle
// ET le rattrapage notifiaient (c'était la double notification). Maintenant ils passent
// par la même file et le second voit que tu as déjà été prévenu.
function rattraper() {
  return unParUn(async () => {
    await convertirAncienneVersion();
    const paquets = await lirePaquets();
    if (paquets && paquets.pleinA <= Date.now()) {
      // Le stock s'est rempli pendant que le navigateur était fermé.
      await prevenirPlein(paquets, "WikiMasters : tes paquets sont sûrement pleins",
        `Ton stock devait être plein à ${heureLisible(paquets.pleinA)}. Ouvre-les vite !`);
    }
    await programmerTout();
  });
}
api.runtime.onStartup.addListener(rattraper);
api.runtime.onInstalled.addListener(rattraper);

// Nouveau en 1.6.5 : une seule fois, on oublie les prix relevés pour « Système de Ponzi »
// (une estimation à 10 000 avait été enregistrée par erreur). Ils seront relus au Marché.
async function remiseAZeroPonzi() {
  const { remisePonzi165, marche } = await api.storage.local.get(["remisePonzi165", "marche"]);
  if (remisePonzi165) return;
  const simplifier = texte => texte.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (marche && marche.annonces) {
    for (const [cle, annonce] of Object.entries(marche.annonces)) {
      if (simplifier(annonce.nom || "") === "systeme de ponzi") delete marche.annonces[cle];
    }
    await api.storage.local.set({ marche: marche });
  }
  await api.storage.local.set({ remisePonzi165: true });
}
api.runtime.onInstalled.addListener(remiseAZeroPonzi);


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
// 1.8 : "prefixe" permet de reconnaître une alerte d'enchère au moment du clic.
async function notifierPC(titre, message, prefixe = PREFIXE_NOTIFICATION) {
  const id = prefixe + Date.now();
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
// Nouveau en 1.8 : pour une alerte d'enchère, il ouvre la page de l'enchère.
api.notifications.onClicked.addListener(id => {
  if (!id.startsWith(PREFIXE_NOTIFICATION)) return;
  api.notifications.clear(id);
  const enchere = id.match(/^wikimasters-enchere-([0-9a-f-]{36})-/i);
  api.tabs.create({ url: enchere ? adresseEnchere(enchere[1]) : PAGE_PAQUETS });
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
function messagesPaquets(reglages, paquets) {
  const messages = [{ id: "paquets-pleins", quand: paquets.pleinA, titre: titrePlein(paquets.max),
    texte: MESSAGE_PLEIN, icone: "package", clic: PAGE_PAQUETS }];
  const alerte = heureAlerte(reglages, paquets);
  if (alerte !== null) {
    messages.push({ id: "paquets-alerte", quand: alerte, titre: titreAlerte(reglages.alerteA, paquets.max),
      texte: messageAlerte(paquets), icone: "hourglass", clic: PAGE_PAQUETS });
  }
  return messages.filter(message => message.quand > Date.now());
}

// Nouveau en 1.8 : les alertes d'enchères à livrer sur le téléphone. ntfy.sh ne garde un message
// programmé que 3 jours au plus : les alertes plus lointaines seront envoyées plus tard
// (la vérification régulière des enchères repasse toutes les 30 minutes).
const NTFY_DELAI_MAX = 3 * JOUR - HEURE;
function messagesEncheres(reglages, encheres, maintenant) {
  return alertesVoulues(reglages, encheres, maintenant, null)
    .filter(alerte => alerte.quand - maintenant < NTFY_DELAI_MAX)
    .map(alerte => ({ id: `enchere-${alerte.id}-${alerte.minutes}`, quand: alerte.quand, titre: titreEnchere(alerte.enchere),
      texte: texteEnchere(alerte.enchere, alerte.minutes * MINUTE), icone: "hourglass_flowing_sand",
      clic: adresseEnchere(alerte.id), enchere: true,
      // 1.15 : ce qui, s'il change, demande de renvoyer l'alerte programmée (tu mènes / surenchéri, dernière mise).
      cle: `${alerte.enchere.statut || ""}|${alerte.enchere.prix || ""}` }));
}

// Programme un message chez ntfy, qui le livrera à l'heure dite, même si ton PC est éteint.
function programmerNtfy(canal, message) {
  const parametres = new URLSearchParams({ title: message.titre, tags: message.icone, click: message.clic || PAGE_PAQUETS });
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
  const encheres = await lireEncheres();
  const { ntfy: deja = null } = await api.storage.local.get("ntfy");
  const maintenant = Date.now();
  const canal = reglages.canalNtfy;

  const possible = canalValide(canal) && (reglages.notifTel || reglages.enchereNotifTel) && await accordEnvoiDonnees();
  const voulus = [];
  if (possible && reglages.notifTel && paquets !== null) voulus.push(...messagesPaquets(reglages, paquets));
  // Nouveau en 1.8 : les alertes des enchères suivies.
  if (possible && reglages.encheres && reglages.enchereNotifTel) voulus.push(...messagesEncheres(reglages, encheres, maintenant));
  const programmes = deja ? deja.messages : {};
  const memeCanal = Boolean(deja && deja.canal === canal);

  // 0) Nouveau en 1.8 : une alerte d'enchère déjà livrée ne repart pas si l'heure de fin n'a été
  //    que précisée (2 minutes d'écart au plus) : sinon tu la recevrais deux fois.
  const aEnvoyer = voulus.filter(message => {
    const avant = memeCanal ? programmes[message.id] : undefined;
    return !(message.enchere && avant !== undefined && avant <= maintenant && message.quand - avant <= 2 * UNE_MINUTE);
  });

  // 1) On annule ce qui n'est plus voulu (notification coupée, canal changé, heure dépassée...).
  for (const [id, quand] of Object.entries(programmes)) {
    const encoreVoulu = memeCanal && aEnvoyer.some(message => message.id === id);
    if (quand > maintenant && !encoreVoulu) await annulerNtfy(deja.canal, id);
  }

  // 2) On programme ce qui est nouveau ou dont l'heure a changé ; le reste ne bouge pas.
  // 1.15 : une alerte d'enchère pas encore livrée est aussi renvoyée quand ton statut (tu mènes / surenchéri)
  // ou la dernière mise vue a changé : avant, le téléphone pouvait annoncer « Tu mènes » alors que tu étais surenchéri.
  const clesAvant = memeCanal && deja.cles ? deja.cles : {};
  const nouveaux = {}, cles = {};
  for (const message of aEnvoyer) {
    const memeHeure = memeCanal && Math.abs((programmes[message.id] ?? 0) - message.quand) < UNE_MINUTE;
    const memeTexte = !message.cle || clesAvant[message.id] === undefined || clesAvant[message.id] === message.cle
      || (programmes[message.id] ?? 0) <= maintenant; // déjà livrée : on ne la renvoie pas pour un simple changement de statut
    if ((memeHeure && memeTexte) || await programmerNtfy(canal, message)) {
      nouveaux[message.id] = message.quand;
      if (message.cle) cles[message.id] = (memeHeure && memeTexte && clesAvant[message.id] !== undefined) ? clesAvant[message.id] : message.cle;
    }
  }

  // 3) Nouveau en 1.8 : on se souvient des alertes d'enchères déjà livrées tant que l'enchère court.
  if (memeCanal) {
    for (const [id, quand] of Object.entries(programmes)) {
      const trouve = id.match(/^enchere-([0-9a-f-]{36})-\d+$/i);
      const enchere = trouve && encheres[trouve[1].toLowerCase()];
      if (nouveaux[id] === undefined && quand <= maintenant && enchere && !enchere.terminee && enchere.finMax > maintenant) {
        nouveaux[id] = quand;
      }
    }
  }
  await api.storage.local.set({ ntfy: Object.keys(nouveaux).length ? { canal: canal, messages: nouveaux, cles: cles } : null });
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
  // 1.8 : le test vaut aussi pour les alertes d'enchères (cases « Sur ce PC » / « Sur mon téléphone » des enchères).
  if (reglages.notifPC || (reglages.encheres && reglages.enchereNotifPC)) {
    try {
      await notifierPC("Test WikiMasters Doublons", "Les notifications sur ce PC fonctionnent.");
      resultat.pc = true;
    } catch (erreur) {
      resultat.pc = false;
    }
  }
  if (reglages.notifTel || (reglages.encheres && reglages.enchereNotifTel)) {
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


// ---------------------------------------------------------------------
//  PARTIE 8 : LES ENCHÈRES SUIVIES (nouveau en 1.8)
//  content.js range dans la mémoire « encheres » les enchères que tu suis et leur heure
//  de fin (fin = la plus tôt possible, finMax = la plus tard possible). Ici, on programme
//  une alarme par alerte voulue (par exemple 1 h et 10 min avant la fin), et on prévient.
//  « encheresEnvoyees » retient les alertes déjà envoyées sur le PC, pour ne jamais les
//  envoyer deux fois.
// ---------------------------------------------------------------------

const PREFIXE_ALARME_ENCHERE = "enchere|";            // enchere|<identifiant>|<minutes avant la fin>
const ALARME_ENCHERES_SYNCHRO = "encheres-synchro";  // vérification régulière (toutes les 30 minutes)
const ALARME_ENCHERES_MENAGE = "encheres-menage";    // 1.12 : retirer les enchères finies depuis plus d'une minute
const OUBLI_APRES_FIN = MINUTE;                       // 1.12 : une enchère finie n'est plus suivie après 1 minute
const FINIES_GARDEES = 7 * JOUR;                      // 1.12 : la mémoire « encheresFinies » (prix d'achat) est gardée 7 jours

// 1.12 : depuis quand l'enchère est finie (ms), ou null si elle ne l'est pas (ou pas sûrement).
// - finMax dépassée : la fin la plus tardive possible est passée ;
// - « Terminée » / « Vendue » vu sur le site (termineeVue, écrit par content.js).
function finieDepuis(enchere, maintenant) {
  const moments = [];
  if (enchere.finMax && enchere.finMax <= maintenant) moments.push(enchere.finMax);
  if (enchere.terminee) moments.push(enchere.termineeVue || enchere.vu || maintenant);
  return moments.length ? Math.min(...moments) : null;
}

function adresseEnchere(id) {
  return `https://www.wiki-masters.com/marketplace/${id}`;
}

async function lireEncheres() {
  const { encheres } = await api.storage.local.get("encheres");
  return encheres || {};
}

function titreEnchere(enchere) {
  const lettre = enchere.rarete && RARETES[enchere.rarete] ? ` (${lettreRarete(enchere.rarete)})` : "";
  return `Enchère bientôt finie : ${enchere.nom || "une carte"}${lettre}`;
}

// « Il reste environ 10 min (fin vers 18:42). Tu mènes (vu à 18:20). Dernière mise vue : 530. »
// Le statut (« Vous menez » / « Surenchéri ») est celui vu la dernière fois sur le site.
function texteEnchere(enchere, reste) {
  const marge = (enchere.finMax || enchere.fin) - enchere.fin;
  const statut = enchere.statut === "menez" ? "Tu mènes" : enchere.statut === "surencheri" ? "Tu as été surenchéri !" : "";
  return `Il reste environ ${dureeLisible(Math.max(0, reste))} (fin vers ${heureLisible(enchere.fin)}`
    + (marge > 2 * MINUTE ? `, à ${dureeLisible(marge)} près` : "") + ")."
    + (statut ? ` ${statut}${enchere.statutVu ? ` (vu à ${heureLisible(enchere.statutVu)})` : ""}.`.replace("!.", "!") : "")
    + (enchere.prix ? ` Dernière mise vue : ${nombreLisible(enchere.prix)}.` : "");
}

// Les alertes encore à venir : [{ id, minutes, quand, enchere }].
// "envoyees" (ou null) : les alertes déjà envoyées, qui ne repartent que si la fin a reculé de plus de 2 minutes
// (une enchère prolongée), pas si son heure a seulement été précisée.
function alertesVoulues(reglages, encheres, maintenant, envoyees) {
  if (!reglages.encheres) return [];
  const delais = nettoyerDelais(reglages.enchereDelais);
  const alertes = [];
  for (const enchere of Object.values(encheres)) {
    if (enchere.terminee || !enchere.fin || !(enchere.finMax > maintenant)) continue;
    for (const minutes of delais) {
      const quand = enchere.fin - minutes * MINUTE;
      if (quand <= maintenant) continue;
      const envoyee = envoyees && envoyees[`${enchere.id}|${minutes}`];
      if (envoyee && enchere.fin - envoyee.fin <= 2 * MINUTE) continue;
      alertes.push({ id: enchere.id, minutes: minutes, quand: quand, enchere: enchere });
    }
  }
  return alertes;
}

// Met les alarmes des enchères en accord avec la mémoire : crée les nouvelles, déplace celles
// dont l'heure a changé, efface celles qui ne servent plus.
async function programmerEncheres() {
  const reglages = await lireReglages();
  const encheres = await lireEncheres();
  const { encheresEnvoyees: envoyees = {} } = await api.storage.local.get("encheresEnvoyees");
  const maintenant = Date.now();
  const voulues = reglages.enchereNotifPC ? alertesVoulues(reglages, encheres, maintenant, envoyees) : [];
  const parNom = new Map(voulues.map(alerte => [`${PREFIXE_ALARME_ENCHERE}${alerte.id}|${alerte.minutes}`, alerte.quand]));

  const existantes = await api.alarms.getAll();
  const heures = new Map(existantes.map(alarme => [alarme.name, alarme.scheduledTime]));
  for (const alarme of existantes) {
    if (alarme.name.startsWith(PREFIXE_ALARME_ENCHERE) && !parNom.has(alarme.name)) await api.alarms.clear(alarme.name);
  }
  for (const [nom, quand] of parNom) {
    if (!heures.has(nom) || Math.abs(heures.get(nom) - quand) > SECONDE) await api.alarms.create(nom, { when: quand });
  }
  // La vérification régulière tourne tant qu'il y a des enchères en mémoire (téléphone au-delà de
  // 3 jours, ménage des enchères terminées).
  if (reglages.encheres && Object.keys(encheres).length > 0) {
    if (!heures.has(ALARME_ENCHERES_SYNCHRO)) await api.alarms.create(ALARME_ENCHERES_SYNCHRO, { periodInMinutes: 30 });
  } else {
    await api.alarms.clear(ALARME_ENCHERES_SYNCHRO);
  }

  // 1.12 : le ménage des enchères finies, programmé une minute après la fin la plus proche
  // (la fin la plus tardive possible, ou le moment où « Terminée » a été vu sur le site).
  const prochainMenage = Object.values(encheres).map(enchere => {
    const finie = finieDepuis(enchere, maintenant);
    if (finie !== null) return finie + OUBLI_APRES_FIN;
    return enchere.finMax ? enchere.finMax + OUBLI_APRES_FIN : null;
  }).filter(quand => quand !== null).sort((a, b) => a - b)[0];
  if (prochainMenage === undefined) {
    await api.alarms.clear(ALARME_ENCHERES_MENAGE);
  } else if (prochainMenage <= maintenant) {
    await nettoyerEncheres(); // déjà dû : tout de suite (l'écriture relancera programmerEncheres)
  } else if (!heures.has(ALARME_ENCHERES_MENAGE) || Math.abs(heures.get(ALARME_ENCHERES_MENAGE) - (prochainMenage + SECONDE)) > SECONDE) {
    await api.alarms.create(ALARME_ENCHERES_MENAGE, { when: prochainMenage + SECONDE });
  }
}

// Une alarme d'enchère sonne : on prévient sur le PC (une seule fois par alerte).
async function alerteEnchere(nomAlarme) {
  const [, id, minutesTexte] = nomAlarme.split("|");
  const minutes = parseInt(minutesTexte, 10);
  await unParUn(async () => {
    const reglages = await lireReglages();
    const encheres = await lireEncheres();
    const enchere = encheres[id];
    const maintenant = Date.now();
    if (!reglages.encheres || !reglages.enchereNotifPC || !enchere || enchere.terminee || !enchere.fin
      || !(enchere.finMax > maintenant)) return;
    const delais = nettoyerDelais(reglages.enchereDelais);
    if (!delais.includes(minutes)) return;
    // L'heure de fin a reculé depuis (enchère prolongée) : il est trop tôt, on reprogramme.
    if (enchere.fin - minutes * MINUTE > maintenant + MINUTE) {
      await programmerEncheres();
      return;
    }
    const { encheresEnvoyees: envoyees = {} } = await api.storage.local.get("encheresEnvoyees");
    const deja = envoyees[`${id}|${minutes}`];
    if (deja && enchere.fin - deja.fin <= 2 * MINUTE) return;
    // Si plusieurs alertes sont en retard en même temps (PC sorti de veille), une seule notification
    // part, avec le vrai temps restant : toutes les alertes déjà passées sont notées comme envoyées.
    for (const d of delais) {
      if (enchere.fin - d * MINUTE <= maintenant + MINUTE) envoyees[`${id}|${d}`] = { fin: enchere.fin, quand: maintenant };
    }
    await api.storage.local.set({ encheresEnvoyees: envoyees });
    await notifierPC(titreEnchere(enchere), texteEnchere(enchere, enchere.fin - maintenant),
      `${PREFIXE_NOTIFICATION}enchere-${id}-`);
  });
}

// Le ménage. 1.12 : une enchère finie depuis plus d'UNE MINUTE n'est plus suivie (avant : un jour).
// Elle passe dans la mémoire « encheresFinies » (7 jours), qui ne sert qu'aux prix d'achat (1.10) :
// si tu la menais au dernier passage, ton achat pourra encore être reconnu en repassant sur l'enchère
// ou sur le Marché. Une enchère dont on ne connaît pas la fin et pas revue depuis 14 jours est oubliée.
async function nettoyerEncheres() {
  const { encheres = {}, encheresEnvoyees = {}, encheresIgnorees = {}, encheresFinies = {} } =
    await api.storage.local.get(["encheres", "encheresEnvoyees", "encheresIgnorees", "encheresFinies"]);
  const maintenant = Date.now();
  let change = false, finiesChangees = false;
  for (const [id, enchere] of Object.entries(encheres)) {
    const finie = finieDepuis(enchere, maintenant);
    const depuis = maintenant - Math.max(enchere.finMax || 0, enchere.vu || 0, enchere.suivieLe || 0);
    if (finie !== null && maintenant - finie > OUBLI_APRES_FIN) {
      encheresFinies[id] = { ...enchere, oublieeLe: maintenant };
      finiesChangees = true;
      delete encheres[id];
      change = true;
    } else if (!enchere.fin && depuis > 14 * JOUR) {
      delete encheres[id];
      change = true;
    }
  }
  for (const [id, enchere] of Object.entries(encheresFinies)) {
    if (maintenant - (enchere.oublieeLe || 0) > FINIES_GARDEES) {
      delete encheresFinies[id];
      finiesChangees = true;
    }
  }
  const envoyees = Object.fromEntries(Object.entries(encheresEnvoyees).filter(([cle]) => encheres[cle.split("|")[0]]));
  const ignorees = Object.fromEntries(Object.entries(encheresIgnorees).filter(([, date]) => maintenant - date < 30 * JOUR));
  const aEcrire = {};
  if (change) aEcrire.encheres = encheres;
  if (finiesChangees) aEcrire.encheresFinies = encheresFinies;
  if (Object.keys(envoyees).length !== Object.keys(encheresEnvoyees).length) aEcrire.encheresEnvoyees = envoyees;
  if (Object.keys(ignorees).length !== Object.keys(encheresIgnorees).length) aEcrire.encheresIgnorees = ignorees;
  if (Object.keys(aEcrire).length) await api.storage.local.set(aEcrire);
}


// ---------------------------------------------------------------------
//  1.14 : LES PRIX DU MARCHÉ PARTAGÉS (fichier dans Google Drive)
//  Le bouton « ☁️ Mettre à jour les prix » du panneau lit le fichier des prix
//  partagé, l'ajoute aux prix de l'extension (seulement ce qui manque, comme
//  l'import), puis renvoie le fichier complet.
//  Le fichier est lu et écrit par un petit script Google (Google Apps Script)
//  installé par le propriétaire du fichier : personne n'a besoin de compte Google,
//  il suffit de l'adresse du script et du code secret (réglages de l'extension).
//  Le fichier lui-même peut rester privé dans le Drive de son propriétaire.
//  Rien n'est envoyé à WikiMasters.
// ---------------------------------------------------------------------

async function lirePartage() {
  const { partage = {} } = await api.storage.local.get("partage");
  return partage;
}

function adresseScriptValide(adresse) {
  return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(String(adresse || "").trim());
}

// Le script répond toujours en JSON : { ok: true, ... } ou { ok: false, erreur: "..." }.
async function appelScript(options, adresse) {
  let reponse;
  try {
    reponse = await fetch(adresse, { ...options, redirect: "follow", cache: "no-store" });
  } catch (erreur) {
    throw new Error("le script Google ne répond pas (connexion internet ?)");
  }
  const texte = await reponse.text();
  let donnees;
  try { donnees = JSON.parse(texte); } catch (e) {
    throw new Error(/<html/i.test(texte)
      ? "le script Google a renvoyé une page web : vérifie qu'il est déployé avec « Qui a accès : Tout le monde »"
      : `réponse illisible du script Google (${reponse.status})`);
  }
  if (!donnees.ok) throw new Error(donnees.erreur || "erreur du script Google");
  return donnees;
}

// Étape 1 du bouton : lire le fichier partagé. Renvoie { texte }.
async function partageLireFichier() {
  const partage = await lirePartage();
  if (!adresseScriptValide(partage.adresse) || !partage.code) return { erreur: "pas-configure" };
  // En POST : le code voyage dans le corps de la demande, jamais dans l'adresse (ni historique, ni journaux).
  let donnees;
  try {
    donnees = await appelScript({ method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "lire", code: partage.code }) }, partage.adresse.trim());
  } catch (erreur) {
    // La toute première version du script ne savait pas lire en POST : elle répondait « fichier absent ».
    if (/fichier absent/i.test(erreur.message)) {
      throw new Error("le script Google déployé n'est pas à jour. Recolle le fichier « script-google-prix-partages.gs » "
        + "sur script.google.com, enregistre, puis Déployer → Gérer les déploiements → crayon → Version : Nouvelle version → Déployer");
    }
    throw erreur;
  }
  if (typeof donnees.csv !== "string") throw new Error("le script Google n'a pas renvoyé le fichier (script pas à jour ?)");
  return { texte: donnees.csv };
}

// Étape 2 du bouton : envoyer le fichier complet. Le script le fusionne avec le fichier actuel
// (si quelqu'un a envoyé entre-temps, ses cartes ne sont pas perdues).
async function partageEcrireFichier(texte) {
  const partage = await lirePartage();
  if (!adresseScriptValide(partage.adresse) || !partage.code) return { erreur: "pas-configure" };
  // En « text/plain » : c'est ce que le script Google accepte le plus simplement.
  const donnees = await appelScript({ method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "ecrire", code: partage.code, csv: texte }) }, partage.adresse.trim());
  await api.storage.local.set({ partage: { ...(await lirePartage()), derniereMaj: Date.now() } });
  return { ok: true, lignes: donnees.lignes, ajoutees: donnees.ajoutees };
}

api.runtime.onMessage.addListener((message, expediteur, repondre) => {
  if (message.type !== "partage-lire" && message.type !== "partage-ecrire") return;
  const tache = message.type === "partage-lire" ? partageLireFichier() : partageEcrireFichier(message.texte);
  tache.then(repondre, erreur => repondre({ erreur: erreur.message || String(erreur) }));
  return true;
});
