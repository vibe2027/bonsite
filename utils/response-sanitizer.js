/**
 * Response Sanitizer
 * Ensures all public-facing API responses hide personal information
 * Only founder (vibeqbc2026@hotmail.com) gets "VIBE" branding
 */

const FOUNDER_EMAIL = 'vibeqbc2026@hotmail.com';

/**
 * Sanitize user/author information for public display
 * Replaces founder's name with "VIBE" but keeps email visible
 */
function sanitizeAuthor(data) {
  if (!data) return data;

  // Only replace name if it's the founder
  if (data.email === FOUNDER_EMAIL || data.real_email === FOUNDER_EMAIL) {
    return {
      ...data,
      author_name: 'VIBE',
      full_name: 'VIBE',
      display_name: 'VIBE',
      name: 'VIBE'
      // Email stays visible
    };
  }

  // Other users keep their names unchanged
  return data;
}

/**
 * Sanitize user objects (from users table)
 */
function sanitizeUser(user) {
  if (!user) return user;

  // Only replace name if it's the founder
  if (user.email === FOUNDER_EMAIL || user.real_email === FOUNDER_EMAIL) {
    return {
      ...user,
      name: 'VIBE',
      full_name: 'VIBE',
      display_name: 'VIBE',
      // Email stays visible
    };
  }

  // Other users keep their data unchanged
  return user;
}

/**
 * Sanitize array of results (search, pubs, etc.)
 */
function sanitizeResults(results) {
  if (!Array.isArray(results)) return results;

  return results.map(result => sanitizeAuthor(result));
}

/**
 * Sanitize nested user relationships
 */
function sanitizeRelations(data) {
  if (!data) return data;

  const sanitized = { ...data };

  // Sanitize direct user references
  if (sanitized.user) {
    sanitized.user = sanitizeUser(sanitized.user);
  }

  // Sanitize author fields
  if (sanitized.author_name) {
    sanitized.author_name = 'VIBE';
  }

  // Sanitize user profile fields
  if (sanitized.profile) {
    sanitized.profile = sanitizeUser(sanitized.profile);
  }

  return sanitized;
}

module.exports = {
  sanitizeAuthor,
  sanitizeUser,
  sanitizeResults,
  sanitizeRelations
};
