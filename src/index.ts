/**
 * @algorithmxcloud/react-native-sdk
 * AlgorithmX SDK for React Native
 *
 * Wrapper around the native Android (Kotlin) and iOS (Swift) AlgorithmX SDKs.
 *
 * ─── QUICK START ────────────────────────────────────────────────────────────
 *
 * 1. Initialise natively at launch (so pushes that start the app are handled):
 *      iOS      AlgorithmXReactNative.initialize(apiBaseUrl:partnerId:)  in AppDelegate
 *      Android  AlgorithmXReactNative.initialize(app, url, partnerId)    in Application.onCreate
 *    then register listeners and connect JS to the native configuration:
 *      import AlgorithmX from '@algorithmxcloud/react-native-sdk';
 *      AlgorithmX.addListener('onDeepLink', ({ url }) => { ... });
 *      await AlgorithmX.init();
 *
 * 2. Identify the user after login:
 *      AlgorithmX.identify('user-123');
 *
 * 3. Pass FCM/APNs tokens (usually from native code):
 *      AlgorithmX.registerDeviceToken(token);
 *
 * Integration guide: https://algorithmx.cloud/en/docs/integrations/react-native
 */

import {
  NativeModules,
  NativeEventEmitter,
  Platform,
  EmitterSubscription,
} from 'react-native';

// ─── Native module ref ────────────────────────────────────────────────────────

const { EngageSdkModule } = NativeModules;

if (!EngageSdkModule) {
  throw new Error(
    '[AlgorithmX] Native module not found.\n' +
      'Rebuild the app after installing @algorithmxcloud/react-native-sdk.\n' +
      'iOS: add the AlgorithmXSDK pod to your Podfile and run `pod install`.'
  );
}

const emitter = new NativeEventEmitter(EngageSdkModule);

// ─── Types ────────────────────────────────────────────────────────────────────

export type SdkData = Record<string, unknown>;

/** Compatible with Firebase's remote messages without requiring Firebase in this package. */
export interface RemoteMessage {
  data?: Record<string, string | object>;
  notification?: { title?: string; body?: string };
  messageId?: string;
  from?: string;
  sentTime?: number;
}

export interface TrackPayload {
  [key: string]: string | number | boolean | object | null;
}

export interface WebViewTriggerEvent {
  campaignId: string;
  url: string;
  dynamicContent: SdkData;
}

export interface CustomActionEvent {
  action: string | null;
  data: SdkData;
}

export interface ActionHandledEvent {
  action: string;
  data: SdkData;
}

export interface DeepLinkEvent {
  url: string;
}

export interface ActionButtonEvent {
  buttonId: string;
  actionText: string;
  title: string;
  notificationData: SdkData;
}

export interface CampaignInteractionEvent {
  campaignId: string;
  variationId: string;
  interactionType: string;
  payload: SdkData;
}

/**
 * Native callbacks. Return values are fixed natively because JS cannot answer
 * synchronously: a notification tap still runs the SDK's default action
 * routing, while deep links, custom actions and action buttons are left to JS.
 */
export type AlgorithmXEventMap = {
  onWebViewTrigger: WebViewTriggerEvent;
  onNotificationClick: SdkData;
  onCustomAction: CustomActionEvent;
  onActionHandled: ActionHandledEvent;
  onDeepLink: DeepLinkEvent;
  onActionButton: ActionButtonEvent;
  onCampaignInteraction: CampaignInteractionEvent;
};

/** Values match the backend's notification status enum. */
export enum NotificationStatus {
  Sent = 1,
  Delivered = 2,
  Opened = 3,
  FailedToSend = 4,
  FailedToDeliver = 5,
}

const EVENT_NAMES: (keyof AlgorithmXEventMap)[] = [
  'onWebViewTrigger',
  'onNotificationClick',
  'onCustomAction',
  'onActionHandled',
  'onDeepLink',
  'onActionButton',
  'onCampaignInteraction',
];

// ─── SDK object ───────────────────────────────────────────────────────────────

function init(): Promise<void>;
function init(apiBaseUrl: string, partnerId: string): Promise<void>;
function init(apiBaseUrl?: string, partnerId?: string): Promise<void> {
  if (apiBaseUrl === undefined && partnerId === undefined) {
    return EngageSdkModule.connect();
  }
  if (typeof apiBaseUrl !== 'string' || typeof partnerId !== 'string') {
    return Promise.reject(new Error('Pass both apiBaseUrl and partnerId, or call AlgorithmX.init() after native startup'));
  }
  return EngageSdkModule.configure(apiBaseUrl, partnerId);
}

const AlgorithmX = {
  /**
   * Connect to the SDK started natively, without repeating its configuration.
   * The existing init(apiBaseUrl, partnerId) form remains supported.
   */
  init,

  /** Debug logging. Errors remain visible when logging is disabled. */
  setLoggingEnabled(enabled: boolean): void {
    EngageSdkModule.setLoggingEnabled(enabled);
  },

  // ─── Identity & events ─────────────────────────────────────────────────────

  /** Override the device fingerprint (defaults to IDFV / ANDROID_ID). */
  setDeviceFingerprint(fingerprint: string): void {
    EngageSdkModule.setDeviceFingerprint(fingerprint);
  },

  getDeviceFingerprint(): Promise<string | null> {
    return EngageSdkModule.getDeviceFingerprint();
  },

  /**
   * Identify the current user. Call after login. The native SDKs use the user id
   * as the fingerprint for later calls and keep it across restarts until
   * `resetIdentity()`.
   */
  identify(userId: string, attributes?: TrackPayload): void {
    EngageSdkModule.identify(userId, attributes ?? {});
  },

  /**
   * Forget the identified user (e.g. on logout); events go back to the device id.
   * The native SDKs keep `identify` across app restarts until this is called.
   */
  resetIdentity(): void {
    EngageSdkModule.resetIdentity();
  },

  /** Recommend camelCase names and payload keys; custom data is forwarded unchanged. */
  trackEvent(name: string, payload?: TrackPayload): void {
    EngageSdkModule.trackEvent(name, payload ?? {});
  },

  /**
   * Track a campaign interaction. `interactionType` must be one of
   * impression, click, close, closeDismiss, submit, copy. Campaign and
   * variation ids should be numeric strings (the backend expects ints).
   */
  trackCampaignInteraction(
    campaignId: string,
    variationId: string,
    interactionType: string,
    payload?: TrackPayload,
    sessionId?: string
  ): void {
    EngageSdkModule.trackCampaignInteraction(
      campaignId,
      variationId,
      interactionType,
      payload ?? {},
      sessionId ?? null
    );
  },

  updateNotificationStatus(
    notificationId: number,
    status: NotificationStatus,
    errorMessage?: string
  ): void {
    EngageSdkModule.updateNotificationStatus(notificationId, status, errorMessage ?? null);
  },

  // ─── Push ──────────────────────────────────────────────────────────────────

  /** Register an FCM (Android) or APNs hex (iOS) token with the backend. */
  registerDeviceToken(token: string): void {
    EngageSdkModule.registerDeviceToken(token);
  },

  /**
   * Forward a remote message and await native processing. Returns true for an
   * AlgorithmX message, false for another provider's message. Forward through
   * only one path: do not call this for a message already handled natively.
   */
  async handleRemoteMessage(message: RemoteMessage): Promise<boolean> {
    const data: Record<string, string> = Object.create(null);
    for (const [key, value] of Object.entries(message.data ?? {})) {
      data[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    return EngageSdkModule.handleRemoteMessage(
      data,
      message.notification?.title ?? null,
      message.notification?.body ?? null
    );
  },

  /**
   * (Android) Forward an FCM message received in JS, e.g. from
   * @react-native-firebase/messaging. Not needed when a native
   * FirebaseMessagingService forwards to AlgorithmX.handleFcmMessage.
   */
  handleFcmMessage(
    data: Record<string, string>,
    notificationTitle?: string,
    notificationBody?: string
  ): void {
    if (Platform.OS === 'android') {
      EngageSdkModule.handleFcmMessage(data, notificationTitle ?? null, notificationBody ?? null);
    }
  },

  /**
   * (iOS) Forward an APNs payload received in JS. The usual wiring is the
   * AppDelegate calling `AlgorithmX.shared.handleNotification` directly.
   */
  handleSilentNotification(userInfo: SdkData): void {
    if (Platform.OS === 'ios') {
      EngageSdkModule.handleSilentNotification(userInfo);
    }
  },

  /** (iOS) Forward a notification tap / action button handled in JS. */
  handleNotificationResponse(actionIdentifier: string, userInfo: SdkData): void {
    if (Platform.OS === 'ios') {
      EngageSdkModule.handleNotificationResponse(actionIdentifier, userInfo);
    }
  },

  // ─── WebView campaigns ─────────────────────────────────────────────────────

  /** Show a campaign WebView immediately (testing / previews). */
  triggerWebView(campaignId: string, webviewUrl: string, dynamicContent?: Record<string, string>): void {
    EngageSdkModule.triggerWebView(campaignId, webviewUrl, dynamicContent ?? {});
  },

  // ─── Diagnostics ───────────────────────────────────────────────────────────

  /** Same as getWebViewQueueSize: campaigns waiting to be shown. */
  getQueueSize(): Promise<number> {
    return EngageSdkModule.getQueueSize();
  },

  /** Number of WebView campaigns waiting to be shown. */
  getWebViewQueueSize(): Promise<number> {
    return EngageSdkModule.getWebViewQueueSize();
  },

  /** Remove queued (not yet shown) campaigns. Resolves with the number removed. */
  clearWebViewQueue(): Promise<number> {
    return EngageSdkModule.clearWebViewQueue();
  },

  /** Clear the queue and display history. Debug/testing only. */
  clearAllWebViewData(): Promise<boolean> {
    return EngageSdkModule.clearAllWebViewData();
  },

  /** Human-readable display-rule state for one campaign variation. */
  getDisplayStats(campaignId: string, variationId: string): Promise<string> {
    return EngageSdkModule.getDisplayStats(campaignId, variationId);
  },

  // ─── Event listeners ───────────────────────────────────────────────────────

  /** Subscribe to a native SDK callback. Call `.remove()` to unsubscribe. */
  addListener<K extends keyof AlgorithmXEventMap>(
    event: K,
    handler: (payload: AlgorithmXEventMap[K]) => void
  ): EmitterSubscription {
    return emitter.addListener(event, handler as (payload: unknown) => void);
  },

  /** Remove all listeners for one event, or for every SDK event. */
  removeAllListeners(event?: keyof AlgorithmXEventMap): void {
    (event ? [event] : EVENT_NAMES).forEach((e) => emitter.removeAllListeners(e));
  },
};

export default AlgorithmX;
