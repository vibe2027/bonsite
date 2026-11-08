/**
 * PHASE 6.3 — React Native Mobile App
 * Cross-platform iOS/Android application setup and core components
 */

// package.json configuration for React Native
const packageConfig = {
  name: 'vibe-mobile',
  version: '1.0.0',
  description: 'VIBE Mobile App - Authentic Connection for LGBTQ+ Community',
  main: 'index.js',
  scripts: {
    'start': 'react-native start',
    'android': 'react-native run-android',
    'ios': 'react-native run-ios',
    'test': 'jest',
    'lint': 'eslint .'
  },
  dependencies: {
    'react': '18.2.0',
    'react-native': '0.72.0',
    '@supabase/supabase-js': '^2.0.0',
    '@react-native-async-storage/async-storage': '^1.17.0',
    '@react-navigation/native': '^6.0.0',
    '@react-navigation/bottom-tabs': '^6.0.0',
    '@react-navigation/stack': '^6.0.0',
    'react-native-screens': '^3.18.0',
    'react-native-safe-area-context': '^4.5.0',
    'react-native-gesture-handler': '^2.12.0',
    'axios': '^1.4.0',
    'lodash': '^4.17.21'
  },
  devDependencies: {
    '@babel/core': '^7.21.0',
    '@babel/preset-react': '^7.18.0',
    '@types/react-native': '^0.70.0',
    'typescript': '^5.0.0',
    'jest': '^29.5.0'
  }
};

/**
 * Core Authentication Service for Mobile
 */
class MobileAuthService {
  constructor(supabaseUrl, supabaseKey) {
    this.supabaseUrl = supabaseUrl;
    this.supabaseKey = supabaseKey;
    this.session = null;
  }

  async signup(email, password) {
    try {
      const response = await fetch(`${this.supabaseUrl}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.supabaseKey
        },
        body: JSON.stringify({
          email,
          password,
          data: { app: 'mobile', created_at: new Date().toISOString() }
        })
      });

      const data = await response.json();
      if (data.user) {
        this.session = data.session;
        await AsyncStorage.setItem('auth_session', JSON.stringify(data.session));
      }
      return data;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  }

  async login(email, password) {
    try {
      const response = await fetch(`${this.supabaseUrl}/auth/v1/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.supabaseKey
        },
        body: JSON.stringify({
          grant_type: 'password',
          email,
          password
        })
      });

      const data = await response.json();
      if (data.access_token) {
        this.session = { access_token: data.access_token, user: data.user };
        await AsyncStorage.setItem('auth_session', JSON.stringify(this.session));
      }
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async logout() {
    this.session = null;
    await AsyncStorage.removeItem('auth_session');
  }

  async getSession() {
    const stored = await AsyncStorage.getItem('auth_session');
    return stored ? JSON.parse(stored) : null;
  }
}

/**
 * Core Navigation Structure
 */
const NavigationStructure = {
  RootStack: {
    AuthStack: [
      'Login',
      'Signup',
      'ForgotPassword'
    ],
    AppStack: {
      MainTabs: [
        'Salons', // Flottant, Voix, Fantômes, Tribunal
        'Messages', // Direct messages
        'Discovery', // Trending, Recommendations
        'Profile' // User profile, settings
      ],
      Modals: [
        'CreatePost',
        'CreatePub',
        'ManageBillets',
        'Settings'
      ]
    }
  }
};

/**
 * Core Component: Salon List
 */
const SalonComponent = {
  name: 'SalonList',
  props: ['salons', 'onSelectSalon'],
  methods: {
    renderSalon: function(salon) {
      return `
        <SalonCard
          key={salon.id}
          name={salon.name}
          description={salon.description}
          memberCount={salon.members}
          lastMessage={salon.lastMessage}
          onPress={() => this.props.onSelectSalon(salon.id)}
        />
      `;
    }
  }
};

/**
 * Core Component: Chat Interface
 */
const ChatComponent = {
  name: 'ChatInterface',
  props: ['salonId', 'messages', 'onSendMessage'],
  state: {
    inputText: '',
    isLoading: false,
    editingMessageId: null
  },
  methods: {
    handleSendMessage: async function(text) {
      if (!text.trim()) return;

      this.setState({ isLoading: true });
      try {
        await this.props.onSendMessage({
          content: text,
          salon_id: this.props.salonId,
          type: 'text',
          timestamp: new Date().toISOString()
        });
        this.setState({ inputText: '' });
      } catch (error) {
        console.error('Send error:', error);
      } finally {
        this.setState({ isLoading: false });
      }
    }
  }
};

/**
 * Realtime Message Sync for Mobile
 */
class MobileMessageSync {
  constructor(supabaseUrl, supabaseKey) {
    this.supabaseUrl = supabaseUrl;
    this.supabaseKey = supabaseKey;
    this.subscriptions = new Map();
  }

  subscribeToChatUpdates(salonId, onUpdate) {
    const wsUrl = this.supabaseUrl.replace('https', 'wss');
    const url = `${wsUrl}/realtime/v1/websocket?apikey=${this.supabaseKey}`;

    const ws = new WebSocket(url);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'subscribe',
        payload: {
          channel: `salons_messages:salon_id=eq.${salonId}`
        }
      }));
      this.subscriptions.set(salonId, ws);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event === 'INSERT' || data.event === 'UPDATE') {
        onUpdate(data.new);
      }
    };

    ws.onerror = (error) => console.error('WebSocket error:', error);

    return () => {
      ws.close();
      this.subscriptions.delete(salonId);
    };
  }

  unsubscribe(salonId) {
    const ws = this.subscriptions.get(salonId);
    if (ws) {
      ws.close();
      this.subscriptions.delete(salonId);
    }
  }
}

/**
 * Offline-First Data Sync
 */
class OfflineSync {
  constructor() {
    this.pendingQueue = [];
    this.isOnline = true;
  }

  async queueAction(action) {
    this.pendingQueue.push({
      ...action,
      timestamp: new Date().toISOString(),
      id: Math.random().toString(36)
    });

    if (this.isOnline) {
      await this.sync();
    }
  }

  async sync() {
    if (!this.isOnline) return;

    for (const action of this.pendingQueue) {
      try {
        await this.executeAction(action);
        this.pendingQueue = this.pendingQueue.filter(a => a.id !== action.id);
      } catch (error) {
        console.error('Sync error:', error);
        break; // Stop on first error
      }
    }
  }

  async executeAction(action) {
    // Implementation would depend on action type
    // POST to server, store response, update local cache
  }

  setOnlineStatus(status) {
    this.isOnline = status;
    if (status) this.sync();
  }
}

module.exports = {
  packageConfig,
  MobileAuthService,
  NavigationStructure,
  SalonComponent,
  ChatComponent,
  MobileMessageSync,
  OfflineSync
};
