# VIBE v1.1.0 Deployment Guide 🚀

## Pre-Deployment Checklist

- [x] Phase 5 features implemented
- [x] All SQL migrations prepared
- [x] API endpoints tested
- [x] Security audit passed
- [x] Documentation complete
- [x] Environment variables defined
- [x] Database backups configured

---

## Deployment Steps

### 1. Database Migrations (Supabase)

Execute in Supabase SQL Editor (in order):

```bash
# 1. Phase 5.0 - Notifications
sql/phase-5-notifications.sql

# 2. Phase 5.1 - Moderation
sql/phase-5-moderation.sql

# 3. Phase 5.4 - Gamification
sql/phase-5-gamification.sql
```

**Expected**: 35+ tables, 100+ indexes, 10+ views

### 2. Update Environment Variables

Add to `.env`:

```env
# Notifications
ENABLE_NOTIFICATIONS=true
NOTIFICATION_BATCH_SIZE=100
NOTIFICATION_RETRY_ATTEMPTS=3

# Gamification
ENABLE_GAMIFICATION=true
LEADERBOARD_UPDATE_INTERVAL=3600

# Analytics
ENABLE_ANALYTICS=true
ANALYTICS_CACHE_TTL=300

# PWA
ENABLE_PWA=true
PWA_CACHE_VERSION=v1.1.0

# Performance
MAX_CONCURRENT_CONNECTIONS=1000
API_RATE_LIMIT=1000
```

### 3. Install Dependencies

```bash
npm install pdfkit csv-stringify
npm audit fix
npm prune --production
```

### 4. Server Integration

Update `server.js`:

```javascript
// Add routes
const notificationRoutes = require('./notifications/notifications-routes');
const analyticsRoutes = require('./analytics/analytics-routes');

app.use('/notifications', notificationRoutes);
app.use('/analytics', analyticsRoutes);

// Schedule leaderboard updates (daily at midnight)
const gamificationService = require('./gamification/gamification-service');
setInterval(() => {
  gamificationService.updateLeaderboards();
}, 24 * 60 * 60 * 1000);

// Register PWA service worker
app.use('/pwa-service-worker.js', express.static('./performance/pwa-service-worker.js'));
```

### 5. Frontend Integration

Add to `index.html`:

```html
<!-- PWA Setup -->
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#D4AF37">
<meta name="apple-mobile-web-app-capable" content="yes">
<link rel="manifest" href="/manifest.json">

<!-- Service Worker Registration -->
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/pwa-service-worker.js')
      .then(reg => console.log('✅ PWA registered'))
      .catch(err => console.error('PWA registration failed:', err));
  }

  // Request notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
</script>
```

### 6. Create Web Manifest

Create `public/manifest.json`:

```json
{
  "name": "VIBE — Connection Authentique",
  "short_name": "VIBE",
  "description": "Authentic community for LGBTQ+",
  "start_url": "/index.html",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#D4AF37",
  "icons": [
    {
      "src": "/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### 7. Deploy to Production

**Option A: Heroku**
```bash
git push heroku main
heroku run 'node migrations.js'
```

**Option B: Railway**
```bash
railway up
```

**Option C: Render**
```bash
# Push to render branch
git push render main:main
```

**Option D: Self-hosted**
```bash
npm install --production
NODE_ENV=production node server.js
```

### 8. Post-Deployment Verification

```bash
# Health check
curl https://your-domain.com/health

# Notifications endpoint
curl https://your-domain.com/notifications \
  -H "x-user-id: test-user"

# Analytics
curl https://your-domain.com/analytics/user \
  -H "x-user-id: test-user"

# Leaderboard
curl https://your-domain.com/analytics/leaderboard/monthly
```

---

## Rollback Procedure

If issues occur:

```bash
# Revert to v1.0.0
git checkout v1.0.0
git push -f heroku v1.0.0:main

# Or maintain database state
git reset --hard v1.0.0
# Keep database (no schema rollback needed)
```

---

## Monitoring & Alerts

### Key Metrics to Monitor

```
✅ API Response Time: <200ms
✅ Error Rate: <0.1%
✅ Database Query Time: <100ms
✅ Notification Delivery: 95%+
✅ Leaderboard Update: <500ms
```

### Error Logging Setup

```javascript
// Add to server.js
const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`);
  console.error(`[CONTEXT] ${req.method} ${req.url}`);
  res.status(500).json({ error: 'Internal server error' });
};

app.use(errorHandler);
```

### Database Monitoring

```sql
-- Check table sizes
SELECT tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) 
FROM pg_tables 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check slow queries
SELECT query, mean_time FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;
```

---

## Performance Optimization Checklist

- [ ] Database indexes verified
- [ ] RLS policies tested
- [ ] Cache strategy validated
- [ ] Service worker caching enabled
- [ ] Static assets compressed
- [ ] Images optimized (WebP)
- [ ] Lighthouse score 95+
- [ ] Load testing passed (1000+ users)

---

## User Communication

### Email Announcement

**Subject**: 🎉 VIBE v1.1.0 — Major Update Released!

**Body**:
```
Hi VIBE Community,

We're excited to announce v1.1.0 with major new features:

🔔 Real-time Notifications
Track tribunal updates, pubs approvals, and billets transfers instantly

📊 Personal Analytics
View your contribution stats, achievements, and community impact

⭐ Gamification
Earn points, unlock achievements, and climb the leaderboards

⚡ Performance Boost
Faster load times, offline support, PWA installation

🤝 Better Moderation
Appeal system, judge assignments, complete audit trails

Get started: https://vibe.app

Avec Humilité et Respect,
The VIBE Team
```

---

## Version History

**v1.1.0** (Current)
- Phase 5: Notifications, Moderation, Analytics, PWA, Gamification
- 11 new database tables
- 18 new API endpoints
- Production ready

**v1.0.0** (Previous)
- Core platform
- Authentication
- Real-time salons
- Tribunal system
- Billets currency
- Pubs advertising

---

## Next Steps (v1.2.0 Planning)

- [ ] Real-time collaboration features
- [ ] Advanced search (Elasticsearch)
- [ ] Recommendation engine
- [ ] Mobile app (React Native)
- [ ] Video chat integration
- [ ] Community guidelines enforcement
- [ ] Creator monetization
- [ ] Advanced analytics dashboard

---

## Support & Troubleshooting

### Common Issues

**Notifications not sending?**
```bash
# Check email service
curl https://api.gmail.com/health

# Verify SMTP credentials
node -e "const m = require('./notifications/notification-service'); console.log('Ready')"
```

**Leaderboards not updating?**
```bash
# Run manual update
node -e "
const g = require('./gamification/gamification-service');
g.updateLeaderboards();
"
```

**PWA not caching?**
```bash
# Clear service worker cache
# In browser console: caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))))
```

---

## Deployment Timeline

```
Day 1: Database migrations (2h)
Day 1: Environment setup (1h)
Day 1: Deploy to staging (1h)
Day 1: Testing & validation (4h)

Day 2: Production deployment (1h)
Day 2: Monitoring setup (1h)
Day 2: User communication (1h)
Day 2: Support preparation (1h)
```

---

**Status**: ✅ v1.1.0 Ready for Production Deploy

*Generated: VIBE Phase 5 Deployment*  
*Date: 2026-08-27*  
*Branch: main (v1.1.0)*  

Avec Humilité et Respect 🌊
