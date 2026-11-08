/**
 * VIBE Haptic v1 — Vibrations haptiques et détection de proximité
 */
(function () {
  'use strict';

  const PATTERNS = {
    message: [20, 30, 20],
    proximite: [50, 100, 50, 100],
    connected: [100, 50, 100],
    sos_alert: [200, 100, 200, 100, 200],
    heartbeat: [30, 50, 30]
  };

  function vibrate(pattern) {
    if (!navigator.vibrate) return;
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.warn('Vibration non supportée:', e.message);
    }
  }

  function onMessageReceived() {
    vibrate(PATTERNS.message);
  }

  function onProximityAlert() {
    vibrate(PATTERNS.proximite);
  }

  function onConnected() {
    vibrate(PATTERNS.connected);
  }

  function sosAlert() {
    vibrate(PATTERNS.sos_alert);
  }

  async function detectProximity(targetLat, targetLng, radiusMeters = 500) {
    if (!navigator.geolocation) return false;

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const distance = haversine(pos.coords.latitude, pos.coords.longitude, targetLat, targetLng);
          resolve(distance <= radiusMeters);
        },
        () => resolve(false),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    });
  }

  function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }


  // ══ MONTRE INTELLIGENTE (Apple Watch / Wear OS via notifications du téléphone) ══
  // Les notifications du navigateur sont relayées vers la montre par le téléphone.
  // Aucune appli native : le jumelage passe par la permission de notification + montre_active.
  var ANGE_TAG = 'vibe-ange-veille';
  var ANGE_ACTIONS = [
    { action: 'sos', title: '⚡ SOS URGENCE' },
    { action: 'ok', title: '✓ Tout va bien' }
  ];

  function _toast(kind, msg) {
    var fn = kind === 'ok' ? window.showSuccess : window.showError;
    if (typeof fn === 'function') fn(msg);
  }

  async function _swReg() {
    if (!('serviceWorker' in navigator)) return null;
    try {
      return (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.ready);
    } catch (e) {
      return null;
    }
  }

  async function _notifier(titre, options) {
    var reg = await _swReg();
    if (reg && reg.showNotification) {
      await reg.showNotification(titre, options);
      return true;
    }
    if ('Notification' in window && Notification.permission === 'granted') {
      var o = Object.assign({}, options);
      delete o.actions; // actions seulement via service worker
      new Notification(titre, o);
      return true;
    }
    return false;
  }

  async function activerVeilleMontreAnge() {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      _toast('err', '⚠ Autorise les notifications pour activer la veille Ange.');
      return false;
    }
    var ok = await _notifier('✦ VIBE · Mode Ange en veille', {
      body: 'Un tap suffit en cas de besoin.',
      tag: ANGE_TAG,
      renotify: false,
      requireInteraction: true,
      actions: ANGE_ACTIONS,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { type: 'ange-veille' }
    });
    if (!ok) _toast('err', '⚠ Notification indisponible sur cet appareil.');
    return ok;
  }

  async function jumelerMontreVibe() {
    var user = window.CURRENT_USER;
    if (!user) {
      _toast('err', '⚠ Connecte-toi pour jumeler ta montre.');
      if (typeof window.openLogin === 'function') window.openLogin();
      return;
    }
    var sb = typeof _supa !== 'undefined' ? _supa : null;
    if (!sb) { _toast('err', '⚠ Service indisponible.'); return; }
    try {
      var acc = await sb.rpc('mon_acces');
      if (!acc.data || !acc.data.montre) {
        _toast('err', '⚠ Achète « Connexion Montre » pour la jumeler (incluse pour les Pionniers).');
        return;
      }
    } catch (e) {
      _toast('err', '⚠ Vérification de l’accès impossible.');
      return;
    }
    if (!('Notification' in window)) {
      _toast('err', '⚠ Les notifications ne sont pas supportées ici.');
      return;
    }
    var perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      _toast('err', '⚠ Permission de notification refusée.');
      return;
    }
    var up = await sb.from('profiles').update({ montre_active: true }).eq('id', user.id);
    if (up.error) { _toast('err', '⚠ Impossible d’activer la montre.'); return; }
    vibrate(PATTERNS.connected);
    await _notifier('⌚ VIBE', {
      body: '⌚ Montre VIBE connectée · Mode Ange & Radar Affinité actifs',
      tag: 'vibe-montre-test',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { type: 'montre-test' }
    });
    await activerVeilleMontreAnge();
    _toast('ok', '⌚ Montre jumelée.');
  }

  // Alerte discrète au poignet : membre >= 80 % d'affinité à proximité (<= 2 km).
  // Une seule alerte par membre et par session.
  var _alertes = {};
  async function vibeMontreAlerteAffinite(membre, pct) {
    try {
      if (!membre || pct < 80) return;
      if (membre.distance_km == null || membre.distance_km > 2) return;
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      if (_alertes[membre.id]) return;
      var sb = typeof _supa !== 'undefined' ? _supa : null;
      var user = window.CURRENT_USER;
      if (!sb || !user) return;
      var p = await sb.from('profiles').select('montre_active').eq('id', user.id).maybeSingle();
      if (!p.data || !p.data.montre_active) return;
      _alertes[membre.id] = true;
      vibrate(PATTERNS.proximite);
      await _notifier('✦ VIBE · Connexion proche (' + pct + '% affinité)', {
        body: 'Quelqu’un de compatible est tout près.',
        tag: 'vibe-affinite-' + membre.id,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: { type: 'affinite' }
      });
    } catch (e) {}
  }

  // Messages du service worker (action SOS depuis la montre)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function (ev) {
      if (ev.data && ev.data.type === 'vibe-sos' && typeof window.activateSOS === 'function') {
        window.activateSOS();
      }
    });
  }
  // Ouverture à froid depuis la notification : confirmation avant d'envoyer un SOS.
  if (location.hash === '#sos-montre') {
    window.addEventListener('load', function () {
      history.replaceState(null, '', location.pathname + location.search);
      if (typeof window.activateSOS === 'function' && window.confirm('Déclencher le SOS Mode Ange ?')) {
        window.activateSOS();
      }
    });
  }

  window.jumelerMontreVibe = jumelerMontreVibe;
  window.activerVeilleMontreAnge = activerVeilleMontreAnge;
  window.vibeMontreAlerteAffinite = vibeMontreAlerteAffinite;

  window.vibeHaptic = {
    vibrate,
    onMessageReceived,
    onProximityAlert,
    onConnected,
    sosAlert,
    detectProximity
  };
})();
