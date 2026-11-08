/**
 * VIBE Translation Service
 * Multi-language support for messages, salons, and content
 * Integrates with LibreTranslate, DeepL, and Google Translate APIs
 */

const axios = require('axios');
const NodeCache = require('node-cache');

// Cache translations for 24 hours (86400 seconds)
const translationCache = new NodeCache({ stdTTL: 86400 });

class TranslationService {
  constructor(config = {}) {
    this.provider = config.provider || 'libretranslate'; // 'libretranslate', 'deepl', 'google'
    this.apiKey = config.apiKey || process.env.TRANSLATION_API_KEY;
    this.libretranslateUrl = config.libretranslateUrl || 'https://api.libretranslate.de/translate';
    this.enableCache = config.enableCache !== false;
  }

  /**
   * Translate text to target language
   * @param {string} text - Text to translate
   * @param {string} targetLanguage - Target language code (e.g., 'fr', 'es', 'de')
   * @param {string} sourceLanguage - Source language code (default: 'auto')
   * @returns {Promise<string>} Translated text
   */
  async translateText(text, targetLanguage, sourceLanguage = 'auto') {
    if (!text || text.trim().length === 0) {
      return text;
    }

    // Check cache first
    const cacheKey = `${sourceLanguage}_${targetLanguage}_${text.substring(0, 50)}`;
    if (this.enableCache) {
      const cached = translationCache.get(cacheKey);
      if (cached) {
        console.log(`✅ Cache hit for translation: ${cacheKey}`);
        return cached;
      }
    }

    try {
      const translated = await this._translate(text, targetLanguage, sourceLanguage);

      // Store in cache
      if (this.enableCache) {
        translationCache.set(cacheKey, translated);
      }

      return translated;
    } catch (error) {
      console.error(`❌ Translation error for "${text}":`, error.message);
      return text; // Fallback to original text
    }
  }

  /**
   * Translate multiple messages in batch
   * @param {Array<{id, text}>} messages - Messages to translate
   * @param {string} targetLanguage - Target language code
   * @returns {Promise<Array>} Translated messages with IDs
   */
  async translateBatch(messages, targetLanguage) {
    try {
      const translations = await Promise.allSettled(
        messages.map(msg =>
          this.translateText(msg.text, targetLanguage)
            .then(translatedText => ({
              id: msg.id,
              original: msg.text,
              translated: translatedText,
              language: targetLanguage,
              timestamp: new Date()
            }))
        )
      );

      // Filter out rejected promises
      return translations
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value);
    } catch (error) {
      console.error('Batch translation error:', error.message);
      return messages.map(msg => ({
        id: msg.id,
        original: msg.text,
        translated: msg.text,
        language: targetLanguage,
        error: true
      }));
    }
  }

  /**
   * Detect language of text
   * @param {string} text - Text to detect
   * @returns {Promise<string>} Language code
   */
  async detectLanguage(text) {
    if (!text || text.trim().length === 0) {
      return 'unknown';
    }

    try {
      if (this.provider === 'libretranslate') {
        const response = await axios.post(`${this.libretranslateUrl}/../detect`, {
          q: text
        }, {
          timeout: 5000
        });
        return response.data.result?.language || 'unknown';
      }
      // Fallback: assume multi-language, return 'auto'
      return 'auto';
    } catch (error) {
      console.error('Language detection error:', error.message);
      return 'unknown';
    }
  }

  /**
   * Get supported languages
   * @returns {Promise<Array>} List of supported languages with codes
   */
  async getSupportedLanguages() {
    try {
      if (this.provider === 'libretranslate') {
        const response = await axios.get(`${this.libretranslateUrl}/../languages`, {
          timeout: 5000
        });
        return response.data.map(lang => ({
          code: lang.code,
          name: lang.name
        }));
      }
      return this._getDefaultLanguages();
    } catch (error) {
      console.error('Error fetching languages:', error.message);
      return this._getDefaultLanguages();
    }
  }

  /**
   * Private: Handle actual translation based on provider
   */
  async _translate(text, targetLanguage, sourceLanguage) {
    if (this.provider === 'libretranslate') {
      return this._translateLibreTranslate(text, targetLanguage, sourceLanguage);
    } else if (this.provider === 'deepl') {
      return this._translateDeepL(text, targetLanguage, sourceLanguage);
    } else if (this.provider === 'google') {
      return this._translateGoogle(text, targetLanguage, sourceLanguage);
    }
    throw new Error('Unsupported translation provider');
  }

  /**
   * LibreTranslate: Free, open-source translation
   */
  async _translateLibreTranslate(text, targetLanguage, sourceLanguage) {
    const response = await axios.post(this.libretranslateUrl, {
      q: text,
      source: sourceLanguage,
      target: targetLanguage,
      format: 'text'
    }, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.data.translatedText) {
      throw new Error('No translation returned from LibreTranslate');
    }

    return response.data.translatedText;
  }

  /**
   * DeepL: High-quality translation (requires API key)
   */
  async _translateDeepL(text, targetLanguage, sourceLanguage) {
    if (!this.apiKey) {
      throw new Error('DeepL API key required');
    }

    const response = await axios.post('https://api-free.deepl.com/v1/translate', {
      text: [text],
      target_lang: targetLanguage.toUpperCase(),
      source_lang: sourceLanguage === 'auto' ? undefined : sourceLanguage.toUpperCase()
    }, {
      timeout: 5000,
      headers: {
        'Authorization': `DeepL-Auth-Key ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.data.translations || response.data.translations.length === 0) {
      throw new Error('No translation returned from DeepL');
    }

    return response.data.translations[0].text;
  }

  /**
   * Google Translate: Via unofficial API (requires API key)
   */
  async _translateGoogle(text, targetLanguage, sourceLanguage) {
    if (!this.apiKey) {
      throw new Error('Google Translate API key required');
    }

    const response = await axios.post(
      'https://translation.googleapis.com/language/translate/v2',
      {
        q: text,
        target: targetLanguage,
        source: sourceLanguage === 'auto' ? undefined : sourceLanguage
      },
      {
        timeout: 5000,
        params: {
          key: this.apiKey
        }
      }
    );

    if (!response.data.data.translations || response.data.data.translations.length === 0) {
      throw new Error('No translation returned from Google Translate');
    }

    return response.data.data.translations[0].translatedText;
  }

  /**
   * Default supported languages (fallback)
   */
  _getDefaultLanguages() {
    return [
      { code: 'fr', name: 'Français' },
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Español' },
      { code: 'de', name: 'Deutsch' },
      { code: 'it', name: 'Italiano' },
      { code: 'pt', name: 'Português' },
      { code: 'nl', name: 'Nederlands' },
      { code: 'pl', name: 'Polski' },
      { code: 'ru', name: 'Русский' },
      { code: 'ja', name: '日本語' },
      { code: 'zh', name: '中文' },
      { code: 'ko', name: '한국어' },
      { code: 'ar', name: 'العربية' },
      { code: 'tr', name: 'Türkçe' },
      { code: 'vi', name: 'Tiếng Việt' }
    ];
  }

  /**
   * Clear translation cache
   */
  clearCache() {
    translationCache.flushAll();
    console.log('Translation cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      keys: translationCache.keys().length,
      memory: translationCache.getStats()
    };
  }
}

module.exports = TranslationService;
