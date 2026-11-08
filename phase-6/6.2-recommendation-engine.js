/**
 * PHASE 6.2 — Recommendation Engine
 * Collaborative filtering + content-based recommendations
 */

const { createClient } = require('@supabase/supabase-js');

class RecommendationEngine {
  constructor(supabaseUrl, supabaseKey) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Collaborative Filtering - Find users with similar interests
   */
  async collaborativeFiltering(userId, options = {}) {
    const { limit = 10, minSimilarity = 0.5 } = options;

    try {
      // Get user's interaction history
      const { data: userInteractions } = await this.supabase
        .from('user_interactions')
        .select('content_id, interaction_type, rating')
        .eq('user_id', userId);

      if (!userInteractions || userInteractions.length === 0) {
        return { recommendations: [], reason: 'no_user_history' };
      }

      // Find similar users
      const { data: similarUsers } = await this.supabase.rpc('find_similar_users', {
        p_user_id: userId,
        p_min_similarity: minSimilarity
      });

      if (!similarUsers || similarUsers.length === 0) {
        return { recommendations: [], reason: 'no_similar_users' };
      }

      // Get content liked by similar users
      const similarUserIds = similarUsers.map(u => u.user_id);
      const { data: recommendations } = await this.supabase
        .from('user_interactions')
        .select('content_id, COUNT(*) as frequency, AVG(rating) as avg_rating')
        .in('user_id', similarUserIds)
        .not('content_id', 'in', userInteractions.map(i => i.content_id).join(','))
        .group_by('content_id')
        .order('frequency', { ascending: false })
        .limit(limit);

      return {
        recommendations: recommendations || [],
        algorithm: 'collaborative_filtering',
        based_on: `${similarUsers.length} similar users`
      };
    } catch (error) {
      console.error('Collaborative filtering error:', error);
      return { recommendations: [], error: error.message };
    }
  }

  /**
   * Content-Based Filtering - Recommend similar content
   */
  async contentBasedFiltering(userId, options = {}) {
    const { limit = 10 } = options;

    try {
      // Get user's preferred content
      const { data: userFavorites } = await this.supabase
        .from('user_interactions')
        .select('content_id, rating')
        .eq('user_id', userId)
        .gte('rating', 4) // High ratings only
        .limit(5);

      if (!userFavorites || userFavorites.length === 0) {
        return { recommendations: [], reason: 'no_favorites' };
      }

      // Find similar content by tags/salon/author
      const { data: recommendations } = await this.supabase.rpc(
        'find_similar_content',
        {
          p_content_ids: userFavorites.map(f => f.content_id),
          p_limit: limit
        }
      );

      return {
        recommendations: recommendations || [],
        algorithm: 'content_based',
        based_on: `${userFavorites.length} favorite items`
      };
    } catch (error) {
      console.error('Content-based filtering error:', error);
      return { recommendations: [], error: error.message };
    }
  }

  /**
   * Hybrid Recommendation - Combine both algorithms
   */
  async hybridRecommendation(userId, options = {}) {
    const { limit = 20 } = options;

    try {
      const collaborative = await this.collaborativeFiltering(userId, { limit: limit / 2 });
      const contentBased = await this.contentBasedFiltering(userId, { limit: limit / 2 });

      // Merge and score
      const combined = this.mergeRecommendations(
        collaborative.recommendations || [],
        contentBased.recommendations || [],
        limit
      );

      // Log recommendation for analytics
      await this.supabase
        .from('recommendation_logs')
        .insert({
          user_id: userId,
          algorithm: 'hybrid',
          recommendations: combined.map(r => r.content_id),
          timestamp: new Date().toISOString()
        });

      return {
        recommendations: combined,
        algorithm: 'hybrid',
        sources: ['collaborative_filtering', 'content_based']
      };
    } catch (error) {
      console.error('Hybrid recommendation error:', error);
      return { recommendations: [], error: error.message };
    }
  }

  /**
   * Personalized Discovery - Show new content based on profile
   */
  async personalizedDiscovery(userId, options = {}) {
    const { limit = 20 } = options;

    try {
      const { data: userProfile } = await this.supabase
        .from('users')
        .select('identity, interests, preferred_salons')
        .eq('id', userId)
        .single();

      // Find trending content in user's preferred salons
      const { data: discovery } = await this.supabase
        .from('content')
        .select('*')
        .in('salon', userProfile.preferred_salons || [])
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        .order('views', { ascending: false })
        .order('likes', { ascending: false })
        .limit(limit);

      return {
        recommendations: discovery || [],
        algorithm: 'personalized_discovery',
        personalization_factors: ['preferred_salons', 'identity', 'interests']
      };
    } catch (error) {
      console.error('Discovery error:', error);
      return { recommendations: [], error: error.message };
    }
  }

  /**
   * Track user interaction for algorithm training
   */
  async trackInteraction(userId, contentId, interactionType, rating = null) {
    try {
      await this.supabase
        .from('user_interactions')
        .insert({
          user_id: userId,
          content_id: contentId,
          interaction_type: interactionType, // 'view', 'like', 'reply', 'share'
          rating: rating,
          timestamp: new Date().toISOString()
        });

      return { success: true };
    } catch (error) {
      console.error('Tracking error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Merge recommendations from multiple sources
   */
  mergeRecommendations(collaborative, contentBased, limit) {
    const scoreMap = new Map();

    // Score collaborative recommendations (weight: 0.6)
    collaborative.forEach((item, index) => {
      const score = (1 - index / collaborative.length) * 0.6;
      scoreMap.set(item.content_id, (scoreMap.get(item.content_id) || 0) + score);
    });

    // Score content-based recommendations (weight: 0.4)
    contentBased.forEach((item, index) => {
      const score = (1 - index / contentBased.length) * 0.4;
      scoreMap.set(item.content_id, (scoreMap.get(item.content_id) || 0) + score);
    });

    // Sort by score and return top N
    return Array.from(scoreMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([contentId, score]) => ({
        content_id: contentId,
        recommendation_score: score
      }));
  }

  /**
   * Get recommendation statistics
   */
  async getStats(userId) {
    try {
      const { data: stats } = await this.supabase
        .from('recommendation_logs')
        .select('algorithm, COUNT(*) as count')
        .eq('user_id', userId)
        .group_by('algorithm');

      return stats || [];
    } catch (error) {
      console.error('Stats error:', error);
      return [];
    }
  }
}

module.exports = RecommendationEngine;
