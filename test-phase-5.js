/**
 * VIBE Phase 5 — Local Testing Suite
 * Quick validation of all new features
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Test data
const TEST_USER_ID = 'test-user-001';
const TEST_ADMIN_ID = 'admin-001';

// Helper: Make HTTP request
function makeRequest(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: data ? JSON.parse(data) : null,
            headers: res.headers
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data,
            headers: res.headers
          });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Tests
async function runTests() {
  console.log('🧪 VIBE Phase 5 Test Suite\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Health check
  try {
    console.log('Test 1: Health Check');
    const res = await makeRequest('GET', '/health');
    if (res.status === 200) {
      console.log('✅ Server is running\n');
      passed++;
    } else {
      console.log('❌ Server health check failed\n');
      failed++;
    }
  } catch (err) {
    console.log(`❌ Server not running: ${err.message}\n`);
    failed++;
  }

  // Test 2: Get notifications
  try {
    console.log('Test 2: Notifications API');
    const res = await makeRequest('GET', '/notifications', {
      'x-user-id': TEST_USER_ID
    });
    if (res.status === 200) {
      console.log(`✅ Got ${res.data.unreadCount || 0} unread notifications\n`);
      passed++;
    } else {
      console.log(`❌ Failed: ${res.status}\n`);
      failed++;
    }
  } catch (err) {
    console.log(`❌ Error: ${err.message}\n`);
    failed++;
  }

  // Test 3: Get user analytics
  try {
    console.log('Test 3: User Analytics');
    const res = await makeRequest('GET', '/analytics/user', {
      'x-user-id': TEST_USER_ID
    });
    if (res.status === 200 || res.status === 404) {
      console.log(`✅ Analytics endpoint available\n`);
      passed++;
    } else {
      console.log(`❌ Failed: ${res.status}\n`);
      failed++;
    }
  } catch (err) {
    console.log(`❌ Error: ${err.message}\n`);
    failed++;
  }

  // Test 4: Get admin analytics
  try {
    console.log('Test 4: Admin Analytics Dashboard');
    const res = await makeRequest('GET', '/analytics/admin', {
      'x-user-id': TEST_ADMIN_ID,
      'x-user-role': 'admin'
    });
    if (res.status === 200 || res.status === 403) {
      console.log(`✅ Admin analytics endpoint available\n`);
      passed++;
    } else {
      console.log(`❌ Failed: ${res.status}\n`);
      failed++;
    }
  } catch (err) {
    console.log(`❌ Error: ${err.message}\n`);
    failed++;
  }

  // Test 5: Get leaderboard
  try {
    console.log('Test 5: Leaderboards');
    const res = await makeRequest('GET', '/analytics/leaderboard/monthly?limit=10');
    if (res.status === 200) {
      console.log(`✅ Leaderboard available\n`);
      passed++;
    } else {
      console.log(`❌ Failed: ${res.status}\n`);
      failed++;
    }
  } catch (err) {
    console.log(`❌ Error: ${err.message}\n`);
    failed++;
  }

  // Test 6: Test notification
  try {
    console.log('Test 6: Test Notification');
    const res = await makeRequest('POST', '/notifications/test', {}, {
      userId: TEST_USER_ID,
      type: 'new_message',
      title: 'Test Notification',
      body: 'This is a test message'
    });
    if (res.status === 200 || res.status === 201) {
      console.log(`✅ Notification test successful\n`);
      passed++;
    } else {
      console.log(`❌ Failed: ${res.status}\n`);
      failed++;
    }
  } catch (err) {
    console.log(`❌ Error: ${err.message}\n`);
    failed++;
  }

  // Summary
  console.log('📊 Test Summary\n');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round(passed / (passed + failed) * 100)}%\n`);

  if (failed === 0) {
    console.log('🎉 All tests passed!\n');
  } else {
    console.log(`⚠️ ${failed} test(s) need attention.\n`);
  }
}

// Run
runTests().catch(console.error);
