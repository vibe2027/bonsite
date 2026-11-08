/**
 * VIBE Contact Routes
 * Formulaire de contact → Email support@vibegay.ca
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// Tri des courriels du QG → public.hq_emails_ai
// ─────────────────────────────────────────────────────────────
// Tri par règles (mots-clés), pas par modèle de langage : aucune clé d'IA n'est
// branchée ici. La colonne resume_ia reçoit un extrait du message.
// La catégorie « finance » n'est lisible que par le Fondateur : la politique RLS
// hq_emails_ai_lecture (hq_caller_role) l'impose côté base, et le COO la reçoit exclue.
const CATEGORIES = [
  ['finance',   /paiement|facture|factur|rembours|virement|interac|stripe|revenu|abonnement|prix|tarif|impay|d[ée]bit|cr[ée]dit/i, 'haute'],
  ['plainte',   /plainte|harc[eè]le|signal|abus|arnaque|menace|danger|insulte|discrimin|inappropri/i, 'haute'],
  ['pub',       /publicit|partenariat|commandit|annonceur|sponsor|promotion/i, 'normale'],
  ['reseaux',   /instagram|facebook|tiktok|m[ée]dia|journaliste|presse|entrevue|r[ée]seaux? sociaux/i, 'normale'],
  ['technique', /bug|erreur|ne fonctionne|plante|connexion|mot de passe|impossible de|application ne/i, 'normale']
];

function classerCourriel(subject, message) {
  const texte = `${subject || ''} ${message || ''}`;
  for (const [categorie, regle, priorite] of CATEGORIES) {
    if (regle.test(texte)) return { categorie, priorite };
  }
  return { categorie: 'general', priorite: 'normale' };
}

let _hq = null;
function hqClient() {
  if (!_hq && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    _hq = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return _hq;
}

async function classerDansLeQG({ name, email, subject, message }) {
  try {
    const client = hqClient();
    if (!client) return;
    const { categorie, priorite } = classerCourriel(subject, message);
    const { error } = await client.from('hq_emails_ai').insert({
      // finance → boîte du Fondateur ; le reste → boîte du Directeur des Opérations (le Fondateur voit tout).
      boite_cible: categorie === 'finance' ? 'founder' : 'coo',
      expediteur: `${String(name).slice(0, 80)} <${String(email).slice(0, 120)}>`,
      sujet: String(subject).slice(0, 200),
      categorie,
      resume_ia: String(message).replace(/\s+/g, ' ').trim().slice(0, 280),
      priorite
    });
    if (error) console.error(`⚠️ Tri QG impossible: ${error.message}`);
  } catch (e) {
    console.error(`⚠️ Tri QG impossible: ${e.message}`);
  }
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const CONTACT_TO = process.env.CONTACT_TO_EMAIL || 'support@vibegay.ca';
const CONTACT_FROM = process.env.CONTACT_FROM_EMAIL || 'VIBE <noreply@vibegay.ca>';

// Échappe le contenu fourni par l'utilisateur avant de l'insérer dans le HTML
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * POST /contact
 * Recevoir les messages du formulaire de contact
 */
router.post('/', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        error: 'Tous les champs sont requis: name, email, subject, message'
      });
    }

    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Email invalide' });
    }

    if (message.length < 10) {
      return res.status(400).json({ error: 'Le message doit avoir au moins 10 caractères' });
    }

    if (!process.env.RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY absente — envoi impossible');
      return res.status(503).json({
        error: 'Service d\'envoi indisponible. Veuillez réessayer plus tard.'
      });
    }

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message);

    // Envoyer via Resend
    const payload = {
      to: [CONTACT_TO],
      from: CONTACT_FROM,
      reply_to: email,
      subject: `[Contact] ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>📧 Nouveau message de contact</h2>

          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>De :</strong> ${safeName}</p>
            <p><strong>Email :</strong> <a href="mailto:${safeEmail}">${safeEmail}</a></p>
            <p><strong>Sujet :</strong> ${safeSubject}</p>
          </div>

          <div style="background: #fff; padding: 15px; border-left: 4px solid #D4AF37; margin: 20px 0;">
            <p><strong>Message :</strong></p>
            <p style="white-space: pre-wrap; word-break: break-word;">${safeMessage}</p>
          </div>

          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            ⏰ Envoyé via formulaire de contact vibegay.ca
          </p>
        </div>
      `,
      text: `Nouveau message de contact\n\nDe: ${name}\nEmail: ${email}\nSujet: ${subject}\n\nMessage:\n${message}`
    };

    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Resend ${response.status}: ${detail}`);
    }

    console.log(`✅ Email de contact reçu de ${email}`);
    // Meilleur effort : un échec du tri ne doit jamais bloquer la réponse à la personne.
    await classerDansLeQG({ name, email, subject, message });
    res.status(200).json({
      success: true,
      message: 'Merci ! Votre message a été envoyé. Nous vous répondrons bientôt.',
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error(`❌ Erreur contact: ${err.message}`);
    res.status(500).json({
      error: 'Erreur lors de l\'envoi du message. Veuillez réessayer plus tard.'
    });
  }
});

module.exports = router;
