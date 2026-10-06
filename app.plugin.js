const { withAndroidManifest, withInfoPlist, withEntitlementsPlist, withPodfile, createRunOncePlugin } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

const serviceName = 'algorithmx.engage.expo.AlgorithmXExpoMessagingService';
const expoServiceName = 'expo.modules.notifications.service.ExpoFirebaseMessagingService';
const nativePod = "  pod 'AlgorithmXSDK', :git => 'https://github.com/algorithmx-cloud/algorithmx-ios-sdk.git', :tag => '1.0.2'";

function validateOptions(options) {
  if (!options || typeof options.apiBaseUrl !== 'string' || !/^https?:\/\/\S+$/.test(options.apiBaseUrl)
      || typeof options.partnerId !== 'string' || !options.partnerId.trim()) {
    throw new Error('AlgorithmX: provide apiBaseUrl and partnerId in the config plugin options.');
  }
  if (options.appGroup !== undefined && (typeof options.appGroup !== 'string' || !/^group\.\S+$/.test(options.appGroup))) {
    throw new Error('AlgorithmX: appGroup must be an existing group.* App Group identifier.');
  }
}

function configureAndroidManifest(manifest, options) {
  const application = manifest.application?.[0];
  if (!application) throw new Error('AlgorithmX: Android manifest has no application.');
  manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
  const services = application.service ?? [];
  const conflicting = services.find(service => service.$?.['android:name'] !== serviceName
    && service.$?.['android:name'] !== expoServiceName
    && service['intent-filter']?.some(filter => filter.action?.some(action => action.$?.['android:name'] === 'com.google.firebase.MESSAGING_EVENT')));
  if (conflicting) throw new Error(`AlgorithmX: existing FCM service ${conflicting.$['android:name']}. Use the React Native existing-push guide instead of the Expo notifications plugin.`);
  application.service = services.filter(service => ![serviceName, expoServiceName].includes(service.$?.['android:name']));
  application.service.push({ $: { 'android:name': expoServiceName, 'tools:node': 'remove' } });
  application.service.push({
    $: { 'android:name': serviceName, 'android:exported': 'false' },
    'intent-filter': [{ action: [{ $: { 'android:name': 'com.google.firebase.MESSAGING_EVENT' } }] }],
  });
  application['meta-data'] = (application['meta-data'] ?? []).filter(item => !['algorithmx.apiBaseUrl', 'algorithmx.partnerId'].includes(item.$?.['android:name']));
  for (const [key, value] of Object.entries({ apiBaseUrl: options.apiBaseUrl, partnerId: options.partnerId })) {
    application['meta-data'].push({ $: { 'android:name': `algorithmx.${key}`, 'android:value': value } });
  }
  return manifest;
}

function configurePodfile(contents) {
  if (/^\s*pod\s+['"]AlgorithmXSDK['"]/m.test(contents)) return contents;
  const target = /^target\s+['"][^'"]+['"]\s+do\s*$/m;
  if (!target.test(contents)) throw new Error('AlgorithmX: cannot find the Expo app target in the Podfile.');
  return contents.replace(target, match => `${match}\n${nativePod}`);
}

function withAlgorithmX(config, options) {
  validateOptions(options);
  config = withAndroidManifest(config, mod => {
    const projectRoot = mod.modRequest.projectRoot;
    const appPackage = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
    if (appPackage.dependencies?.['@react-native-firebase/messaging']) {
      throw new Error('AlgorithmX: this Expo plugin uses expo-notifications. For an existing React Native Firebase messaging integration use the React Native Firebase guide instead.');
    }
    if (!appPackage.dependencies?.['expo-notifications']) throw new Error('AlgorithmX: install expo-notifications before using this plugin.');
    mod.modResults.manifest = configureAndroidManifest(mod.modResults.manifest, options);
    return mod;
  });
  config = withInfoPlist(config, mod => {
    mod.modResults.AlgorithmX = { apiBaseUrl: options.apiBaseUrl, partnerId: options.partnerId, ...(options.appGroup ? { appGroup: options.appGroup } : {}) };
    mod.modResults.UIBackgroundModes = [...new Set([...(mod.modResults.UIBackgroundModes ?? []), 'remote-notification'])];
    return mod;
  });
  config = withEntitlementsPlist(config, mod => {
    // Match Expo Notifications. Signing/EAS supplies the correct APNs environment.
    mod.modResults['aps-environment'] ??= 'development';
    if (options.appGroup) {
      mod.modResults['com.apple.security.application-groups'] = [...new Set([...(mod.modResults['com.apple.security.application-groups'] ?? []), options.appGroup])];
    }
    return mod;
  });
  return withPodfile(config, mod => {
    mod.modResults.contents = configurePodfile(mod.modResults.contents);
    return mod;
  });
}

module.exports = createRunOncePlugin(withAlgorithmX, '@algorithmxcloud/react-native-sdk', require('./package.json').version);
// Pure transformations are also exercised without generating a native project.
module.exports.configureAndroidManifest = configureAndroidManifest;
module.exports.configurePodfile = configurePodfile;
module.exports.validateOptions = validateOptions;
