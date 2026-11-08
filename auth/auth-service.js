/**
 * VIBE Auth Service
 * Complete authentication + role management + email verification
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Email configuration
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// ─────────────────────────────────────────────────────────────
// SIGNUP (with role assignment)
// ─────────────────────────────────────────────────────────────

async function signup(email, password, fullName, region, role = 'user') {
  try {
    console.log(`📝 Signup: ${email} as ${role}`);

    // Create auth user in Supabase
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { role, full_name: fullName, region }
    });

    if (authError) throw authError;

    const authId = authData.user.id;

    // Create user record in DB
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        auth_id: authId,
        email,
        full_name: fullName,
        region,
        role,
        is_verified: false
      })
      .select()
      .single();

    if (userError) throw userError;

    // Create billets record if not admin
    if (role !== 'admin') {
      await supabase
        .from('billets')
        .insert({
          user_id: userData.id,
          amount: 0,
          balance: 0,
          monthly_limit: role === 'co_founder' ? 1000 : 0,
          is_co_founder_hidden: role === 'co_founder'
        });
    }

    // Create profile
    await supabase
      .from('user_profiles')
      .insert({
        user_id: userData.id,
        region
      });

    // Send verification email
    await sendVerificationEmail(email, authId);

    console.log(`✅ User created: ${email} (${role})`);
    return { success: true, user: userData, authId };

  } catch (err) {
    console.error(`❌ Signup error: ${err.message}`);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────

async function login(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    // Update last_login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('auth_id', data.user.id);

    console.log(`✅ Login: ${email}`);
    return { success: true, session: data.session, user: data.user };

  } catch (err) {
    console.error(`❌ Login error: ${err.message}`);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// VERIFY EMAIL
// ─────────────────────────────────────────────────────────────

async function verifyEmail(authId) {
  try {
    // Update user verification status
    const { data: user, error: userError } = await supabase
      .from('users')
      .update({
        is_verified: true,
        verified_at: new Date().toISOString()
      })
      .eq('auth_id', authId)
      .select()
      .single();

    if (userError) throw userError;

    // Confirm auth user email
    await supabase.auth.admin.updateUserById(authId, {
      email_confirm: true
    });

    console.log(`✅ Email verified: ${user.email}`);
    return { success: true, user };

  } catch (err) {
    console.error(`❌ Verification error: ${err.message}`);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// SEND EMAILS
// ─────────────────────────────────────────────────────────────

async function sendVerificationEmail(email, authId) {
  try {
    const verificationLink = `${process.env.BASE_URL}/auth/verify?token=${authId}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: '✨ Bienvenue sur VIBE — Vérifie ton email',
      html: `
        <div style="font-family: Arial; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #D4AF37;">Bienvenue sur VIBE 🌊</h2>
          <p>Merci de t'être inscrit(e)!</p>
          <p>Clique sur le lien ci-dessous pour vérifier ton adresse email:</p>
          <a href="${verificationLink}" style="
            display: inline-block;
            padding: 12px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
          ">Vérifier mon email</a>
          <p style="margin-top: 20px; font-size: 12px; color: #666;">
            Ou copie ce lien: ${verificationLink}
          </p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          <p style="font-size: 12px; color: #999;">
            VIBE — Plateforme de connexion authentique pour la communauté LGBTQ+
          </p>
        </div>
      `
    };

    await emailTransporter.sendMail(mailOptions);
    console.log(`📧 Verification email sent: ${email}`);

  } catch (err) {
    console.error(`❌ Email error: ${err.message}`);
  }
}

async function sendRoleConfirmation(email, role) {
  try {
    const roleText = role === 'admin' ? 'Administrateur' : 'Co-fondateur';
    const access = role === 'admin'
      ? 'accès complet à toutes les fonctionnalités'
      : 'accès co-fondateur avec 1000 billets/mois';

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `🔑 Accès ${roleText} confirmé — VIBE`,
      html: `
        <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #D4AF37;">Bienvenue ${roleText} 🔑</h2>
          <p>Ton compte a été configuré avec ${access}.</p>

          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3>Accès ${roleText}:</h3>
            ${role === 'admin' ? `
              <ul>
                <li>Dashboard admin complet</li>
                <li>Gestion des utilisateurs</li>
                <li>Tribunal et modération</li>
                <li>Système de billets</li>
                <li>Analytiques complètes</li>
              </ul>
            ` : `
              <ul>
                <li>1000 billets par mois</li>
                <li>Accès caché (6-12 mois)</li>
                <li>Pouvoir envoyer des pubs</li>
                <li>Co-signature VIBE</li>
                <li>Dashboard co-fondateur</li>
              </ul>
            `}
          </div>

          <p style="color: #666;">
            <strong>Note importante:</strong> Avec grand pouvoir vient grande responsabilité.
            Nous comptons sur ton humilité et ton respect de la communauté.
          </p>

          <p style="margin-top: 30px;">
            <a href="${process.env.BASE_URL}/dashboard" style="
              display: inline-block;
              padding: 12px 24px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: bold;
            ">Accéder au Dashboard</a>
          </p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          <p style="font-size: 12px; color: #999;">
            VIBE — Avec humilité et respect 💜
          </p>
        </div>
      `
    };

    await emailTransporter.sendMail(mailOptions);
    console.log(`📧 Role confirmation sent: ${email}`);

  } catch (err) {
    console.error(`❌ Email error: ${err.message}`);
  }
}

async function sendTribunalNotification(email, caseInfo) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `⚖️ Mise à jour du Tribunal — ${caseInfo.status}`,
      html: `
        <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #D4AF37;">Mise à jour du Tribunal ⚖️</h2>
          <p>Une mise à jour concernant votre cas au tribunal:</p>

          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Statut:</strong> ${caseInfo.status}</p>
            <p><strong>Type:</strong> ${caseInfo.case_type}</p>
            <p><strong>Détails:</strong> ${caseInfo.description}</p>
          </div>

          <p>
            <a href="${process.env.BASE_URL}/tribunal/${caseInfo.id}" style="
              display: inline-block;
              padding: 10px 20px;
              background: #D4AF37;
              color: black;
              text-decoration: none;
              border-radius: 6px;
              font-weight: bold;
            ">Voir les détails</a>
          </p>

          <p style="font-size: 12px; color: #999; margin-top: 20px;">
            Nous nous engageons à traiter tous les cas avec équité et respect.
          </p>
        </div>
      `
    };

    await emailTransporter.sendMail(mailOptions);
    console.log(`📧 Tribunal notification sent: ${email}`);

  } catch (err) {
    console.error(`❌ Email error: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────
// BILLETS MANAGEMENT
// ─────────────────────────────────────────────────────────────

async function sendBillets(fromUserId, toEmail, amount) {
  try {
    console.log(`💸 Sending ${amount} billets from ${fromUserId} to ${toEmail}`);

    // Get recipient
    const { data: recipient, error: recipientError } = await supabase
      .from('users')
      .select('id')
      .eq('email', toEmail)
      .single();

    if (recipientError) throw new Error(`User not found: ${toEmail}`);

    // Deduct from sender
    await supabase
      .from('billets')
      .update({ balance: supabase.raw(`balance - ${amount}`) })
      .eq('user_id', fromUserId);

    // Add to recipient
    await supabase
      .from('billets')
      .update({ balance: supabase.raw(`balance + ${amount}`) })
      .eq('user_id', recipient.id);

    // Log transaction
    await supabase
      .from('billet_transactions')
      .insert({
        user_id: fromUserId,
        amount,
        transaction_type: 'send',
        recipient_id: recipient.id,
        description: `Sent ${amount} billets to ${toEmail}`
      });

    console.log(`✅ Billets sent successfully`);
    return { success: true };

  } catch (err) {
    console.error(`❌ Billets error: ${err.message}`);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// TRIBUNAL CASE MANAGEMENT
// ─────────────────────────────────────────────────────────────

async function createTribunalCase(complainantId, defendantId, caseType, description) {
  try {
    const { data, error } = await supabase
      .from('tribunal_cases')
      .insert({
        complainant_id: complainantId,
        defendant_id: defendantId,
        case_type: caseType,
        description,
        status: 'open'
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`⚖️ Tribunal case created: ${data.id}`);

    // Send notification to both parties
    const { data: complainant } = await supabase
      .from('users')
      .select('email')
      .eq('id', complainantId)
      .single();

    const { data: defendant } = await supabase
      .from('users')
      .select('email')
      .eq('id', defendantId)
      .single();

    await sendTribunalNotification(complainant?.email, {
      id: data.id,
      status: 'Case opened',
      case_type: caseType,
      description
    });

    await sendTribunalNotification(defendant?.email, {
      id: data.id,
      status: 'You have been reported',
      case_type: caseType,
      description
    });

    return { success: true, case: data };

  } catch (err) {
    console.error(`❌ Tribunal error: ${err.message}`);
    throw err;
  }
}

module.exports = {
  signup,
  login,
  verifyEmail,
  sendVerificationEmail,
  sendRoleConfirmation,
  sendTribunalNotification,
  sendBillets,
  createTribunalCase
};
