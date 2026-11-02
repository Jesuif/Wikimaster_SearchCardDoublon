// =====================================================================
//  WikiMasters Doublons 1.3 - commun.js
//  Nouveau en 1.3 : ce fichier est partagé par les trois parties de
//  l'extension (content.js, background.js et la page des réglages).
//  On y range ce qui doit être identique partout, pour ne l'écrire qu'une fois.
// =====================================================================

// Chrome appelle ses outils « chrome », Firefox les appelle « browser » : on prend celui qui existe.
const api = globalThis.browser ?? globalThis.chrome;

// Tous les réglages, avec leur valeur de départ. Chaque fonction de l'extension a sa case à cocher.
const REGLAGES_PAR_DEFAUT = {
  surlignerAnimees: true,   // cadre doré autour des cartes animées
  statistiques: true,       // statistiques par rareté après la lecture de la collection
  historique: true,         // comparer chaque lecture à la précédente
  manquantes: true,         // cartes manquantes et pourcentage par rareté
  echanges: true,           // copie pour Discord et comparaison avec un ami
  badge: true,              // nombre de paquets estimé sur l'icône de l'extension
  minutesParPaquet: 10,     // 10 minutes par paquet (3 avec WikiMasters PRO)
  notifPC: false,           // notification sur ce PC
  notifTel: false,          // notification sur le téléphone (ntfy)
  canalNtfy: "",
  alerteAvant: false,       // prévenir aussi avant le stock plein...
  alerteA: 8                // ...quand le stock atteint 8 paquets
};

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
function rareteDepuisLettre(lettre) {
  return Object.keys(RARETES).find(rarete => RARETES[rarete].lettre === lettre) || null;
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
