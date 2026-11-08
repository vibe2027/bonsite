# VIBE i18n (Internationalization) System

**Bringing Language to the Community**

Comprehensive multi-language support for the VIBE platform, enabling authentic connection across linguistic boundaries in the global LGBTQ+ community.

---

## 🌍 Overview

The i18n system provides:

- **Message Translation**: Real-time translation of salon messages
- **Language Detection**: Automatic detection of message language
- **User Preferences**: Per-user language settings and auto-translation
- **Salon Localization**: Translated salon names/descriptions
- **Caching Strategy**: Optimized for performance and cost
- **Multiple Providers**: Support for LibreTranslate, DeepL, Google Translate
- **Analytics**: Track translation usage and multilingual engagement

---

## 🛠️ Architecture

### Components

1. **TranslationService** (`translation-service.js`)
   - Core translation engine
   - Multi-provider support
   - Intelligent caching
   - Batch processing

2. **i18n Routes** (`i18n-routes.js`)
   - REST endpoints for translation
   - Language detection API
   - Cache management

3. **Database Schema** (`sql/phase-6-i18n.sql`)
   - User language preferences
   - Message translations
   - Salon localization
   - Translation cache
   - Analytics views

### Supported Languages

```
French (fr), English (en), Spanish (es), German (de), Italian (it),
Portuguese (pt), Dutch (nl), Polish (pl), Russian (ru), Japanese (ja),
Chinese (zh), Korean (ko), Arabic (ar), Turkish (tr), Vietnamese (vi)
```

---

## 📦 Installation

### 1. Install Dependencies

```bash
npm install axios node-cache
```

### 2. Add Environment Variables

```env
# Translation Configuration
TRANSLATION_PROVIDER=libretranslate  # Options: libretranslate, deepl, google
TRANSLATION_API_KEY=your_api_key_here

# LibreTranslate (free, self-hosted option)
LIBRETRANSLATE_URL=https://api.libretranslate.de/translate

# DeepL (high quality, requires API key)
# DEEPL_API_KEY=xxx

# Google Translate (requires API key)
# GOOGLE_TRANSLATE_API_KEY=xxx
```

### 3. Execute Database Migration

```bash
# In Supabase SQL Editor:
-- Execute sql/phase-6-i18n.sql

-- Creates tables:
-- - user_language_preferences
-- - message_translations
-- - salon_translations
-- - translation_cache
-- - language_detection_log
-- - translation_statistics

-- Creates views:
-- - user_multilingual_stats
-- - translation_popularity
-- - multilingual_salons
-- - translation_cache_performance
```

### 4. Mount Routes in Server

```javascript
// server.js or app.js
const i18nRoutes = require('./i18n/i18n-routes');

app.use('/api/i18n', i18nRoutes);
```

---

## 📡 API Endpoints

### Translate Text

**POST** `/api/i18n/translate`

Translate text to a target language.

```bash
curl -X POST http://localhost:3000/api/i18n/translate \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-123" \
  -d '{
    "text": "Hello, this is a beautiful message about pride!",
    "targetLanguage": "fr",
    "sourceLanguage": "auto"
  }'
```

**Response**:
```json
{
  "original": "Hello, this is a beautiful message about pride!",
  "translated": "Bonjour, c'est un beau message sur la fierté!",
  "targetLanguage": "fr",
  "sourceLanguage": "auto"
}
```

### Batch Translate

**POST** `/api/i18n/translate-batch`

Translate multiple messages efficiently.

```bash
curl -X POST http://localhost:3000/api/i18n/translate-batch \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-123" \
  -d '{
    "messages": [
      { "id": "msg-1", "text": "Pride Month is here!" },
      { "id": "msg-2", "text": "Let us celebrate together" }
    ],
    "targetLanguage": "es"
  }'
```

**Response**:
```json
{
  "count": 2,
  "translations": [
    {
      "id": "msg-1",
      "original": "Pride Month is here!",
      "translated": "¡Llegó el mes del Orgullo!",
      "language": "es",
      "timestamp": "2026-08-27T10:30:00Z"
    },
    {
      "id": "msg-2",
      "original": "Let us celebrate together",
      "translated": "Celebremos juntos",
      "language": "es",
      "timestamp": "2026-08-27T10:30:00Z"
    }
  ]
}
```

### Detect Language

**POST** `/api/i18n/detect-language`

Detect the language of text.

```bash
curl -X POST http://localhost:3000/api/i18n/detect-language \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-123" \
  -d '{"text": "Bienvenue dans notre communauté!"}'
```

**Response**:
```json
{
  "text": "Bienvenue dans notre communauté!",
  "detectedLanguage": "fr"
}
```

### Get Supported Languages

**GET** `/api/i18n/languages`

```bash
curl http://localhost:3000/api/i18n/languages
```

**Response**:
```json
{
  "count": 15,
  "languages": [
    { "code": "fr", "name": "Français" },
    { "code": "en", "name": "English" },
    { "code": "es", "name": "Español" },
    ...
  ]
}
```

### Translate Message

**POST** `/api/i18n/message/:messageId/translate`

Translate a specific salon message and store the translation.

```bash
curl -X POST http://localhost:3000/api/i18n/message/msg-abc123/translate \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-123" \
  -d '{"targetLanguage": "de"}'
```

### Cache Management (Admin Only)

**GET** `/api/i18n/cache-stats`

```bash
curl http://localhost:3000/api/i18n/cache-stats \
  -H "x-user-id: admin-123" \
  -H "x-user-role: admin"
```

**POST** `/api/i18n/cache-clear`

```bash
curl -X POST http://localhost:3000/api/i18n/cache-clear \
  -H "x-user-id: admin-123" \
  -H "x-user-role: admin"
```

---

## 💡 Implementation Examples

### Frontend: Auto-Translate Messages

```javascript
// Client-side: Auto-translate incoming messages
async function loadMessagesWithTranslation(salonId, userLanguage) {
  const messages = await fetch(`/api/messages/${salonId}`).then(r => r.json());
  
  if (userLanguage !== 'en') {
    const translated = await fetch('/api/i18n/translate-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.map(m => ({ id: m.id, text: m.content })),
        targetLanguage: userLanguage
      })
    }).then(r => r.json());
    
    // Merge translations with original messages
    return messages.map(m => ({
      ...m,
      translated: translated.translations.find(t => t.id === m.id)?.translated
    }));
  }
  
  return messages;
}
```

### Backend: Message Hook

```javascript
// Automatically detect and store translation when message is created
const { createMessage } = require('./messages/message-service');

createMessage.onSuccess(async (message) => {
  // Detect language
  const detectedLanguage = await translationService.detectLanguage(message.content);
  
  // Store language info
  await db.query(
    'UPDATE messages SET detected_language = $1 WHERE id = $2',
    [detectedLanguage, message.id]
  );
  
  // Pre-compute common translations
  const commonLanguages = ['fr', 'es', 'de'];
  for (const lang of commonLanguages) {
    if (detectedLanguage !== lang) {
      await translationService.translateText(message.content, lang);
    }
  }
});
```

### Frontend: Language Preference UI

```javascript
// User settings component
async function updateLanguagePreference(userId, preferences) {
  const response = await fetch('/api/user/language-preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      primaryLanguage: preferences.primaryLanguage,        // 'fr'
      interfaceLanguage: preferences.interfaceLanguage,    // 'fr'
      autoTranslate: preferences.autoTranslate,            // true
      translateToLanguages: ['en', 'es', 'de']
    })
  });
  
  return response.json();
}

// Auto-translate chat based on user settings
function setupAutoTranslation(preferences) {
  if (preferences.autoTranslate && preferences.translateToLanguages.length > 0) {
    // Enable automatic translation toggle in chat UI
    // Show original + translated versions side-by-side
    // Allow quick language switching
  }
}
```

---

## 🔐 Security & Privacy

### Data Handling

- **Translations NOT stored on third-party servers** (except when using cloud providers)
- **LibreTranslate**: Open-source, can be self-hosted
- **Cache stored locally** in PostgreSQL
- **RLS policies** prevent unauthorized access

### Rate Limiting

```
- 100 translations per minute per user
- 1000 translations per hour per IP
- Batch limit: 50 messages per request
```

### Privacy Features

- Users can opt-out of translation caching
- Translation cache auto-purges after 90 days
- Admin can clear cache anytime
- Language detection logs purged after 30 days

---

## 📊 Analytics & Monitoring

### Translation Usage Analytics

```sql
-- Most popular translation pairs
SELECT source_language, target_language, total_translations
FROM translation_popularity
ORDER BY total_translations DESC
LIMIT 10;

-- Language distribution
SELECT
  DATE(created_at) as date,
  source_language,
  target_language,
  translation_count
FROM translation_statistics
ORDER BY date DESC;

-- Cache performance
SELECT * FROM translation_cache_performance;
```

### Dashboard Metrics

- Total translations by language pair
- Average translation confidence score
- Cache hit rate
- Most active multilingual users
- Salons with translations
- Translation providers usage

---

## 🚀 Deployment Considerations

### Development
```bash
npm install
TRANSLATION_PROVIDER=libretranslate node server.js
```

### Staging
```bash
# Use DeepL for higher quality
TRANSLATION_PROVIDER=deepl
TRANSLATION_API_KEY=xxx
npm install --production
```

### Production
```bash
# Option 1: LibreTranslate (self-hosted)
docker run -d -p 5000:5000 libretranslate/libretranslate

# Option 2: DeepL API (cloud)
TRANSLATION_PROVIDER=deepl
TRANSLATION_API_KEY=xxx

# Option 3: Google Translate
TRANSLATION_PROVIDER=google
GOOGLE_TRANSLATE_API_KEY=xxx
```

### Performance Optimization

1. **Caching**: 24-hour TTL on translations
2. **Batch Processing**: Translate up to 50 messages at once
3. **Lazy Loading**: Translate only when needed
4. **Worker Threads**: Off-load translation to background workers

---

## 📈 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Translation Coverage | 99% | Messages successfully translated |
| Cache Hit Rate | 60%+ | Reused translations from cache |
| Avg Translation Latency | < 500ms | End-to-end translation time |
| User Adoption | 30%+ | Users enabling auto-translation |
| Language Support | 15+ | Active language pairs |
| Provider Cost | < $100/month | For 100k translations/month |

---

## 🐛 Troubleshooting

### "Translation API timeout"
```
→ Increase timeout in translation-service.js
→ Check provider API status
→ Use cache for common phrases
```

### "Translation cache growing too large"
```
→ Implement cache eviction policy (LRU)
→ Clear cache regularly (admin endpoint)
→ Monitor cache size in monitoring dashboard
```

### "Provider API rate limit exceeded"
```
→ Implement request queuing
→ Switch provider or self-host LibreTranslate
→ Use cache for frequently translated text
```

---

## 🔮 Future Enhancements

- [ ] Contextual translation (understand salon context)
- [ ] Community feedback on translation quality (upvote/downvote)
- [ ] Glossary of LGBTQ+ terms in multiple languages
- [ ] Real-time collaborative translation (Wikipedia-style)
- [ ] Voice-to-text in multiple languages
- [ ] Emoji standardization across cultures
- [ ] Regional dialect support

---

## 📝 Documentation

- **API Reference**: See endpoints above
- **Database Schema**: `sql/phase-6-i18n.sql`
- **Service Code**: `i18n/translation-service.js`
- **Routes**: `i18n/i18n-routes.js`

---

## 🤝 Contributing

Translation quality improvements welcome! Please report:
- Mistranslations
- Missing languages
- Dialect/cultural context issues
- Performance improvements

---

**Status**: ✅ i18n System Ready for Integration  
**Integration Point**: Phase 6 bonus feature  
**Next Steps**: Integrate with message service, UI components  

Avec Humilité et Respect 🌊
