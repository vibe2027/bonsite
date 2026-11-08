/**
 * VIBE Salons v1 — Système de salons en temps réel avec Supabase
 * Trois salons : Flottant (chat), Voix (audio), Fantômes (anonyme)
 */
(function () {
  'use strict';

  const SALONS = {
    flottant: { id: 'flottant', nom: 'Salon Flottant', emoji: '🌊', type: 'chat', couleur: '#D4AF37' },
    voix: { id: 'voix', nom: 'Salon de la Voix', emoji: '🎙', type: 'voice', couleur: 'rgba(212,175,55,0.85)' },
    fantomes: { id: 'fantomes', nom: 'Salle des Fantômes', emoji: '👻', type: 'anonyme', couleur: 'rgba(180,180,255,0.85)' }
  };

  let _sb = null;
  let _userId = null;
  let _currentSalon = null;
  let _realtimeSubscription = null;
  let _messageCallback = null;

  function sb() {
    if (_sb) return _sb;
    if (window._supa) return (_sb = window._supa);
    if (window.supabase?.createClient) {
      _sb = window.supabase.createClient(
        'https://fhksytcoyjtcrkmhnoyw.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoa3N5dGNveWp0Y3JrbWhub3l3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1OTkzODIsImV4cCI6MjA5MjE3NTM4Mn0.nW9xgEQSuXlq96d53AFE7jUADmr04YdMoD9hCNmw64k'
      );
      return _sb;
    }
    return null;
  }

  async function initSalons(userId) {
    _userId = userId;
    const client = sb();
    if (!client) throw new Error('Supabase non disponible');

    try {
      await client.from('salons_messages').select('id').limit(1);
    } catch (e) {
      console.warn('Table salons_messages non prête:', e.message);
    }

    return true;
  }

  async function joinSalon(salonId) {
    if (!SALONS[salonId]) throw new Error('Salon inexistant');

    const client = sb();

    // ✅ Vérifie que l'utilisateur est toujours connecté
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) throw new Error('Session expirée');

    _currentSalon = salonId;

    if (_realtimeSubscription) {
      client.removeChannel(_realtimeSubscription);
    }

    _realtimeSubscription = client
      .channel(`salon_${salonId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'salons_messages', filter: `salon=eq.${salonId}` },
        (payload) => {
          if (_messageCallback) {
            _messageCallback(payload.new);
          }
        }
      )
      .on('presence', { event: 'sync' }, () => {
        updateMemberCount(salonId);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const { data, error } = await client
            .from('salons_messages')
            .select('*')
            .eq('salon', salonId)
            .order('created_at', { ascending: false })
            .limit(50);

          if (!error && data) {
            data.reverse().forEach(msg => {
              if (_messageCallback) _messageCallback(msg);
            });
          }

          // ✅ Track présence avec l'utilisateur actuel (pas le cache)
          await _realtimeSubscription.track({
            online_at: new Date().toISOString(),
            user_id: user.id
          });
        }
      });

    return true;
  }

  async function sendMessage(text) {
    if (!_currentSalon) throw new Error('Salon manquant');

    const client = sb();

    // ✅ Récupère l'utilisateur DIRECTEMENT de la session active (pas de cache)
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) throw new Error('Session expirée, reconnecte-toi');

    const { data, error } = await client.from('salons_messages').insert({
      salon: _currentSalon,
      user_id: user.id,  // ✅ Depuis la session active, pas du cache
      texte: text,
      created_at: new Date().toISOString()
    }).select();

    if (error) throw error;
    return data?.[0];
  }

  async function loadMessages(salonId, limit = 50) {
    const client = sb();
    const { data, error } = await client
      .from('salons_messages')
      .select('*')
      .eq('salon', salonId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).reverse();
  }

  async function updateMemberCount(salonId) {
    const client = sb();
    const channel = client.channel(`salon_${salonId}`);
    const state = channel.presenceState();
    return Object.keys(state).length;
  }

  function onNewMessage(callback) {
    _messageCallback = callback;
  }

  function getSalonCategories() {
    return Object.values(SALONS);
  }

  function getSalonById(id) {
    return SALONS[id] || null;
  }

  function canAccessSalon(salonId) {
    return !!SALONS[salonId] && _userId != null;
  }

  window.vibeSalons = {
    disabled: false,
    init: initSalons,
    joinSalon,
    sendMessage,
    loadMessages,
    updateMemberCount,
    onNewMessage,
    getSalonCategories,
    getSalonById,
    canAccessSalon,
    getCurrentSalon: () => _currentSalon
  };
})();
