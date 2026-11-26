// =====================================================================
//  WikiMasters Doublons 1.20.6 (sans chargement automatique) - reponses-site.js
//  Nouveau en 1.15 : ce petit script tourne DANS la page du site (et non à côté,
//  comme content.js). Il regarde les réponses que le site reçoit déjà pour son
//  Marché (/api/marketplace…) : la liste des enchères, la page d'une enchère et
//  ses mises. Il n'envoie AUCUNE requête de plus et ne modifie rien : il recopie
//  seulement l'essentiel (heure de fin exacte, mise, meneur, historique des mises)
//  pour content.js, par un message à l'intérieur de la page.
//  Nouveau : il lit aussi l'historique des prix d'une carte (price-history), que le
//  site charge quand tu ouvres l'onglet « Marché » de sa fiche, pour connaître le
//  prix moyen de toutes ses raretés. Là non plus, rien n'est demandé en plus.
//  Le navigateur ne donne pas à ce script les outils de l'extension (mémoire,
//  notifications) : tout le reste est fait par content.js.
// =====================================================================
(() => {
  if (window.__wmdReponsesSite) return; // déjà en place (page rechargée sans nouveau document)
  window.__wmdReponsesSite = true;

  const SOURCE = "wmd-reponses-site";
  const REGEX_MARCHE = /^\/api\/marketplace(?:\/([0-9a-f-]{36}))?(?:\/[a-z_-]+)?\/?$/i;
  // 1.16 : l'historique des prix d'une carte, que le site charge lui-même quand tu ouvres l'onglet
  // « Marché » de sa fiche. Il donne les moyennes de TOUTES les raretés de la carte d'un coup.
  const REGEX_HISTORIQUE = /^\/api\/marketplace\/cards\/([0-9a-f-]{36})\/price-history\/?$/i;
  const nombre = v => (typeof v === "number" && Number.isFinite(v) ? v : null);

  // L'essentiel d'une enchère, tel que le site le donne.
  function resumerEnchere(a) {
    if (!a || typeof a !== "object" || typeof a.id !== "string") return null;
    const fin = typeof a.end_at === "string" ? Date.parse(a.end_at) : NaN;
    const regle = typeof a.settled_at === "string" ? Date.parse(a.settled_at) : NaN;
    return {
      regle: Number.isFinite(regle) ? regle : null, // l'heure où l'enchère a été soldée (fin réelle)
      // 1.20.6 : l'heure de la mise en vente (pour savoir si ta dernière lecture de la collection l'a vue).
      cree: typeof a.created_at === "string" && Number.isFinite(Date.parse(a.created_at)) ? Date.parse(a.created_at) : null,
      id: a.id.toLowerCase(),
      fin: Number.isFinite(fin) ? fin : null,
      statut: typeof a.status === "string" ? a.status : null,
      mise: nombre(a.current_bid),
      depart: nombre(a.base_amount),
      meneurId: a.current_bidder_id || null,
      meneur: a.current_bidder && a.current_bidder.username ? String(a.current_bidder.username) : null,
      vendeurId: a.seller_id || null,
      vendeur: a.seller && a.seller.username ? String(a.seller.username) : null,
      gagnantId: a.winner_id || null,
      gagnant: a.winner && a.winner.username ? String(a.winner.username) : null,
      prixFinal: nombre(a.final_price),
      rarete: typeof a.snapshot_rarity === "string" ? a.snapshot_rarity : a.card && typeof a.card.rarity === "string" ? a.card.rarity : null,
      nom: a.card && typeof a.card.wikipedia_title === "string" ? a.card.wikipedia_title : null,
      // 1.16 : l'identifiant de la carte, pour savoir à quelle carte correspond un historique de prix.
      carteId: typeof a.card_id === "string" ? a.card_id.toLowerCase()
        : a.card && typeof a.card.id === "string" ? a.card.id.toLowerCase() : null
    };
  }

  function resumerListe(liste) {
    return Array.isArray(liste) ? liste.map(resumerEnchere).filter(Boolean) : null;
  }

  function resumerMises(liste) {
    if (!Array.isArray(liste)) return null;
    return liste.filter(m => m && typeof m === "object").map(m => {
      const quand = typeof m.placed_at === "string" ? Date.parse(m.placed_at) : NaN;
      return {
        id: m.bidder_id || (m.bidder && m.bidder.id) || null,
        pseudo: m.bidder && m.bidder.username ? String(m.bidder.username) : null,
        montant: nombre(m.amount),
        quand: Number.isFinite(quand) ? quand : null
      };
    });
  }

  function resumer(donnees, chemin) {
    if (!donnees || typeof donnees !== "object") return null;
    const id = (chemin.match(REGEX_MARCHE) || [])[1] || null;
    const message = { source: SOURCE, version: 1, quand: Date.now(), id: id ? id.toLowerCase() : null };
    if (Array.isArray(donnees.auctions)) message.encheres = resumerListe(donnees.auctions);
    if (donnees.auction) message.enchere = resumerEnchere(donnees.auction);
    if (Array.isArray(donnees.bids)) message.mises = resumerMises(donnees.bids);
    // Le premier chargement du Marché donne aussi TES enchères : tes ventes, tes mises, tes victoires.
    for (const cle of ["selling", "bidding", "won", "history"]) {
      if (Array.isArray(donnees[cle])) (message.miennes = message.miennes || {})[cle] = resumerListe(donnees[cle]);
    }
    if (typeof donnees.hasMore === "boolean") message.encore = donnees.hasMore;
    return message.encheres || message.enchere || message.mises || message.miennes ? message : null;
  }

  // 1.16 : l'essentiel de l'historique des prix : pour chaque rareté, les moyennes par semaine et par mois.
  function resumerPeriodes(liste) {
    if (!Array.isArray(liste)) return [];
    return liste.filter(p => p && typeof p === "object" && typeof p.start === "string").map(p => ({
      debut: p.start, moyenne: nombre(p.avg), nb: nombre(p.count)
    })).filter(p => p.moyenne !== null);
  }
  function resumerHistorique(donnees, carteId) {
    if (!donnees || typeof donnees !== "object" || Array.isArray(donnees)) return null;
    // 1.20.5 : une carte jamais vendue : le site peut ne renvoyer aucune rareté (by_rarity vide, nul ou absent).
    // L'historique vide est quand même transmis : l'extension note alors « pas de prix moyen » (le « ? »).
    const parRarete = {};
    const raretes = donnees.by_rarity && typeof donnees.by_rarity === "object" ? donnees.by_rarity : {};
    for (const [code, r] of Object.entries(raretes)) {
      if (!r || typeof r !== "object") continue;
      parRarete[code] = { semaines: resumerPeriodes(r.weekly), mois: resumerPeriodes(r.monthly) };
    }
    const calcule = typeof donnees.computed_at === "string" ? Date.parse(donnees.computed_at) : NaN;
    return { source: SOURCE, version: 1, quand: Date.now(), id: null,
      historique: { carteId: carteId.toLowerCase(), calcule: Number.isFinite(calcule) ? calcule : Date.now(), parRarete } };
  }

  // 1.20 : les échanges (/api/trades…) : on n'en retient que les cartes (identifiant, nom, rareté),
  // pour pouvoir demander l'historique des prix d'une carte de l'échange quand tu cliques dessus.
  const REGEX_ECHANGES = /^\/api\/trades?(?:\/|$)/i;
  function cartesDans(donnees) {
    const cartes = new Map();
    const parcourir = (v, rareteAutour, profondeur) => {
      if (!v || typeof v !== "object" || profondeur > 8 || cartes.size > 500) return;
      if (Array.isArray(v)) { for (const x of v) parcourir(x, rareteAutour, profondeur + 1); return; }
      const rarete = typeof v.snapshot_rarity === "string" ? v.snapshot_rarity : typeof v.rarity === "string" ? v.rarity : rareteAutour;
      if (typeof v.id === "string" && typeof v.wikipedia_title === "string" && /^[0-9a-f-]{36}$/i.test(v.id)) {
        cartes.set(v.id.toLowerCase(), { carteId: v.id.toLowerCase(), nom: v.wikipedia_title, rarete: rarete || null });
      }
      for (const x of Object.values(v)) if (x && typeof x === "object") parcourir(x, rarete, profondeur + 1);
    };
    parcourir(donnees, null, 0);
    return [...cartes.values()];
  }

  const fetchDuSite = window.fetch;
  if (typeof fetchDuSite !== "function") return;

  // 1.17.5 : l'extension peut demander l'état d'UNE de tes enchères (une vente à revendre si invendue),
  // exactement comme sa page le demande. La réponse repasse par la lecture ci-dessous.
  window.addEventListener("message", evenement => {
    const d = evenement.data;
    if (evenement.source !== window || evenement.origin !== location.origin || !d || d.source !== "wmd-demande" || d.version !== 1) return;
    if (d.type === "lire-enchere" && /^[0-9a-f-]{36}$/i.test(String(d.id || ""))) {
      window.fetch(`/api/marketplace/${String(d.id).toLowerCase()}`, { credentials: "same-origin", wmdDemande: true }).catch(() => {});
    }
    // 1.17.7 : tes ventes (« selling »), que le Marché charge lui-même en s'ouvrant.
    if (d.type === "lire-ventes") window.fetch("/api/marketplace", { credentials: "same-origin", wmdDemande: true }).catch(() => {});
    // 1.20 : l'historique des prix d'une carte (comme l'onglet « Marché » de sa fiche le demande).
    if (d.type === "lire-historique" && /^[0-9a-f-]{36}$/i.test(String(d.id || ""))) {
      window.fetch(`/api/marketplace/cards/${String(d.id).toLowerCase()}/price-history`, { credentials: "same-origin", wmdDemande: true }).catch(() => {});
    }
  });
  window.fetch = function (...args) {
    const promesse = fetchDuSite.apply(this, args);
    try {
      const entree = args[0];
      const adresse = typeof entree === "string" ? entree : entree instanceof URL ? entree.href : entree && entree.url ? entree.url : "";
      const url = new URL(adresse, location.href);
      const historique = url.origin === location.origin ? url.pathname.match(REGEX_HISTORIQUE) : null;
      const echanges = url.origin === location.origin && !historique && REGEX_ECHANGES.test(url.pathname);
      if (echanges) {
        promesse.then(reponse => {
          if (!reponse || !reponse.ok) return;
          reponse.clone().json().then(donnees => {
            const cartes = cartesDans(donnees);
            if (cartes.length) window.postMessage({ source: SOURCE, version: 1, quand: Date.now(), id: null, cartesEchange: cartes }, location.origin);
          }).catch(() => {});
        }).catch(() => {});
      } else if (historique) {
        // On lit seulement la réponse que le site a lui-même demandée.
        promesse.then(reponse => {
          if (!reponse) return;
          // 1.20.5 : « 404 » = pas d'historique pour cette carte (jamais vendue) : un historique vide.
          if (reponse.status === 404) { const vide = resumerHistorique({}, historique[1]); if (vide) window.postMessage(vide, location.origin); return; }
          if (!reponse.ok) return;
          reponse.clone().json().then(donnees => {
            const message = resumerHistorique(donnees, historique[1]);
            if (message) window.postMessage(message, location.origin);
          }).catch(() => {});
        }).catch(() => {});
      } else if (url.origin === location.origin && REGEX_MARCHE.test(url.pathname)) {
        const methode = String((args[1] && args[1].method) || (entree && entree.method) || "GET").toUpperCase();
        promesse.then(reponse => {
          if (!reponse || !reponse.ok) return;
          reponse.clone().json().then(donnees => {
            const message = resumer(donnees, url.pathname);
            if (!message) return;
            message.demandeExtension = Boolean(args[1] && args[1].wmdDemande); // 1.17.7 : demandée par l'extension, pas par la page
            message.methode = methode;
            message.tri = url.searchParams.get("sort");
            message.page = Number(url.searchParams.get("page")) || null;
            message.recherche = url.searchParams.get("q");
            window.postMessage(message, location.origin);
          }).catch(() => {});
        }).catch(() => {});
      }
    } catch (erreur) {
      // Jamais gêner le site : en cas de souci, on laisse passer la requête telle quelle.
    }
    return promesse;
  };
})();
