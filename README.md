# AlgorithmX React Native SDK

> **Recommended naming: camelCase**
>
> We recommend `camelCase` for custom event names and payload keys, such as `addToCart` and `productId`. This is a recommendation only: the SDK does not enforce or normalize custom names or keys. Titles can use natural text in any language.
>
> SDK-defined fields, built-in events, and action types use the documented camelCase names. Legacy SDK push keys and built-in event/action names are still accepted on input; outgoing SDK tracking uses the canonical names. Your backend must accept `/api/v1/tracks/algoViewInteract`, with camelCase interaction fields and `payload` as a JSON string.

Connect your React Native app to [AlgorithmX](https://algorithmx.cloud), the campaign management and customer data platform. The SDK sends customer identity and events, handles AlgorithmX push notifications, routes campaign actions to your navigation, and shows in-app campaigns on Android and iOS.

It wraps the native [AlgorithmX Android SDK](https://github.com/algorithmx-cloud/algorithmx-android-sdk) and [AlgorithmX iOS SDK](https://github.com/algorithmx-cloud/algorithmx-ios-sdk).

- Android minSdk 24, iOS 15.1 or later
- Works with the New Architecture
- Expo: needs a development build; Expo Go cannot load native modules

> These integration improvements are included in SDK 1.0.2. Earlier builds with version 1.0.1 do not include them.

## Installation

```bash
npm install @algorithmxcloud/react-native-sdk
```

**Android:** nothing else. The native SDK comes from Maven Central.

**iOS:** add the native SDK pod to your app target in `ios/Podfile`, then run `pod install`:

```ruby
pod 'AlgorithmXSDK', :git => 'https://github.com/algorithmx-cloud/algorithmx-ios-sdk.git', :tag => '1.0.2'
```

## Quick start

Start the SDK in your native entry points so pushes that start the app before JavaScript runs are handled:

```kotlin
// Android: MainApplication.onCreate
AlgorithmXReactNative.initialize(this, "https://api.example.com", "your-partner-id")
```

```swift
// iOS: application(_:didFinishLaunchingWithOptions:)
import AlgorithmXReactNativeSDK
AlgorithmXReactNative.initialize(apiBaseUrl: "https://api.example.com", partnerId: "your-partner-id")
```

Then, at your app's entry, register listeners and connect JavaScript. It uses the configuration already supplied in native startup:

```ts
import AlgorithmX from '@algorithmxcloud/react-native-sdk';

AlgorithmX.addListener('onDeepLink', ({ url }) => {
  // Open the URL with your router.
});

async function startAlgorithmX() {
  await AlgorithmX.init();
  AlgorithmX.identify('customer_123', { language: 'en' });
  AlgorithmX.trackEvent('addToCart', { productId: 'SKU-123', quantity: 2 });
}

startAlgorithmX().catch((error) => console.warn('AlgorithmX startup failed', error));
```

AlgorithmX gives you the API base URL and your partner ID. The SDK sends the partner ID in the `x-partner-id` header of every SDK API request.

`init()` rejects with `E_INIT` if native startup is missing. The existing `init(apiBaseUrl, partnerId)` form remains supported and rejects mismatched configuration. Keep native startup for pushes that arrive before JavaScript. Enable request logging from JavaScript with `AlgorithmX.setLoggingEnabled(true)`.

## Expo SDK 55 with Expo Notifications

Use the same SDK, with the optional config plugin listed after `expo-notifications`:

```json
{
  "expo": {
    "android": { "googleServicesFile": "./google-services.json" },
    "plugins": [
      ["expo-notifications", { "enableBackgroundRemoteNotifications": true }],
      ["@algorithmxcloud/react-native-sdk", {
        "apiBaseUrl": "https://api.example.com",
        "partnerId": "your-partner-id"
      }]
    ]
  }
}
```

Install `expo-notifications` with `npx expo install expo-notifications`, then prebuild and rebuild. Native lifecycle integrations start the SDK and register FCM/APNs tokens. The plugin supplies the iOS Git pod line, push entitlements/background mode, and one Android messaging service. That service handles AlgorithmX messages and forwards unrelated messages to Expo. JavaScript still calls `AlgorithmX.init()` and uses the same customer/event/navigation APIs.

Do not also install the Firebase adapter or forward AlgorithmX messages manually. Keep your own permission prompt and use AlgorithmX callbacks for its campaign navigation. Expo Push Tokens are not AlgorithmX's platform tokens. Other Expo versions require validation; Expo Go is unsupported. Optional iOS rich-notification extensions are not generated. For an existing extension, an optional `appGroup` plugin setting configures the main app’s shared group; the extension target needs matching provisioning/configuration.

Expo apps with React Native Firebase or a custom service can keep the matching React Native push path below instead. The Expo lifecycle module is inactive without plugin configuration. An additional iOS library that replaces the notification-center delegate after startup needs an integration assessment.

## Choose your push integration

Use one forwarding path per platform. Keep your existing permission prompt and navigation. The SDK does not request permission or replace your other provider's notification handlers.

### Android: React Native Firebase

If the app already uses `@react-native-firebase/messaging` (modular API, versions 22–26), import the optional adapter. It does not add Firebase to apps that only import the main SDK.

In the app entry file, outside React components:

```ts
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import {
  connectFirebaseMessaging,
  handleFirebaseMessage,
} from '@algorithmxcloud/react-native-sdk/firebase';

const messaging = getMessaging();

// Add this to your existing background handler if you already have one.
setBackgroundMessageHandler(messaging, async (message) => {
  if (await handleFirebaseMessage(message)) return;
  // Your existing background handling for other providers.
});

// Call once at startup. Move your other Android foreground message handling
// into onOtherMessage so it does not also display AlgorithmX messages.
const push = connectFirebaseMessaging({
  messaging,
  onOtherMessage: async (message) => {
    // Your existing Android foreground handling for other providers.
  },
  onError: (error) => console.warn('AlgorithmX push failed', error),
});

// Await push.ready in your startup flow and handle errors there.
// Use push.remove() if your application tears down this integration.
```

The adapter registers the current Android FCM token, listens for token refresh, and forwards foreground AlgorithmX messages. `handleFirebaseMessage` returns `true` after native processing for an AlgorithmX message and `false` otherwise. On iOS it returns `false` and installs no message/token listeners: keep the native APNs helpers below. This avoids processing the same iOS notification twice or registering an iOS FCM token where AlgorithmX expects APNs.

If you want to keep all your existing JavaScript listeners, use `await AlgorithmX.handleRemoteMessage(message)` in your Android foreground and background handlers, and keep your existing calls to `AlgorithmX.registerDeviceToken(token)`. Do not also connect the adapter or forward the message natively.

### Android: existing native messaging service

Add one branch to the app's existing `onMessageReceived`. The helper checks ownership internally:

```kotlin
if (AlgorithmXReactNative.handleFcmMessage(
    applicationContext, message.data,
    message.notification?.title, message.notification?.body
)) return
// Your existing handling for other providers.
```

Forward `onNewToken` with `AlgorithmXReactNative.registerDeviceToken(token)`. Also fetch and register the current Firebase token on every app launch; token refresh callbacks alone do not cover an app update that adds AlgorithmX.

### iOS: native APNs callbacks, including apps using Firebase

Initialize natively before React Native starts. Keep your existing notification delegate, call `application.registerForRemoteNotifications()` on every launch, and enable the Push Notifications capability and Background Modes → Remote notifications. APNs registration is separate from asking permission for visible notifications.

Use these helpers in the existing callback methods:

```swift
// application(_:didRegisterForRemoteNotificationsWithDeviceToken:)
AlgorithmXReactNative.registerDeviceToken(deviceToken)

// application(_:didReceiveRemoteNotification:fetchCompletionHandler:)
if AlgorithmXReactNative.handleRemoteNotification(
    userInfo, completionHandler: completionHandler
) { return }
// Your existing handling for other providers; it must finish completionHandler.

// userNotificationCenter(_:willPresent:withCompletionHandler:)
if AlgorithmXReactNative.handleForegroundNotification(
    notification, completionHandler: completionHandler
) { return }
// Your existing presentation handling for other providers.

// userNotificationCenter(_:didReceive:withCompletionHandler:)
if AlgorithmXReactNative.handleNotificationResponse(
    response, completionHandler: completionHandler
) { return }
// Your existing response handling for other providers.
```

The message/response helpers return `false` without calling the completion handler for another provider's notification. When they return `true`, AlgorithmX calls the completion handler; do not call it again. Foreground presentation defaults to banner, list, and sound; supply `presentationOptions` to customize it. Forward Apple's `Data` token directly; the helper converts it to hexadecimal text.

If the app has no existing handling after a `false` result, finish with `.noData` for a background message, your chosen presentation options for foreground, or `completionHandler()` for a response. Libraries that manage notification delegates need an integration that preserves these callbacks.

Notification tap destinations are implemented once in JavaScript with `onDeepLink`, `onCustomAction`, and `onActionButton`. Keep `onNotificationClick` for observation so the same tap does not navigate twice. Register listeners at app startup, and wait for your navigator to be ready before opening a destination.

## SDK HTTP endpoints

API URLs are the initialized `apiBaseUrl` plus the paths below. Every SDK API request includes the `x-partner-id` header containing the initialized partner ID.

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/v1/identify` | Identify the customer and send optional attributes. |
| `POST` | `/api/v1/tracks/{eventName}` | Send a custom event with its original name and payload. |
| `POST` | `/api/v1/tracks/algoViewInteract` | Report campaign and push interactions. |
| `PUT` | `/api/v1/inAppPushEvents/device/status` | Update notification delivery or open status. |
| `POST` | `/api/v1/notificationTokens` | Register a push token for the current customer. |

`{eventName}` is the custom name supplied to `trackEvent`; the SDK keeps it unchanged. Campaign HTML and notification images are downloaded with `GET` from their supplied URLs, so those downloads have no fixed SDK path. Campaign HTML may also load its own resources. A caller-supplied campaign interaction `endpoint` overrides the default interaction path.

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
