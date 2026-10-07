# Changelog

## 1.0.3

- General `trackEvent` requests now use `POST /api/v1/Event/Log` with an array of `{ eventType, data, timestamp }` events and ISO 8601 UTC timestamps. Empty properties are sent as `{}`.
- Event requests send the current SDK fingerprint in `X-Anonymous-Id`, alongside `x-partner-id`. Event names and custom data retain their supplied spelling.
- Campaign/push interaction, identity, notification-status, and push-token endpoints retain their existing contracts.
- Requires native Android/iOS SDK 1.0.3; the Expo plugin installs the 1.0.3 iOS tag.

## 1.0.2

- Added an optional Expo SDK 55 / Expo Notifications integration: build-time configuration, early native startup, platform token registration, iOS callback composition, and a single Android FCM service preserving unrelated Expo messages. Config plugin transforms are idempotent and reject an existing custom Android FCM owner.

- Added `AlgorithmX.init()` to connect to native startup without repeating the URL and partner ID in JavaScript. The existing two-argument form remains supported; missing native startup rejects with `E_INIT`.
- Added JavaScript `setLoggingEnabled` and awaitable `handleRemoteMessage`. Push forwarding returns whether the native SDK owns the message, uses existing native payload normalization, and preserves custom keys and nested Firebase data.
- Added native React Native push helpers for Android message ownership and iOS APNs token conversion, background delivery, foreground presentation, and notification responses. iOS ownership checks leave other providers' completion handlers untouched.
- Added the optional `/firebase` entry for React Native Firebase's modular API: Android foreground handling, current/refresh token registration, explicit background forwarding, error reporting, and listener cleanup. iOS keeps native APNs forwarding to avoid duplicate processing and FCM/APNs token confusion.

- Fixed notification endpoints now use `/api/v1/inAppPushEvents/device/status` and `/api/v1/notificationTokens` instead of `/api/v1/in-app-push-events/device/status` and `/api/v1/notification-tokens`. The backend must accept the new routes before this SDK release; the local test backend retains the previous routes as aliases. The `x-partner-id` header stays unchanged.
- SDK-defined tracking fields, push fields, built-in events, and action names now use camelCase. Campaign interactions use `/api/v1/tracks/algoViewInteract` and camelCase fields; `payload` remains a JSON string. The backend must support this contract before release.
- Previous fixed push keys/action names and campaign bridge events remain accepted on input. Custom event names, payload keys, nested data, action text, and titles retain their supplied spelling; camelCase is recommended in the guides.
- WebView impression personalization is emitted in a `dynamicContent` object containing the original custom keys and their text values.

## 1.0.1

- **Breaking:** the partner ID that AlgorithmX gives you is now required everywhere you start the SDK: `AlgorithmXReactNative.initialize(application, apiBaseUrl, partnerId)` (Android), `AlgorithmXReactNative.initialize(apiBaseUrl:partnerId:)` and `initialize(apiBaseUrl:partnerId:appGroup:)` (iOS), and `AlgorithmX.init(apiBaseUrl, partnerId)` (JavaScript). `init` rejects with `E_INIT` when the partner ID differs from the native one.
- The SDK sends the partner ID in the `x-partner-id` header of every request. Uses `cloud.algorithmx:android-sdk:1.0.1`; the iOS bridge pod requires `AlgorithmXSDK` 1.0.1 or later, so the app's Podfile must use `:tag => '1.0.1'`.

## 1.0.0

- First public release on npm as `@algorithmxcloud/react-native-sdk` (previously the unpublished `react-native-engage-sdk`).
- The default export is now named `AlgorithmX` in the examples, and the event map type is `AlgorithmXEventMap`.
- Android uses `cloud.algorithmx:android-sdk:1.0.0` from Maven Central; apps no longer include an `:android-sdk` module.
- The iOS bridge pod is `AlgorithmXReactNativeSDK` and depends on the `AlgorithmXSDK` pod (previously `EngageRnSdk` and `EngageSDK`).
- The package ships compiled JavaScript and type definitions in `lib/`.
