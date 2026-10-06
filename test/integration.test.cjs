const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function integration({ platform = 'android', initialized = true, token = 'fcm-current', nativePush } = {}) {
  const calls = [];
  const listeners = {};
  const removed = [];
  const messaging = { app: { name: '[DEFAULT]' } };
  const native = {
    connect: async () => {
      calls.push({ method: 'connect' });
      if (!initialized) throw Object.assign(new Error('Native startup is missing'), { code: 'E_INIT' });
    },
    configure: async (...args) => calls.push({ method: 'configure', args }),
    setLoggingEnabled: (...args) => calls.push({ method: 'logging', args }),
    registerDeviceToken: (...args) => calls.push({ method: 'token', args }),
    handleRemoteMessage: async (...args) => {
      calls.push({ method: 'push', args });
      if (nativePush) return nativePush(...args);
      return args[0].engageAction === 'algoShowNotification' || args[0].engageAction === 'algoTriggerWebview';
    },
  };
  const firebase = {
    getMessaging: () => messaging,
    getToken: async (instance) => {
      assert.equal(instance, messaging);
      calls.push({ method: 'getToken' });
      return token;
    },
    onMessage: (instance, listener) => {
      assert.equal(instance, messaging);
      listeners.message = listener;
      return () => removed.push('message');
    },
    onTokenRefresh: (instance, listener) => {
      assert.equal(instance, messaging);
      listeners.token = listener;
      return () => removed.push('token');
    },
  };
  const loaded = {};
  function load(file) {
    const exports = {};
    vm.runInNewContext(readFileSync(path.join(__dirname, '../lib', file + '.js'), 'utf8'), {
      exports,
      console,
      require(name) {
        if (name === 'react-native') return {
          NativeModules: { EngageSdkModule: native },
          NativeEventEmitter: class {},
          Platform: { OS: platform },
        };
        if (name === '@react-native-firebase/messaging') return firebase;
        if (name === './index') return loaded.index;
        throw new Error('Unexpected dependency: ' + name);
      },
    });
    loaded[file] = exports;
    return exports;
  }
  const sdk = load('index').default;
  const adapter = () => load('firebase');
  return { sdk, adapter, calls, listeners, removed };
}

test('init() uses native startup without configuring or repeating credentials', async () => {
  const { sdk, calls } = integration();
  await sdk.init();
  assert.deepEqual(calls, [{ method: 'connect' }]);
});

test('init() rejects a missing native startup; explicit configuration remains compatible', async () => {
  const { sdk, calls } = integration({ initialized: false });
  await assert.rejects(sdk.init(), { code: 'E_INIT' });
  await sdk.init('https://api.example.com', 'partner');
  assert.deepEqual(calls[1], { method: 'configure', args: ['https://api.example.com', 'partner'] });
  await assert.rejects(sdk.init('https://api.example.com'), /Pass both/);
  assert.equal(calls.length, 2);
});

test('debug logging forwards to the native SDK', () => {
  const { sdk, calls } = integration();
  sdk.setLoggingEnabled(true);
  assert.deepEqual(calls, [{ method: 'logging', args: [true] }]);
});

test('push forwarding preserves custom keys and serializes nested Firebase data as JSON', async () => {
  const { sdk, calls } = integration();
  const data = { engageAction: 'algoShowNotification', Custom_Key: { Product_ID: 'A1' } };
  assert.equal(await sdk.handleRemoteMessage({ data, notification: { title: 'Title', body: 'Body' } }), true);
  assert.equal(calls[0].args[0].Custom_Key, '{"Product_ID":"A1"}');
  assert.equal(calls[0].args[1], 'Title');
  assert.equal(calls[0].args[2], 'Body');
  assert.deepEqual(data.Custom_Key, { Product_ID: 'A1' });
  assert.equal(await sdk.handleRemoteMessage({}), false);
  assert.equal(calls[1].args[1], null);
});

test('push promise waits for native completion and propagates a native error', async () => {
  let complete;
  const { sdk } = integration({ nativePush: () => new Promise((resolve) => { complete = resolve; }) });
  let finished = false;
  const pending = sdk.handleRemoteMessage({ data: { engageAction: 'algoTriggerWebview' } }).then(() => { finished = true; });
  await Promise.resolve();
  assert.equal(finished, false);
  complete(true);
  await pending;
  assert.equal(finished, true);
  const failing = integration({ nativePush: () => { throw Object.assign(new Error('failed'), { code: 'E_PUSH' }); } });
  await assert.rejects(failing.sdk.handleRemoteMessage({}), { code: 'E_PUSH' });
});

test('Firebase adapter registers current and refreshed Android tokens and routes other providers', async () => {
  const { adapter, calls, listeners } = integration();
  const other = [];
  const connection = adapter().connectFirebaseMessaging({ onOtherMessage: (message) => other.push(message) });
  await connection.ready;
  assert.equal(calls.find((call) => call.method === 'token').args[0], 'fcm-current');
  await listeners.message({ data: { engageAction: 'algoTriggerWebview' } });
  assert.equal(other.length, 0);
  const unrelated = { data: { source: 'another-provider' }, messageId: 'message-1' };
  await listeners.message(unrelated);
  assert.equal(other[0], unrelated);
  listeners.token('fcm-new');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.filter((call) => call.method === 'token').at(-1).args[0], 'fcm-new');
  connection.remove();
});

test('Firebase adapter never forwards iOS messages twice or registers its FCM token as APNs', async () => {
  const { adapter, calls, listeners } = integration({ platform: 'ios' });
  const firebase = adapter();
  const connection = firebase.connectFirebaseMessaging();
  await connection.ready;
  assert.equal(await firebase.handleFirebaseMessage({ data: { engageAction: 'algoTriggerWebview' } }), false);
  assert.deepEqual(Object.keys(listeners), []);
  assert.equal(calls.filter((call) => ['token', 'push', 'getToken'].includes(call.method)).length, 0);
  connection.remove();
});

test('Firebase startup failure cleans up subscriptions and listener errors reach the app', async () => {
  const failing = integration({ initialized: false });
  const connection = failing.adapter().connectFirebaseMessaging();
  await assert.rejects(connection.ready, { code: 'E_INIT' });
  assert.deepEqual(failing.removed, ['message', 'token']);
  const errors = [];
  const receiving = integration({ nativePush: () => { throw new Error('push failed'); } });
  const active = receiving.adapter().connectFirebaseMessaging({ onError: (error) => errors.push(error) });
  await active.ready;
  await receiving.listeners.message({});
  assert.equal(errors[0].message, 'push failed');
  active.remove();
});

test('removing an adapter twice is safe and prevents in-flight token registration', async () => {
  const { adapter, calls, listeners, removed } = integration();
  const connection = adapter().connectFirebaseMessaging();
  await connection.ready;
  const registrations = calls.filter((call) => call.method === 'token').length;
  const pending = connection.refreshToken();
  connection.remove();
  connection.remove();
  listeners.token('ignored-token');
  await listeners.message({ data: { engageAction: 'algoShowNotification' } });
  await pending;
  assert.deepEqual(removed, ['message', 'token']);
  assert.equal(calls.filter((call) => call.method === 'token').length, registrations);
  assert.equal(calls.filter((call) => call.method === 'push').length, 0);
});
