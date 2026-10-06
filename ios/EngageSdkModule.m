#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

/**
 * Exposes the Swift EngageSdkModule (EngageSdkBridge.swift) to React Native.
 * Selectors here must match the @objc names in the Swift file.
 */
@interface RCT_EXTERN_MODULE(EngageSdkModule, RCTEventEmitter)

RCT_EXTERN_METHOD(connect:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setLoggingEnabled:(BOOL)enabled)

RCT_EXTERN_METHOD(configure:(NSString *)apiBaseUrl
                  partnerId:(NSString *)partnerId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setDeviceFingerprint:(NSString *)fingerprint)
RCT_EXTERN_METHOD(getDeviceFingerprint:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(identify:(NSString *)userId attributes:(NSDictionary *)attributes)
RCT_EXTERN_METHOD(resetIdentity)
RCT_EXTERN_METHOD(trackEvent:(NSString *)name payload:(NSDictionary *)payload)
RCT_EXTERN_METHOD(trackCampaignInteraction:(NSString *)campaignId
                  variationId:(NSString *)variationId
                  interactionType:(NSString *)interactionType
                  payload:(NSDictionary *)payload
                  sessionId:(NSString *)sessionId)
RCT_EXTERN_METHOD(updateNotificationStatus:(NSInteger)notificationId
                  status:(NSInteger)status
                  errorMessage:(NSString *)errorMessage)

RCT_EXTERN_METHOD(registerDeviceToken:(NSString *)token)
RCT_EXTERN_METHOD(handleRemoteMessage:(NSDictionary *)data
                  title:(NSString *)title
                  body:(NSString *)body
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(handleSilentNotification:(NSDictionary *)userInfo)
RCT_EXTERN_METHOD(handleNotificationResponse:(NSString *)actionIdentifier userInfo:(NSDictionary *)userInfo)

RCT_EXTERN_METHOD(triggerWebView:(NSString *)campaignId
                  webviewUrl:(NSString *)webviewUrl
                  dynamicContent:(NSDictionary *)dynamicContent)

RCT_EXTERN_METHOD(getQueueSize:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getWebViewQueueSize:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(clearWebViewQueue:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(clearAllWebViewData:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getDisplayStats:(NSString *)campaignId
                  variationId:(NSString *)variationId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
