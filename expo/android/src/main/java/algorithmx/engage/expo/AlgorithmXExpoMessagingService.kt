package algorithmx.engage.expo

import algorithmx.engage.rn.AlgorithmXReactNative
import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.service.ExpoFirebaseMessagingService

/** One FCM service: AlgorithmX messages are owned here, all others stay in Expo. */
class AlgorithmXExpoMessagingService : ExpoFirebaseMessagingService() {
    override fun onMessageReceived(message: RemoteMessage) {
        if (AlgorithmXReactNative.handleFcmMessage(
                this, message.data, message.notification?.title, message.notification?.body
            )) return
        super.onMessageReceived(message)
    }

    override fun onNewToken(token: String) {
        AlgorithmXReactNative.registerDeviceToken(token)
        super.onNewToken(token)
    }
}
