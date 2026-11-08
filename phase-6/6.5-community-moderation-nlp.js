/**
 * PHASE 6.5 — Community Moderation with NLP
 * Automated content filtering using OpenAI API with human review
 */

const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

class CommunityModerationNLP {
  constructor(supabaseUrl, supabaseKey, openaiKey) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.openaiKey = openaiKey;
    this.openaiUrl = 'https://api.openai.com/v1/moderations';

    // Custom moderation rules for LGBTQ+ safety
    this.customFilters = {
      harassment: {
        keywords: ['kill', 'hate', 'disgusting'],
        severity: 'high'
      },
      discrimination: {
        keywords: ['inferior', 'degenerate'],
        severity: 'high'
      },
      spam: {
        keywords: ['buy now', 'click here', 'free money'],
        severity: 'medium'
      },
      explicit_content: {
        severity: 'medium'
      }
    };

    this.flaggedContents = [];
  }

  /**
   * Moderate content using OpenAI API
   */
  async moderateContent(content, contentType = 'message') {
    try {
      // Call OpenAI moderation endpoint
      const response = await axios.post(
        this.openaiUrl,
        { input: content },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const { results } = response.data;
      const moderation = results[0];

      // Parse OpenAI categories
      const violations = {
        harassment: moderation.categories.harassment,
        hate_speech: moderation.categories.hate,
        sexual_content: moderation.categories.sexual,
        violence: moderation.categories.violence,
        self_harm: moderation.categories.self_harm,
        illegal_activity: moderation.categories.illegal
      };

      // Apply custom LGBTQ+ safety filters
      const customViolations = this.checkCustomFilters(content);

      const isFlagged = moderation.flagged || Object.values(customViolations).some(v => v);

      const result = {
        flagged: isFlagged,
        scores: moderation.category_scores,
        violations: { ...violations, ...customViolations },
        severity: this.calculateSeverity(violations, customViolations),
        action: this.determineAction(isFlagged, violations)
      };

      return result;
    } catch (error) {
      console.error('Moderation API error:', error);
      // Fallback to custom filters only
      return {
        flagged: false,
        violations: this.checkCustomFilters(content),
        severity: 'unknown',
        action: 'review',
        error: error.message
      };
    }
  }

  /**
   * Apply custom LGBTQ+-specific safety filters
   */
  checkCustomFilters(content) {
    const violations = {};
    const lowerContent = content.toLowerCase();

    for (const [category, filter] of Object.entries(this.customFilters)) {
      if (filter.keywords) {
        const hasKeyword = filter.keywords.some(kw => lowerContent.includes(kw));
        if (hasKeyword) violations[category] = true;
      }

      // Check for slurs (maintained in private database)
      if (category === 'discrimination') {
        violations.slur_detected = this.containsSlur(lowerContent);
      }
    }

    return violations;
  }

  /**
   * Check for known slurs (abstracted for safety)
   */
  containsSlur(content) {
    // In production, this would check against a maintained list
    // of harmful slurs targeting LGBTQ+ community
    const slurs = [
      // Community-specific terms that are always violations
      // (actual list maintained in secure database)
    ];

    return slurs.some(slur => content.includes(slur));
  }

  /**
   * Determine moderation action based on violations
   */
  determineAction(isFlagged, violations) {
    if (!isFlagged) return 'approve';

    const highSeverity = [
      violations.harassment,
      violations.hate_speech,
      violations.violence,
      violations.self_harm
    ].some(v => v);

    if (highSeverity) return 'reject'; // Automatically reject

    const mediumSeverity = [
      violations.sexual_content,
      violations.illegal_activity
    ].some(v => v);

    if (mediumSeverity) return 'review'; // Require human review

    return 'approve_with_warning';
  }

  /**
   * Calculate overall severity level
   */
  calculateSeverity(violations, customViolations) {
    if (violations.harassment || violations.hate_speech || violations.violence) {
      return 'critical';
    }
    if (violations.sexual_content || violations.illegal_activity) {
      return 'high';
    }
    if (Object.values(customViolations).some(v => v)) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Process message before posting
   */
  async processMessage(userId, content, salonId) {
    try {
      // Run moderation
      const moderation = await this.moderateContent(content, 'message');

      // Log moderation result
      await this.supabase.from('moderation_logs').insert({
        user_id: userId,
        content_type: 'message',
        content: content,
        salon_id: salonId,
        moderation_result: moderation,
        action: moderation.action,
        timestamp: new Date().toISOString()
      });

      // Handle based on action
      if (moderation.action === 'reject') {
        // Silently reject
        return {
          approved: false,
          reason: 'content_policy_violation',
          message: 'Your message violates our community guidelines'
        };
      }

      if (moderation.action === 'review') {
        // Queue for human review
        await this.supabase.from('moderation_queue').insert({
          content_id: `msg-${Date.now()}`,
          content_type: 'message',
          content: content,
          user_id: userId,
          salon_id: salonId,
          moderation_flags: moderation.violations,
          status: 'pending',
          created_at: new Date().toISOString()
        });

        return {
          approved: false,
          reason: 'requires_review',
          message: 'Your message is under review'
        };
      }

      if (moderation.action === 'approve_with_warning') {
        // Auto-flag for archives but allow posting
        return {
          approved: true,
          warning: true,
          message: 'Posted (with content warning)'
        };
      }

      return { approved: true };
    } catch (error) {
      console.error('Message processing error:', error);
      // Fail safe: require review on error
      return {
        approved: false,
        reason: 'moderation_error',
        message: 'Please try again'
      };
    }
  }

  /**
   * Process pub/advertisement
   */
  async processPub(userId, content, salonId) {
    const moderation = await this.moderateContent(content, 'pub');

    // Pubs have stricter rules
    if (moderation.flagged || moderation.severity !== 'low') {
      return {
        approved: false,
        reason: 'content_rejected',
        message: 'Ad violates community standards'
      };
    }

    return { approved: true };
  }

  /**
   * Human review interface - Get pending items
   */
  async getPendingReview(limit = 20) {
    const { data } = await this.supabase
      .from('moderation_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit);

    return data || [];
  }

  /**
   * Resolve moderation review
   */
  async resolveReview(queueId, decision, notes = '') {
    try {
      await this.supabase
        .from('moderation_queue')
        .update({
          status: decision === 'approve' ? 'approved' : 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewer_notes: notes
        })
        .eq('id', queueId);

      // If approved, publish content
      if (decision === 'approve') {
        // Insert into salons_messages or pubs
        const item = await this.supabase
          .from('moderation_queue')
          .select('*')
          .eq('id', queueId)
          .single();

        if (item.data.content_type === 'message') {
          await this.supabase.from('salons_messages').insert({
            user_id: item.data.user_id,
            salon_name: item.data.salon_id,
            content: item.data.content,
            created_at: new Date().toISOString()
          });
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Review resolution error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get moderation statistics
   */
  async getStats(timeframe = '7days') {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    const { data } = await this.supabase
      .from('moderation_logs')
      .select('action, severity, COUNT(*) as count')
      .gte('timestamp', cutoffDate.toISOString())
      .group_by('action', 'severity');

    return {
      total: data?.reduce((sum, row) => sum + row.count, 0) || 0,
      by_action: data || [],
      flagged_rate: 0 // Calculate from data
    };
  }

  /**
   * Create tribunal case for appeals
   */
  async createAppeal(userId, rejectedContentId, reason) {
    try {
      await this.supabase.from('tribunal_cases').insert({
        complainant_id: userId,
        case_type: 'moderation_appeal',
        description: reason,
        referenced_content_id: rejectedContentId,
        status: 'open',
        created_at: new Date().toISOString()
      });

      return {
        success: true,
        message: 'Appeal submitted. Community tribunal will review.'
      };
    } catch (error) {
      console.error('Appeal error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = CommunityModerationNLP;
