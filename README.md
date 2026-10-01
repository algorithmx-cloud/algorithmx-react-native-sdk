# AlgorithmX React Native SDK

Connect your React Native app to [AlgorithmX](https://algorithmx.cloud), the campaign management and customer data platform. The SDK sends customer identity and events, handles AlgorithmX push notifications, routes campaign actions to your navigation, and shows in-app campaigns on Android and iOS.

It wraps the native [AlgorithmX Android SDK](https://github.com/algorithmx-cloud/algorithmx-android-sdk) and [AlgorithmX iOS SDK](https://github.com/algorithmx-cloud/algorithmx-ios-sdk).

- Android minSdk 24, iOS 15.1 or later
- Works with the New Architecture
- Expo: needs a development build; Expo Go cannot load native modules

## Installation

```bash
npm install @algorithmxcloud/react-native-sdk
```

**Android:** nothing else. The native SDK comes from Maven Central.

**iOS:** add the native SDK pod to your app target in `ios/Podfile`, then run `pod install`:

```ruby
pod 'AlgorithmXSDK', :git => 'https://github.com/algorithmx-cloud/algorithmx-ios-sdk.git', :tag => '1.0.0'
```

## Quick start

Start the SDK in your native entry points so pushes that start the app before JavaScript runs are handled:

```kotlin
// Android: MainApplication.onCreate
AlgorithmXReactNative.initialize(this, "https://api.example.com")
```

```swift
// iOS: application(_:didFinishLaunchingWithOptions:)
import AlgorithmXReactNativeSDK
AlgorithmXReactNative.initialize(apiBaseUrl: "https://api.example.com")
```

Then, at your app's entry, register listeners and bind JavaScript with the same URL:

```ts
import AlgorithmX from '@algorithmxcloud/react-native-sdk';

AlgorithmX.addListener('onDeepLink', ({ url }) => {
  // Open the URL with your router.
});

await AlgorithmX.init('https://api.example.com');
AlgorithmX.identify('customer_123', { language: 'en' });
AlgorithmX.trackEvent('add_to_cart', { product_id: 'SKU-123', quantity: 2 });
```

The integration guide covers push notifications on both platforms, all listeners, and testing.

**[React Native integration guide →](https://algorithmx.cloud/en/docs/integrations/react-native)**

## Development

```bash
npm install
npm run typecheck
npm run build   # compiles src/ to lib/; also runs on `npm pack` and `npm publish`
```

## License

MIT. See [LICENSE](LICENSE).
