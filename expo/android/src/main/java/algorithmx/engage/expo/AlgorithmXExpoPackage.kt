package algorithmx.engage.expo

import android.app.Application
import android.content.Context
import android.content.pm.PackageManager
import algorithmx.engage.rn.AlgorithmXReactNative
import com.google.firebase.messaging.FirebaseMessaging
import expo.modules.core.interfaces.ApplicationLifecycleListener
import expo.modules.core.interfaces.Package

/** Native startup is opt-in through the config plugin and runs before JS. */
class AlgorithmXExpoPackage : Package {
    override fun createApplicationLifecycleListeners(context: Context): List<ApplicationLifecycleListener> =
        listOf(object : ApplicationLifecycleListener {
            override fun onCreate(application: Application) {
                val config = application.packageManager.getApplicationInfo(
                    application.packageName, PackageManager.GET_META_DATA
                ).metaData ?: return
                val url = config.getString("algorithmx.apiBaseUrl") ?: return
                val partnerId = config.getString("algorithmx.partnerId") ?: return
                check(AlgorithmXReactNative.initialize(application, url, partnerId)) {
                    "AlgorithmX Expo configuration conflicts with existing native startup"
                }
                FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
                    AlgorithmXReactNative.registerDeviceToken(token)
                }
            }
        })
}
