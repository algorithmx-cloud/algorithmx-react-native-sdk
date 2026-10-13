# AlgorithmX React Native SDK

## API-based in-app views

**Production backend support is pending:** the .NET in-app delivery route must be implemented as described in [AlgorithmX issue #207](https://github.com/algorithmx-cloud/AlgorithmX/issues/207). Current device tests use `in-app-test-backend`; no .NET implementation is included in this SDK update.

In-app campaigns use the API in SDK 1.1.0. Initialise the SDK and identify a signed-in customer; no campaign-fetch code, silent push, push token, or notification permission is needed for this flow.

1. The SDK bootstraps its anonymous profile and device automatically.
2. On startup or returning to the foreground, it calls `GET /api/v1/inAppViews?language=...&customerId=...`.
3. The backend checks the customer's segment, campaign publication/schedule and language, and returns eligible inline HTML, CSS, JavaScript, translations and variation parameters.
4. The SDK selects a stable variation, applies priority, frequency, expiry and app-enter delay, and displays at most one campaign per visit. The template supplies its close button; Android also supports Back.

The SDK supplies `X-Partner-Id`, its persistent UUID in `X-Anonymous-Id`, and the installation UUID in `X-Device-Id`. Before login, `customerId` is the anonymous UUID. After `identify` / `identifyUser`, it is your application's account ID, stored by AlgorithmX as `ExternalId`. The backend resolves the internal profile ID; your app does not pass an AlgorithmX profile UUID. Identification, logout and account changes invalidate old campaign requests and content. Signed-in variation selection and local display history use the account ID.

Language defaults to the device/app language. Override it only when your app has its own language selector:

```ts
AlgorithmX.setInAppLanguage('ar');
```

An empty language override restores the automatic default. Arabic, Hebrew, Persian and Urdu translations use RTL layout; text and placeholder translations are applied from the template's `builderState.translations`.

**First check:** publish an active campaign that matches your test customer's segment and language, open the app, and confirm the GET request and impression. Leave the app and return to check another visit. Impressions, clicks, submits, copies and closes are logged through `POST /api/v1/Event/Log` as `inAppViewInteraction`; campaign and variation UUIDs remain strings.

The automatic mobile flow supports app-enter campaigns and an optional time delay. Browser URL/scroll/exit/inactivity rules and custom triggers are excluded by the backend from this automatic feed. Display history is stored on the installation; this is not a global cross-device frequency counter.

GET requests follow queued identity/profile POSTs. When identity is still processing (`409`), the SDK retries up to three times, and it retries again when connectivity returns or the app re-enters the foreground. Normal event/profile requests remain fire-and-forget. The old silent-push `algoTriggerWebview` is ignored. Visible push notifications retain their separate integration.


> **SDK 1.1.0:** these APIs use SDK-generated anonymous/device IDs and API-based in-app delivery. Existing 1.0.x integrations should follow the updated identity and profile instructions below.

## Customer identity and profile data

The SDK generates and stores an anonymous UUID and a separate installation device UUID during startup. You do not generate either ID or call the bootstrap endpoint yourself. The anonymous UUID stays the same across app restarts and login; events continue to use it in `X-Anonymous-Id`.

Use the stable account ID from your application's backend when the customer signs in. The SDK sends it as `ExternalId`, allowing AlgorithmX to resolve the same customer across devices. AlgorithmX manages its own internal profile ID.

Call the identity function after login and when starting with a signed-in customer. Email and phone become trusted identifiers; supported profile fields are sent separately to `/Customer/Ingest`.

```ts
AlgorithmX.identify('customer_123', {
  email: 'amina@example.com',
  firstName: 'Amina', lastName: 'Hassan',
  emailOptIn: true, smsOptIn: false, pushOptIn: true,
  gdprAccepted: true, whatsAppOptIn: false,
});
```

Supported identifier fields are `email`, `phone`, and `userName`; your application's `userId` becomes `ExternalId`. Supported profile fields are `firstName`, `lastName`, `gender`, `dateOfBirth`, `registeredAt`, `emailOptIn`, `smsOptIn`, `pushOptIn`, `gdprAccepted`, and `whatsAppOptIn`. Send dates as ISO 8601 text and consent fields as booleans.

**Send a complete profile.** `/Customer/Ingest` replaces these traits: omitted text/date fields are cleared and omitted consent fields become `false`. Include all current values whenever you send profile fields through `identify` / `identifyUser` or `setUserProfile`. An identify call containing only identifiers does not send a profile update.

Fields such as `plan`, `language`, `country`, and `loyaltyTier` are not supported customer traits by these endpoints. The SDK rejects unsupported fields. Send arbitrary business data with `trackEvent`; that records event data and does not create custom profile fields.

To update profile fields later, pass `profile`, your application's complete current customer profile object, without email, phone, or userName:

```ts
AlgorithmX.setUserProfile(profile);
```

On logout:

```ts
AlgorithmX.resetIdentity();
```

Logout clears waiting campaigns, generates a fresh anonymous UUID and bootstraps a new anonymous profile. The installation's device UUID is retained. Calling identify with a different account ID also rotates the anonymous UUID first, preventing the two accounts from being merged. Close any campaign already on screen as part of your app's logout flow.

To inspect the SDK-generated UUID for diagnostics:

```ts
const anonymousId = await AlgorithmX.getAnonymousId();
```

The SDK remembers the external account ID across restarts. These calls do not replace your application's authentication. API requests are sent in order, but the backend responds with `202 Accepted` and processes messages asynchronously; confirm the stored customer data in AlgorithmX. Offline event/profile requests are dropped. Bootstrap and saved account identification are attempted again on startup/foreground; profile updates must be sent again by your app if delivery failed.

**Check:** the customer can be found using the external ID/email you supplied, and the anonymous UUID is unchanged after login. After logout or switching accounts, it changes.


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

> These integration improvements are included in SDK 1.0.3. Earlier builds with version 1.0.1 do not include them.

## Installation

```bash
npm install @algorithmxcloud/react-native-sdk
```

**Android:** nothing else. The native SDK comes from Maven Central.

**iOS:** add the native SDK pod to your app target in `ios/Podfile`, then run `pod install`:

```ruby
pod 'AlgorithmXSDK', :git => 'https://github.com/algorithmx-cloud/algorithmx-ios-sdk.git', :tag => '1.1.0'
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
  AlgorithmX.identify('customer_123', { email: 'amina@example.com' });
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
| `GET` | `/api/v1/inAppViews` | Fetch inline campaigns with automatic identity/language/device headers. |
| `POST` | `/api/v1/Identity/Bootstrap` | Bootstrap the SDK-generated anonymous/device UUIDs. |
| `POST` | `/api/v1/Identity` | Link ExternalId, Email, Phone or UserName to the anonymous profile. |
| `POST` | `/api/v1/Customer/Ingest` | Replace supported customer traits. |
| `POST` | `/api/v1/Event/Log` | Send a custom event as an array with its original name and data. |
| `POST` | `/api/v1/tracks/algoViewInteract` | Report campaign and push interactions. |
| `PUT` | `/api/v1/inAppPushEvents/device/status` | Update notification delivery or open status. |
| `POST` | `/api/v1/notificationTokens` | Register a push token for the current customer. |

`trackEvent` keeps the custom name unchanged in `eventType`. General events use `POST /api/v1/Event/Log`, a one-event array body, ISO 8601 UTC timestamps, and `X-Anonymous-Id` containing the SDK-generated anonymous UUID, including after login. `data` contains properties or `{}`; `x-partner-id` is also required. Campaign HTML and notification images are downloaded with `GET` from their supplied URLs, so those downloads have no fixed SDK path. Campaign HTML may also load its own resources. A caller-supplied campaign interaction `endpoint` overrides the default interaction path.

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
