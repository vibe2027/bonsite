/**
 * VIBE Live v2 — GPS optimisé, conflits, status SOS, salons
 */
(function () {
  'use strict';

  var SOS_SECONDS = 30;
  var GPS_MAX_AGE_MS = 15000;
  var GPS_GOOD_ACC_M = 50;

  var _sb = null;
  var _sosRec = null;
  var _sosChunks = [];
  var _sosWatch = null;
  var _sosPos = null;
  var _sosActive = false;
  var _sosLock = false;
  var _sosTimerIv = null;
  var _sosForceTo = null;
  var _status = 'idle'; // idle | ready | recording | sending | sent | error
  var _gpsStatus = 'off'; // off | seeking | ok | weak | denied

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function sb() {
    if (_sb) return _sb;
    try {
      if (window._supa) {
        _sb = window._supa;
        return _sb;
      }
      if (window.supabase && window.supabase.createClient) {
        _sb = window.supabase.createClient(
          'https://fhksytcoyjtcrkmhnoyw.supabase.co',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoa3N5dGNveWp0Y3JrbWhub3l3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1OTkzODIsImV4cCI6MjA5MjE3NTM4Mn0.nW9xgEQSuXlq96d53AFE7jUADmr04YdMoD9hCNmw64k'
        );
        return _sb;
      }
    } catch (e) {}
    return null;
  }

  function notify(msg, ok) {
    if (ok && typeof showSuccess === 'function') return showSuccess(msg);
    if (!ok && typeof showError === 'function') return showError(msg);
    try {
      console.log('[VIBE]', msg);
    } catch (e) {}
  }

  /* ── Status SOS (HUD + panel) ── */
  function setSosStatus(st, detail) {
    _status = st;
    var labels = {
      idle: { t: 'ANGE \u00b7 PR\u00caT', c: 'rgba(212,175,55,0.7)' },
      ready: { t: 'GPS OK \u00b7 PR\u00caT', c: '#3bb6ff' },
      recording: { t: 'ENREG. 30s', c: '#DC3232' },
      sending: { t: 'ENVOI...', c: '#ffaa00' },
      sent: { t: 'ALERTE ENVOY\u00c9E', c: '#2ecc71' },
      error: { t: 'ERREUR', c: '#DC3232' }
    };
    var L = labels[st] || labels.idle;
    var el = document.getElementById('vibe-sos-status');
    if (el) {
      el.textContent = L.t + (detail ? ' \u00b7 ' + detail : '');
      el.style.color = L.c;
    }
    var hud = document.getElementById('lh-sos');
    if (hud && st === 'sent') {
      var n = parseInt(hud.textContent, 10) || 0;
      hud.textContent = String(n + 1);
    }
    var dot = document.getElementById('vibe-sos-dot');
    if (dot) {
      dot.style.background =
        st === 'recording' ? '#DC3232' : st === 'sent' ? '#2ecc71' : st === 'ready' ? '#3bb6ff' : 'rgba(212,175,55,0.5)';
      dot.style.boxShadow =
        st === 'recording' ? '0 0 12px #DC3232' : st === 'sent' ? '0 0 10px #2ecc71' : 'none';
      if (st === 'recording') dot.classList.add('vibe-pulse');
      else dot.classList.remove('vibe-pulse');
    }
  }

  function setGpsStatus(st, acc) {
    _gpsStatus = st;
    var g = document.getElementById('vibe-gps-status');
    if (!g) return;
    var map = {
      off: 'GPS \u00b7 OFF',
      seeking: 'GPS \u00b7 RECHERCHE...',
      ok: 'GPS \u00b7 OK' + (acc != null ? ' \u00b7 ' + Math.round(acc) + 'm' : ''),
      weak: 'GPS \u00b7 FAIBLE' + (acc != null ? ' \u00b7 ' + Math.round(acc) + 'm' : ''),
      denied: 'GPS \u00b7 REFUS\u00c9'
    };
    g.textContent = map[st] || st;
    g.style.color =
      st === 'ok' ? '#2ecc71' : st === 'weak' ? '#ffaa00' : st === 'denied' ? '#DC3232' : 'rgba(255,255,255,0.45)';
  }

  /* ── GPS optimis\u00e9 (meilleure pr\u00e9cision, pas de conflit) ── */
  function acceptPosition(pos) {
    if (!pos || !pos.coords) return false;
    var acc = pos.coords.accuracy;
    var next = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: acc,
      ts: Date.now()
    };
    // Conflit : garder la position la plus pr\u00e9cise / la plus fra\u00eeche
    if (!_sosPos) {
      _sosPos = next;
      setGpsStatus(acc <= GPS_GOOD_ACC_M ? 'ok' : 'weak', acc);
      if (_status === 'idle') setSosStatus('ready');
      return true;
    }
    var age = Date.now() - _sosPos.ts;
    if (acc < _sosPos.accuracy || age > GPS_MAX_AGE_MS) {
      _sosPos = next;
      setGpsStatus(acc <= GPS_GOOD_ACC_M ? 'ok' : 'weak', acc);
      if (_status === 'idle' || _status === 'ready') setSosStatus('ready');
      return true;
    }
    return false;
  }

  function startGpsWatch() {
    if (!navigator.geolocation) {
      setGpsStatus('denied');
      return;
    }
    if (_sosWatch != null) return; // d\u00e9j\u00e0 actif — pas de conflit
    setGpsStatus('seeking');
    try {
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          acceptPosition(pos);
        },
        function (err) {
          if (err && err.code === 1) setGpsStatus('denied');
          else setGpsStatus('weak');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
      );
      _sosWatch = navigator.geolocation.watchPosition(
        function (pos) {
          acceptPosition(pos);
        },
        function (err) {
          if (err && err.code === 1) setGpsStatus('denied');
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 12000 }
      );
    } catch (e) {
      setGpsStatus('denied');
    }
  }

  function stopGpsWatch() {
    if (_sosWatch != null && navigator.geolocation) {
      try {
        navigator.geolocation.clearWatch(_sosWatch);
      } catch (e) {}
    }
    _sosWatch = null;
  }

  /* ── CSS ── */
  function injectLiveCSS() {
    if (document.getElementById('vibe-live-css')) return;
    var s = document.createElement('style');
    s.id = 'vibe-live-css';
    s.textContent = [
      '.vibe-bubble{position:absolute;width:68px;height:68px;border-radius:50%;overflow:hidden;border:2px solid rgba(0,170,255,0.55);box-shadow:0 0 18px rgba(0,170,255,0.25);cursor:pointer;transition:transform .25s;animation:vibeFloat 6s ease-in-out infinite}',
      '.vibe-bubble:hover{transform:scale(1.12);z-index:5}',
      '.vibe-bubble img{width:100%;height:100%;object-fit:cover}',
      '.vibe-bubble .vb-name{position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:0.4rem;letter-spacing:1px;color:rgba(255,255,255,0.75);font-family:Share Tech Mono,monospace}',
      '.vibe-bubble-wrap{position:relative;width:100%;min-height:280px;overflow:hidden;border-radius:12px;background:radial-gradient(ellipse at center,rgba(0,40,80,0.35),rgba(0,0,0,0.5))}',
      '@keyframes vibeFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}',
      '@keyframes vibePulse{0%,100%{opacity:1}50%{opacity:.35}}',
      '.vibe-pulse{animation:vibePulse 1s infinite}',
      '.vibe-ange-panel{margin-top:14px;padding:14px;border:1px solid rgba(212,175,55,0.35);background:rgba(212,175,55,0.06);font-family:Share Tech Mono,monospace}',
      '.vibe-ange-panel input{width:100%;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.15);color:#fff;padding:10px;margin:8px 0;font-family:inherit;font-size:0.7rem}',
      '.vibe-ange-timer{font-size:1.4rem;color:#DC3232;letter-spacing:2px;text-align:center;margin:10px 0}',
      '.vibe-status-row{display:flex;align-items:center;gap:10px;margin:8px 0 4px;font-size:0.48rem;letter-spacing:2px}',
      '.vibe-sos-dot{width:10px;height:10px;border-radius:50%;background:rgba(212,175,55,0.5);flex-shrink:0}',
      '.vibe-voix-box{margin-top:12px;padding:12px;border:1px solid rgba(0,170,255,0.3);background:rgba(0,30,60,0.3)}',
      '.vibe-voix-msg{padding:8px 0;border-bottom:0.5px solid rgba(255,255,255,0.08);font-size:0.65rem;color:rgba(255,255,255,0.8)}',
      '.vibe-voix-msg b{color:#3bb6ff}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ── Bulles profils (grille anti-conflit) ── */
  async function loadFlottantBubbles() {
    var cloud =
      document.getElementById('salon-cloud') ||
      document.querySelector('.bubble-cloud') ||
      document.querySelector('[data-salon-view="flottant"]');

    if (!cloud) {
      var room = document.getElementById('salon-room') || document.querySelector('.salon-room');
      if (room) {
        cloud = document.getElementById('vibe-bubble-wrap');
        if (!cloud) {
          cloud = document.createElement('div');
          cloud.id = 'vibe-bubble-wrap';
          cloud.className = 'vibe-bubble-wrap';
          room.insertBefore(cloud, room.firstChild);
        }
      }
    }
    if (!cloud) {
      var cards = document.querySelector('.salon-card[data-salon="flottant"]');
      if (cards && cards.parentElement) {
        cloud = document.getElementById('vibe-bubble-wrap');
        if (!cloud) {
          cloud = document.createElement('div');
          cloud.id = 'vibe-bubble-wrap';
          cloud.className = 'vibe-bubble-wrap';
          cloud.style.marginTop = '16px';
          cards.parentElement.appendChild(cloud);
        }
      }
    }
    if (!cloud) return;

    var client = sb();
    var profiles = [];
    try {
      if (client) {
        var res = await client
          .from('profiles')
          .select('id,prenom,ville,photo_url,mode_fantome')
          .order('updated_at', { ascending: false })
          .limit(24);
        if (!res.error && res.data) profiles = res.data;
        if (!profiles.length) {
          var r2 = await client.from('profiles').select('id,prenom,ville,photo_url').limit(24);
          if (!r2.error && r2.data) profiles = r2.data;
        }
      }
    } catch (e) {}

    cloud.querySelectorAll('.vibe-bubble').forEach(function (b) {
      b.remove();
    });

    if (!profiles.length) {
      if (!cloud.querySelector('.vibe-empty-bubbles')) {
        var empty = document.createElement('div');
        empty.className = 'vibe-empty-bubbles';
        empty.style.cssText =
          'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:Share Tech Mono,monospace;font-size:0.55rem;color:rgba(255,255,255,0.4);letter-spacing:1px;text-align:center;padding:20px';
        empty.textContent = 'Aucun profil pour l\'instant \u2014 sois le premier.';
        cloud.appendChild(empty);
      }
      return;
    }
    var emptyMsg = cloud.querySelector('.vibe-empty-bubbles');
    if (emptyMsg) emptyMsg.remove();

    // Grille fixe = pas de chevauchement (conflit positions)
    var cols = 6;
    profiles.forEach(function (p, i) {
      var col = i % cols;
      var row = Math.floor(i / cols);
      var b = document.createElement('div');
      b.className = 'vibe-bubble';
      b.style.left = 6 + col * 15.5 + '%';
      b.style.top = 8 + row * 30 + '%';
      b.style.animationDelay = i * 0.25 + 's';
      if (p.mode_fantome) b.style.filter = 'blur(12px)';
      var name = (p.prenom || '?').slice(0, 12);
      var ville = p.ville ? '\u00b7' + String(p.ville).slice(0, 3).toUpperCase() : '';
      if (p.photo_url) {
        b.innerHTML =
          '<img src="' +
          p.photo_url +
          '" alt="" loading="lazy"/><span class="vb-name">' +
          name +
          ville +
          '</span>';
      } else {
        b.style.display = 'flex';
        b.style.alignItems = 'center';
        b.style.justifyContent = 'center';
        b.style.background = 'rgba(0,80,140,0.5)';
        b.innerHTML =
          '<span style="font-size:1.2rem;color:#3bb6ff">' +
          name.charAt(0).toUpperCase() +
          '</span><span class="vb-name">' +
          name +
          ville +
          '</span>';
      }
      b.onclick = function () {
        if (typeof openPrivateChat === 'function') openPrivateChat(p.id, p.prenom);
        else notify('Profil : ' + name + (p.ville ? ' \u00b7 ' + p.ville : ''), true);
      };
      cloud.appendChild(b);
    });
  }

  /* ── Panel Ange + status ── */
  function ensureAngePanel() {
    var btn = document.getElementById('sos-btn');
    if (!btn || document.getElementById('vibe-ange-panel')) return;
    var panel = document.createElement('div');
    panel.id = 'vibe-ange-panel';
    panel.className = 'vibe-ange-panel';
    panel.innerHTML =
      '<div class="vibe-status-row">' +
      '<span id="vibe-sos-dot" class="vibe-sos-dot"></span>' +
      '<span id="vibe-sos-status">ANGE \u00b7 PR\u00caT</span>' +
      '<span id="vibe-gps-status" style="margin-left:auto">GPS \u00b7 OFF</span>' +
      '</div>' +
      '<div style="font-size:0.48rem;letter-spacing:2px;color:#D4AF37;margin-bottom:6px">CONTACT DE CONFIANCE (obligatoire)</div>' +
      '<input id="vibe-ange-contact" type="email" placeholder="courriel@exemple.com" autocomplete="email"/>' +
      '<div style="font-size:0.42rem;color:rgba(255,255,255,0.45);line-height:1.6">GPS temps r\u00e9el optimis\u00e9 + audio <b style="color:#fff">30 s</b>. Ne remplace pas le 911.</div>' +
      '<div id="vibe-ange-timer" class="vibe-ange-timer" style="display:none">30</div>' +
      '<button type="button" id="vibe-ange-go" style="margin-top:10px;width:100%;padding:12px;background:rgba(220,50,50,0.85);border:none;color:#fff;font-family:Share Tech Mono,monospace;letter-spacing:2px;cursor:pointer;font-size:0.55rem">D\u00c9CLENCHER ALERTE (30s)</button>' +
      '<button type="button" id="vibe-ange-cancel" style="display:none;margin-top:8px;width:100%;padding:10px;background:transparent;border:1px solid rgba(255,255,255,0.25);color:rgba(255,255,255,0.7);font-family:Share Tech Mono,monospace;letter-spacing:2px;cursor:pointer;font-size:0.5rem">ANNULER</button>';
    btn.parentNode.insertBefore(panel, btn.nextSibling);

    try {
      var saved = localStorage.getItem('vibe_ange_contact');
      if (saved) document.getElementById('vibe-ange-contact').value = saved;
    } catch (e) {}

    document.getElementById('vibe-ange-go').onclick = function () {
      startAngeAlert();
    };
    document.getElementById('vibe-ange-cancel').onclick = function () {
      cancelAngeAlert();
    };

    var taps = [];
    btn.addEventListener(
      'click',
      function (e) {
        var now = Date.now();
        taps = taps.filter(function (t) {
          return now - t < 900;
        });
        taps.push(now);
        if (taps.length >= 3) {
          taps = [];
          e.preventDefault();
          e.stopPropagation();
          startAngeAlert();
        }
      },
      true
    );

    // GPS en veille (pr\u00e9chauffe)
    startGpsWatch();
    setSosStatus('idle');
  }

  function getContact() {
    var input = document.getElementById('vibe-ange-contact');
    var email = (input && input.value ? input.value : '').trim();
    if (!email) {
      try {
        email = localStorage.getItem('vibe_ange_contact') || '';
      } catch (e) {}
    }
    if (!email && window.CURRENT_USER && window.CURRENT_USER.user_metadata) {
      email = window.CURRENT_USER.user_metadata.contact_urgence || '';
    }
    return email;
  }

  function cancelAngeAlert() {
    if (!_sosActive) return;
    try {
      if (_sosRec && _sosRec.state !== 'inactive') _sosRec.stop();
    } catch (e) {}
    if (_sosTimerIv) clearInterval(_sosTimerIv);
    if (_sosForceTo) clearTimeout(_sosForceTo);
    _sosTimerIv = null;
    _sosForceTo = null;
    _sosActive = false;
    _sosLock = false;
    _sosChunks = [];
    var timerEl = document.getElementById('vibe-ange-timer');
    if (timerEl) timerEl.style.display = 'none';
    var cancelBtn = document.getElementById('vibe-ange-cancel');
    if (cancelBtn) cancelBtn.style.display = 'none';
    setSosStatus('idle');
    notify('Alerte annul\u00e9e', false);
  }

  async function startAngeAlert() {
    // Verrou anti-conflit (double d\u00e9clenchement)
    if (_sosActive || _sosLock) {
      notify('\u26a0 Alerte d\u00e9j\u00e0 en cours', false);
      return;
    }
    var contact = getContact();
    if (!contact || contact.indexOf('@') < 1) {
      notify('\u26a0 Ajoute un courriel de contact de confiance', false);
      var panel = document.getElementById('vibe-ange-panel');
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var inp = document.getElementById('vibe-ange-contact');
      if (inp) inp.focus();
      return;
    }
    try {
      localStorage.setItem('vibe_ange_contact', contact);
    } catch (e) {}

    _sosLock = true;
    _sosActive = true;
    _sosChunks = [];

    // GPS : s'assurer que le watch tourne
    startGpsWatch();

    var timerEl = document.getElementById('vibe-ange-timer');
    if (timerEl) {
      timerEl.style.display = 'block';
      timerEl.textContent = String(SOS_SECONDS);
    }
    var cancelBtn = document.getElementById('vibe-ange-cancel');
    if (cancelBtn) cancelBtn.style.display = 'block';

    setSosStatus('recording');
    notify('Mode Ange \u2014 enregistrement ' + SOS_SECONDS + 's', true);

    try {
      var stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      var mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';
      _sosRec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      _sosChunks = [];
      _sosRec.ondataavailable = function (ev) {
        if (ev.data && ev.data.size) _sosChunks.push(ev.data);
      };
      _sosRec.onstop = function () {
        stream.getTracks().forEach(function (t) {
          t.stop();
        });
        if (_sosActive) finishAngeAlert(contact);
        else {
          _sosLock = false;
        }
      };
      _sosRec.start(1000);

      var left = SOS_SECONDS;
      if (_sosTimerIv) clearInterval(_sosTimerIv);
      _sosTimerIv = setInterval(function () {
        left -= 1;
        if (timerEl) timerEl.textContent = String(Math.max(0, left));
        setSosStatus('recording', left + 's');
        if (left <= 0) {
          clearInterval(_sosTimerIv);
          _sosTimerIv = null;
          try {
            if (_sosRec && _sosRec.state !== 'inactive') _sosRec.stop();
          } catch (e) {
            finishAngeAlert(contact);
          }
        }
      }, 1000);

      if (_sosForceTo) clearTimeout(_sosForceTo);
      _sosForceTo = setTimeout(function () {
        try {
          if (_sosRec && _sosRec.state !== 'inactive') _sosRec.stop();
        } catch (e) {}
      }, (SOS_SECONDS + 1) * 1000);
    } catch (err) {
      notify('\u26a0 Micro refus\u00e9 \u2014 envoi GPS seulement', false);
      await finishAngeAlert(contact);
    }
  }

  async function finishAngeAlert(contact) {
    if (_sosTimerIv) clearInterval(_sosTimerIv);
    if (_sosForceTo) clearTimeout(_sosForceTo);
    _sosTimerIv = null;
    _sosForceTo = null;

    setSosStatus('sending');
    var cancelBtn = document.getElementById('vibe-ange-cancel');
    if (cancelBtn) cancelBtn.style.display = 'none';

    var blob = null;
    if (_sosChunks.length) {
      blob = new Blob(_sosChunks, { type: (_sosChunks[0] && _sosChunks[0].type) || 'audio/webm' });
    }

    // Position : pr\u00e9f\u00e9rer la plus pr\u00e9cise encore fra\u00eeche
    var pos = _sosPos;
    if (pos && Date.now() - pos.ts > GPS_MAX_AGE_MS) {
      // trop vieille — tenter un dernier fix
      try {
        await new Promise(function (resolve) {
          if (!navigator.geolocation) return resolve();
          navigator.geolocation.getCurrentPosition(
            function (p) {
              acceptPosition(p);
              pos = _sosPos;
              resolve();
            },
            function () {
              resolve();
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
          );
        });
      } catch (e) {}
    }

    var payload = {
      contact_email: contact,
      lat: pos ? pos.lat : null,
      lng: pos ? pos.lng : null,
      accuracy: pos ? pos.accuracy : null,
      user_id: window.CURRENT_USER ? window.CURRENT_USER.id : null,
      created_at: new Date().toISOString(),
      duration_sec: SOS_SECONDS,
      status: 'sent'
    };

    var client = sb();
    var ok = false;
    try {
      if (client) {
        if (blob && blob.size > 0) {
          var path = 'sos/' + (payload.user_id || 'anon') + '_' + Date.now() + '.webm';
          try {
            var up = await client.storage.from('sos-audio').upload(path, blob, {
              contentType: blob.type || 'audio/webm',
              upsert: true
            });
            if (!up.error) payload.audio_path = path;
          } catch (e) {}
        }
        var ins = await client.from('sos_alerts').insert([payload]);
        if (!ins.error) ok = true;
      }
    } catch (e) {}

    if (!ok) {
      // File offline anti-perte
      try {
        var q = JSON.parse(localStorage.getItem('vibe_sos_queue') || '[]');
        q.push(payload);
        localStorage.setItem('vibe_sos_queue', JSON.stringify(q.slice(-30)));
      } catch (e2) {}
    }

    _sosActive = false;
    _sosLock = false;
    _sosRec = null;
    _sosChunks = [];

    var timerEl = document.getElementById('vibe-ange-timer');
    if (timerEl) {
      timerEl.textContent = '0';
      setTimeout(function () {
        timerEl.style.display = 'none';
      }, 2500);
    }

    setSosStatus(ok ? 'sent' : 'error', pos ? 'GPS' : 'sans GPS');
    notify(
      (ok ? '\u2713' : '\u26a0') +
        ' Alerte ' +
        (ok ? 'envoy\u00e9e' : 'mise en file') +
        (blob ? ' (audio 30s)' : '') +
        (pos ? ' + GPS' : ''),
      ok
    );

    setTimeout(function () {
      if (_status === 'sent' || _status === 'error') setSosStatus('idle');
    }, 8000);
  }

  /* File offline → r\u00e9essayer */
  async function flushSosQueue() {
    var client = sb();
    if (!client) return;
    var q = [];
    try {
      q = JSON.parse(localStorage.getItem('vibe_sos_queue') || '[]');
    } catch (e) {
      return;
    }
    if (!q.length) return;
    var remain = [];
    for (var i = 0; i < q.length; i++) {
      try {
        var r = await client.from('sos_alerts').insert([q[i]]);
        if (r.error) remain.push(q[i]);
      } catch (e) {
        remain.push(q[i]);
      }
    }
    try {
      localStorage.setItem('vibe_sos_queue', JSON.stringify(remain));
    } catch (e) {}
  }

  /* ── Salon Voix ── */
  function ensureVoixUI() {
    var card = document.querySelector('.salon-card[data-salon="voix"]');
    if (!card || document.getElementById('vibe-voix-box')) return;
    var box = document.createElement('div');
    box.id = 'vibe-voix-box';
    box.className = 'vibe-voix-box';
    box.innerHTML =
      '<div style="font-size:0.48rem;letter-spacing:2px;color:#3bb6ff;margin-bottom:8px">SALON DE LA VOIX \u00b7 TEMPS R\u00c9EL</div>' +
      '<div id="vibe-voix-msgs" style="max-height:180px;overflow-y:auto;margin-bottom:8px"></div>' +
      '<div style="display:flex;gap:6px">' +
      '<input id="vibe-voix-input" type="text" placeholder="\u00c9cris ou note vocale..." style="flex:1;background:rgba(0,0,0,0.4);border:1px solid rgba(0,170,255,0.3);color:#fff;padding:8px;font-family:Share Tech Mono,monospace;font-size:0.6rem"/>' +
      '<button type="button" id="vibe-voix-send" style="padding:8px 12px;background:#00aaff;border:none;color:#000;font-family:Share Tech Mono,monospace;cursor:pointer;font-size:0.5rem">ENVOYER</button>' +
      '<button type="button" id="vibe-voix-rec" style="padding:8px 12px;background:rgba(220,50,50,0.8);border:none;color:#fff;font-family:Share Tech Mono,monospace;cursor:pointer;font-size:0.5rem">\uD83C\uDF99 15s</button>' +
      '</div>';
    card.parentNode.insertBefore(box, card.nextSibling);
    document.getElementById('vibe-voix-send').onclick = sendVoixText;
    document.getElementById('vibe-voix-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') sendVoixText();
    });
    document.getElementById('vibe-voix-rec').onclick = recordVoixNote;
    loadVoixMessages();
    subscribeVoix();
  }

  function escapeHtml(t) {
    var d = document.createElement('div');
    d.textContent = t || '';
    return d.innerHTML;
  }

  async function loadVoixMessages() {
    var client = sb();
    var box = document.getElementById('vibe-voix-msgs');
    if (!box || !client) return;
    try {
      var res = await client
        .from('salon_messages')
        .select('id,username,message,created_at')
        .eq('salon_id', 'voix')
        .order('created_at', { ascending: false })
        .limit(40);
      if (res.error || !res.data) return;
      box.innerHTML = res.data
        .slice()
        .reverse()
        .map(function (m) {
          return (
            '<div class="vibe-voix-msg"><b>' +
            escapeHtml(m.username || '?') +
            '</b> ' +
            escapeHtml(m.message) +
            '</div>'
          );
        })
        .join('');
      box.scrollTop = box.scrollHeight;
    } catch (e) {}
  }

  async function sendVoixText() {
    var input = document.getElementById('vibe-voix-input');
    var msg = (input && input.value ? input.value : '').trim();
    if (!msg) return;
    if (!window.CURRENT_USER) {
      notify('\u26a0 Connecte-toi pour \u00e9crire', false);
      if (typeof openLogin === 'function') openLogin();
      return;
    }
    var client = sb();
    if (!client) return;
    try {
      await client.from('salon_messages').insert([
        {
          salon_id: 'voix',
          user_id: window.CURRENT_USER.id,
          username: (window.CURRENT_USER.email || 'membre').split('@')[0],
          message: msg
        }
      ]);
      input.value = '';
      loadVoixMessages();
    } catch (e) {
      notify('\u26a0 Envoi impossible', false);
    }
  }

  var _voixRecLock = false;
  async function recordVoixNote() {
    if (_voixRecLock) {
      notify('\u26a0 Enregistrement d\u00e9j\u00e0 en cours', false);
      return;
    }
    if (!window.CURRENT_USER) {
      notify('\u26a0 Connecte-toi', false);
      return;
    }
    _voixRecLock = true;
    try {
      var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      var rec = new MediaRecorder(stream);
      var chunks = [];
      rec.ondataavailable = function (e) {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = async function () {
        stream.getTracks().forEach(function (t) {
          t.stop();
        });
        var blob = new Blob(chunks, { type: 'audio/webm' });
        var client = sb();
        if (client) {
          var path = 'voix/' + window.CURRENT_USER.id + '_' + Date.now() + '.webm';
          try {
            await client.storage.from('salon-audio').upload(path, blob, { contentType: 'audio/webm' });
          } catch (e) {}
          await client.from('salon_messages').insert([
            {
              salon_id: 'voix',
              user_id: window.CURRENT_USER.id,
              username: (window.CURRENT_USER.email || 'membre').split('@')[0],
              message: '[Note vocale 15s]'
            }
          ]);
        }
        _voixRecLock = false;
        notify('\u2713 Note vocale envoy\u00e9e', true);
        loadVoixMessages();
      };
      rec.start();
      notify('Enregistrement 15s...', true);
      setTimeout(function () {
        try {
          if (rec.state !== 'inactive') rec.stop();
        } catch (e) {
          _voixRecLock = false;
        }
      }, 15000);
    } catch (e) {
      _voixRecLock = false;
      notify('\u26a0 Micro refus\u00e9', false);
    }
  }

  function subscribeVoix() {
    var client = sb();
    if (!client || window._vibeVoixSub) return;
    try {
      client
        .channel('salon:voix')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'salon_messages', filter: 'salon_id=eq.voix' },
          function () {
            loadVoixMessages();
          }
        )
        .subscribe();
      window._vibeVoixSub = true;
    } catch (e) {}
  }

  function init() {
    injectLiveCSS();
    ensureAngePanel();
    ensureVoixUI();
    loadFlottantBubbles();
    flushSosQueue();
  }

  ready(function () {
    init();
    setTimeout(init, 1000);
    setTimeout(loadFlottantBubbles, 2500);
    setInterval(loadFlottantBubbles, 45000);
    setInterval(flushSosQueue, 60000);
    window.addEventListener('online', flushSosQueue);
  });

  window.vibeStartAnge = startAngeAlert;
  window.vibeCancelAnge = cancelAngeAlert;
  window.vibeLoadBubbles = loadFlottantBubbles;
  window.vibeSosStatus = function () {
    return { status: _status, gps: _gpsStatus, pos: _sosPos };
  };
})();
