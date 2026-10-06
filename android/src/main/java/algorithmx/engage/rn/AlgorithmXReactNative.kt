package algorithmx.engage.rn

import android.app.Activity
import android.app.Application
import android.content.Context
import android.net.Uri
import android.os.Bundle
import android.util.Log
import algorithmx.engage.activities.NotificationClickActivity
import algorithmx.engage.core.AlgorithmX
import algorithmx.engage.interfaces.ActionButtonHandler
import algorithmx.engage.interfaces.AlgoWebViewListener
import algorithmx.engage.interfaces.CampaignInteractionListener
import algorithmx.engage.interfaces.DeepLinkHandler
import algorithmx.engage.interfaces.NotificationClickListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap

/**
 * Initializes the native SDK exactly once. `AlgorithmX.initialize` is not
 * idempotent (it registers the activity lifecycle callbacks each time), so both
 * the host Application and the JS `init` call go through here.
 *
 * Call it from `Application.onCreate` so an FCM message that starts the process
 * is handled before JavaScript runs.
 */
object AlgorithmXReactNative {
    private var configuredUrl: String? = null
    private var configuredPartnerId: String? = null

    @JvmStatic
    @Synchronized
    fun isInitialized(): Boolean = configuredUrl != null

    /**
     * Returns false if a value is blank, or the SDK was already initialized with a
     * different URL or partner ID. [partnerId] is sent as the `x-partner-id` header.
     */
    @JvmStatic
    @Synchronized
    fun initialize(application: Application, apiBaseUrl: String, partnerId: String): Boolean {
        val url = apiBaseUrl.trimEnd('/')
        if (url.isBlank() || partnerId.isBlank()) return false
        configuredUrl?.let { return it == url && configuredPartnerId == partnerId }
        AlgorithmX.initialize(application, url, partnerId)
        EventBridge.attachToSdk()
        application.registerActivityLifecycleCallbacks(ForegroundTracker)
        configuredUrl = url
        configuredPartnerId = partnerId
        return true
    }

    /** Returns false without touching messages belonging to another provider. */
    @JvmStatic
    fun handleFcmMessage(
        context: Context,
        data: Map<String, String>,
        notificationTitle: String? = null,
        notificationBody: String? = null
    ): Boolean {
        if (!AlgorithmX.isAlgorithmXPush(data)) return false
        check(isInitialized()) { "Initialize AlgorithmXReactNative in Application.onCreate before handling push" }
        AlgorithmX.handleFcmMessage(context, data, notificationTitle, notificationBody)
        return true
    }

    @JvmStatic
    fun registerDeviceToken(token: String) = AlgorithmX.registerDeviceToken(token)
}

/**
 * The Android SDK does not detect foreground on its own: queued WebView
 * campaigns are shown only when the host calls `onAppBecameActive` (at most one
 * per foreground session). Mirrors the Flutter plugin.
 */
private object ForegroundTracker : Application.ActivityLifecycleCallbacks {
    private val started = mutableSetOf<Activity>()
    private var foreground = false

    override fun onActivityStarted(activity: Activity) {
        // The transparent notification-click trampoline is not the app's UI.
        if (activity is NotificationClickActivity) return
        started.add(activity)
        if (!foreground) {
            foreground = true
            AlgorithmX.onAppBecameActive(activity)
        }
    }

    override fun onActivityStopped(activity: Activity) = left(activity)
    override fun onActivityDestroyed(activity: Activity) = left(activity)

    private fun left(activity: Activity) {
        started.remove(activity)
        if (started.isEmpty() && foreground) {
            foreground = false
            AlgorithmX.onAppWentBackground()
        }
    }

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = Unit
    override fun onActivityResumed(activity: Activity) = Unit
    override fun onActivityPaused(activity: Activity) = Unit
    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit
}

/**
 * Owns the SDK listeners and forwards callbacks to JS as device events. Events
 * are buffered until JS subscribes, so a notification tap that cold starts the
 * app still reaches JS.
 */
internal object EventBridge :
    AlgoWebViewListener,
    NotificationClickListener,
    DeepLinkHandler,
    ActionButtonHandler,
    CampaignInteractionListener {

    private const val TAG = "AlgorithmXRN"
    private const val MAX_BUFFERED = 50

    private var context: ReactApplicationContext? = null
    private var listenerCount = 0
    private val buffered = ArrayDeque<Pair<String, Map<String, Any?>>>()

    fun attachToSdk() {
        AlgorithmX.setAlgoWebViewListener(this)
        AlgorithmX.setNotificationClickListener(this)
        AlgorithmX.setDeepLinkHandler(this)
        AlgorithmX.setActionButtonHandler(this)
        AlgorithmX.setCampaignInteractionListener(this)
    }

    @Synchronized
    fun listenerAdded(reactContext: ReactApplicationContext) {
        context = reactContext
        listenerCount++
        while (buffered.isNotEmpty()) {
            val (name, body) = buffered.removeFirst()
            send(reactContext, name, body)
        }
    }

    @Synchronized
    fun listenersRemoved(count: Int) {
        listenerCount = (listenerCount - count).coerceAtLeast(0)
    }

    @Synchronized
    private fun emit(name: String, body: Map<String, Any?>) {
        val reactContext = context
        if (reactContext != null && listenerCount > 0 && reactContext.hasActiveReactInstance()) {
            send(reactContext, name, body)
        } else {
            buffered.addLast(name to body)
            if (buffered.size > MAX_BUFFERED) buffered.removeFirst()
        }
    }

    private fun send(reactContext: ReactApplicationContext, name: String, body: Map<String, Any?>) {
        try {
            reactContext.emitDeviceEvent(name, toWritableMap(body))
        } catch (e: Exception) {
            Log.e(TAG, "Failed to emit $name", e)
        }
    }

    // Return values are fixed: JS cannot answer synchronously. Taps still run the
    // SDK's default routing; deep links and action buttons are left to JS.

    override fun onWebViewTrigger(campaignId: String, webviewUrl: String, dynamicContent: Map<String, Any>?) =
        emit(
            "onWebViewTrigger",
            mapOf("campaignId" to campaignId, "url" to webviewUrl, "dynamicContent" to (dynamicContent ?: emptyMap()))
        )

    override fun onNotificationClick(data: Map<String, Any>): Boolean {
        emit("onNotificationClick", data)
        return false
    }

    override fun onCustomAction(action: String?, data: Map<String, Any>): Boolean {
        emit("onCustomAction", mapOf("action" to action, "data" to data))
        return true
    }

    override fun onActionHandled(action: String, data: Map<String, Any>) =
        emit("onActionHandled", mapOf("action" to action, "data" to data))

    override fun onDeepLinkReceived(uri: Uri): Boolean {
        emit("onDeepLink", mapOf("url" to uri.toString()))
        return true
    }

    override fun onActionButtonClicked(
        buttonId: String,
        actionText: String,
        title: String,
        notificationData: Map<String, Any>
    ): Boolean {
        emit(
            "onActionButton",
            mapOf("buttonId" to buttonId, "actionText" to actionText, "title" to title, "notificationData" to notificationData)
        )
        return true
    }

    override fun onCampaignInteraction(
        campaignId: String,
        variationId: String,
        interactionType: String,
        payload: Map<String, Any>
    ) = emit(
        "onCampaignInteraction",
        mapOf("campaignId" to campaignId, "variationId" to variationId, "interactionType" to interactionType, "payload" to payload)
    )
}

internal fun toWritableMap(map: Map<*, *>): WritableMap = Arguments.createMap().apply {
    map.forEach { (key, value) ->
        val name = key.toString()
        when (value) {
            null -> putNull(name)
            is String -> putString(name, value)
            is Boolean -> putBoolean(name, value)
            is Int -> putInt(name, value)
            is Number -> putDouble(name, value.toDouble())
            is Map<*, *> -> putMap(name, toWritableMap(value))
            is Iterable<*> -> putArray(name, toWritableArray(value))
            else -> putString(name, value.toString())
        }
    }
}

private fun toWritableArray(list: Iterable<*>): WritableArray = Arguments.createArray().apply {
    list.forEach { value ->
        when (value) {
            null -> pushNull()
            is String -> pushString(value)
            is Boolean -> pushBoolean(value)
            is Int -> pushInt(value)
            is Number -> pushDouble(value.toDouble())
            is Map<*, *> -> pushMap(toWritableMap(value))
            is Iterable<*> -> pushArray(toWritableArray(value))
            else -> pushString(value.toString())
        }
    }
}
