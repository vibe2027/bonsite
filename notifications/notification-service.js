/**
 * VIBE Notification Service
 * Handles push, email, and in-app notifications
 */

const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const emailTransport = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// ─────────────────────────────────────────────────────────────
// Types de notifications
// ─────────────────────────────────────────────────────────────

const NOTIFICATION_TYPES = {
  NEW_MESSAGE: 'new_message',
  TRIBUNAL_CASE: 'tribunal_case',
  PUB_APPROVAL: 'pub_approval',
  BILLET_TRANSFER: 'billet_transfer',
  ACCOUNT_SECURITY: 'account_security',
  ANNOUNCEMENT: 'announcement'
};

// ─────────────────────────────────────────────────────────────
// Créer notification in-app
// ─────────────────────────────────────────────────────────────

async function createNotification(userId, type, title, body, data = {}) {
  try {
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        body,
        data,
        read_at: null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`📢 Notification créée: ${notification.id}`);
    return notification;

  } catch (err) {
    console.error(`❌ Erreur créer notification: ${err.message}`);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// Envoyer email de notification
// ─────────────────────────────────────────────────────────────

async function sendEmailNotification(email, subject, htmlBody) {
  try {
    const result = await emailTransport.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject,
      html: htmlBody
    });

    console.log(`📧 Email envoyé: ${result.messageId}`);
    return result;

  } catch (err) {
    console.error(`❌ Erreur email: ${err.message}`);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// Envoyer notification de message nouveau
// ─────────────────────────────────────────────────────────────

async function notifyNewMessage(userId, salonName, senderName, message) {
  try {
    // Récupérer les préférences utilisateur
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('email_on_message, push_on_message')
      .eq('user_id', userId)
      .single();

    // In-app notification (toujours)
    await createNotification(
      userId,
      NOTIFICATION_TYPES.NEW_MESSAGE,
      `Nouveau message dans ${salonName}`,
      `${senderName}: ${message.substring(0, 50)}...`,
      { salon: salonName, sender: senderName }
    );

    // Email si activé
    if (prefs?.email_on_message) {
      const { data: user } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();

      await sendEmailNotification(
        user.email,
        `Nouveau message dans ${salonName}`,
        `<p><strong>${senderName}</strong> a écrit:</p><p>${message}</p>`
      );
    }

  } catch (err) {
    console.error(`❌ Erreur notifyNewMessage: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────
// Notifier tribunal case update
// ─────────────────────────────────────────────────────────────

async function notifyTribunalCase(userId, caseId, action, details) {
  try {
    const title = {
      created: 'Nouveau cas tribunal',
      resolved: 'Cas tribunal résolu',
      appeal: 'Appel reçu'
    }[action] || 'Mise à jour tribunal';

    await createNotification(
      userId,
      NOTIFICATION_TYPES.TRIBUNAL_CASE,
      title,
      details,
      { caseId, action }
    );

    // Email pour les cas critiques
    if (action === 'resolved') {
      const { data: user } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();

      await sendEmailNotification(
        user.email,
        title,
        `<p>Cas #${caseId}: ${details}</p>`
      );
    }

  } catch (err) {
    console.error(`❌ Erreur notifyTribunalCase: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────
// Notifier pub approval/rejection
// ─────────────────────────────────────────────────────────────

async function notifyPubStatus(userId, pubId, status, reason = '') {
  try {
    const title = status === 'approved' ? 'Pub approuvée ✅' : 'Pub rejetée ❌';
    const body = reason || 'Votre pub a été ' + (status === 'approved' ? 'approuvée' : 'rejetée');

    await createNotification(
      userId,
      NOTIFICATION_TYPES.PUB_APPROVAL,
      title,
      body,
      { pubId, status, reason }
    );

    // Email
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    await sendEmailNotification(
      user.email,
      title,
      `<p>${body}</p><p>Pub ID: ${pubId}</p>`
    );

  } catch (err) {
    console.error(`❌ Erreur notifyPubStatus: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────
// Notifier billet transfer
// ─────────────────────────────────────────────────────────────

async function notifyBilletTransfer(toUserId, fromUser, amount) {
  try {
    await createNotification(
      toUserId,
      NOTIFICATION_TYPES.BILLET_TRANSFER,
      `Vous avez reçu ${amount} billets`,
      `De: ${fromUser}`,
      { fromUser, amount }
    );

    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', toUserId)
      .single();

    await sendEmailNotification(
      user.email,
      `Vous avez reçu ${amount} billets`,
      `<p><strong>${fromUser}</strong> vous a envoyé <strong>${amount} billets</strong></p>`
    );

  } catch (err) {
    console.error(`❌ Erreur notifyBilletTransfer: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────
// Notifier account security alert
// ─────────────────────────────────────────────────────────────

async function notifySecurityAlert(userId, alertType, details) {
  try {
    const title = {
      login: 'Nouvelle connexion détectée',
      password_change: 'Mot de passe changé',
      2fa_enabled: 'Authentification 2FA activée'
    }[alertType] || 'Alerte sécurité';

    await createNotification(
      userId,
      NOTIFICATION_TYPES.ACCOUNT_SECURITY,
      title,
      details,
      { alertType }
    );

    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    await sendEmailNotification(
      user.email,
      '⚠️ ' + title,
      `<p><strong>Alerte de sécurité:</strong></p><p>${details}</p><p>Si ce n'était pas vous, changez votre mot de passe immédiatement.</p>`
    );

  } catch (err) {
    console.error(`❌ Erreur notifySecurityAlert: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────
// Marquer comme lu
// ─────────────────────────────────────────────────────────────

async function markAsRead(notificationId) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .select()
      .single();

    if (error) throw error;
    return data;

  } catch (err) {
    console.error(`❌ Erreur markAsRead: ${err.message}`);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// Récupérer notifications utilisateur
// ─────────────────────────────────────────────────────────────

async function getUserNotifications(userId, limit = 50, offset = 0) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const unreadCount = data.filter(n => !n.read_at).length;

    return {
      notifications: data,
      unreadCount,
      total: data.length
    };

  } catch (err) {
    console.error(`❌ Erreur getUserNotifications: ${err.message}`);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// Obtenir préférences de notification
// ─────────────────────────────────────────────────────────────

async function getNotificationPreferences(userId) {
  try {
    let { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error?.code === 'PGRST116') {
      // N'existe pas encore, créer les préférences par défaut
      const defaults = {
        user_id: userId,
        email_on_message: true,
        push_on_message: true,
        email_on_tribunal: true,
        push_on_tribunal: true,
        email_on_pubs: true,
        email_on_billets: true,
        email_on_security: true
      };

      const { data: created, error: createError } = await supabase
        .from('notification_preferences')
        .insert(defaults)
        .select()
        .single();

      if (createError) throw createError;
      return created;
    }

    if (error) throw error;
    return data;

  } catch (err) {
    console.error(`❌ Erreur getNotificationPreferences: ${err.message}`);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// Mettre à jour préférences
// ─────────────────────────────────────────────────────────────

async function updateNotificationPreferences(userId, preferences) {
  try {
    const { data, error } = await supabase
      .from('notification_preferences')
      .update(preferences)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;

  } catch (err) {
    console.error(`❌ Erreur updateNotificationPreferences: ${err.message}`);
    throw err;
  }
}

module.exports = {
  // Types
  NOTIFICATION_TYPES,

  // Core
  createNotification,
  sendEmailNotification,

  // Specific notifications
  notifyNewMessage,
  notifyTribunalCase,
  notifyPubStatus,
  notifyBilletTransfer,
  notifySecurityAlert,

  // User operations
  markAsRead,
  getUserNotifications,
  getNotificationPreferences,
  updateNotificationPreferences
};
