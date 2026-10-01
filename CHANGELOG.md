# Changelog

## 1.0.0

- First public release on npm as `@algorithmxcloud/react-native-sdk` (previously the unpublished `react-native-engage-sdk`).
- The default export is now named `AlgorithmX` in the examples, and the event map type is `AlgorithmXEventMap`.
- Android uses `cloud.algorithmx:android-sdk:1.0.0` from Maven Central; apps no longer include an `:android-sdk` module.
- The iOS bridge pod is `AlgorithmXReactNativeSDK` and depends on the `AlgorithmXSDK` pod (previously `EngageRnSdk` and `EngageSDK`).
- The package ships compiled JavaScript and type definitions in `lib/`.
