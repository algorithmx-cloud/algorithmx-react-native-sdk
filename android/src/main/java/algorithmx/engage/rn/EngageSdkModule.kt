package algorithmx.engage.rn

import android.app.Application
import algorithmx.engage.core.AlgorithmX
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

/**
 * React Native ↔ AlgorithmX bridge (Android). JS name: "EngageSdkModule".
 * Native callbacks reach JS through [EventBridge] as device events.
 */
class EngageSdkModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "EngageSdkModule"

    // JS `init`. Mirrors the iOS selector name.
    @ReactMethod
    fun configure(apiBaseUrl: String, promise: Promise) {
        val app = reactContext.applicationContext as Application
        if (AlgorithmXReactNative.initialize(app, apiBaseUrl)) {
            promise.resolve(null)
        } else {
            promise.reject("E_INIT", "AlgorithmX is already initialized with a different apiBaseUrl")
        }
    }

    // ─── Identity & events ──────────────────────────────────────────────────

    @ReactMethod
    fun setDeviceFingerprint(fingerprint: String) = AlgorithmX.setDeviceFingerprint(fingerprint)

    @ReactMethod
    fun getDeviceFingerprint(promise: Promise) = promise.resolve(AlgorithmX.getDeviceFingerprint())

    @ReactMethod
    fun identify(userId: String, attributes: ReadableMap) =
        AlgorithmX.identifyUser(userId, attributes.toMap().ifEmpty { null })

    @ReactMethod
    fun resetIdentity() = AlgorithmX.resetIdentity()

    @ReactMethod
    fun trackEvent(name: String, payload: ReadableMap) =
        AlgorithmX.trackEvent(name, payload.toMap().ifEmpty { null })

    @ReactMethod
    fun trackCampaignInteraction(
        campaignId: String,
        variationId: String,
        interactionType: String,
        payload: ReadableMap,
        sessionId: String?
    ) = AlgorithmX.trackCampaignInteraction(
        campaignId, variationId, interactionType, payload.toMap().ifEmpty { null }, sessionId
    )

    @ReactMethod
    fun updateNotificationStatus(notificationId: Double, status: Double, errorMessage: String?) {
        val value = AlgorithmX.NotificationEventStatus.values().firstOrNull { it.value == status.toInt() } ?: return
        AlgorithmX.updateNotificationStatus(notificationId.toInt(), value, errorMessage)
    }

    // ─── Push ───────────────────────────────────────────────────────────────

    @ReactMethod
    fun registerDeviceToken(token: String) = AlgorithmX.registerDeviceToken(token)

    /** For apps that receive FCM in JS (e.g. @react-native-firebase/messaging). */
    @ReactMethod
    fun handleFcmMessage(data: ReadableMap, notificationTitle: String?, notificationBody: String?) {
        val strings = data.toMap().mapValues { it.value.toString() }
        AlgorithmX.handleFcmMessage(reactContext.applicationContext, strings, notificationTitle, notificationBody)
    }

    // ─── WebView campaigns ─────────────────────────────────────────────────

    @ReactMethod
    fun triggerWebView(campaignId: String, webviewUrl: String, dynamicContent: ReadableMap) =
        AlgorithmX.triggerWebView(reactContext.applicationContext, campaignId, webviewUrl, dynamicContent.toMap().ifEmpty { null })

    // ─── Diagnostics ───────────────────────────────────────────────────────

    @ReactMethod
    fun getQueueSize(promise: Promise) = promise.resolve(AlgorithmX.getQueueSize())

    @ReactMethod
    fun getWebViewQueueSize(promise: Promise) = promise.resolve(AlgorithmX.getWebViewQueueSize())

    @ReactMethod
    fun clearWebViewQueue(promise: Promise) = promise.resolve(AlgorithmX.clearWebViewQueue())

    @ReactMethod
    fun clearAllWebViewData(promise: Promise) = promise.resolve(AlgorithmX.clearAllWebViewData())

    @ReactMethod
    fun getDisplayStats(campaignId: String, variationId: String, promise: Promise) =
        promise.resolve(AlgorithmX.getDisplayStats(campaignId, variationId))

    // ─── NativeEventEmitter contract ───────────────────────────────────────

    @ReactMethod
    fun addListener(@Suppress("UNUSED_PARAMETER") eventName: String) = EventBridge.listenerAdded(reactContext)

    @ReactMethod
    fun removeListeners(count: Double) = EventBridge.listenersRemoved(count.toInt())
}

private fun ReadableMap.toMap(): Map<String, Any> =
    toHashMap().filterValues { it != null }.mapValues { it.value!! }
