/**
 * VIBE Setup Script
 * Creates special admin and co-founder accounts
 * Run: node setup-admins.js
 */

const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
require('dotenv').config();

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

async function setupAdminAccounts() {
  console.log('🚀 VIBE Platform Setup - Creating Admin Accounts\n');

  try {
    // 1. Create Admin Account
    console.log('📝 Creating Admin Account...');
    const adminUser = await createAdminAccount();
    console.log(`✅ Admin created: ${adminUser.email}\n`);

    // 2. Create Co-Founder Account
    console.log('📝 Creating Co-Founder Account...');
    const coFounderUser = await createCoFounderAccount();
    console.log(`✅ Co-Founder created: ${coFounderUser.email}\n`);

    // 3. Send confirmation emails
    console.log('📧 Sending confirmation emails...');
    await sendAdminWelcome(adminUser);
    await sendCoFounderWelcome(coFounderUser);
    console.log('✅ Emails sent\n');

    console.log('═══════════════════════════════════════════════════');
    console.log('✨ SETUP COMPLETE ✨');
    console.log('═══════════════════════════════════════════════════\n');
    console.log('🔐 Admin Account:');
    console.log(`   Email: vibeqbc2026@hotmail.com`);
    console.log(`   Role: admin (Full access)`);
    console.log(`   Dashboard: http://localhost:3000/admin-dashboard-ui.html\n`);

    console.log('🔑 Co-Founder Account:');
    console.log(`   Email: jmarcreid@gmail.com`);
    console.log(`   Role: co_founder (1000 billets/month, hidden)`);
    console.log(`   Dashboard: http://localhost:3000/co-founder-dashboard.html\n`);

    console.log('🌐 Login Page: http://localhost:3000/login.html\n');
    console.log('💡 Next steps:');
    console.log('   1. Start server: node server.js');
    console.log('   2. Visit login page');
    console.log('   3. Login with above credentials');
    console.log('   4. Verify email via link in inbox\n');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

async function createAdminAccount() {
  const email = 'vibeqbc2026@hotmail.com';
  const password = generatePassword();
  const fullName = 'VIBE Admin';
  const region = 'Gaspésie';

  try {
    // Create Supabase auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        role: 'admin',
        full_name: fullName,
        region
      }
    });

    if (authError) throw authError;

    const authId = authData.user.id;

    // Create user record in database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        auth_id: authId,
        email,
        full_name: fullName,
        region,
        role: 'admin',
        is_verified: false
      })
      .select()
      .single();

    if (userError) throw userError;

    console.log(`  └─ Auth ID: ${authId}`);
    console.log(`  └─ Database ID: ${userData.id}`);

    return userData;
  } catch (error) {
    console.error('❌ Admin creation failed:', error.message);
    throw error;
  }
}

async function createCoFounderAccount() {
  const email = 'jmarcreid@gmail.com';
  const password = generatePassword();
  const fullName = 'VIBE Co-Founder';
  const region = 'Gaspésie';

  try {
    // Create Supabase auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        role: 'co_founder',
        full_name: fullName,
        region
      }
    });

    if (authError) throw authError;

    const authId = authData.user.id;

    // Create user record in database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        auth_id: authId,
        email,
        full_name: fullName,
        region,
        role: 'co_founder',
        is_verified: false
      })
      .select()
      .single();

    if (userError) throw userError;

    // Create billets record with hidden flag
    const { error: billetsError } = await supabase
      .from('billets')
      .insert({
        user_id: userData.id,
        amount: 1000,
        balance: 1000,
        monthly_limit: 1000,
        is_co_founder_hidden: true
      });

    if (billetsError) throw billetsError;

    console.log(`  └─ Auth ID: ${authId}`);
    console.log(`  └─ Database ID: ${userData.id}`);
    console.log(`  └─ Initial Billets: 1000 (HIDDEN)`);

    return userData;
  } catch (error) {
    console.error('❌ Co-founder creation failed:', error.message);
    throw error;
  }
}

async function sendAdminWelcome(user) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: '🔑 Accès Administrateur Confirmé — VIBE',
      html: `
        <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #D4AF37;">Bienvenue Administrateur 🔑</h2>

          <p>Ton compte administrateur VIBE a été créé avec succès.</p>

          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3>Accès Complet:</h3>
            <ul>
              <li>Dashboard admin complet</li>
              <li>Gestion des utilisateurs</li>
              <li>Tribunal et modération</li>
              <li>Système de billets</li>
              <li>Analytiques complètes</li>
              <li>Approbation des pubs</li>
              <li>Ajustement des billets</li>
            </ul>
          </div>

          <p><strong>Informations de Connexion:</strong></p>
          <ul>
            <li>Email: ${user.email}</li>
            <li>Dashboard: <a href="${process.env.BASE_URL}/admin-dashboard-ui.html">Admin Panel</a></li>
            <li>Connexion: <a href="${process.env.BASE_URL}/login.html">Login</a></li>
          </ul>

          <p style="color: #666; margin-top: 20px;">
            <strong>Rappel Important:</strong> Avec grand pouvoir vient grande responsabilité.
            Nous comptons sur ton humilité et ton respect de la communauté LGBTQ+.
          </p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          <p style="font-size: 12px; color: #999;">
            VIBE — Plateforme de connexion authentique avec humilité et respect 💜
          </p>
        </div>
      `
    };

    await emailTransporter.sendMail(mailOptions);
    console.log(`  └─ Email sent to ${user.email}`);
  } catch (error) {
    console.error('  └─ Email failed:', error.message);
  }
}

async function sendCoFounderWelcome(user) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: '🌟 Accès Co-Fondateur Confirmé — VIBE',
      html: `
        <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #D4AF37;">Bienvenue Co-Fondateur 🌟</h2>

          <p>Ton compte co-fondateur VIBE a été créé avec succès.</p>

          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3>Accès Co-Fondateur:</h3>
            <ul>
              <li>1000 billets par mois</li>
              <li>Accès caché (6-12 mois) - SECRET</li>
              <li>Pouvoir envoyer des pubs</li>
              <li>Co-signature VIBE</li>
              <li>Dashboard co-fondateur</li>
              <li>Connexion directe à l'admin</li>
            </ul>
          </div>

          <p style="background: #fff3cd; padding: 12px; border-left: 4px solid #ffc107; border-radius: 4px; margin: 20px 0;">
            <strong>🔒 Important:</strong> Ton accès comme co-fondateur est <strong>CACHÉ</strong> du public.
            Personne ne doit savoir pendant 6-12 mois que tu as ce pouvoir spécial.
          </p>

          <p><strong>Informations de Connexion:</strong></p>
          <ul>
            <li>Email: ${user.email}</li>
            <li>Dashboard: <a href="${process.env.BASE_URL}/co-founder-dashboard.html">Co-Founder Panel</a></li>
            <li>Connexion: <a href="${process.env.BASE_URL}/login.html">Login</a></li>
          </ul>

          <p style="color: #666; margin-top: 20px;">
            <strong>Restrictions:</strong>
            <br>- Maximum 1000 billets par mois
            <br>- Tes billets sont cachés du public
            <br>- Tu peux envoyer des pubs à la communauté
            <br>- Réserve ce pouvoir pour des usages importants
          </p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          <p style="font-size: 12px; color: #999;">
            VIBE — Avec humilité et respect 💜
          </p>
        </div>
      `
    };

    await emailTransporter.sendMail(mailOptions);
    console.log(`  └─ Email sent to ${user.email}`);
  } catch (error) {
    console.error('  └─ Email failed:', error.message);
  }
}

function generatePassword() {
  // Generate a secure random password
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Run setup
setupAdminAccounts().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
