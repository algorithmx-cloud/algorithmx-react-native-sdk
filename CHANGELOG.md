# Changelog

## 1.1.1 — October 18, 2026

- The optional React Native Firebase adapter registers current and refreshed FCM tokens on iOS as well as Android. It registers for remote messages first when iOS registration is disabled.
- Keep iOS message handling in the host's native callbacks to avoid processing a notification twice. Existing Android foreground forwarding and cleanup behavior are preserved.
- Document Firebase token forwarding for both platforms. Native AlgorithmX SDK requirements remain 1.1.0; Firebase remains optional for consumers of the main package.

## 1.1.0 — October 13, 2026

- Production API-based in-app delivery requires the backend work tracked in [AlgorithmX issue #207](https://github.com/algorithmx-cloud/AlgorithmX/issues/207). SDK flows were verified on physical Android and iOS devices against the local test backend.

- Expo Android startup keeps API-based in-app views available when Firebase is not configured; FCM token registration is conditional on a default Firebase app.
- API-based in-app views now work across Android, iOS, React Native/Expo and Flutter. Fetch automatically on startup/foreground and identity changes, with device/app language, anonymous/device UUID headers, and ExternalId as customerId after identify.
- Inline HTML/CSS/JS, translated text/placeholders/RTL, fractional stable allocation, local account-based history, priority/frequency/expiry and enter-time delay are shared across native implementations. Legacy silent in-app triggers are ignored; visible push and manual previews remain separate.
- API-view interactions use the backend's Event/Log contract with string UUIDs and the identity captured at display time. Ordered GETs, bounded 409/network retries and connectivity recovery minimise host integration work.

- Generate and persist anonymous and installation device UUIDs inside the SDK. Bootstrap the profile through `/api/v1/Identity/Bootstrap`.
- Identify through `/api/v1/Identity` using `anonymousId` and trusted identifiers: ExternalId, Email, Phone and UserName. Login preserves the anonymous UUID; logout/account switching creates a new one and clears waiting campaigns.
- Map supported customer traits to `/api/v1/Customer/Ingest` with profile headers. Add `setUserProfile` and `getAnonymousId`; reject unsupported profile fields. Customer ingestion replaces the complete set of supported fields.
- Send events with the anonymous UUID after login; keep account IDs separate. Serialize SDK HTTP requests in call order. The backend processes accepted requests asynchronously on separate queues.
- Legacy `setDeviceFingerprint` now accepts only anonymous UUIDs. Native dependency requirements are 1.1.0.

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
