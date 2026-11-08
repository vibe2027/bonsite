/**
 * PHASE 6.1 — Advanced Search Engine (Elasticsearch Integration)
 * Full-text, semantic, and vector search across all salon content
 */

const { Client } = require('@elastic/elasticsearch');
const { sanitizeAuthor } = require('../utils/response-sanitizer');

class AdvancedSearchEngine {
  constructor(elasticsearchUrl = process.env.ELASTICSEARCH_URL) {
    this.client = new Client({ node: elasticsearchUrl });
    this.indexName = 'vibe-content';
  }

  /**
   * Initialize search indices
   */
  async initializeIndices() {
    try {
      // Create index with mappings
      await this.client.indices.create({
        index: this.indexName,
        body: {
          settings: {
            number_of_shards: 2,
            number_of_replicas: 1,
            analysis: {
              analyzer: {
                custom_analyzer: {
                  type: 'standard',
                  stopwords: '_english_'
                }
              }
            }
          },
          mappings: {
            properties: {
              id: { type: 'keyword' },
              type: { type: 'keyword' }, // 'message', 'pub', 'profile'
              content: { type: 'text', analyzer: 'custom_analyzer' },
              content_vector: { type: 'dense_vector', dims: 1536, index: true, similarity: 'cosine' },
              salon: { type: 'keyword' },
              author_id: { type: 'keyword' },
              author_name: { type: 'text' },
              created_at: { type: 'date' },
              updated_at: { type: 'date' },
              views: { type: 'integer' },
              likes: { type: 'integer' },
              language: { type: 'keyword' }
            }
          }
        }
      });

      console.log(`✅ Search index "${this.indexName}" created`);
    } catch (error) {
      if (error.statusCode !== 400) throw error;
    }
  }

  /**
   * Index content for search
   */
  async indexContent(content) {
    const {
      id,
      type,
      text,
      vector,
      salon,
      authorId,
      authorName,
      language = 'en'
    } = content;

    try {
      await this.client.index({
        index: this.indexName,
        id,
        body: {
          id,
          type,
          content: text,
          content_vector: vector, // OpenAI embeddings
          salon,
          author_id: authorId,
          author_name: authorName,
          created_at: new Date().toISOString(),
          language
        }
      });

      return { success: true, id };
    } catch (error) {
      console.error('Indexing error:', error);
      throw error;
    }
  }

  /**
   * Full-text search
   */
  async fullTextSearch(query, options = {}) {
    const {
      salon = null,
      type = null,
      limit = 20,
      offset = 0
    } = options;

    const filters = [];
    if (salon) filters.push({ term: { salon } });
    if (type) filters.push({ term: { type } });

    const response = await this.client.search({
      index: this.indexName,
      body: {
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query,
                  fields: ['content', 'author_name'],
                  fuzziness: 'AUTO'
                }
              }
            ],
            filter: filters
          }
        },
        from: offset,
        size: limit,
        highlight: {
          fields: {
            content: { number_of_fragments: 3 }
          }
        }
      }
    });

    return this.formatResults(response);
  }

  /**
   * Semantic/Vector search using embeddings
   */
  async semanticSearch(queryVector, options = {}) {
    const { limit = 20, threshold = 0.7 } = options;

    const response = await this.client.search({
      index: this.indexName,
      body: {
        query: {
          script_score: {
            query: { match_all: {} },
            script: {
              source: "cosineSimilarity(params.query_vector, 'content_vector') + 1.0",
              params: { query_vector: queryVector }
            },
            min_score: threshold
          }
        },
        size: limit
      }
    });

    return this.formatResults(response);
  }

  /**
   * Combined search (full-text + semantic)
   */
  async hybridSearch(query, queryVector, options = {}) {
    const { limit = 20 } = options;

    const fullText = await this.fullTextSearch(query, { limit: limit / 2 });
    const semantic = await this.semanticSearch(queryVector, { limit: limit / 2 });

    // Merge and deduplicate
    const results = [...fullText.results];
    const ids = new Set(fullText.results.map(r => r.id));

    for (const result of semantic.results) {
      if (!ids.has(result.id)) {
        results.push(result);
      }
    }

    return { results: results.slice(0, limit) };
  }

  /**
   * Trending/popular search (sort by views + likes)
   */
  async trendingSearch(options = {}) {
    const { salon = null, limit = 20 } = options;

    const filters = salon ? [{ term: { salon } }] : [];

    const response = await this.client.search({
      index: this.indexName,
      body: {
        query: {
          bool: {
            filter: filters,
            must: { match_all: {} }
          }
        },
        sort: [
          { views: { order: 'desc' } },
          { likes: { order: 'desc' } },
          { created_at: { order: 'desc' } }
        ],
        size: limit
      }
    });

    return this.formatResults(response);
  }

  /**
   * Format Elasticsearch results
   */
  formatResults(response) {
    const { hits } = response.hits;
    return {
      total: response.hits.total.value,
      results: hits.map(hit => ({
        id: hit._id,
        score: hit._score,
        ...hit._source,
        // Sanitize author name for public display
        author_name: 'VIBE',
        highlight: hit.highlight || {}
      }))
    };
  }

  /**
   * Auto-complete suggestions
   */
  async autoComplete(prefix, field = 'content') {
    const response = await this.client.search({
      index: this.indexName,
      body: {
        query: {
          match_phrase_prefix: {
            [field]: prefix
          }
        },
        _source: false,
        size: 10
      }
    });

    return response.hits.hits.map(hit => hit._id);
  }

  /**
   * Delete index
   */
  async deleteIndex() {
    try {
      await this.client.indices.delete({ index: this.indexName });
      console.log(`✅ Index "${this.indexName}" deleted`);
    } catch (error) {
      console.error('Delete error:', error);
    }
  }
}

module.exports = AdvancedSearchEngine;
