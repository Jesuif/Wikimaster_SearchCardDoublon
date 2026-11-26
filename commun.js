// =====================================================================
//  WikiMasters Doublons 1.20.4 (sans chargement automatique) - commun.js
//  Nouveau en 1.3 : ce fichier est partagé par les trois parties de
//  l'extension (content.js, background.js et la page des réglages).
//  On y range ce qui doit être identique partout, pour ne l'écrire qu'une fois.
// =====================================================================

// Chrome appelle ses outils « chrome », Firefox les appelle « browser » : on prend celui qui existe.
const api = globalThis.browser ?? globalThis.chrome;

// Tous les réglages, avec leur valeur de départ. Chaque fonction de l'extension a sa case à cocher.
const REGLAGES_PAR_DEFAUT = {
  surlignerAnimees: true,   // cadre doré autour des cartes animées
  etiquettes: true,         // 1.9 (repris de la branche 1.4) : étiquettes suggérées pour chaque carte
  statistiques: true,       // statistiques par rareté après la lecture de la collection
  historique: true,         // comparer chaque lecture à la précédente
  suiviCollection: true,    // 1.19 : collection corrigée toute seule (mises en vente, achats, défausses...)
  manquantes: true,         // cartes manquantes et pourcentage par rareté
  echanges: true,           // copie pour Discord et comparaison avec un ami
  badge: true,              // nombre de paquets estimé sur l'icône de l'extension
  minutesParPaquet: 10,     // 10 minutes par paquet (3 avec WikiMasters PRO)
  notifPC: false,           // notification sur ce PC
  notifTel: false,          // notification sur le téléphone (ntfy)
  canalNtfy: "",
  alerteAvant: false,       // prévenir aussi avant le stock plein...
  alerteA: 8,               // ...quand le stock atteint 8 paquets
  marche: true,             // nouveau en 1.4 : relever et afficher les mises actuelles sur la page Marché
  // 1.10 : les cadres du Marché apparaissent quand la mise est AU MOINS ce pourcentage sous l'estimation
  // (25 = mise à 75 % ou moins de l'estimation, comme avant).
  ecartMoyenne: 25,         // cadre jaune → rouge : écart avec le prix moyen du site
  ecartMax: 25,             // cadre bleu : écart avec le prix le plus haut trouvé au Marché
  // 1.10 : un écart en wikibidous, en plus du pourcentage (0 = pas utilisé).
  ecartMoyenneMontant: 0,
  ecartMaxMontant: 0,
  // 1.14 : pour chaque cadre, SOIT le % SOIT le montant (réglés dans le panneau du Marché).
  // null = pas encore choisi : « montant » si un montant avait été donné avant, sinon « pourcent ».
  ecartMoyenneMode: null,
  ecartMaxMode: null,

  // Nouveau en 1.8 : les enchères suivies.
  encheres: true,           // me prévenir avant la fin des enchères que je suis
  enchereAuto: true,        // suivre tout seul une enchère quand je mise dessus
  enchereDelais: [60, 10],  // les alertes, en minutes avant la fin (ici : 1 h avant, puis 10 min avant)
  enchereNotifPC: true,     // alertes d'enchères sur ce PC
  enchereNotifTel: false,   // alertes d'enchères sur le téléphone (même canal ntfy que les paquets)
  // 1.15 : une fenêtre bleue quand un de mes amis a misé sur l'enchère que je regarde
  // (les amis à ignorer sont dans la mémoire « amisIgnores », réglables dans la page des réglages).
  alerteAmis: true,

  // Nouveau en 1.8 : la lecture page par page.
  animeesJeu: true,         // bouton « Trouver les cartes animées » sur « Toutes les cartes »
  pagesMax: 300,            // au-delà, les recherches sur « Toutes les cartes » refusent de démarrer
  patienceMinutes: 3        // si une page tarde, on réessaie pendant ce temps avant d'abandonner
};

// Nouveau en 1.8 : les alertes d'enchères permises (de 1 minute à 3 jours avant la fin), 10 au plus.
const ENCHERE_DELAI_MAX = 3 * 24 * 60;
function nettoyerDelais(delais) {
  const propres = (Array.isArray(delais) ? delais : [])
    .map(minutes => Math.round(Number(minutes)))
    .filter(minutes => minutes >= 1 && minutes <= ENCHERE_DELAI_MAX);
  return [...new Set(propres)].sort((a, b) => b - a).slice(0, 10); // la plus lointaine d'abord
}

// Lit les réglages enregistrés et complète ceux qui manquent avec les valeurs de départ.
async function lireReglages() {
  const { reglages } = await api.storage.local.get("reglages");
  return { ...REGLAGES_PAR_DEFAUT, ...reglages };
}

// Les 6 raretés du jeu : le nom utilisé dans les images du site, la lettre affichée,
// le nom en clair et un ordre de tri (6 = la plus rare).
const RARETES = {
  legendaire: { lettre: "L",  nom: "Légendaire", ordre: 6 },
  ultra_rare: { lettre: "UR", nom: "Ultra rare", ordre: 5 },
  super_rare: { lettre: "SR", nom: "Super rare", ordre: 4 },
  rare:       { lettre: "R",  nom: "Rare",       ordre: 3 },
  peu_commun: { lettre: "PC", nom: "Peu commun", ordre: 2 },
  commun:     { lettre: "C",  nom: "Commun",     ordre: 1 }
};

function lettreRarete(rarete) {
  return RARETES[rarete] ? RARETES[rarete].lettre : "?";
}

function ordreRarete(rarete) {
  return RARETES[rarete] ? RARETES[rarete].ordre : 0;
}

// L'inverse de lettreRarete : "UR" donne "ultra_rare".
// 1.17.1 : les cartes « L+ » (shiny) sont des L avec un autre visuel : le badge « L✦ shiny » ou « L+ » donne aussi "legendaire".
function rareteDepuisLettre(lettre) {
  const propre = String(lettre == null ? "" : lettre).replace(/shiny|[✦+*]/gi, "").replace(/\s+/g, "");
  if (!propre) return null;
  return Object.keys(RARETES).find(rarete => RARETES[rarete].lettre === propre) || null;
}

// 1.17.1 : un petit badge de rareté. Avant : seulement un élément sans enfant (« L »).
// Les cartes shiny ont « L<span>✦</span><span> shiny</span> » : on accepte aussi un texte court fait de quelques spans.
function estPetitBadge(element) {
  if (element.children.length === 0) return true;
  return element.textContent.trim().length <= 14
    && [...element.children].every(enfant => enfant.tagName === "SPAN" && enfant.children.length === 0);
}

// Combien de paquets as-tu (à peu près) à un moment donné ?
// "paquets" = { pleinA, max } : l'heure (en millisecondes) où le stock est, ou était, plein.
// Exemple avec 10 minutes par paquet : plein dans 25 minutes → il manque 3 paquets → 7 / 10.
function paquetsEstimes(paquets, minutesParPaquet, maintenant) {
  if (maintenant >= paquets.pleinA) return paquets.max;
  const manquants = Math.ceil((paquets.pleinA - maintenant) / (minutesParPaquet * 60 * 1000));
  return Math.max(0, paquets.max - manquants);
}

// L'heure à laquelle le stock atteindra "nombre" paquets.
function heureOuStockAtteint(paquets, nombre, minutesParPaquet) {
  return paquets.pleinA - (paquets.max - nombre) * minutesParPaquet * 60 * 1000;
}

function heureLisible(millisecondes) {
  return new Date(millisecondes).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function dateLisible(millisecondes) {
  const date = new Date(millisecondes);
  return date.toLocaleDateString("fr-FR") + " à " + heureLisible(millisecondes);
}

// Un nombre écrit à la française : 1634 → « 1 634 », 2.5 → « 2,5 ».
function nombreLisible(nombre, decimales = 0) {
  return nombre.toLocaleString("fr-FR", { maximumFractionDigits: decimales });
}


// ---------------------------------------------------------------------
//  Nouveau en 1.8 : LES DURÉES (alertes d'enchères)
// ---------------------------------------------------------------------

const SECONDE = 1000, MINUTE = 60 * SECONDE, HEURE = 60 * MINUTE, JOUR = 24 * HEURE;

// Une durée en millisecondes, écrite pour un humain : « 2 j 3 h », « 1 h 05 », « 12 min », « 40 s ».
function dureeLisible(ms) {
  if (ms < MINUTE) return `${Math.max(0, Math.round(ms / SECONDE))} s`;
  const jours = Math.floor(ms / JOUR);
  const heures = Math.floor((ms % JOUR) / HEURE);
  const minutes = Math.floor((ms % HEURE) / MINUTE);
  if (jours > 0) return heures > 0 ? `${jours} j ${heures} h` : `${jours} j`;
  if (heures > 0) return minutes > 0 ? `${heures} h ${String(minutes).padStart(2, "0")}` : `${heures} h`;
  return `${minutes} min`;
}

// Un délai d'alerte (en minutes) : 90 → « 1 h 30 », 10 → « 10 min », 1440 → « 1 j ».
function delaiLisible(minutes) {
  return dureeLisible(minutes * MINUTE);
}

// Lit une durée écrite par le site : « 2 j 03:12:45 », « 3h 12m », « 12 min 30 s », « 9:32 »,
// « 2 jours 3 heures », « Se termine dans 45 min »...
// Renvoie { ms, precision } (precision = la plus petite unité lue, en ms), ou null si aucune durée.
// Comme pour le minuteur des paquets (« Prochain dans 9:32 »), « 9:32 » se lit 9 min 32 s
// et « 1:09:32 » se lit 1 h 9 min 32 s.
function lireDuree(texte) {
  const t = String(texte).toLowerCase().replace(/\s+/g, " ").trim();
  if (!t || /il y a|\bago\b/.test(t)) return null; // « il y a 3 min » : c'est du passé, pas un compte à rebours
  let ms = 0, precision = null;
  const ajouter = (nombre, unite) => {
    ms += nombre * unite;
    precision = precision === null ? unite : Math.min(precision, unite);
  };
  const fin = "(?![a-zà-ÿ])"; // l'unité ne doit pas être le début d'un mot (« 3 mises », « 2 sur 5 »...)
  const horloge = t.match(/(?:^|[^\d:])(\d{1,3}):(\d{2})(?::(\d{2}))?(?![\d:])/);
  if (horloge) {
    if (horloge[3] !== undefined) {
      ajouter(parseInt(horloge[1], 10), HEURE);
      ajouter(parseInt(horloge[2], 10), MINUTE);
      ajouter(parseInt(horloge[3], 10), SECONDE);
    } else {
      ajouter(parseInt(horloge[1], 10), MINUTE);
      ajouter(parseInt(horloge[2], 10), SECONDE);
    }
  }
  const jours = t.match(new RegExp("(\\d+)\\s*(?:j|jours?|d|days?)" + fin));
  if (jours) ajouter(parseInt(jours[1], 10), JOUR);
  if (!horloge) {
    // « 3h12 » : 3 heures et 12 minutes.
    const heureMinute = t.match(/(\d+)\s*h\s*(\d{2})(?!\d)(?!\s*(?:s|sec|min|m)(?![a-zà-ÿ]))/);
    if (heureMinute) {
      ajouter(parseInt(heureMinute[1], 10), HEURE);
      ajouter(parseInt(heureMinute[2], 10), MINUTE);
    } else {
      const heures = t.match(new RegExp("(\\d+)\\s*(?:h|hrs?|heures?|hours?)" + fin));
      if (heures) ajouter(parseInt(heures[1], 10), HEURE);
    }
    const minutes = !heureMinute && t.match(new RegExp("(\\d+)\\s*(?:min|mins|minutes?|mn|m)" + fin));
    if (minutes) ajouter(parseInt(minutes[1], 10), MINUTE);
    const secondes = t.match(new RegExp("(\\d+)\\s*(?:s|sec|secs|secondes?|seconds?)" + fin));
    if (secondes) ajouter(parseInt(secondes[1], 10), SECONDE);
  }
  return precision === null ? null : { ms: ms, precision: precision };
}

// Vrai si le texte n'est QU'UNE durée (« 2j 03:12:45 », « 3 h 12 min », « 12:45 »), sans autres mots.
function estSeulementUneDuree(texte) {
  const t = String(texte).toLowerCase().replace(/\s+/g, " ").trim();
  const reste = t
    .replace(/\d{1,3}:\d{2}(?::\d{2})?/g, "")
    .replace(/\d+\s*(?:jours?|j|d|heures?|hrs?|h|minutes?|mins?|mn|m|secondes?|secs?|s)(?![a-zà-ÿ])/g, "")
    .replace(/\d{2}(?=\s*$)/, "") // « 3h12 »
    .replace(/[\s,.:\-–]+/g, "");
  return reste === "" && lireDuree(t) !== null;
}

// 1.15 : la précision d'une lecture de fin d'enchère. Un compte à rebours à la seconde (« 12:45 », « 3m 12s »)
// est « précis » : l'heure de fin enregistrée suit alors le site à quelques secondes près.
function lecturePrecise(precisionMs) {
  return Number.isFinite(precisionMs) && precisionMs <= SECONDE;
}

// Lit une date de fin écrite en entier : « 22/11/2026 18:00 », « le 22/11 à 18h00 », « 22 nov. à 18:00 ».
// Renvoie l'heure en millisecondes, ou null.
const MOIS = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
function lireDateFin(texte, maintenant = Date.now()) {
  const t = String(texte).toLowerCase().replace(/\s+/g, " ");
  const heure = t.match(/(\d{1,2})\s*[:h]\s*(\d{2})/);
  let jour = null, mois = null, annee = null;
  const chiffres = t.match(/(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?/);
  if (chiffres) {
    jour = parseInt(chiffres[1], 10);
    mois = parseInt(chiffres[2], 10) - 1;
    if (chiffres[3]) annee = parseInt(chiffres[3], 10) + (chiffres[3].length === 2 ? 2000 : 0);
  } else {
    const lettres = t.match(/(\d{1,2})\s+(janv|f[ée]vr?|mars|avr|mai|juin|juil|ao[uû]t|sept?|oct|nov|d[ée]c)/);
    if (!lettres) return null;
    jour = parseInt(lettres[1], 10);
    const debut = lettres[2].replace("fev", "fév").replace("aou", "aoû").replace("dec", "déc").slice(0, 3);
    mois = MOIS.findIndex(m => m.startsWith(debut));
    if (mois < 0) return null;
  }
  if (!(jour >= 1 && jour <= 31 && mois >= 0 && mois <= 11)) return null;
  const date = new Date(maintenant);
  date.setFullYear(annee ?? date.getFullYear(), mois, jour);
  date.setHours(heure ? parseInt(heure[1], 10) : 23, heure ? parseInt(heure[2], 10) : 59, 0, 0);
  // Sans année : une date déjà passée de plus d'un mois est sans doute celle de l'an prochain.
  if (annee === null && date.getTime() < maintenant - 30 * JOUR) date.setFullYear(date.getFullYear() + 1);
  return date.getTime();
}


// ---------------------------------------------------------------------
//  LES ÉTIQUETTES SUGGÉRÉES (repris en 1.9 de la branche 1.4 de l'extension)
// ---------------------------------------------------------------------

// Les étiquettes que l'extension sait reconnaître. Chaque utilisateur peut les renommer,
// changer leurs mots-clés, les couper ou en ajouter (page des réglages).
// - motsCles : mots cherchés dans la description de la carte (et dans la parenthèse de son nom).
// - auDebut : la description doit COMMENCER par un des mots-clés (évite « acteur de films »).
// - synonymes : noms d'étiquettes déjà créées sur le site qui veulent dire la même chose.
// - exclusions : si la description contient un de ces mots, l'étiquette n'est pas proposée.
// - passeAvant : si cette étiquette est trouvée, celles de la liste ne sont pas proposées.
const ETIQUETTES_PAR_DEFAUT = [
  { id: "comediens", nom: "comédiens", icone: "🎭", active: true, auDebut: false,
    motsCles: "acteur, actrice, comédien",
    synonymes: "comédien, acteur, actrice, acteurs et actrices" },
  { id: "politique", nom: "politique", icone: "🏛️", active: true, auDebut: false,
    motsCles: "politique, politicien, politiste, politologue, homme d'État, femme d'État, chef d'État, "
      + "chef de gouvernement, président de la République, ministre, député, sénateur, sénatrice, maire, "
      + "parlement, parlementaire, gouvernement, élection, électoral, électoraux, référendum, idéologie, militant, "
      + "diplomate, ambassadeur, ambassadrice, coup d'État, pays d, pays de, pays du, pays des, État souverain, "
      + "guerre, Conseil de sécurité",
    synonymes: "politique, géopolitique, politiciens" },
  { id: "film-serie", nom: "film & série", icone: "🎬", active: true, auDebut: true,
    motsCles: "film, téléfilm, court métrage, long métrage, série télévisée, série de télévision, série d'animation, "
      + "série de films, mini-série, feuilleton, saison de série, telenovela, sitcom, franchise",
    synonymes: "film, série, films et séries, cinéma, écran, télé, télévision" },
  { id: "flore", nom: "flore", icone: "🌿", active: true, auDebut: false,
    motsCles: "plante, végétal, végétaux, arbre, arbuste, fougère, graminée, orchidée, cactus, conifère, "
      + "palmier, liane, algue, cultivar",
    synonymes: "flore, plante, végétaux, botanique" },
  { id: "insectes", nom: "insectes", icone: "🐞", active: true, auDebut: false, passeAvant: ["faune"],
    motsCles: "insecte, coléoptère, lépidoptère, diptère, hyménoptère, hémiptère, orthoptère, odonate, "
      + "trichoptère, névroptère, papillon, fourmi, abeille, guêpe, frelon, mouche, moustique, punaise, "
      + "criquet, sauterelle, libellule, blatte, termite, phasme, mante, coccinelle, scarabée, puceron",
    synonymes: "insecte, entomologie" },
  { id: "faune", nom: "faune", icone: "🦊", active: true, auDebut: false,
    motsCles: "animal, animaux, espèce animale, mammifère, oiseau, oiseaux, poisson, reptile, amphibien, serpent, "
      + "lézard, tortue, grenouille, crapaud, araignée, arachnide, opilion, scorpion, crustacé, mollusque, "
      + "gastéropode, escargot, requin, cétacé, baleine, dauphin, primate, rongeur, chauve-souris, dinosaure, "
      + "race de chiens, race de chats, race de chevaux",
    synonymes: "faune, animal, animaux" },
  { id: "musique", nom: "musique", icone: "🎵", active: true, auDebut: false,
    motsCles: "chanteur, chanteuse, musicien, rappeur, rappeuse, compositeur, compositrice, auteur-compositeur, "
      + "guitariste, pianiste, violoniste, violoncelliste, bassiste, organiste, chef d'orchestre, groupe de rock, "
      + "groupe de musique, groupe de rap, album, chanson, single, musique",
    exclusions: "bande dessinée", // « album de bande dessinée » n'est pas de la musique
    synonymes: "musique, musiciens, chanteurs, music" },
  { id: "animee", nom: "carte animée", icone: "✨", active: true, auDebut: false,
    motsCles: "", // reconnue par son image GIF qui bouge, pas par des mots-clés
    synonymes: "carte animée, carte animé, cartes animées, animée, animé, gif" }
];

// Met un texte en forme pour comparer sans se soucier des majuscules, des accents ni de la ponctuation :
// « Homme d'État » → « homme d etat ».
function normaliser(texte) {
  return (texte || "")
    .normalize("NFD").replace(/\p{M}/gu, "")       // enlève les accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")                       // tout le reste devient une espace
    .trim();
}

// Transforme « acteur, actrice » en une recherche qui accepte aussi les pluriels et les féminins
// (acteurs, comédienne, comédiennes...). auDebut : seulement au début du texte.
function motifMotsCles(motsCles, auDebut) {
  const mots = motsCles.split(",").map(normaliser).filter(Boolean);
  if (mots.length === 0) return null;
  const debut = auDebut ? "^" : "(?:^| )";
  return new RegExp(`${debut}(?:${mots.join("|")})(?:s|x|e|es|ne|nes)?(?: |$)`);
}

// La parenthèse du nom de la carte : « Sam Jaffe (acteur) » → « acteur ».
function parentheseDuNom(nom) {
  const trouve = (nom || "").match(/\(([^)]*)\)\s*$/);
  return trouve ? trouve[1] : "";
}

// Les identifiants des étiquettes qui correspondent à une carte : ["comediens", "musique"]...
function etiquettesDeLaCarte(carte, etiquettes) {
  const textes = [normaliser(carte.description), normaliser(parentheseDuNom(carte.nom))].filter(Boolean);
  let trouvees = [];
  for (const etiquette of etiquettes) {
    if (!etiquette.active) continue;
    if (etiquette.id === "animee") {
      if (carte.animee) trouvees.push(etiquette);
      continue;
    }
    const motif = motifMotsCles(etiquette.motsCles, etiquette.auDebut);
    const interdit = motifMotsCles(etiquette.exclusions || "", false);
    if (motif && textes.some(texte => motif.test(texte)) && !(interdit && textes.some(texte => interdit.test(texte)))) {
      trouvees.push(etiquette);
    }
  }
  // Un insecte n'est pas proposé aussi en « faune ».
  const ecartees = new Set(trouvees.flatMap(etiquette => etiquette.passeAvant || []));
  trouvees = trouvees.filter(etiquette => !ecartees.has(etiquette.id));
  return trouvees.map(etiquette => etiquette.id);
}

// Une étiquette déjà créée sur le site correspond-elle à une des nôtres ?
// « Faune & Flore » correspond à « faune » ET à « flore » ; « Écrans » à « film & série ».
function correspondances(nomSurLeSite, etiquettes) {
  const sansPluriel = mot => mot.replace(/(s|x)$/, "");
  const tout = sansPluriel(normaliser(nomSurLeSite));
  // Un nom composé (« Faune & Flore », « Films / Séries ») est aussi découpé en morceaux.
  const morceaux = nomSurLeSite.split(/&|\+|\/|,| et /i).map(morceau => sansPluriel(normaliser(morceau))).filter(Boolean);
  return etiquettes.filter(etiquette => {
    const noms = [etiquette.nom, ...etiquette.synonymes.split(",")].map(nom => sansPluriel(normaliser(nom))).filter(Boolean);
    return noms.some(nom => nom === tout || morceaux.includes(nom));
  }).map(etiquette => etiquette.id);
}

// Les étiquettes enregistrées dans les réglages (ou celles de départ). Une étiquette de départ
// absente de la mémoire (ajoutée dans une version plus récente) est ajoutée à la fin.
async function lireEtiquettes() {
  const { etiquettes } = await api.storage.local.get("etiquettes");
  if (!Array.isArray(etiquettes)) return ETIQUETTES_PAR_DEFAUT.map(etiquette => ({ ...etiquette }));
  const manquantes = ETIQUETTES_PAR_DEFAUT.filter(defaut => !etiquettes.some(etiquette => etiquette.id === defaut.id));
  return [...etiquettes, ...manquantes.map(etiquette => ({ ...etiquette }))];
}

// Le nom à proposer pour une étiquette. Si tu as déjà une étiquette équivalente sur le site
// (« Écrans » pour « film & série »), c'est elle qu'on propose : pas de doublon d'étiquette.
// "surLeSite" = { nom: nombre de cartes }. Si tu as renommé l'étiquette dans les réglages,
// seul ce nom exact compte.
function nomPropose(etiquette, surLeSite) {
  const defaut = ETIQUETTES_PAR_DEFAUT.find(d => d.id === etiquette.id);
  const renommee = !defaut || normaliser(defaut.nom) !== normaliser(etiquette.nom);
  const regle = renommee ? { ...etiquette, synonymes: "" } : etiquette;
  let meilleur = null;
  for (const [nom, nombre] of Object.entries(surLeSite || {})) {
    if (!correspondances(nom, [regle]).length) continue;
    if (!meilleur || nombre > surLeSite[meilleur]) meilleur = nom; // la plus utilisée
  }
  return meilleur || etiquette.nom;
}


// ---------------------------------------------------------------------
//  1.15 : LES NOMS DE CARTES AVEC DES PARENTHÈSES (et autres signes)
//  La recherche du site ne trouve pas « Bob Marley (chanson) » quand on tape le nom entier :
//  les parenthèses (et [ ] { } * + ? | ^ $ \) y ont un sens spécial. L'extension tape donc
//  seulement le titre principal (« Bob Marley »), puis choisit elle-même, parmi les résultats,
//  la carte qui porte exactement le nom voulu.
// ---------------------------------------------------------------------
const REGEX_SIGNES_RECHERCHE = /[()[\]{}*+?|^$\\]/;

// Le texte à taper dans une recherche du site : « Bob Marley (chanson) » → « Bob Marley ».
// Un nom sans signe spécial est tapé tel quel. Si le titre principal est trop court
// (« C++ (langage) » → « C »), on prend le morceau le plus long du nom.
function texteDeRecherche(nom) {
  const t = String(nom || "").replace(/\s+/g, " ").trim();
  if (!REGEX_SIGNES_RECHERCHE.test(t)) return t;
  const morceaux = t.split(/[()[\]{}*+?|^$\\]+/).map(m => m.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (morceaux.length && morceaux[0].length >= 3) return morceaux[0];
  const plusLong = [...morceaux].sort((a, b) => b.length - a.length)[0];
  return plusLong || t.replace(/[()[\]{}*+?|^$\\]+/g, " ").replace(/\s+/g, " ").trim();
}

// Vrai si deux noms de cartes désignent la même carte : exactement le même texte, ou le même une fois
// les majuscules, accents, espaces et signes mis de côté (« Bob Marley (chanson) » = « Bob Marley(chanson) »).
function memeCarte(a, b) {
  if (a === undefined || a === null || b === undefined || b === null) return false;
  const x = String(a).trim(), y = String(b).trim();
  if (!x || !y) return false;
  if (x === y) return true;
  const nx = normaliser(x);
  return nx !== "" && nx === normaliser(y);
}

// Vrai si le nom affiché d'une carte contient le texte cherché (pour savoir si les résultats sont arrivés).
function nomContient(nom, cherche) {
  return normaliser(nom).includes(normaliser(cherche));
}


// ---------------------------------------------------------------------
//  1.15 : LES AMIS SUR UNE ENCHÈRE
// ---------------------------------------------------------------------

// Deux pseudos sont les mêmes sans tenir compte des majuscules ni des espaces autour.
function memePseudo(a, b) {
  return Boolean(a) && Boolean(b) && String(a).trim().toLocaleLowerCase("fr") === String(b).trim().toLocaleLowerCase("fr");
}

// Les amis présents parmi les enchérisseurs d'une enchère, sans les amis ignorés ni toi-même.
// amis = [{ nom, affiche }] ; encherisseurs = [pseudos] ; ignores = [noms] ; moi = ton pseudo (ou null).
// Renvoie les amis trouvés, dans l'ordre de la liste d'amis, sans doublon.
function amisParmiEncherisseurs(encherisseurs, amis, ignores, moi) {
  const trouves = [];
  for (const ami of amis || []) {
    const noms = [ami.nom, ami.affiche].filter(Boolean);
    if (!noms.length || noms.some(n => memePseudo(n, moi))) continue;
    if ((ignores || []).some(i => noms.some(n => memePseudo(n, i)))) continue;
    if (!(encherisseurs || []).some(e => noms.some(n => memePseudo(n, e)))) continue;
    if (!trouves.some(t => memePseudo(t.nom, ami.nom))) trouves.push(ami);
  }
  return trouves;
}


// ---------------------------------------------------------------------
//  1.15 : LE FILTRE « SEULEMENT LES MISES JUSQU'À … » ET LE TRI DU SITE
// ---------------------------------------------------------------------

// Vrai si les mises affichées vont de la plus haute à la plus basse (tri « mise la plus haute ») :
// au moins 3 mises, jamais en hausse, et au moins une baisse.
function prixDecroissants(prix) {
  const liste = (prix || []).filter(p => Number.isFinite(p));
  if (liste.length < 3) return false;
  let baisse = false;
  for (let i = 1; i < liste.length; i++) {
    if (liste[i] > liste[i - 1]) return false;
    if (liste[i] < liste[i - 1]) baisse = true;
  }
  return baisse;
}
