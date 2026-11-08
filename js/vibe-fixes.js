/**
 * VIBE — Corrections v6
 * Compteur Pionnier corrigé + Stripe + SEO + 2 salons + tarifs
 */
(function () {
  'use strict';

  var MAX_PIONNIERS = 500;
  var TARIFS = {
    pionnier: '149 $',
    mois1: '29,99 $',
    mois3: '74,99 $',
    mois6: '119,99 $',
    an1: '179,99 $',
    boost: '9,99 $ CAD',
    fantome: '12,99 $ CAD',
    visites: '9,99 $ CAD',
    montre: '14,99 $ CAD',
    tribunal: '49 $ CAD'
  };

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function getSupa() {
    try {
      if (window._supa) return window._supa;
      if (window.supabase && window.supabase.createClient) {
        return window.supabase.createClient(
          'https://fhksytcoyjtcrkmhnoyw.supabase.co',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoa3N5dGNveWp0Y3JrbWhub3l3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1OTkzODIsImV4cCI6MjA5MjE3NTM4Mn0.nW9xgEQSuXlq96d53AFE7jUADmr04YdMoD9hCNmw64k'
        );
      }
    } catch (e) {}
    return null;
  }

  /**
   * BUG FIX: les inscrits GRATUITS ne doivent PAS réduire les 500 places Pionnier.
   * On compte seulement statut pionnier / inscrit payé / is_founder.
   */
  async function fixPioneerCounter() {
    var sb = getSupa();
    var used = 0;
    try {
      if (sb) {
        var r1 = await sb
          .from('landing_inscriptions')
          .select('id', { count: 'exact', head: true })
          .in('statut', ['inscrit', 'pionnier', 'paye', 'founder', 'fondateur']);
        var r2 = await sb
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('is_founder', true);
        used = Math.max(r1.count || 0, r2.count || 0);
      }
    } catch (e) {
      used = 0;
    }
    var restants = Math.max(0, MAX_PIONNIERS - used);
    var pct = ((used / MAX_PIONNIERS) * 100).toFixed(0);

    var ids = ['spots-left', 'lh-places', 'stat-spots', 'form-spots'];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (id === 'form-spots') el.textContent = restants + ' places restantes';
      else el.textContent = String(restants);
    });
    var fill = document.getElementById('spots-fill');
    if (fill) fill.style.width = 100 - parseFloat(pct) + '%';
  }

  function patchLoadStats() {
    if (typeof window.loadStats !== 'function' || window.loadStats._vibePioneerFixed) return;
    var orig = window.loadStats;
    window.loadStats = async function () {
      var r = await orig.apply(this, arguments);
      await fixPioneerCounter();
      return r;
    };
    window.loadStats._vibePioneerFixed = true;
  }

  function injectCSS() {
    if (document.getElementById('vibe-fixes-css')) return;
    var s = document.createElement('style');
    s.id = 'vibe-fixes-css';
    s.textContent = [
      '.id-chip{background:transparent;border:1px solid rgba(0,170,255,0.45);color:rgba(255,255,255,0.75);padding:8px 12px;font-family:Share Tech Mono,monospace;font-size:0.5rem;letter-spacing:1px;cursor:pointer;transition:all .2s;margin:2px}',
      '.id-chip.on{background:rgba(0,170,255,0.85);color:#000;border-color:#00aaff}',
      '.fog-overlay{position:absolute;inset:0;z-index:2;background:rgba(180,180,220,0.55);backdrop-filter:blur(28px) saturate(0.55);-webkit-backdrop-filter:blur(28px) saturate(0.55);transition:opacity .9s ease,backdrop-filter .9s ease;pointer-events:none}',
      '.fog-overlay.dissipating{opacity:0;backdrop-filter:blur(0);-webkit-backdrop-filter:blur(0)}',
      '.vibe-legal-bar{position:relative;z-index:10;text-align:center;padding:10px 16px;font-family:Share Tech Mono,monospace;font-size:0.42rem;letter-spacing:2px;color:rgba(212,175,55,0.75);border-bottom:0.5px solid rgba(212,175,55,0.12);background:rgba(0,0,0,0.6)}',
      '.tarif-card-v{border:1px solid rgba(0,170,255,0.35);padding:14px 10px;text-align:center;background:rgba(0,40,70,0.3)}',
      '.tarif-card-v .t-lbl{font-size:0.42rem;color:rgba(255,255,255,0.5);letter-spacing:1px;margin-bottom:6px}',
      '.tarif-card-v .t-prc{font-size:1.2rem;color:#3bb6ff;font-family:Playfair Display,serif;font-weight:700}'
    ].join('');
    document.head.appendChild(s);
  }

  function injectSEO() {
    if (document.getElementById('vibe-seo-jsonld')) return;
    if (!document.querySelector('link[rel="canonical"]')) {
      var can = document.createElement('link');
      can.rel = 'canonical';
      can.href = 'https://vibegay.ca' + (location.pathname === '/' ? '/' : location.pathname);
      document.head.appendChild(can);
    }
    if (!document.querySelector('meta[name="robots"]')) {
      var robots = document.createElement('meta');
      robots.name = 'robots';
      robots.content = 'index,follow,max-image-preview:large';
      document.head.appendChild(robots);
    }
    if (!document.querySelector('meta[name="keywords"]')) {
      var kw = document.createElement('meta');
      kw.name = 'keywords';
      kw.content =
        'LGBTQ,gay,lesbienne,bi,trans,rencontre,Québec,Montréal,Toronto,Canada,VIBE,Mode Ange,dating queer';
      document.head.appendChild(kw);
    }
    // Google Search Console : colle ton code de vérification ici si besoin
    // <meta name="google-site-verification" content="TON_CODE">
    var ld = document.createElement('script');
    ld.id = 'vibe-seo-jsonld';
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'VIBE',
      alternateName: 'vibegay.ca',
      url: 'https://vibegay.ca',
      applicationCategory: 'SocialNetworkingApplication',
      operatingSystem: 'Web',
      inLanguage: ['fr-CA', 'en'],
      description:
        'Réseau social et de rencontres LGBTQ+ né à Québec. Mode Ange, salons en temps réel, Tribunal communautaire.',
      offers: {
        '@type': 'Offer',
        price: '99',
        priceCurrency: 'CAD',
        description: 'Pass Pionnier — 1 an, 1 seul versement'
      },
      publisher: {
        '@type': 'Organization',
        name: 'Vibegay.ca',
        url: 'https://vibegay.ca',
        email: 'support@vibegay.ca',
        address: { '@type': 'PostalAddress', addressLocality: 'Québec', addressRegion: 'QC', addressCountry: 'CA' }
      }
    });
    document.head.appendChild(ld);
  }

  function wireStripe() {
    var cfg = window.VIBE_STRIPE;
    if (!cfg) return;
    if (typeof window.EXTRA_LINKS === 'undefined') window.EXTRA_LINKS = {};
    ['boost', 'fantome', 'visites', 'montre'].forEach(function (k) {
      if (cfg[k]) window.EXTRA_LINKS[k] = cfg[k];
    });
    if (typeof window.acheterExtra === 'function' && !window.acheterExtra._vibePatched) {
      window.acheterExtra = function (type) {
        if (!window.CURRENT_USER) {
          if (typeof showError === 'function') showError('\u26a0 Connecte-toi pour acheter.');
          if (typeof openLogin === 'function') openLogin();
          return;
        }
        // vibeCheckout bascule vers /paiement.html?p=<extra> tant que Stripe est désactivé.
        if (typeof window.vibeCheckout === 'function') {
          window.vibeCheckout(type);
          return;
        }
        window.location.href = (window.VIBE_PAGE_PAIEMENT || '/paiement.html') + '?p=' + encodeURIComponent(type);
      };
      window.acheterExtra._vibePatched = true;
    }
  }

  function fixModeFantomeText() {
    document.querySelectorAll('.af-row').forEach(function (row) {
      var title = row.querySelector('.af-title');
      var text = row.querySelector('.af-text');
      if (title && /Mode Fant/i.test(title.textContent) && text) {
        text.textContent =
          "\u00c9paisse brume dense sur ta photo de profil. Personne ne te voit clairement. Quand tu veux te montrer, le brouillard se dissipe d'un tap. Ce n'est pas un salon \u2014 c'est un mode profil.";
      }
    });
  }

  function badgeAngeGratuit() {
    var btn = document.getElementById('sos-btn');
    if (!btn || document.getElementById('ange-gratuit-badge')) return;
    var badge = document.createElement('div');
    badge.id = 'ange-gratuit-badge';
    badge.style.cssText =
      'margin-top:10px;font-size:0.48rem;letter-spacing:3px;color:rgba(212,175,55,0.65);text-transform:uppercase;font-family:Share Tech Mono,monospace';
    badge.textContent = '\u2726 Gratuit pour tous';
    btn.insertAdjacentElement('afterend', badge);
  }

  window.signupIdentites = window.signupIdentites || [];
  function addSignupIdentites() {
    var form = document.getElementById('signup-form');
    if (!form || document.getElementById('signup-identites')) return;
    var villeGroup = form.querySelector('#ville');
    if (!villeGroup) return;
    var parent = villeGroup.closest('.form-group');
    if (!parent) return;
    var wrap = document.createElement('div');
    wrap.className = 'form-group';
    wrap.innerHTML =
      '<label class="form-label">Identit\u00e9</label>' +
      '<div id="signup-identites" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px">' +
      ['gay', 'lesbienne', 'bi', 'trans', 'nonbinaire', 'queer', 'autre']
        .map(function (id) {
          var labels = {
            gay: 'Gay',
            lesbienne: 'Lesbienne',
            bi: 'Bi',
            trans: 'Trans',
            nonbinaire: 'Non-binaire',
            queer: 'Queer',
            autre: 'Autre'
          };
          return '<button type="button" data-id="' + id + '" class="id-chip">' + labels[id] + '</button>';
        })
        .join('') +
      '</div>';
    parent.insertAdjacentElement('afterend', wrap);
    document.getElementById('signup-identites').addEventListener('click', function (e) {
      var b = e.target.closest('[data-id]');
      if (!b) return;
      var id = b.getAttribute('data-id');
      var arr = window.signupIdentites;
      if (arr.indexOf(id) >= 0) window.signupIdentites = arr.filter(function (x) { return x !== id; });
      else window.signupIdentites.push(id);
      b.classList.toggle('on', window.signupIdentites.indexOf(id) >= 0);
    });
  }

  function addTarifsSuite() {
    if (document.getElementById('tarifs-suite')) return;
    var plan = document.querySelector('.plan-choice');
    if (!plan) return;
    var box = document.createElement('div');
    box.id = 'tarifs-suite';
    box.style.cssText = 'margin:8px 0 24px;text-align:left';
    box.innerHTML =
      '<div style="font-size:0.48rem;letter-spacing:3px;color:rgba(0,170,255,0.7);text-transform:uppercase;margin-bottom:12px;font-family:Share Tech Mono,monospace">// Apr\u00e8s les 500 Pionniers \u2014 abonnements</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px">' +
      [
        ['1 mois', TARIFS.mois1],
        ['3 mois', TARIFS.mois3],
        ['6 mois', TARIFS.mois6],
        ['1 an', TARIFS.an1]
      ]
        .map(function (t) {
          return '<div class="tarif-card-v"><div class="t-lbl">' + t[0] + '</div><div class="t-prc">' + t[1] + '</div></div>';
        })
        .join('') +
      '</div>' +
      '<div style="margin-top:12px;padding:12px;border:1px solid rgba(212,175,55,0.35);background:rgba(212,175,55,0.06);font-size:0.46rem;letter-spacing:1px;color:rgba(255,255,255,0.7);font-family:Share Tech Mono,monospace;line-height:1.8">' +
      '\u2726 <b style="color:#D4AF37">PIONNIER</b> \u2014 500 places \u00b7 <b style="color:#D4AF37">' +
      TARIFS.pionnier +
      ' CAD</b> \u00b7 <b>1 seul versement</b> \u00b7 1 an complet' +
      '</div>';
    plan.insertAdjacentElement('afterend', box);
  }

  function addExtraPrices() {
    var section = document.getElementById('boutique-section');
    if (!section || section.dataset.pricesDone) return;
    section.dataset.pricesDone = '1';
    var prices = { boost: TARIFS.boost, fantome: TARIFS.fantome, visites: TARIFS.visites, montre: TARIFS.montre };
    var colors = { boost: 'rgba(0,238,255,0.9)', fantome: 'rgba(180,180,255,0.95)', visites: '#D4AF37', montre: '#D4AF37' };
    section.querySelectorAll('button[onclick*="acheterExtra"]').forEach(function (btn) {
      var m = (btn.getAttribute('onclick') || '').match(/acheterExtra\('(\w+)'\)/);
      if (!m) return;
      var key = m[1];
      if (!prices[key] || btn.parentElement.querySelector('.extra-price')) return;
      var p = document.createElement('div');
      p.className = 'extra-price';
      p.style.cssText =
        'margin-top:8px;font-size:0.55rem;font-weight:700;color:' +
        colors[key] +
        ';font-family:Share Tech Mono,monospace;letter-spacing:1px';
      p.textContent = prices[key];
      btn.insertAdjacentElement('afterend', p);
    });
  }

  function legalBanner() {
    if (document.getElementById('vibe-legal-bar')) return;
    var hud = document.querySelector('.live-hud');
    var bar = document.createElement('div');
    bar.id = 'vibe-legal-bar';
    bar.className = 'vibe-legal-bar';
    bar.innerHTML =
      'R\u00c9SERV\u00c9 AUX <b style="color:#D4AF37">18 ANS ET PLUS</b> \u00b7 Aucune donn\u00e9e vendue \u00b7 Loi 25 \u00b7 LPRPDE \u00b7 <a href="/conditions.html" style="color:rgba(0,170,255,0.85)">Conditions</a> \u00b7 <a href="/confidentialite.html" style="color:rgba(0,170,255,0.85)">Confidentialit\u00e9</a>';
    if (hud && hud.parentNode) hud.insertAdjacentElement('afterend', bar);
    else document.body.insertBefore(bar, document.body.firstChild);
  }

  function reinforceTribunal25() {
    document.querySelectorAll('.vtxt').forEach(function (el) {
      if (/(25|49)\s*\$/.test(el.textContent) && !/CAD/.test(el.textContent)) {
        el.innerHTML = el.innerHTML.replace(/(25|49)\s*\$/, '<span style="color:#DC3232;font-weight:700">49 $ CAD</span>');
      }
    });
  }

  function runAll() {
    injectCSS();
    injectSEO();
    wireStripe();
    patchLoadStats();
    fixPioneerCounter();
    fixModeFantomeText();
    badgeAngeGratuit();
    addSignupIdentites();
    addTarifsSuite();
    addExtraPrices();
    legalBanner();
    reinforceTribunal25();
  }

  ready(function () {
    runAll();
    setTimeout(runAll, 600);
    setTimeout(fixPioneerCounter, 1200);
    setTimeout(fixPioneerCounter, 3000);
  });
})();
