/**
 * VIBE Salon UI v1 — Rendu et interactions temps réel
 */
(function () {
  'use strict';

  let _currentSalon = null;
  let _messages = [];
  const MAX_MESSAGES = 100;

  function escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async function selectSalon(salonId) {
    if (!window.vibeSalons?.canAccessSalon(salonId)) {
      console.warn('Accès refusé à ce salon');
      return false;
    }

    _currentSalon = salonId;
    _messages = [];

    const salon = window.vibeSalons.getSalonById(salonId);
    const labelEl = document.getElementById('salon-actif-label');
    if (labelEl) {
      labelEl.innerHTML = `${salon.emoji} ${salon.nom.toUpperCase()}`;
    }

    try {
      const msgs = await window.vibeSalons.loadMessages(salonId, 30);
      _messages = msgs;
      renderMessages();

      await window.vibeSalons.joinSalon(salonId);

      window.vibeSalons.onNewMessage((msg) => {
        addMessage(msg);
        if (window.vibeHaptic?.onMessageReceived) {
          window.vibeHaptic.onMessageReceived();
        }
      });

      updateSalonBgEffect(salonId);
      return true;
    } catch (err) {
      console.error('Erreur salon:', err.message);
      return false;
    }
  }

  function addMessage(msg) {
    if (_messages.length >= MAX_MESSAGES) _messages.shift();
    _messages.push(msg);
    renderMessages();
  }

  function renderMessages() {
    const container = document.getElementById('live-chat-msgs');
    if (!container) return;

    container.innerHTML = _messages.map(msg => `
      <div class="msg-item" style="display:flex;gap:8px;margin-bottom:10px;font-size:0.75rem;padding-bottom:8px;border-bottom:0.5px solid rgba(255,255,255,0.05)">
        <div style="color:rgba(212,175,55,0.7);min-width:65px">[${new Date(msg.created_at).toLocaleTimeString('fr-CA', {hour:'2-digit',minute:'2-digit'})}]</div>
        <div style="flex:1">
          <div style="color:#D4AF37;margin-bottom:2px">${escapeHTML(msg.user_id?.substring(0, 8) || 'Anon')}</div>
          <div style="color:rgba(255,255,255,0.85)">${escapeHTML(msg.texte)}</div>
        </div>
      </div>
    `).join('');

    container.scrollTop = container.scrollHeight;
  }

  function updateSalonBgEffect(salonId) {
    const canvas = document.getElementById('salon-canvas');
    if (canvas && window.animateSalon) {
      window.animateSalon(salonId, canvas);
    }
  }

  async function sendMessage() {
    const input = document.getElementById('chat-input');
    if (!input || !input.value.trim()) return;

    const text = input.value.trim();
    input.value = '';

    try {
      await window.vibeSalons.sendMessage(text);
    } catch (err) {
      console.error('Erreur envoi message:', err.message);
    }
  }

  window.salonUI = {
    disabled: false,
    selectSalon,
    sendMessage,
    addMessage,
    renderMessages,
    escapeHTML
  };

  window.sendChatMsg = sendMessage;
})();
