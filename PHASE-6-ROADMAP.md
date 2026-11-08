# VIBE Phase 6 — v1.2.0 Advanced Features Roadmap

**Version**: 1.0  
**Target Release**: Q4 2026  
**Status**: Planning & Architecture  

---

## 🎯 Phase 6 Vision

Build upon the solid foundation of v1.1.0 (Notifications, Moderation, Analytics, PWA, Gamification) to introduce:
1. **Real-time Collaboration** — Live document editing, presence awareness, collaborative spaces
2. **Advanced Search** — Elasticsearch integration for semantic search across salons, messages, pubs
3. **Recommendation Engine** — ML-powered content and connection recommendations
4. **Mobile App** — React Native cross-platform mobile application
5. **Video Chat** — WebRTC integration for real-time audio/video communication
6. **Community Guidelines** — Automated moderation, pattern detection, violation enforcement
7. **Creator Monetization** — Tipping system, premium salons, sponsored content
8. **Analytics Dashboard** — Advanced data visualization and business intelligence

**Completion Timeline**: 8-12 weeks (2 weeks per feature track)

---

## 📋 Phase 6.0 — Real-time Collaboration

### Architecture Overview

**Technology Stack**:
- Supabase Realtime (PostgreSQL LISTEN/NOTIFY)
- Operational Transformation (OT) for conflict resolution
- Yjs for CRDT-based synchronization
- Redux for state management
- WebSocket for bi-directional communication

### Database Schema

```sql
-- Collaborative documents
CREATE TABLE collaborative_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id),
  created_by UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  version INT DEFAULT 0,
  locked_by UUID REFERENCES users(id),
  locked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Document edits log (audit trail)
CREATE TABLE document_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES collaborative_documents(id) ON DELETE CASCADE,
  editor_id UUID NOT NULL REFERENCES users(id),
  operation JSONB NOT NULL,  -- OT operation
  version INT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Active collaborators (presence)
CREATE TABLE document_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES collaborative_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cursor_position INT,
  selection_start INT,
  selection_end INT,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(document_id, user_id)
);
```

### API Endpoints

**Collaboration Routes** (`/api/collaborate/`):
- `POST /documents` — Create new collaborative document
- `GET /documents/:id` — Fetch document with full history
- `PATCH /documents/:id` — Apply operational transformation
- `POST /documents/:id/lock` — Lock document for exclusive editing
- `DELETE /documents/:id/lock` — Release document lock
- `GET /documents/:id/presence` — Get active collaborators
- `WS /documents/:id/sync` — WebSocket for real-time sync
- `GET /documents/:id/history` — View edit history/audit trail
- `POST /documents/:id/version/:version/restore` — Restore to previous version

### Implementation Details

**OT Engine**:
```javascript
// Server-side OT transformation
class OperationalTransform {
  constructor(version) {
    this.version = version;
    this.operations = [];
  }

  transform(operation) {
    // Transform incoming op against pending ops
    let transformed = operation;
    for (const pending of this.operations) {
      transformed = this.transformAgainst(transformed, pending);
    }
    return transformed;
  }

  transformAgainst(op1, op2) {
    // OT algorithm: transform op1 against op2
    // Returns transformed operation that can be applied sequentially
  }
}
```

**Presence Tracking**:
- User cursors and selections broadcast via Realtime
- Automatic cleanup of stale presence after 5 minutes
- Colored cursor indicators per user
- Hover tooltips with user names

### Security Considerations

- RLS policies per salon (only members can edit)
- Version pinning to prevent unauthorized rollbacks
- Edit logs immutable (service_role only)
- Presence data ephemeral (not persisted)
- Rate limiting on OT operations (10/second per user)

---

## 📋 Phase 6.1 — Advanced Search (Elasticsearch)

### Architecture Overview

**Technology Stack**:
- Elasticsearch 8.x for full-text and semantic search
- Vector embeddings via OpenAI/Anthropic embeddings API
- Search UI with facets, filters, autocomplete
- Synonym management for LGBTQ+ terminology
- Search analytics for trending topics

### Elasticsearch Mappings

```javascript
{
  "mappings": {
    "properties": {
      "type": {
        "type": "keyword",
        "values": ["message", "salon", "pub", "profile", "document"]
      },
      "title": {
        "type": "text",
        "analyzer": "french_analyzer",
        "fields": {
          "keyword": {"type": "keyword"},
          "completion": {"type": "completion"}
        }
      },
      "content": {
        "type": "text",
        "analyzer": "french_analyzer"
      },
      "embedding": {
        "type": "dense_vector",
        "dims": 1536,
        "index": true,
        "similarity": "cosine"
      },
      "salon_id": {"type": "keyword"},
      "author_id": {"type": "keyword"},
      "created_at": {"type": "date"},
      "language": {"type": "keyword"},
      "tags": {
        "type": "text",
        "analyzer": "keyword"
      },
      "visibility": {"type": "keyword"}
    }
  }
}
```

### API Endpoints

**Search Routes** (`/api/search/`):
- `GET /query` — Full-text search with filters
- `GET /semantic` — Vector similarity search
- `GET /autocomplete` — Search suggestions
- `GET /trending` — Trending topics/people
- `GET /suggestions` — "Did you mean?" suggestions
- `POST /index` — Manually trigger reindex (admin)

### Indexing Strategy

**Real-time Indexing**:
- PostgreSQL triggers → Kafka topic → Elasticsearch consumer
- Near real-time (< 1 second latency)
- Bulk indexing for historical data

**Batching**:
- 1000 documents per batch
- Exponential backoff on failures
- Dead letter queue for unindexable documents

### Query Features

**Boolean Search**:
```
salon:flottant AND (LGBTQ+ OR community)
author:"Marie" -visibility:private
created:[2026-01-01 TO 2026-12-31]
```

**Autocomplete**:
- Returns top 10 suggestions
- Weighted by popularity + recency
- Personalized based on user history

**Semantic Search**:
- "Find messages about coming out experiences"
- Vector similarity matching
- Works across languages

### Security Considerations

- RLS applied per-document (visibility filters)
- Private messages excluded from search
- User identity obfuscation for blocked users
- Search logs purged after 90 days
- Rate limiting: 100 searches/minute per user

---

## 📋 Phase 6.2 — Recommendation Engine

### Architecture Overview

**Technology Stack**:
- Collaborative filtering (user-user similarity)
- Content-based filtering (feature matching)
- Hybrid recommendation model
- Apache Spark for batch processing
- Redis for real-time ranking

### Database Schema

```sql
-- User similarity matrix (cached)
CREATE TABLE user_similarities (
  user_id_1 UUID NOT NULL REFERENCES users(id),
  user_id_2 UUID NOT NULL REFERENCES users(id),
  similarity_score FLOAT NOT NULL,  -- 0.0-1.0
  computed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY(user_id_1, user_id_2)
);

-- Salon recommendations
CREATE TABLE salon_recommendations (
  user_id UUID NOT NULL REFERENCES users(id),
  salon_id UUID NOT NULL REFERENCES salons(id),
  score FLOAT NOT NULL,  -- composite score
  reason TEXT,  -- why: "You follow X members", "Similar interests"
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY(user_id, salon_id)
);

-- Connection recommendations
CREATE TABLE connection_recommendations (
  source_user_id UUID NOT NULL REFERENCES users(id),
  target_user_id UUID NOT NULL REFERENCES users(id),
  score FLOAT NOT NULL,
  mutual_connections INT,  -- shared connections count
  mutual_interests INT,  -- shared tags count
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY(source_user_id, target_user_id)
);

-- Content recommendations (messages, pubs)
CREATE TABLE content_recommendations (
  user_id UUID NOT NULL REFERENCES users(id),
  content_type TEXT NOT NULL CHECK(content_type IN ('message', 'pub', 'document')),
  content_id UUID NOT NULL,
  score FLOAT NOT NULL,
  algorithm TEXT,  -- which algorithm generated
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### Recommendation Algorithms

**Collaborative Filtering** (User-User):
```
similarity(user_a, user_b) = 
  cosine_similarity(
    user_a_preferences_vector,
    user_b_preferences_vector
  )

score(item_for_user_a) = 
  Σ(similarity(user_a, user_n) * rating(user_n, item)) / Σsimilarity
```

**Content-Based Filtering**:
- User preference vector: [interest_tags, salon_participation, activity_patterns]
- Item feature vector: [category_tags, salon_type, engagement_level]
- Similarity via cosine distance in embedding space

**Hybrid Scoring**:
```
final_score = 0.4 * collaborative_score + 
              0.3 * content_based_score + 
              0.2 * popularity_score + 
              0.1 * recency_boost
```

### API Endpoints

**Recommendations Routes** (`/api/recommendations/`):
- `GET /salons` — Recommended salons for user
- `GET /connections` — Suggested connections
- `GET /content` — Recommended messages/pubs
- `GET /explore` — Discovery feed
- `POST /feedback/:item_id` — Thumbs up/down feedback
- `DELETE /feedback/:item_id` — Undo feedback

### Batch Processing

**Daily Updates** (off-peak, 2 AM UTC):
1. Recompute user similarity matrix (Spark)
2. Generate new recommendations for all users
3. Update Redis cache with top 100 recommendations per user
4. Store in `*_recommendations` tables

**Real-time Adjustments**:
- User actions (join salon, follow user) trigger incremental updates
- Cache invalidation for affected users
- 5-minute TTL on Redis entries

### Cold Start Problem

**New Users** (< 1 week):
- Recommend based on signup interests
- Popular items in community
- Trending in their demographic
- Gradually personalize as they interact

**New Content** (< 24 hours):
- Recommend to users with similar interests
- Trending topic boost
- Gradually deprioritize as it ages

### Privacy & Ethics

- Recommendations never expose private content
- Blocked/muted users excluded from recommendations
- Option to disable personalization (get random instead)
- Transparency: "Why this recommendation?" tooltips
- Regular bias audits for discriminatory patterns

---

## 📋 Phase 6.3 — Mobile App (React Native)

### Architecture Overview

**Technology Stack**:
- React Native (shared iOS/Android code)
- Expo for OTA updates and simplified build process
- Redux + Redux Toolkit for state management
- React Navigation for routing
- Socket.io for real-time sync
- Secure storage for tokens (Keychain/Keystore)

### Project Structure

```
vibe-mobile/
├── app/
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── SignupScreen.tsx
│   │   │   └── OnboardingScreen.tsx
│   │   ├── home/
│   │   │   ├── HomeScreen.tsx
│   │   │   └── FeedScreen.tsx
│   │   ├── salons/
│   │   │   ├── SalonsScreen.tsx
│   │   │   ├── SalonDetailScreen.tsx
│   │   │   └── CreateSalonScreen.tsx
│   │   ├── messages/
│   │   │   ├── ChatListScreen.tsx
│   │   │   ├── ChatDetailScreen.tsx
│   │   │   └── VoiceMessageScreen.tsx
│   │   ├── profile/
│   │   │   ├── ProfileScreen.tsx
│   │   │   ├── EditProfileScreen.tsx
│   │   │   ├── AchievementsScreen.tsx
│   │   │   └── SettingsScreen.tsx
│   │   └── notifications/
│   │       └── NotificationsScreen.tsx
│   ├── components/
│   │   ├── SalonCard.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── UserAvatar.tsx
│   │   └── ...
│   ├── store/
│   │   ├── auth/
│   │   ├── salons/
│   │   ├── messages/
│   │   ├── notifications/
│   │   └── store.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useSocket.ts
│   │   └── useSalons.ts
│   ├── services/
│   │   ├── api.ts
│   │   ├── socket.ts
│   │   ├── storage.ts
│   │   └── notifications.ts
│   └── navigation/
│       ├── RootNavigator.tsx
│       └── AuthNavigator.tsx
├── app.json
├── package.json
└── tsconfig.json
```

### Key Features

**Authentication**:
- Biometric login (Face ID, fingerprint)
- Social login (Apple, Google)
- Secure token storage in device keychain
- Token refresh on background
- Logout on jailbreak/root detection

**Real-time Messaging**:
- Socket.io connection with reconnection logic
- Message delivery indicators (sent, delivered, read)
- Typing indicators
- Voice message recording/playback
- Image/file uploads with progress

**Salons & Navigation**:
- Smooth tab navigation (Home, Salons, Messages, Profile)
- Pull-to-refresh for feed
- Infinite scroll pagination
- Swipe-to-reply gestures
- Search with autocomplete

**Push Notifications**:
- Expo Notifications or FCM
- Silent notifications for real-time sync
- Badge count management
- Deep links to notification source
- Do Not Disturb hours respect

**Offline Support**:
- SQLite for local message cache
- Syncs when connection restored
- Queues outgoing messages
- Optimistic UI updates

### Mobile API Endpoints

**Mobile-specific routes** (`/api/mobile/`):
- `POST /login` — Mobile authentication
- `GET /feed` — Optimized feed (lower bandwidth)
- `GET /salons?limit=20&cursor=X` — Paginated salons
- `GET /messages/:salon_id?limit=50&cursor=X` — Message pagination
- `POST /messages/batch` — Batch sync messages
- `POST /files/upload` — Image/file uploads
- `GET /config` — App configuration (feature flags, versions)

### Performance Optimization

**Bundle Size**:
- Tree-shake unused code
- Lazy load screens on first access
- Code splitting per feature
- Image optimization (WebP for Android)
- Target: < 50MB APK size

**Memory**:
- Paginated message loading (50 at a time)
- Image caching layer
- Redux selectors for computed values
- Cleanup on screen unmount

**Network**:
- Request batching (max 5 parallel)
- Compression (gzip)
- Delta sync (only fetch new messages)
- Exponential backoff on failures

### Store Schema

```typescript
interface RootState {
  auth: {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    error: string | null;
  };
  salons: {
    byId: Record<string, Salon>;
    allIds: string[];
    isLoading: boolean;
    hasMore: boolean;
  };
  messages: {
    byId: Record<string, Message>;
    bySalon: Record<string, string[]>;  // salon_id -> message_ids
    isLoading: Record<string, boolean>;
    hasMore: Record<string, boolean>;
  };
  notifications: {
    unread: Notification[];
    count: number;
  };
}
```

---

## 📋 Phase 6.4 — Video Chat Integration

### Architecture Overview

**Technology Stack**:
- WebRTC for peer-to-peer communication
- Jitsi Meet or PeerJS for simplified integration
- Redis for signaling server
- STUN/TURN servers for NAT traversal
- Supabase as coordination backend

### Database Schema

```sql
-- Video sessions
CREATE TABLE video_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID REFERENCES salons(id),
  created_by UUID NOT NULL REFERENCES users(id),
  session_type TEXT CHECK(session_type IN ('one-to-one', 'group', 'salon-wide')),
  max_participants INT DEFAULT 100,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  recording_available BOOLEAN DEFAULT false,
  recording_url TEXT
);

-- Video participants
CREATE TABLE video_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES video_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  left_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INT,
  bandwidth_mbps FLOAT,
  audio_enabled BOOLEAN DEFAULT true,
  video_enabled BOOLEAN DEFAULT true
);
```

### Signaling Flow

**1. Initiation**:
```
User A → Server: Create video session
Server → User A: Session created, join with token
Server → Salon members: Notification "User A started video call"
```

**2. Peer Connection**:
```
User B → Server: Join session (token validation)
Server → User A: New participant joined
User A ↔ User B: Exchange SDP/ICE candidates (via Redis)
User A ↔ User B: Direct P2P connection established
```

**3. Termination**:
```
User A → Server: End session / User A leaves
Server → All: Update participant list
Server → Storage: Archive session metadata + recording
```

### API Endpoints

**Video Routes** (`/api/video/`):
- `POST /sessions` — Start video session
- `GET /sessions/:id` — Get session info
- `POST /sessions/:id/join` — Generate join token
- `POST /sessions/:id/leave` — Leave session
- `DELETE /sessions/:id` — End session (creator only)
- `GET /sessions/:id/recording` — Access recording
- `WS /sessions/:id/signal` — WebRTC signaling

### Recording Strategy

**Cloud Recording**:
- Capture audio/video stream server-side
- MP4 encoding (H.264 video, AAC audio)
- Upload to S3/Supabase Storage
- Generate thumbnail at 5 seconds
- Retention: 30 days (user can export)

**Client-side Recording**:
- User permission required
- MediaRecorder API
- Local file or upload to cloud

### Performance & Scalability

**Single Server** (< 50 concurrent sessions):
- Direct WebSocket signaling
- Peer-to-peer media flow
- No TURN server needed (LAN)

**Multi-Server** (> 50 sessions):
- Load balance signaling via Redis Pub/Sub
- Coordinate via PostgreSQL
- TURN server for symmetric NAT
- Session affinity for WebSocket connections

### Privacy & Moderation

- Host can mute/remove participants
- Session recording consent notification
- Automatic recording stop at max duration
- Banned users cannot join
- Report malicious content during call

---

## 📋 Phase 6.5 — Community Guidelines & Moderation

### Architecture Overview

**Technology Stack**:
- NLP for content classification (OpenAI Moderation API)
- Regex patterns for policy violations
- User reporting + AI scoring
- Escalation workflows
- Automated enforcement

### Database Schema

```sql
-- Community guidelines
CREATE TABLE community_guidelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK(category IN (
    'harassment', 'hate_speech', 'nsfw', 'spam', 
    'misinformation', 'self_harm', 'illegal', 'other'
  )),
  description TEXT NOT NULL,
  severity INT CHECK(severity BETWEEN 1 AND 5),  -- 1=warning, 5=permanent ban
  automated BOOLEAN DEFAULT true,  -- can be auto-flagged
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Content violations
CREATE TABLE content_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL CHECK(content_type IN ('message', 'profile', 'pub', 'salon_name')),
  content_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  guideline_id UUID NOT NULL REFERENCES community_guidelines(id),
  flag_reason TEXT,
  severity INT,
  ai_score FLOAT,  -- 0.0-1.0 confidence
  status TEXT DEFAULT 'under_review' CHECK(status IN ('under_review', 'approved', 'warning_issued', 'content_removed', 'user_suspended')),
  moderator_id UUID REFERENCES users(id),
  moderator_notes TEXT,
  appeal_filed BOOLEAN DEFAULT false,
  appeal_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- User warnings & suspensions
CREATE TABLE user_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  restriction_type TEXT CHECK(restriction_type IN ('warning', 'muted', 'suspended', 'banned')),
  duration_days INT,  -- NULL for permanent
  reason TEXT NOT NULL,
  violations_count INT DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  lifted_by UUID REFERENCES users(id),
  lifted_at TIMESTAMP WITH TIME ZONE
);
```

### Automated Moderation Flow

**Real-time Detection**:
```
1. Message submitted
2. Run through OpenAI Moderation API
3. Check against regex patterns (slurs, links, etc.)
4. If suspicious:
   - Calculate violation severity (1-5)
   - Flag for review if severity > 2
   - Queue immediate removal if severity = 5
5. Store violation record with reasoning
```

**Human Review** (severity 2-4):
```
1. Mod queue shows flagged content
2. Context: user history, similar violations, appeals
3. Decisions: approve, remove + warn, remove + suspend
4. Auto-send user notification with decision
```

### Policy Enforcement

**Warnings** (first offense):
- Private message explaining policy
- No content removal
- Flag on user profile (mods only)

**Muted** (repeated minor violations):
- Cannot post for 24-72 hours
- Can still read/react
- Option to appeal

**Suspended** (serious violations):
- Cannot post, can only read
- Duration: 7-30 days
- Repeat violations increase duration
- Appeal option available

**Banned** (egregious violations or repeat suspensions):
- Complete account disable
- Content archived (can request export)
- IP-based re-registration prevention
- Option for permanent appeal (reviewed by leadership)

### API Endpoints

**Moderation Routes** (`/api/moderation/`):
- `GET /violations` — List violations (mod only)
- `PATCH /violations/:id` — Update violation status
- `POST /violations/:id/appeal` — Appeal a decision
- `GET /appeals` — List appeals (mod/leadership)
- `PATCH /appeals/:id` — Resolve appeal
- `POST /guidelines` — Create new guideline (leadership)
- `GET /user-restrictions/:user_id` — View restrictions

### Appeal Process

**User Initiates Appeal**:
1. User submits written appeal within 30 days
2. Provides context/evidence
3. Appeal stored in database

**Leadership Reviews** (2-week SLA):
1. Mod who made decision provides context
2. Leadership panel reviews appeal + original content
3. Options: uphold, overturn + restore, reduce penalty
4. User notified with written decision

**Documentation**:
- All decisions logged with reasoning
- Audit trail immutable
- Annual report on violation trends

---

## 📋 Phase 6.6 — Creator Monetization

### Architecture Overview

**Technology Stack**:
- Stripe for payments
- Supabase for revenue tracking
- Automated payout scheduling
- Tax reporting integration

### Database Schema

```sql
-- Creator profiles
CREATE TABLE creator_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  stripe_connect_id TEXT UNIQUE,
  status TEXT CHECK(status IN ('pending', 'active', 'suspended')),
  bio TEXT,
  avatar_url TEXT,
  payout_schedule TEXT DEFAULT 'weekly',  -- weekly, monthly
  min_payout_threshold FLOAT DEFAULT 10.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Premium salons
CREATE TABLE premium_salons (
  salon_id UUID PRIMARY KEY REFERENCES salons(id),
  creator_id UUID NOT NULL REFERENCES users(id),
  price_usd FLOAT NOT NULL CHECK(price_usd > 0),
  billing_cycle TEXT CHECK(billing_cycle IN ('monthly', 'annual')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Premium subscriptions
CREATE TABLE premium_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES users(id),
  salon_id UUID NOT NULL REFERENCES premium_salons(salon_id),
  stripe_subscription_id TEXT UNIQUE,
  status TEXT CHECK(status IN ('active', 'paused', 'cancelled')),
  subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  cancelled_at TIMESTAMP WITH TIME ZONE,
  renewal_at TIMESTAMP WITH TIME ZONE
);

-- Tipping transactions
CREATE TABLE tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users(id),
  to_user_id UUID NOT NULL REFERENCES users(id),
  amount_usd FLOAT NOT NULL CHECK(amount_usd > 0),
  message TEXT,
  stripe_charge_id TEXT UNIQUE,
  status TEXT DEFAULT 'completed' CHECK(status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Sponsorships
CREATE TABLE sponsorships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id),
  brand_name TEXT NOT NULL,
  content_id UUID,  -- message/pub being sponsored
  amount_usd FLOAT NOT NULL,
  approval_status TEXT DEFAULT 'pending' CHECK(approval_status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Revenue tracking
CREATE TABLE creator_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id),
  source TEXT CHECK(source IN ('subscriptions', 'tips', 'sponsorships')),
  amount_usd FLOAT NOT NULL,
  month TEXT NOT NULL,  -- YYYY-MM
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(creator_id, source, month)
);
```

### Monetization Models

**Premium Salons** (Creator subscription model):
- Creator sets monthly or annual fee
- Subscriber gets exclusive access to salon
- Stripe handles billing + payments
- Creator receives 85% (VIBE takes 15% + 2.2% Stripe fee)
- Payout: weekly to creator's bank account

**Tipping**:
- Users can tip creators directly ($1-$50)
- Stripe charges user card
- Creator receives 95% (VIBE takes 5% + Stripe fee)
- Minimum payout threshold: $10
- Monthly payouts

**Sponsored Content**:
- Brands pay creators to feature products
- Approval required (doesn't violate guidelines)
- Creator disclosure: "Sponsored by Brand"
- Revenue: per-post negotiation
- Tracked via sponsorship table

### API Endpoints

**Monetization Routes** (`/api/monetization/`):
- `GET /profile/:user_id` — View creator profile
- `POST /profile` — Create/update creator profile
- `POST /profile/stripe-connect` — Initiate Stripe Connect onboarding
- `POST /salons/:salon_id/premium` — Convert to premium
- `PATCH /salons/:salon_id/premium` — Update price/billing
- `POST /salons/:salon_id/subscribe` — Subscribe to premium salon
- `POST /tips/:user_id` — Send tip
- `GET /revenue` — Creator revenue dashboard
- `GET /payouts` — Payout history
- `POST /sponsorships` — Submit sponsorship request
- `PATCH /sponsorships/:id` — Approve/reject sponsorship

### Tax & Compliance

**Tax Documents** (US):
- Stripe generates 1099-K at $20k+ threshold
- Creator can download tax forms
- Payment breakdown report (tips, subscriptions, etc.)

**Terms & Conditions**:
- Creators maintain content ownership
- VIBE can terminate payout if policy violations
- Tax liability: creator's responsibility
- Transaction disputes: Stripe/creator handle

---

## 📋 Phase 6.7 — Advanced Analytics Dashboard

### Architecture Overview

**Technology Stack**:
- Chart.js or Apache ECharts for visualizations
- PostgreSQL materialized views for aggregations
- Caching layer (Redis)
- Real-time updates via Supabase Realtime
- Data export (PDF, CSV)

### Database Schema

```sql
-- Hourly aggregations
CREATE MATERIALIZED VIEW analytics_hourly AS
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as message_count,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT salon_id) as active_salons
FROM messages
GROUP BY DATE_TRUNC('hour', created_at);

-- Daily cohort analysis
CREATE MATERIALIZED VIEW cohort_analysis AS
SELECT
  DATE(users.created_at) as cohort_date,
  DATE(messages.created_at) as activity_date,
  COUNT(DISTINCT messages.user_id) as active_users
FROM users
LEFT JOIN messages ON users.id = messages.user_id
GROUP BY DATE(users.created_at), DATE(messages.created_at);

-- Salon health metrics
CREATE MATERIALIZED VIEW salon_health_metrics AS
SELECT
  salon_id,
  DATE_TRUNC('day', created_at) as day,
  COUNT(*) as messages,
  COUNT(DISTINCT user_id) as active_members,
  AVG(EXTRACT(EPOCH FROM (CASE WHEN read_at IS NOT NULL 
    THEN read_at - created_at ELSE now() - created_at END)))/60 as avg_response_time_minutes
FROM messages
GROUP BY salon_id, DATE_TRUNC('day', created_at);
```

### Dashboard Views

**Admin Dashboard**:
1. **Overview**
   - Total users (current month, 30-day growth %)
   - Active daily users (MAU, DAU, DAU/MAU %)
   - Message volume (daily trend)
   - Salons health (top 10, churn rate)

2. **Growth Metrics**
   - Cohort retention (heatmap)
   - Sign-up trend (daily, weekly)
   - Activation rate (% completing onboarding)
   - Engagement funnel (view → message → friend)

3. **Community Health**
   - Moderation stats (violations/day, appeal rate)
   - User feedback sentiment (NPS survey)
   - Feature adoption (% using notifications, PWA, etc.)
   - Churn rate (churned users last 30 days)

4. **Monetization** (if enabled):
   - Revenue (MRR, ARR)
   - Subscription churn
   - Creator earnings distribution
   - Tax reporting

**Creator Dashboard**:
1. **Audience**
   - Followers count & trend
   - New followers (daily, weekly)
   - Follower demographics (age ranges, interests)

2. **Content Performance**
   - Posts by engagement (views, reactions, replies)
   - Top-performing content (timeline)
   - Audience sentiment (reactions breakdown)
   - Shares & saves

3. **Earnings** (if monetized):
   - Revenue by source (subscriptions, tips, sponsorships)
   - Subscriber count & churn
   - Payout schedule
   - Tax documents

4. **Engagement Insights**
   - When audience is most active (heatmap)
   - Recommended posting times
   - Content recommendations based on performance
   - Follower engagement trend

### API Endpoints

**Analytics Routes** (`/api/analytics/`):
- `GET /admin/overview` — Admin dashboard overview
- `GET /admin/growth` — Growth metrics
- `GET /admin/community` — Community health
- `GET /admin/export` — Export data (PDF/CSV)
- `GET /creator/:user_id/audience` — Creator audience stats
- `GET /creator/:user_id/performance` — Content performance
- `GET /creator/:user_id/earnings` — Monetization stats

### Materialized View Refresh

**Hourly** (fast views):
```
-- analytics_hourly: refresh every 1 hour
REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_hourly;
```

**Daily** (slower views):
```
-- cohort_analysis, salon_health_metrics: refresh every 24 hours at 2 AM UTC
-- Scheduled via pgcron or application scheduler
```

---

## 📋 Implementation Schedule

### Week 1-2: Phase 6.0 & 6.1
- [ ] Real-time collaboration with OT engine
- [ ] Elasticsearch setup and indexing
- [ ] Search UI with filters
- [ ] Test coverage (>80%)

### Week 3-4: Phase 6.2 & 6.3
- [ ] Recommendation engine training
- [ ] React Native mobile app structure
- [ ] Authentication & socket setup
- [ ] iOS/Android testing

### Week 5-6: Phase 6.4 & 6.5
- [ ] WebRTC video integration
- [ ] Recording infrastructure
- [ ] Content moderation pipeline
- [ ] Automated violation detection

### Week 7-8: Phase 6.6 & 6.7
- [ ] Stripe integration for payments
- [ ] Premium salon & tipping flows
- [ ] Advanced analytics dashboard
- [ ] Data export features

### Week 9-10: Testing & QA
- [ ] Integration testing across features
- [ ] Performance benchmarking
- [ ] Security audit
- [ ] Load testing (1000+ concurrent users)

### Week 11-12: Deployment & Launch
- [ ] Staging deployment
- [ ] Beta testing with select users
- [ ] Production deployment
- [ ] Launch communication

---

## 🎯 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Real-time Collaboration | 95%+ uptime | Document sync latency < 500ms |
| Search | 90%+ recall | Relevant results in top 5 |
| Recommendations | 20%+ CTR | Click-through rate on recommendations |
| Mobile App | 50k+ downloads | Organic install rate |
| Video Sessions | 99% connection success | Failed peer connections < 1% |
| Moderation | 95%+ accuracy | Mod override rate < 5% |
| Creator Revenue | $50k+ MRR | First 100 creators earning |
| Analytics | Real-time accuracy | Dashboard update < 5 min latency |

---

## 💰 Resource Allocation

- **Frontend Development**: 3 engineers (40 sprint points/week)
- **Backend Development**: 4 engineers (50 sprint points/week)
- **Mobile Development**: 2 engineers (30 sprint points/week)
- **DevOps/Infrastructure**: 1 engineer (20 sprint points/week)
- **QA/Testing**: 2 engineers (25 sprint points/week)
- **Product/Design**: 1 PM, 1 Designer (15 sprint points/week)

**Total**: 13 FTE, 8-12 weeks

---

## 🚀 Risk Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| WebRTC scalability | High | Medium | Load testing early, TURN server redundancy |
| Elasticsearch indexing lag | Medium | Low | Async indexing, cache search results |
| Mobile approval delays | High | Medium | Submit to app stores week 7 |
| Payment processing issues | High | Low | Stripe sandbox testing, fallback payment method |
| Moderation false positives | Medium | High | Human review queue, appeals process |
| Creator trust concerns | Medium | Medium | Transparent payout system, regular reporting |

---

## 📝 Documentation

**Phase 6 Deliverables**:
- [ ] Phase-6-Architecture.md (technical deep dive)
- [ ] Phase-6-API-Reference.md (all endpoints)
- [ ] Phase-6-Database-Schema.md (complete SQL)
- [ ] Phase-6-Deployment-Guide.md (production setup)
- [ ] Phase-6-User-Guide.md (feature documentation)
- [ ] Phase-6-Admin-Guide.md (moderation tools)
- [ ] Phase-6-Changelog.md (v1.2.0 release notes)

---

## 🏁 Conclusion

Phase 6 represents a significant expansion of VIBE's capabilities, moving from a social platform to a comprehensive ecosystem with:
- **Real-time Collaboration** for community-building
- **Advanced Discovery** through AI recommendations
- **Native Mobile Experience** for on-the-go access
- **Direct Communication** via video integration
- **Creator Economy** enabling financial sustainability
- **Community Safety** through intelligent moderation

Success requires coordinated effort across multiple engineering teams but positions VIBE as a market leader in authentic LGBTQ+ community platforms.

---

**Status**: ✅ Phase 6 Roadmap Complete  
**Next Step**: Begin Phase 6.0 (Real-time Collaboration) implementation  
*Date: 2026-08-27*  
Avec Humilité et Respect 🌊
