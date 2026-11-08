/**
 * VIBE — QG (salons du Fondateur et du Directeur des Opérations)
 *
 * Interface seulement : toute la logique et tous les contrôles d'accès sont dans la
 * base (fonctions hq_* + RLS, rôle lu via hq_caller_role() sur courriel confirmé).
 * Ce fichier ne décide de rien : si l'appelant n'a pas le droit, la base refuse.
 *
 *  - Fondateur : briefing financement/revenus, courriels (finance incluse), billets
 *    (approuver / refuser « À vie »), offrir un Extra, événements, plaintes.
 *  - Directeur des Opérations : courriels hors finance, billets (À vie → demande
 *    d'accord du Fondateur), événements, plaintes. Aucun onglet ni appel financier.
 */
(function () {
  'use strict';

  var ROLE = null;
  var TAB = null;

  function sb() { return typeof _supa !== 'undefined' ? _supa : null; }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ok(msg) { if (typeof window.showSuccess === 'function') window.showSuccess(msg); }
  function ko(msg) { if (typeof window.showError === 'function') window.showError(msg); }
  function money(cents) { return (Number(cents || 0) / 100).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' }); }

  var MONO = 'font-family:Share Tech Mono,monospace;';
  var BTN = 'background:transparent;border:1px solid rgba(212,175,55,0.5);color:#D4AF37;padding:7px 12px;cursor:pointer;font-size:0.46rem;letter-spacing:1px;' + MONO;
  var FIELD = 'background:rgba(255,255,255,0.05);border:0.5px solid rgba(212,175,55,0.35);color:#fff;padding:8px;font-size:0.5rem;' + MONO;

  async function detecterRole() {
    var c = sb();
    if (!c || !window.CURRENT_USER) return null;
    try {
      var r = await c.rpc('hq_caller_role');
      return r && !r.error && (r.data === 'founder' || r.data === 'coo') ? r.data : null;
    } catch (e) { return null; }
  }

  function monterBouton() {
    if (document.getElementById('hq-qg-btn')) return;
    var b = document.createElement('button');
    b.id = 'hq-qg-btn';
    b.type = 'button';
    b.textContent = ROLE === 'founder' ? '👑 QG' : '⚙️ QG';
    b.setAttribute('aria-label', ROLE === 'founder' ? 'Salon du Fondateur' : 'Salon du Directeur des Opérations');
    b.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:4000;background:#0a0a10;border:1px solid #D4AF37;color:#D4AF37;padding:10px 14px;cursor:pointer;font-size:0.55rem;letter-spacing:2px;' + MONO;
    b.addEventListener('click', ouvrir);
    document.body.appendChild(b);
  }

  function modal() {
    var m = document.getElementById('hq-qg-modal');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'hq-qg-modal';
    m.className = 'modal-overlay';
    m.innerHTML =
      '<div class="modal-box" style="max-width:640px;width:94vw">' +
      '<div class="modal-title" id="hq-qg-titre" style="font-size:0.85rem"></div>' +
      '<div id="hq-qg-tabs" style="display:flex;flex-wrap:wrap;gap:6px;margin:10px 0"></div>' +
      '<div id="hq-qg-body" style="max-height:60vh;overflow-y:auto;' + MONO + 'font-size:0.52rem;line-height:1.7;color:rgba(255,255,255,0.85)"></div>' +
      '<button type="button" id="hq-qg-fermer" style="' + BTN + 'margin-top:12px;width:100%">FERMER</button>' +
      '</div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) { if (e.target === m) m.classList.remove('open'); });
    m.querySelector('#hq-qg-fermer').addEventListener('click', function () { m.classList.remove('open'); });
    return m;
  }

  var ONGLETS = {
    briefing:   { label: 'Briefing',   founder: true,  fn: vueBriefing },
    courriels:  { label: 'Courriels',  fn: vueCourriels },
    plaintes:   { label: 'Plaintes',   fn: vuePlaintes },
    billets:    { label: 'Billets',    fn: vueBillets },
    extras:     { label: 'Offrir un Extra', founder: true, fn: vueExtras },
    evenements: { label: 'Événements', fn: vueEvenements }
  };

  function ouvrir() {
    var m = modal();
    m.querySelector('#hq-qg-titre').textContent = ROLE === 'founder' ? '👑 Salon du Fondateur' : '⚙️ Salon du Directeur des Opérations';
    var tabs = m.querySelector('#hq-qg-tabs');
    tabs.innerHTML = '';
    Object.keys(ONGLETS).forEach(function (k) {
      if (ONGLETS[k].founder && ROLE !== 'founder') return; // COO : aucun onglet financier / réservé
      var t = document.createElement('button');
      t.type = 'button'; t.dataset.k = k; t.textContent = ONGLETS[k].label; t.style.cssText = BTN;
      t.addEventListener('click', function () { aller(k); });
      tabs.appendChild(t);
    });
    m.classList.add('open');
    aller(ROLE === 'founder' ? 'briefing' : 'courriels');
  }

  async function aller(k) {
    TAB = k;
    document.querySelectorAll('#hq-qg-tabs button').forEach(function (b) {
      b.style.background = b.dataset.k === k ? 'rgba(212,175,55,0.9)' : 'transparent';
      b.style.color = b.dataset.k === k ? '#000' : '#D4AF37';
    });
    var body = document.getElementById('hq-qg-body');
    body.innerHTML = '<div style="opacity:.6">Chargement…</div>';
    try { await ONGLETS[k].fn(body); } catch (e) { body.innerHTML = '<div style="color:#e66">Erreur de chargement.</div>'; }
  }

  // ── Briefing (Fondateur) ──
  async function vueBriefing(body) {
    var r = await sb().rpc('hq_briefing_finance');
    var d = r.data;
    if (!d || d.ok === false) { body.innerHTML = esc((d && d.error) || 'Accès refusé.'); return; }
    var rev = d.revenus_cents_par_plan || {};
    var total = Object.keys(rev).reduce(function (s, k) { return s + Number(rev[k] || 0); }, 0);
    var ext = d.extras_vendus || {};
    body.innerHTML =
      '<div style="color:#D4AF37;letter-spacing:2px">// FINANCEMENT & REVENUS</div>' +
      '<div>Pionniers attribués : <b>' + esc(d.pionniers_attribues) + '</b> / 500</div>' +
      '<div>Abonnements actifs : <b>' + esc(d.abonnements_actifs) + '</b></div>' +
      '<div>Revenus encaissés (tous plans) : <b>' + money(total) + '</b></div>' +
      '<div style="margin-top:6px;color:#D4AF37">Par plan</div>' +
      (Object.keys(rev).length ? Object.keys(rev).map(function (k) { return '<div>· ' + esc(k) + ' : ' + money(rev[k]) + '</div>'; }).join('') : '<div style="opacity:.6">Aucun paiement enregistré.</div>') +
      '<div style="margin-top:6px;color:#D4AF37">Extras vendus</div>' +
      ['boost', 'fantome', 'visites', 'montre'].map(function (k) { return '<div>· ' + k + ' : ' + esc(ext[k] || 0) + '</div>'; }).join('') +
      '<div>Extras offerts : <b>' + esc(d.extras_offerts) + '</b></div>';
  }

  // ── Courriels (RLS : le COO ne reçoit jamais « finance ») ──
  async function vueCourriels(body) {
    var r = await sb().from('hq_emails_ai').select('*').order('created_at', { ascending: false }).limit(50);
    if (r.error) { body.innerHTML = 'Accès refusé.'; return; }
    var rows = r.data || [];
    body.innerHTML = rows.length ? rows.map(function (m) {
      return '<div style="padding:8px 0;border-bottom:0.5px solid rgba(212,175,55,0.15)">' +
        '<span style="color:#D4AF37">[' + esc(m.categorie) + ']</span> ' + (m.priorite === 'haute' ? '<b style="color:#e66">HAUTE</b> ' : '') +
        esc(m.sujet) + '<div style="opacity:.6">' + esc(m.expediteur) + ' · ' + esc(new Date(m.created_at).toLocaleString('fr-CA')) + '</div>' +
        '<div style="opacity:.8">' + esc(m.resume_ia) + '</div></div>';
    }).join('') : '<div style="opacity:.6">Aucun courriel trié.</div>';
  }

  // ── Plaintes (signalements du Tribunal) ──
  async function vuePlaintes(body) {
    var r = await sb().from('tribunal_signalements').select('*').order('created_at', { ascending: false }).limit(40);
    if (r.error) { body.innerHTML = 'Accès refusé.'; return; }
    var rows = r.data || [];
    body.innerHTML = rows.length ? rows.map(function (p) {
      return '<div style="padding:8px 0;border-bottom:0.5px solid rgba(212,175,55,0.15)"><b>' + esc(p.motif) + '</b>' +
        '<div style="opacity:.7">' + esc(p.pseudo_reporter) + ' · ' + esc(p.statut) + '</div><div style="opacity:.8">' + esc(p.details) + '</div></div>';
    }).join('') : '<div style="opacity:.6">Aucune plainte.</div>';
  }

  // ── Billets VIP #0000 à #1500 ──
  var DUREES = [['7j', '1 semaine'], ['1m', '1 mois'], ['3m', '3 mois'], ['6m', '6 mois'], ['1a', '1 an'], ['vie', 'À vie']];
  async function vueBillets(body) {
    var r = await sb().rpc('hq_compilation_billets');
    var d = r.data;
    if (!d || d.ok === false) { body.innerHTML = esc((d && d.error) || 'Accès refusé.'); return; }
    var s = d.stats || {};
    var attenteLigne = function (b) {
      return b.statut === 'attente_accord_fondateur' && ROLE === 'founder'
        ? ' <button type="button" data-act="approuver" data-n="' + esc(b.numero) + '" style="' + BTN + '">✓ Approuver à vie</button> <button type="button" data-act="refuser" data-n="' + esc(b.numero) + '" style="' + BTN + '">✗ Refuser</button>'
        : '';
    };
    body.innerHTML =
      '<div>Total ' + esc(s.total) + ' · Dispo ' + esc(s.disponibles) + ' · Réservés ' + esc(s.reserves) + ' · Actifs ' + esc(s.actives) + ' · Expirés ' + esc(s.expires) + ' · <b style="color:#D4AF37">En attente d\'accord ' + esc(s.attente_accord) + '</b></div>' +
      '<div style="margin:10px 0;padding:10px;border:1px solid rgba(212,175,55,0.3)"><div style="color:#D4AF37">Attribuer un billet</div>' +
      '<input id="hq-b-num" type="number" min="0" max="1500" placeholder="N° 0–1500" style="' + FIELD + 'width:96px"> ' +
      '<input id="hq-b-mail" type="email" placeholder="courriel du destinataire" style="' + FIELD + 'width:200px"> ' +
      '<select id="hq-b-duree" style="' + FIELD + '">' + DUREES.map(function (x) { return '<option value="' + x[0] + '">' + x[1] + '</option>'; }).join('') + '</select> ' +
      '<input id="hq-b-notes" placeholder="notes" maxlength="500" style="' + FIELD + 'width:140px"> ' +
      '<button type="button" id="hq-b-go" style="' + BTN + '">ATTRIBUER</button>' +
      (ROLE === 'coo' ? '<div style="opacity:.6;margin-top:4px">« À vie » = demande envoyée au Fondateur pour accord.</div>' : '') + '</div>' +
      ((d.billets || []).map(function (b) {
        return '<div style="padding:6px 0;border-bottom:0.5px solid rgba(212,175,55,0.15)">#' + String(b.numero).padStart(4, '0') + ' · ' + esc(b.statut) + ' · ' + esc(b.duree) +
          ' · ' + esc(b.destinataire_email || '') + attenteLigne(b) + '</div>';
      }).join('') || '<div style="opacity:.6">Aucun billet attribué.</div>');

    body.querySelector('#hq-b-go').addEventListener('click', async function () {
      var res = await sb().rpc('hq_attribuer_billet', {
        p_numero: parseInt(body.querySelector('#hq-b-num').value, 10),
        p_email_dest: body.querySelector('#hq-b-mail').value,
        p_notes: body.querySelector('#hq-b-notes').value,
        p_duree: body.querySelector('#hq-b-duree').value
      });
      var o = res.data;
      if (o && o.ok) { ok(o.attente_accord ? 'Demande envoyée au Fondateur.' : 'Billet attribué.'); aller('billets'); } else { ko('⚠ ' + ((o && o.error) || 'Erreur')); }
    });
    body.querySelectorAll('button[data-act]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var fn = b.dataset.act === 'approuver' ? 'hq_approuver_billet_vie' : 'hq_refuser_vie';
        var res = await sb().rpc(fn, { p_numero: parseInt(b.dataset.n, 10) });
        var o = res.data;
        if (o && o.ok) { ok('Fait.'); aller('billets'); } else { ko('⚠ ' + ((o && o.error) || 'Erreur')); }
      });
    });
  }

  // ── Offrir un Extra (Fondateur) ──
  async function vueExtras(body) {
    body.innerHTML =
      '<div style="color:#D4AF37">Offrir gratuitement un Extra à un membre</div>' +
      '<input id="hq-x-mail" type="email" placeholder="courriel du membre" style="' + FIELD + 'width:220px"> ' +
      '<select id="hq-x-extra" style="' + FIELD + '"><option value="boost">🚀 Boost 24 h</option><option value="fantome">👻 Mode Fantôme 7 j</option><option value="visites">👁 Qui m\'a consulté 7 j</option><option value="montre">⌚ Connexion Montre</option></select> ' +
      '<button type="button" id="hq-x-go" style="' + BTN + '">OFFRIR</button>';
    body.querySelector('#hq-x-go').addEventListener('click', async function () {
      var res = await sb().rpc('hq_offrir_extra', { p_email: body.querySelector('#hq-x-mail').value, p_extra: body.querySelector('#hq-x-extra').value });
      var o = res.data;
      if (o && o.ok) ok('Extra offert.'); else ko('⚠ ' + ((o && o.error) || 'Erreur'));
    });
  }

  // ── Événements / Tournée ──
  async function vueEvenements(body) {
    var r = await sb().from('evenements_vibe').select('*').eq('statut', 'actif').order('created_at', { ascending: false }).limit(40);
    var rows = r.data || [];
    body.innerHTML =
      '<div style="margin-bottom:10px;padding:10px;border:1px solid rgba(212,175,55,0.3)"><div style="color:#D4AF37">Nouvel événement</div>' +
      '<input id="hq-e-ville" placeholder="Ville" maxlength="80" style="' + FIELD + 'width:110px"> ' +
      '<input id="hq-e-date" placeholder="Date (texte)" maxlength="80" style="' + FIELD + 'width:120px"> ' +
      '<input id="hq-e-titre" placeholder="Titre" maxlength="120" style="' + FIELD + 'width:170px"> ' +
      '<input id="hq-e-desc" placeholder="Description" maxlength="600" style="' + FIELD + 'width:200px"> ' +
      '<button type="button" id="hq-e-go" style="' + BTN + '">CRÉER</button></div>' +
      (rows.map(function (e) {
        return '<div style="padding:6px 0;border-bottom:0.5px solid rgba(212,175,55,0.15)"><b>' + esc(e.titre) + '</b> · ' + esc(e.ville) + ' · ' + esc(e.date_texte) +
          ' <button type="button" data-id="' + esc(e.id) + '" class="hq-e-del" style="' + BTN + '">SUPPRIMER</button></div>';
      }).join('') || '<div style="opacity:.6">Aucun événement actif.</div>');
    body.querySelector('#hq-e-go').addEventListener('click', async function () {
      var res = await sb().rpc('hq_creer_evenement', {
        p_ville: body.querySelector('#hq-e-ville').value, p_date_texte: body.querySelector('#hq-e-date').value,
        p_titre: body.querySelector('#hq-e-titre').value, p_description: body.querySelector('#hq-e-desc').value
      });
      var o = res.data;
      if (o && o.ok) { ok('Événement créé.'); aller('evenements'); } else { ko('⚠ ' + ((o && o.error) || 'Erreur')); }
    });
    body.querySelectorAll('.hq-e-del').forEach(function (b) {
      b.addEventListener('click', async function () {
        var res = await sb().rpc('hq_supprimer_evenement', { p_id: b.dataset.id });
        if (res.data && res.data.ok) { ok('Supprimé.'); aller('evenements'); } else ko('⚠ Erreur');
      });
    });
  }

  // Détection du rôle une fois la session prête (le rôle est revérifié par la base à chaque appel).
  var essais = 0;
  (function attendre() {
    if (ROLE || essais++ > 40) return;
    detecterRole().then(function (r) {
      if (r) { ROLE = r; monterBouton(); } else setTimeout(attendre, 1500);
    });
  })();
})();
