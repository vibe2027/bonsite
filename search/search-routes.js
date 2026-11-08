/**
 * VIBE Search Routes
 * Handles full-text, semantic, and hybrid search across platform content
 */

const express = require('express');
const { sanitizeResults } = require('../utils/response-sanitizer');

const router = express.Router();

let searchEngine = null;
if (process.env.ELASTICSEARCH_URL) {
  const AdvancedSearchEngine = require('../phase-6/6.1-advanced-search');
  try {
    searchEngine = new AdvancedSearchEngine(process.env.ELASTICSEARCH_URL);
  } catch (err) {
    console.warn('⚠️ Elasticsearch initialization failed:', err.message);
  }
}

/**
 * POST /search/full-text
 * Full-text search across all content
 */
router.post('/full-text', async (req, res) => {
  try {
    if (!searchEngine) {
      return res.status(503).json({ error: 'Search service unavailable' });
    }

    const { query, salon, type, limit = 20, offset = 0 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const results = await searchEngine.fullTextSearch(query, {
      salon,
      type,
      limit,
      offset
    });

    // Sanitize results to hide personal info
    const sanitized = {
      ...results,
      results: sanitizeResults(results.results)
    };

    res.json(sanitized);
  } catch (err) {
    console.error(`❌ Full-text search error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /search/semantic
 * Semantic/vector search using embeddings
 */
router.post('/semantic', async (req, res) => {
  try {
    if (!searchEngine) {
      return res.status(503).json({ error: 'Search service unavailable' });
    }

    const { queryVector, limit = 20, threshold = 0.7 } = req.body;

    if (!queryVector || !Array.isArray(queryVector)) {
      return res.status(400).json({ error: 'Query vector array required' });
    }

    const results = await searchEngine.semanticSearch(queryVector, {
      limit,
      threshold
    });

    // Sanitize results
    const sanitized = {
      ...results,
      results: sanitizeResults(results.results)
    };

    res.json(sanitized);
  } catch (err) {
    console.error(`❌ Semantic search error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /search/hybrid
 * Combined full-text + semantic search
 */
router.post('/hybrid', async (req, res) => {
  try {
    if (!searchEngine) {
      return res.status(503).json({ error: 'Search service unavailable' });
    }

    const { query, queryVector, limit = 20 } = req.body;

    if (!query || !queryVector) {
      return res.status(400).json({ error: 'Query and query vector required' });
    }

    const results = await searchEngine.hybridSearch(query, queryVector, { limit });

    // Sanitize results
    const sanitized = {
      ...results,
      results: sanitizeResults(results.results)
    };

    res.json(sanitized);
  } catch (err) {
    console.error(`❌ Hybrid search error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /search/trending
 * Trending/popular content by views and likes
 */
router.get('/trending', async (req, res) => {
  try {
    if (!searchEngine) {
      return res.status(503).json({ error: 'Search service unavailable' });
    }

    const { salon, limit = 20 } = req.query;

    const results = await searchEngine.trendingSearch({
      salon,
      limit: parseInt(limit)
    });

    // Sanitize results
    const sanitized = {
      ...results,
      results: sanitizeResults(results.results)
    };

    res.json(sanitized);
  } catch (err) {
    console.error(`❌ Trending search error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /search/autocomplete
 * Auto-complete suggestions
 */
router.get('/autocomplete', async (req, res) => {
  try {
    if (!searchEngine) {
      return res.status(503).json({ error: 'Search service unavailable' });
    }

    const { prefix, field = 'content' } = req.query;

    if (!prefix || prefix.length < 2) {
      return res.status(400).json({ error: 'Prefix must be at least 2 characters' });
    }

    const suggestions = await searchEngine.autoComplete(prefix, field);

    res.json({
      suggestions,
      prefix,
      count: suggestions.length
    });
  } catch (err) {
    console.error(`❌ Autocomplete error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
