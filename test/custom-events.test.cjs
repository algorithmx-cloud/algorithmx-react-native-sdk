const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function sdkWithNativeCalls() {
  const calls = [];
  const nativeModule = {
    trackEvent: (...args) => calls.push({ method: 'trackEvent', args }),
    trackCampaignInteraction: (...args) => calls.push({ method: 'trackCampaignInteraction', args }),
  };
  const exports = {};
  vm.runInNewContext(readFileSync(path.join(__dirname, '../lib/index.js'), 'utf8'), {
    exports,
    require(name) {
      assert.equal(name, 'react-native');
      return {
        NativeModules: { EngageSdkModule: nativeModule },
        NativeEventEmitter: class {},
        Platform: { OS: 'android' },
      };
    },
  });
  return { sdk: exports.default, calls };
}

test('custom event names and mixed-case nested payload keys remain unchanged', () => {
  const { sdk, calls } = sdkWithNativeCalls();
  const payload = { product_id: 'A1', ProductID: 'A2', Nested_Data: { First_Name: 'Amina' } };
  sdk.trackEvent('Purchase_COMPLETED', payload);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args[0], 'Purchase_COMPLETED');
  assert.equal(calls[0].args[1], payload);
});

test('camelCase built-in interaction and custom payload reach the native SDK', () => {
  const { sdk, calls } = sdkWithNativeCalls();
  const payload = { Custom_Key: { coupon_code: 'SAVE10' } };
  sdk.trackCampaignInteraction('4', '8', 'closeDismiss', payload, 'session-1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args[2], 'closeDismiss');
  assert.equal(calls[0].args[3], payload);
  assert.equal(calls[0].args[4], 'session-1');
});
