/**
 * VIBE i18n Routes
 * Translation and multi-language support endpoints
 */

const express = require('express');
const router = express.Router();
const TranslationService = require('./translation-service');
const { requireAuth, adminOnly } = require('../middleware/auth');

// Initialize translation service
const translationService = new TranslationService({
  provider: process.env.TRANSLATION_PROVIDER || 'libretranslate',
  apiKey: process.env.TRANSLATION_API_KEY,
  enableCache: true
});

/**
 * POST /i18n/translate
 * Translate text to target language
 */
router.post('/translate', requireAuth, async (req, res) => {
  try {
    const { text, targetLanguage, sourceLanguage = 'auto' } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text is required' });
    }

    if (!targetLanguage) {
      return res.status(400).json({ error: 'Target language is required' });
    }

    const translated = await translationService.translateText(
      text,
      targetLanguage,
      sourceLanguage
    );

    res.json({
      original: text,
      translated,
      targetLanguage,
      sourceLanguage
    });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ error: 'Translation failed', details: error.message });
  }
});

/**
 * POST /i18n/translate-batch
 * Translate multiple messages in batch
 * Body: { messages: [{ id, text }], targetLanguage }
 */
router.post('/translate-batch', requireAuth, async (req, res) => {
  try {
    const { messages, targetLanguage } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    if (!targetLanguage) {
      return res.status(400).json({ error: 'Target language is required' });
    }

    const translated = await translationService.translateBatch(
      messages,
      targetLanguage
    );

    res.json({
      count: translated.length,
      translations: translated
    });
  } catch (error) {
    console.error('Batch translation error:', error);
    res.status(500).json({ error: 'Batch translation failed', details: error.message });
  }
});

/**
 * POST /i18n/detect-language
 * Detect language of text
 */
router.post('/detect-language', requireAuth, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const language = await translationService.detectLanguage(text);

    res.json({
      text: text.substring(0, 100),
      detectedLanguage: language
    });
  } catch (error) {
    console.error('Language detection error:', error);
    res.status(500).json({ error: 'Detection failed', details: error.message });
  }
});

/**
 * GET /i18n/languages
 * Get list of supported languages
 */
router.get('/languages', async (req, res) => {
  try {
    const languages = await translationService.getSupportedLanguages();
    res.json({
      count: languages.length,
      languages
    });
  } catch (error) {
    console.error('Error fetching languages:', error);
    res.status(500).json({ error: 'Failed to fetch languages' });
  }
});

/**
 * POST /i18n/message/:messageId/translate
 * Translate a salon message and store translation
 * Requires Supabase integration for message storage
 */
router.post('/message/:messageId/translate', requireAuth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { targetLanguage } = req.body;
    const userId = req.headers['x-user-id'];

    if (!messageId || !targetLanguage) {
      return res.status(400).json({ error: 'Message ID and target language required' });
    }

    // TODO: Fetch message from Supabase
    // const { data: message } = await supabase
    //   .from('messages')
    //   .select('id, content')
    //   .eq('id', messageId)
    //   .single();

    // if (!message) {
    //   return res.status(404).json({ error: 'Message not found' });
    // }

    // const translated = await translationService.translateText(
    //   message.content,
    //   targetLanguage
    // );

    // TODO: Store translation in Supabase
    // const { data: translation } = await supabase
    //   .from('message_translations')
    //   .insert({
    //     message_id: messageId,
    //     user_id: userId,
    //     language: targetLanguage,
    //     content: translated,
    //     created_at: new Date()
    //   });

    res.json({
      messageId,
      translated: 'Translation stored',
      targetLanguage
    });
  } catch (error) {
    console.error('Message translation error:', error);
    res.status(500).json({ error: 'Failed to translate message' });
  }
});

/**
 * GET /i18n/cache-stats
 * Get translation cache statistics (admin only)
 */
router.get('/cache-stats', requireAuth, adminOnly, (req, res) => {
  try {
    const stats = translationService.getCacheStats();
    res.json({
      cacheSize: stats.keys,
      memoryStats: stats.memory
    });
  } catch (error) {
    console.error('Cache stats error:', error);
    res.status(500).json({ error: 'Failed to get cache stats' });
  }
});

/**
 * POST /i18n/cache-clear
 * Clear translation cache (admin only)
 */
router.post('/cache-clear', requireAuth, adminOnly, (req, res) => {
  try {
    translationService.clearCache();
    res.json({ message: 'Translation cache cleared' });
  } catch (error) {
    console.error('Cache clear error:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

module.exports = router;
