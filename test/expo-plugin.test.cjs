const test = require('node:test');
const assert = require('node:assert/strict');
const { configureAndroidManifest, configurePodfile, validateOptions } = require('../app.plugin');
const options = { apiBaseUrl: 'https://api.example.com', partnerId: 'customer-partner' };

test('Expo manifest owns one FCM service and preserves unrelated app configuration across prebuilds', () => {
  const manifest = { $: {}, application: [{ 'meta-data': [{ $: { 'android:name': 'other.key', 'android:value': 'keep' } }], service: [{ $: { 'android:name': 'other.Service' } }] }] };
  configureAndroidManifest(manifest, options);
  const first = JSON.stringify(manifest);
  configureAndroidManifest(manifest, options);
  assert.equal(JSON.stringify(manifest), first);
  assert.equal(manifest.application[0].service.length, 3);
  assert.equal(manifest.application[0]['meta-data'].length, 3);
  configureAndroidManifest(manifest, { ...options, partnerId: 'updated-partner' });
  assert.equal(manifest.application[0]['meta-data'].find(x => x.$['android:name'] === 'algorithmx.partnerId').$['android:value'], 'updated-partner');
});

test('Expo rejects another FCM owner instead of replacing its notification flow', () => {
  const manifest = { $: {}, application: [{ service: [{ $: { 'android:name': 'custom.PushService' }, 'intent-filter': [{ action: [{ $: { 'android:name': 'com.google.firebase.MESSAGING_EVENT' } }] }] }] }] };
  assert.throws(() => configureAndroidManifest(manifest, options), /custom.PushService/);
});

test('Expo adds the native iOS dependency inside the app target once', () => {
  const source = "platform :ios, '15.1'\ntarget 'Shop' do\n  use_expo_modules!\nend\n";
  const configured = configurePodfile(source);
  assert.equal(configurePodfile(configured), configured);
  assert.match(configured, /target 'Shop' do\n  pod 'AlgorithmXSDK'/);
  assert.throws(() => configurePodfile('invalid file'), /cannot find/);
});

test('Expo requires usable build-time configuration', () => {
  validateOptions(options);
  validateOptions({ ...options, appGroup: 'group.com.example.shop' });
  assert.throws(() => validateOptions({ ...options, appGroup: 'invalid' }), /App Group/);
  assert.throws(() => validateOptions({ ...options, partnerId: ' ' }), /provide/);
  assert.throws(() => validateOptions({ ...options, apiBaseUrl: 'bad-url' }), /provide/);
});
