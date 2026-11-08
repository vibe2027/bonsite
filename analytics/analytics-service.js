/**
 * VIBE Analytics Service
 * User and Admin analytics, reporting, exports
 */

const { createClient } = require('@supabase/supabase-js');
const PDFDocument = require('pdfkit');
const { stringify } = require('csv-stringify/sync');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─────────────────────────────────────────────────────────────
// User Analytics
// ─────────────────────────────────────────────────────────────

async function getUserAnalytics(userId) {
  try {
    // Get user stats
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    // Message count
    const { count: messageCount } = await supabase
      .from('salons_messages')
      .select('id', { count: 'exact' })
      .eq('user_id', userId);

    // Billet stats
    const { data: billetStats } = await supabase
      .from('billets')
      .select('balance')
      .eq('user_id', userId)
      .single();

    // Pubs created
    const { count: pubsCount } = await supabase
      .from('pubs')
      .select('id', { count: 'exact' })
      .eq('user_id', userId);

    // Gamification
    const { data: gamification } = await supabase
      .from('user_gamification_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Monthly contribution
    const { data: monthlyPoints } = await supabase
      .from('user_points')
      .select('*')
      .eq('user_id', userId)
      .eq('month', new Date().toISOString().slice(0, 7))
      .single();

    return {
      user,
      messages: messageCount || 0,
      billets: billetStats?.balance || 0,
      pubs: pubsCount || 0,
      gamification,
      monthlyPoints: monthlyPoints?.points || 0,
      achievements: gamification?.total_achievements || 0,
      reputationLevel: gamification?.reputation_level || 'novice'
    };

  } catch (err) {
    console.error(`❌ Error getting user analytics: ${err.message}`);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// Admin Analytics Dashboard
// ─────────────────────────────────────────────────────────────

async function getAdminAnalytics(days = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // User metrics
    const { count: totalUsers } = await supabase
      .from('users')
      .select('id', { count: 'exact' });

    const { count: newUsers } = await supabase
      .from('users')
      .select('id', { count: 'exact' })
      .gte('created_at', startDate.toISOString());

    // Engagement metrics
    const { count: messages } = await supabase
      .from('salons_messages')
      .select('id', { count: 'exact' })
      .gte('created_at', startDate.toISOString());

    // Tribunal metrics
    const { data: tribunalStats } = await supabase
      .from('tribunal_case_stats')
      .select('*')
      .single();

    // Pubs metrics
    const { count: activePubs } = await supabase
      .from('pubs')
      .select('id', { count: 'exact' })
      .eq('status', 'active');

    const { data: pubRevenue } = await supabase
      .rpc('calculate_pub_revenue', { days });

    // Revenue (if Stripe integrated)
    const { data: stripeStats } = await supabase
      .rpc('get_stripe_revenue', { days });

    return {
      users: {
        total: totalUsers,
        new: newUsers,
        dailyAverage: Math.round(newUsers / days)
      },
      engagement: {
        messages: messages || 0,
        messagesPerDay: Math.round((messages || 0) / days),
        activePubs: activePubs || 0
      },
      moderation: tribunalStats,
      revenue: {
        pubs: pubRevenue?.[0]?.total || 0,
        stripe: stripeStats?.[0]?.total || 0
      },
      period: { days, startDate: startDate.toISOString() }
    };

  } catch (err) {
    console.error(`❌ Error getting admin analytics: ${err.message}`);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// Daily Active Users (DAU)
// ─────────────────────────────────────────────────────────────

async function getDailyActiveUsers(days = 30) {
  try {
    const { data } = await supabase
      .rpc('get_daily_active_users', { days });

    return data || [];

  } catch (err) {
    console.error(`❌ Error getting DAU: ${err.message}`);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// Export User Analytics to PDF
// ─────────────────────────────────────────────────────────────

async function exportUserAnalyticsPDF(userId) {
  try {
    const analytics = await getUserAnalytics(userId);
    const doc = new PDFDocument();
    const filename = `vibe-analytics-${userId}.pdf`;

    doc.fontSize(20).text('VIBE — Personal Analytics Report', 50, 50);
    doc.fontSize(12).text(`Generated: ${new Date().toLocaleDateString()}`, 50, 80);
    doc.moveTo(50, 100).lineTo(550, 100).stroke();

    // User section
    doc.fontSize(14).text('Account Information', 50, 120);
    doc.fontSize(11);
    doc.text(`Email: ${analytics.user.email}`, 70, 145);
    doc.text(`Joined: ${new Date(analytics.user.created_at).toLocaleDateString()}`, 70, 165);
    doc.text(`Role: ${analytics.user.role}`, 70, 185);

    // Activity section
    doc.fontSize(14).text('Activity', 50, 220);
    doc.fontSize(11);
    doc.text(`Messages Sent: ${analytics.messages}`, 70, 245);
    doc.text(`Pubs Created: ${analytics.pubs}`, 70, 265);
    doc.text(`Billets Balance: ${analytics.billets}`, 70, 285);

    // Gamification section
    doc.fontSize(14).text('Gamification', 50, 320);
    doc.fontSize(11);
    doc.text(`Reputation Level: ${analytics.reputationLevel}`, 70, 345);
    doc.text(`Total Achievements: ${analytics.achievements}`, 70, 365);
    doc.text(`This Month Points: ${analytics.monthlyPoints}`, 70, 385);
    doc.text(`Reputation Score: ${analytics.gamification?.reputation_score || 0}`, 70, 405);

    doc.end();
    return { doc, filename };

  } catch (err) {
    console.error(`❌ Error exporting PDF: ${err.message}`);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// Export Analytics to CSV
// ─────────────────────────────────────────────────────────────

async function exportAnalyticsCSV(type = 'users', days = 30) {
  try {
    let data;

    if (type === 'users') {
      const { data: users } = await supabase
        .from('users')
        .select('id, email, role, created_at')
        .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

      data = users;
    } else if (type === 'engagement') {
      const { data: messages } = await supabase
        .from('salons_messages')
        .select('user_id, salon, created_at')
        .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

      data = messages;
    } else if (type === 'tribunal') {
      const { data: cases } = await supabase
        .from('tribunal_cases')
        .select('id, status, case_type, created_at, resolved_at');

      data = cases;
    }

    const csv = stringify(data, {
      header: true,
      columns: Object.keys(data?.[0] || {})
    });

    return csv;

  } catch (err) {
    console.error(`❌ Error exporting CSV: ${err.message}`);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// Get Leaderboard Analytics
// ─────────────────────────────────────────────────────────────

async function getLeaderboardAnalytics(type = 'monthly', limit = 100) {
  try {
    const { data } = await supabase
      .from('leaderboards')
      .select('rank, user:users(full_name, email), score')
      .eq('leaderboard_type', type)
      .order('rank')
      .limit(limit);

    return data || [];

  } catch (err) {
    console.error(`❌ Error getting leaderboard: ${err.message}`);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// Get Salon Analytics
// ─────────────────────────────────────────────────────────────

async function getSalonAnalytics(salon, days = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Message count and stats
    const { count: messageCount } = await supabase
      .from('salons_messages')
      .select('id', { count: 'exact' })
      .eq('salon', salon)
      .gte('created_at', startDate.toISOString());

    // Active users in salon
    const { data: activeUsers } = await supabase
      .rpc('get_salon_active_users', { salon_name: salon, days });

    // Most active contributors
    const { data: topContributors } = await supabase
      .rpc('get_salon_top_contributors', { salon_name: salon, days, limit: 10 });

    return {
      salon,
      messages: messageCount || 0,
      activeUsers: activeUsers?.[0]?.count || 0,
      topContributors,
      period: { days, startDate: startDate.toISOString() }
    };

  } catch (err) {
    console.error(`❌ Error getting salon analytics: ${err.message}`);
    throw err;
  }
}

module.exports = {
  getUserAnalytics,
  getAdminAnalytics,
  getDailyActiveUsers,
  exportUserAnalyticsPDF,
  exportAnalyticsCSV,
  getLeaderboardAnalytics,
  getSalonAnalytics
};
