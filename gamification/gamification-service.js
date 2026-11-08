/**
 * VIBE Gamification Service
 * Handles points, achievements, reputation, and leaderboards
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─────────────────────────────────────────────────────────────
// Achievement Definitions
// ─────────────────────────────────────────────────────────────

const ACHIEVEMENTS = {
  first_message: {
    id: 'first_message',
    title: 'First Voice',
    description: 'Send your first message in a salon',
    icon: '🗣️',
    rarity: 'common',
    points: 10
  },
  hundred_messages: {
    id: 'hundred_messages',
    title: 'Chatterbox',
    description: 'Send 100 messages in a salon',
    icon: '💬',
    rarity: 'uncommon',
    points: 50
  },
  helpful_moderator: {
    id: 'helpful_moderator',
    title: 'Community Helper',
    description: 'Receive 10 helpful votes',
    icon: '🤝',
    rarity: 'rare',
    points: 100
  },
  verified_member: {
    id: 'verified_member',
    title: 'Verified',
    description: 'Reach trusted reputation level',
    icon: '✅',
    rarity: 'rare',
    points: 75
  },
  legend: {
    id: 'legend',
    title: 'Legend',
    description: 'Reach legend reputation status',
    icon: '⭐',
    rarity: 'legendary',
    points: 500
  },
  monthly_top_10: {
    id: 'monthly_top_10',
    title: 'Top Contributor',
    description: 'Rank in top 10 monthly leaderboard',
    icon: '🏆',
    rarity: 'epic',
    points: 200
  }
};

// ─────────────────────────────────────────────────────────────
// Add Points to User
// ─────────────────────────────────────────────────────────────

async function addPoints(userId, points, reason, referenceId = null) {
  try {
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Record transaction
    const { error: transactionError } = await supabase
      .from('point_transactions')
      .insert({
        user_id: userId,
        points,
        reason,
        reference_id: referenceId
      });

    if (transactionError) throw transactionError;

    // Update or create user_points record
    let { data: existingPoints } = await supabase
      .from('user_points')
      .select('id, points, breakdown')
      .eq('user_id', userId)
      .eq('month', month)
      .single();

    if (!existingPoints) {
      const { error: insertError } = await supabase
        .from('user_points')
        .insert({
          user_id: userId,
          month,
          points,
          breakdown: { [reason]: points }
        });

      if (insertError) throw insertError;
    } else {
      const newBreakdown = existingPoints.breakdown || {};
      newBreakdown[reason] = (newBreakdown[reason] || 0) + points;

      const { error: updateError } = await supabase
        .from('user_points')
        .update({
          points: existingPoints.points + points,
          breakdown: newBreakdown
        })
        .eq('id', existingPoints.id);

      if (updateError) throw updateError;
    }

    // Update reputation score
    await updateReputationScore(userId);

    console.log(`✅ Added ${points} points to ${userId} for ${reason}`);
    return { success: true, points };

  } catch (err) {
    console.error(`❌ Error adding points: ${err.message}`);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// Unlock Achievement
// ─────────────────────────────────────────────────────────────

async function unlockAchievement(userId, achievementId) {
  try {
    const achievement = ACHIEVEMENTS[achievementId];
    if (!achievement) {
      throw new Error(`Unknown achievement: ${achievementId}`);
    }

    // Check if already unlocked
    const { data: existing } = await supabase
      .from('user_achievements')
      .select('id')
      .eq('user_id', userId)
      .eq('achievement_id', achievementId)
      .single();

    if (existing) {
      return { success: false, message: 'Already unlocked' };
    }

    // Unlock achievement
    const { error: insertError } = await supabase
      .from('user_achievements')
      .insert({
        user_id: userId,
        achievement_id: achievementId,
        title: achievement.title,
        description: achievement.description,
        icon_emoji: achievement.icon,
        rarity: achievement.rarity,
        points_reward: achievement.points
      });

    if (insertError) throw insertError;

    // Award points
    await addPoints(userId, achievement.points, 'achievement_unlocked', achievementId);

    console.log(`🏆 Achievement unlocked for ${userId}: ${achievementId}`);
    return { success: true, achievement };

  } catch (err) {
    console.error(`❌ Error unlocking achievement: ${err.message}`);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// Update Reputation Score
// ─────────────────────────────────────────────────────────────

async function updateReputationScore(userId) {
  try {
    const { data: stats } = await supabase
      .from('user_gamification_stats')
      .select('reputation_score, total_achievements')
      .eq('user_id', userId)
      .single();

    if (!stats) return;

    // Calculate new level based on reputation score
    const { data: currentRep } = await supabase
      .from('user_reputation')
      .select('score, level')
      .eq('user_id', userId)
      .single();

    let newLevel = 'novice';
    if (stats.reputation_score >= 1000) newLevel = 'legend';
    else if (stats.reputation_score >= 500) newLevel = 'elder';
    else if (stats.reputation_score >= 250) newLevel = 'community_helper';
    else if (stats.reputation_score >= 100) newLevel = 'trusted';
    else if (stats.reputation_score >= 25) newLevel = 'member';

    const { error: updateError } = await supabase
      .from('user_reputation')
      .update({ level: newLevel })
      .eq('user_id', userId);

    if (updateError) throw updateError;

    // Check for level-up achievements
    if (currentRep?.level !== newLevel) {
      if (newLevel === 'trusted') {
        await unlockAchievement(userId, 'verified_member');
      } else if (newLevel === 'legend') {
        await unlockAchievement(userId, 'legend');
      }
    }

  } catch (err) {
    console.error(`❌ Error updating reputation: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────
// Get User Gamification Stats
// ─────────────────────────────────────────────────────────────

async function getUserStats(userId) {
  try {
    const { data: stats } = await supabase
      .from('user_gamification_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    return stats;

  } catch (err) {
    console.error(`❌ Error getting user stats: ${err.message}`);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// Get Leaderboards
// ─────────────────────────────────────────────────────────────

async function getLeaderboard(type = 'global_points', limit = 100) {
  try {
    let query;

    if (type === 'monthly_points') {
      query = await supabase
        .from('monthly_leaderboard')
        .select('*')
        .limit(limit);
    } else if (type === 'reputation') {
      query = await supabase
        .from('global_reputation_leaderboard')
        .select('*')
        .limit(limit);
    } else {
      // global_points
      query = await supabase
        .from('leaderboards')
        .select('*')
        .eq('leaderboard_type', 'global_points')
        .order('rank')
        .limit(limit);
    }

    return query.data || [];

  } catch (err) {
    console.error(`❌ Error getting leaderboard: ${err.message}`);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// Get User Achievements
// ─────────────────────────────────────────────────────────────

async function getUserAchievements(userId) {
  try {
    const { data: achievements } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: false });

    return achievements || [];

  } catch (err) {
    console.error(`❌ Error getting achievements: ${err.message}`);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// Add Helpful Vote
// ─────────────────────────────────────────────────────────────

async function addHelpfulVote(userId) {
  try {
    const { error } = await supabase
      .from('user_reputation')
      .update({ helpful_votes: supabase.raw('helpful_votes + 1') })
      .eq('user_id', userId);

    if (error) throw error;

    // Check for achievement
    const { data: rep } = await supabase
      .from('user_reputation')
      .select('helpful_votes')
      .eq('user_id', userId)
      .single();

    if (rep?.helpful_votes === 10) {
      await unlockAchievement(userId, 'helpful_moderator');
    }

    await addPoints(userId, 5, 'helpful_vote');
    return { success: true };

  } catch (err) {
    console.error(`❌ Error adding helpful vote: ${err.message}`);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// Update Leaderboards (scheduled job)
// ─────────────────────────────────────────────────────────────

async function updateLeaderboards() {
  try {
    console.log('📊 Updating leaderboards...');

    // Update monthly leaderboard
    const { data: monthlyData } = await supabase
      .from('monthly_leaderboard')
      .select('*');

    for (const entry of monthlyData || []) {
      await supabase
        .from('leaderboards')
        .upsert({
          leaderboard_type: 'monthly_points',
          rank: entry.rank,
          user_id: entry.user_id,
          score: entry.points,
          period: new Date().toISOString().slice(0, 7)
        }, { onConflict: 'leaderboard_type,user_id' });
    }

    // Update reputation leaderboard
    const { data: repData } = await supabase
      .from('global_reputation_leaderboard')
      .select('*');

    for (const entry of repData || []) {
      await supabase
        .from('leaderboards')
        .upsert({
          leaderboard_type: 'reputation',
          rank: entry.rank,
          user_id: entry.user_id,
          score: entry.score
        }, { onConflict: 'leaderboard_type,user_id' });
    }

    console.log('✅ Leaderboards updated');

  } catch (err) {
    console.error(`❌ Error updating leaderboards: ${err.message}`);
  }
}

module.exports = {
  ACHIEVEMENTS,
  addPoints,
  unlockAchievement,
  updateReputationScore,
  getUserStats,
  getLeaderboard,
  getUserAchievements,
  addHelpfulVote,
  updateLeaderboards
};
