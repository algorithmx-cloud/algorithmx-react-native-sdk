package algorithmx.engage.rn

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Registers EngageSdkModule with React Native's module registry.
 *
 * Add this to your MainApplication.kt:
 *
 *   override fun getPackages(): List<ReactPackage> = listOf(
 *       MainReactPackage(),
 *       EngageSdkPackage(),   // <-- add this line
 *   )
 */
class EngageSdkPackage : ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
        listOf(EngageSdkModule(context))

    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
