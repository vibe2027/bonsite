# 🔗 Guide d'Intégration Phase 6
## Connecter les 6 modules avancés au cœur de VIBE

---

## 📦 Architecture Intégration

```
┌─────────────────────────────────────┐
│         Frontend (React)              │
│  - Collaborative Editor UI           │
│  - Search Interface                  │
│  - Video Call Component              │
│  - Moderation Dashboard              │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│    API Server (Express/Node)         │
│  - Routes Phase 6                    │
│  - Middleware Integration            │
│  - Feature Flags                     │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Supabase + External Services       │
│  - PostgreSQL (RLS)                  │
│  - Realtime (Websockets)             │
│  - Storage (Recordings)              │
│  - Elasticsearch                     │
│  - OpenAI API                        │
└─────────────────────────────────────┘
```

---

## 🚀 ÉTAPE 1: Backend Integration

### **1.1 Charger les Classes Phase 6 dans `index.js`**

```javascript
// index.js (Express server principal)

// ✅ Imports existants
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

// ✅ NOUVEAUX: Imports Phase 6
const OperationalTransformEngine = require('./phase-6/6.0-realtime-collaboration');
const AdvancedSearchEngine = require('./phase-6/6.1-advanced-search');
const RecommendationEngine = require('./phase-6/6.2-recommendation-engine');
const WebRTCVideoChat = require('./phase-6/6.4-webrtc-video-chat');
const CommunityModerationNLP = require('./phase-6/6.5-community-moderation-nlp');

const app = express();

// ✅ Initialiser Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ✅ Initialiser Services Phase 6 (Singleton)
const otEngine = new OperationalTransformEngine(supabase);
const searchEngine = new AdvancedSearchEngine(process.env.ELASTICSEARCH_URL);
const recommendations = new RecommendationEngine(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
const videoChat = new WebRTCVideoChat(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
const moderation = new CommunityModerationNLP(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  process.env.OPENAI_API_KEY
);

// ✅ Middleware de Feature Flags
app.use((req, res, next) => {
  res.locals.features = {
    realtimeCollab: process.env.FEATURE_FLAG_REALTIME_COLLAB === 'true',
    advancedSearch: process.env.FEATURE_FLAG_ADVANCED_SEARCH === 'true',
    recommendations: process.env.FEATURE_FLAG_RECOMMENDATIONS === 'true',
    webrtcVideo: process.env.FEATURE_FLAG_WEBRTC_VIDEO === 'true',
    nlpModeration: process.env.FEATURE_FLAG_NLP_MODERATION === 'true'
  };
  next();
});

module.exports = { app, otEngine, searchEngine, recommendations, videoChat, moderation };
```

### **1.2 Créer les Routes Phase 6**

**`routes/realtime-collaboration.js`**
```javascript
const express = require('express');
const router = express.Router();
const { otEngine } = require('../index');
const { authenticateToken } = require('../middleware/auth');

// Appliquer une opération collaborative
router.post('/operation', authenticateToken, async (req, res) => {
  try {
    if (!res.locals.features.realtimeCollab) {
      return res.status(503).json({ error: 'Feature disabled' });
    }

    const { documentId, operation } = req.body;
    const result = await otEngine.applyOperation(documentId, operation);
    res.json(result);
  } catch (err) {
    console.error('OT operation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Récupérer historique
router.get('/history/:documentId', authenticateToken, async (req, res) => {
  const { documentId } = req.params;
  const history = await otEngine.getHistory(documentId);
  res.json(history);
});

module.exports = router;
```

**`routes/search.js`**
```javascript
const express = require('express');
const router = express.Router();
const { searchEngine } = require('../index');
const { authenticateToken } = require('../middleware/auth');

// Recherche full-text
router.post('/full-text', authenticateToken, async (req, res) => {
  try {
    if (!res.locals.features.advancedSearch) {
      return res.status(503).json({ error: 'Feature disabled' });
    }

    const { query, salon, type, limit } = req.body;
    const results = await searchEngine.fullTextSearch(query, { salon, type, limit });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Recherche sémantique
router.post('/semantic', authenticateToken, async (req, res) => {
  const { queryVector, limit } = req.body;
  const results = await searchEngine.semanticSearch(queryVector, { limit });
  res.json(results);
});

// Recherche hybride
router.post('/hybrid', authenticateToken, async (req, res) => {
  const { query, queryVector, limit } = req.body;
  const results = await searchEngine.hybridSearch(query, queryVector, { limit });
  res.json(results);
});

module.exports = router;
```

**`routes/recommendations.js`**
```javascript
const express = require('express');
const router = express.Router();
const { recommendations } = require('../index');
const { authenticateToken } = require('../middleware/auth');

// Recommandations hybrides
router.get('/hybrid', authenticateToken, async (req, res) => {
  try {
    if (!res.locals.features.recommendations) {
      return res.status(503).json({ error: 'Feature disabled' });
    }

    const userId = req.user.id;
    const { limit } = req.query;
    const recs = await recommendations.hybridRecommendation(userId, { limit });
    res.json(recs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Découverte personnalisée
router.get('/discovery', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const discovery = await recommendations.personalizedDiscovery(userId);
  res.json(discovery);
});

// Track interaction
router.post('/track', authenticateToken, async (req, res) => {
  const { contentId, interactionType, rating } = req.body;
  await recommendations.trackInteraction(req.user.id, contentId, interactionType, rating);
  res.json({ success: true });
});

module.exports = router;
```

**`routes/webrtc.js`**
```javascript
const express = require('express');
const router = express.Router();
const { videoChat } = require('../index');
const { authenticateToken } = require('../middleware/auth');

// Créer peer connection
router.post('/create-connection', authenticateToken, async (req, res) => {
  if (!res.locals.features.webrtcVideo) {
    return res.status(503).json({ error: 'Feature disabled' });
  }

  const { callId, isInitiator } = req.body;
  const pc = videoChat.createPeerConnection(callId, isInitiator);
  res.json({ callId, initialized: true });
});

// Initier appel
router.post('/initiate', authenticateToken, async (req, res) => {
  const { callId, remoteUserId } = req.body;
  const offer = await videoChat.initiateCall(callId, remoteUserId);
  res.json({ offer });
});

// Gérer offre
router.post('/handle-offer', authenticateToken, async (req, res) => {
  const { callId, offer } = req.body;
  const answer = await videoChat.handleOffer(callId, offer);
  res.json({ answer });
});

// Stats d'appel
router.get('/stats/:callId', authenticateToken, async (req, res) => {
  const stats = await videoChat.getCallStats(req.params.callId);
  res.json(stats);
});

// Terminer appel
router.post('/end', authenticateToken, async (req, res) => {
  const { callId } = req.body;
  await videoChat.endCall(callId);
  res.json({ success: true });
});

module.exports = router;
```

**`routes/moderation.js`**
```javascript
const express = require('express');
const router = express.Router();
const { moderation } = require('../index');
const { authenticateToken, moderatorOnly } = require('../middleware/auth');

// Vérifier contenu
router.post('/check', authenticateToken, async (req, res) => {
  if (!res.locals.features.nlpModeration) {
    return res.status(503).json({ error: 'Feature disabled' });
  }

  const { content, contentType } = req.body;
  const result = await moderation.moderateContent(content, contentType);
  res.json(result);
});

// Traiter message avant publication
router.post('/process-message', authenticateToken, async (req, res) => {
  const { content, salonId } = req.body;
  const result = await moderation.processMessage(req.user.id, content, salonId);
  res.json(result);
});

// Queue de modération (pour modérateurs)
router.get('/queue', authenticateToken, moderatorOnly, async (req, res) => {
  const { limit } = req.query;
  const queue = await moderation.getPendingReview(limit || 20);
  res.json(queue);
});

// Résoudre un élément en queue
router.post('/resolve', authenticateToken, moderatorOnly, async (req, res) => {
  const { queueId, decision, notes } = req.body;
  const result = await moderation.resolveReview(queueId, decision, notes);
  res.json(result);
});

module.exports = router;
```

### **1.3 Enregistrer Routes dans `index.js`**

```javascript
// À ajouter dans index.js après app initialization
const realtimeRoutes = require('./routes/realtime-collaboration');
const searchRoutes = require('./routes/search');
const recRoutes = require('./routes/recommendations');
const webrtcRoutes = require('./routes/webrtc');
const modRoutes = require('./routes/moderation');

// Enregistrer routes
app.use('/api/collaboration', realtimeRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/recommendations', recRoutes);
app.use('/api/webrtc', webrtcRoutes);
app.use('/api/moderation', modRoutes);
```

---

## 🎨 ÉTAPE 2: Frontend Integration

### **2.1 Composants React pour Phase 6**

**`components/CollaborativeEditor.jsx`**
```jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function CollaborativeEditor({ documentId }) {
  const [content, setContent] = useState('');
  const [users, setUsers] = useState([]);

  useEffect(() => {
    // Subscribe to realtime changes
    const channel = supabase
      .channel(`doc:${documentId}`)
      .on('broadcast', { event: 'operation' }, (payload) => {
        applyRemoteOperation(payload.operation);
      })
      .subscribe();

    return () => channel.unsubscribe();
  }, [documentId]);

  const handleChange = async (e) => {
    const newContent = e.target.value;
    const operation = {
      type: 'insert',
      position: content.length,
      content: newContent.slice(content.length)
    };

    await fetch('/api/collaboration/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId, operation })
    });

    setContent(newContent);
  };

  const applyRemoteOperation = (operation) => {
    // Apply OT transformation locally
    console.log('Remote operation:', operation);
  };

  return (
    <div>
      <h2>Collaborative Document</h2>
      <textarea
        value={content}
        onChange={handleChange}
        style={{ width: '100%', height: '400px' }}
      />
      <p>Collaborators: {users.join(', ')}</p>
    </div>
  );
}
```

**`components/SearchAdvanced.jsx`**
```jsx
import React, { useState } from 'react';

export default function SearchAdvanced() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [type, setType] = useState('full_text');

  const handleSearch = async (e) => {
    e.preventDefault();
    const response = await fetch(`/api/search/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: 20 })
    });
    const data = await response.json();
    setResults(data.results || []);
  };

  return (
    <form onSubmit={handleSearch}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher..."
      />
      <select value={type} onChange={(e) => setType(e.target.value)}>
        <option value="full_text">Texte Complet</option>
        <option value="semantic">Sémantique</option>
        <option value="hybrid">Hybride</option>
      </select>
      <button type="submit">Chercher</button>
      <div>
        {results.map((r) => (
          <div key={r.id}>{r.content.substring(0, 100)}...</div>
        ))}
      </div>
    </form>
  );
}
```

**`components/VideoChat.jsx`**
```jsx
import React, { useEffect, useRef, useState } from 'react';

export default function VideoChat({ remoteUserId }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [callId] = useState(generateCallId());

  useEffect(() => {
    initializeCall();
  }, []);

  const initializeCall = async () => {
    // Initialize peer connection
    const response = await fetch('/api/webrtc/create-connection', {
      method: 'POST',
      body: JSON.stringify({ callId, isInitiator: true })
    });

    // Get local stream
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    localVideoRef.current.srcObject = stream;

    // Initiate call
    await fetch('/api/webrtc/initiate', {
      method: 'POST',
      body: JSON.stringify({ callId, remoteUserId })
    });
  };

  return (
    <div>
      <video ref={localVideoRef} autoPlay muted style={{ width: '200px' }} />
      <video ref={remoteVideoRef} autoPlay style={{ width: '400px' }} />
    </div>
  );
}

function generateCallId() {
  return `call_${Date.now()}`;
}
```

### **2.2 Service d'API Client**

**`lib/api-phase6.js`**
```javascript
import { supabase } from './supabase';

const API_BASE = '/api';

export const searchAPI = {
  fullText: async (query, options = {}) => {
    const response = await fetch(`${API_BASE}/search/full-text`, {
      method: 'POST',
      body: JSON.stringify({ query, ...options })
    });
    return response.json();
  },

  semantic: async (queryVector, options = {}) => {
    const response = await fetch(`${API_BASE}/search/semantic`, {
      method: 'POST',
      body: JSON.stringify({ queryVector, ...options })
    });
    return response.json();
  },

  hybrid: async (query, queryVector, options = {}) => {
    const response = await fetch(`${API_BASE}/search/hybrid`, {
      method: 'POST',
      body: JSON.stringify({ query, queryVector, ...options })
    });
    return response.json();
  }
};

export const recommendationsAPI = {
  hybrid: async (limit = 20) => {
    const response = await fetch(`${API_BASE}/recommendations/hybrid?limit=${limit}`);
    return response.json();
  },

  discovery: async () => {
    const response = await fetch(`${API_BASE}/recommendations/discovery`);
    return response.json();
  },

  track: async (contentId, interactionType, rating = null) => {
    await fetch(`${API_BASE}/recommendations/track`, {
      method: 'POST',
      body: JSON.stringify({ contentId, interactionType, rating })
    });
  }
};

export const moderationAPI = {
  check: async (content, contentType = 'message') => {
    const response = await fetch(`${API_BASE}/moderation/check`, {
      method: 'POST',
      body: JSON.stringify({ content, contentType })
    });
    return response.json();
  },

  processMessage: async (content, salonId) => {
    const response = await fetch(`${API_BASE}/moderation/process-message`, {
      method: 'POST',
      body: JSON.stringify({ content, salonId })
    });
    return response.json();
  }
};
```

---

## 🔐 ÉTAPE 3: Sécurité & RLS

### **3.1 Middleware Authentication**

**`middleware/auth.js`**
```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const authenticateToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) throw error;

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const moderatorOnly = async (req, res, next) => {
  const isModerator = req.user.user_metadata?.role === 'moderator' ||
                      req.user.user_metadata?.role === 'admin';

  if (!isModerator) {
    return res.status(403).json({ error: 'Moderator access required' });
  }

  next();
};

module.exports = { authenticateToken, moderatorOnly };
```

---

## 📊 ÉTAPE 4: Monitoring & Logging

### **4.1 Logger Configuration**

**`lib/logger.js`**
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/phase6.log' })
  ]
});

module.exports = logger;
```

### **4.2 Event Tracking**

```javascript
// À ajouter dans chaque route Phase 6
logger.info('Phase6 Operation', {
  module: 'search',
  operation: 'full_text_search',
  userId: req.user.id,
  query: query,
  timestamp: new Date()
});
```

---

## ✅ Checklist Intégration

- [ ] Tous les imports Phase 6 dans `index.js`
- [ ] Toutes les routes créées et enregistrées
- [ ] Middleware authentication intégré
- [ ] Composants React créés et testés
- [ ] Service API client configuré
- [ ] RLS policies appliquées
- [ ] Logging mis en place
- [ ] Feature flags testés (enabled/disabled)
- [ ] Tests d'intégration passés
- [ ] Documentation mise à jour

---

## 🚀 Déploiement

Une fois l'intégration complète:

```bash
# 1. Tester localement
npm run dev

# 2. Tester en staging
npm run build
npm run start:staging

# 3. Déployer en production (voir DEPLOYMENT-PLAN-PHASE-6.md)
git push origin main
```

---

**Status:** 🟡 En Intégration  
**Dernière Maj:** 2026-08-27
