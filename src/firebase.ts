/** Optional integration. Import this entry only when React Native Firebase is installed. */
import { Platform } from 'react-native';
import AlgorithmX, { RemoteMessage } from './index';

/** Shared shape of the namespaced and modular Firebase messaging instances. */
export interface FirebaseMessagingInstance {
  readonly app: { readonly name: string };
}

// Keep Firebase types out of the public declarations: importing the main SDK
// must not require Firebase. Metro resolves this optional entry in RN apps.
const { getMessaging, getToken, onMessage, onTokenRefresh } = require('@react-native-firebase/messaging') as {
  getMessaging(): FirebaseMessagingInstance;
  getToken(messaging: FirebaseMessagingInstance): Promise<string>;
  onMessage(messaging: FirebaseMessagingInstance, listener: (message: RemoteMessage) => void | Promise<void>): () => void;
  onTokenRefresh(messaging: FirebaseMessagingInstance, listener: (token: string) => void): () => void;
};

export interface FirebaseMessagingOptions {
  /** Use the app's existing instance, or the default Firebase app when omitted. */
  messaging?: FirebaseMessagingInstance;
  /** Called for foreground messages belonging to other providers on Android. */
  onOtherMessage?: (message: RemoteMessage) => void | Promise<void>;
  /** Errors from listeners; startup errors reject the connection's ready promise. */
  onError?: (error: unknown) => void;
}

export interface FirebaseMessagingConnection {
  /** Await once at app startup. Does not request notification permission. */
  ready: Promise<void>;
  /** Register the current Android FCM token again, for example after permission changes. */
  refreshToken(): Promise<void>;
  /** Removes foreground/token listeners. The app still owns its background handler. */
  remove(): void;
}

/**
 * Use in the app's existing Firebase background handler. iOS uses native APNs
 * callbacks, so it is deliberately not forwarded again from JavaScript.
 */
export async function handleFirebaseMessage(message: RemoteMessage): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  return AlgorithmX.handleRemoteMessage(message);
}

/**
 * Connect Android foreground messages and FCM tokens. On iOS keep the native
 * AlgorithmXReactNative push helpers; Firebase's iOS token is not an APNs token.
 * Call once at app startup, outside screen components. Never replaces the app's
 * background handler or installs a second native messaging service.
 */
export function connectFirebaseMessaging(options: FirebaseMessagingOptions = {}): FirebaseMessagingConnection {
  const messaging = options.messaging ?? getMessaging();
  let active = true;
  const subscriptions: (() => void)[] = [];
  const reportError = options.onError ?? ((error: unknown) => console.warn('[AlgorithmX] Firebase integration failed', error));

  async function refreshToken() {
    if (!active || Platform.OS !== 'android') return;
    await AlgorithmX.init();
    const token = await getToken(messaging);
    if (active && token) AlgorithmX.registerDeviceToken(token);
  }

  function remove() {
    if (!active) return;
    active = false;
    subscriptions.forEach((unsubscribe) => unsubscribe());
  }

  if (Platform.OS === 'android') {
    subscriptions.push(onMessage(messaging, async (message) => {
      if (!active) return;
      try {
        if (await handleFirebaseMessage(message)) return;
        if (active) await options.onOtherMessage?.(message);
      } catch (error) {
        reportError(error);
      }
    }));
    subscriptions.push(onTokenRefresh(messaging, (token) => {
      if (!active || !token) return;
      AlgorithmX.init().then(() => {
        if (active) AlgorithmX.registerDeviceToken(token);
      }).catch(reportError);
    }));
  }

  const ready = AlgorithmX.init().then(refreshToken).catch((error) => {
    remove();
    throw error;
  });
  return { ready, refreshToken, remove };
}
