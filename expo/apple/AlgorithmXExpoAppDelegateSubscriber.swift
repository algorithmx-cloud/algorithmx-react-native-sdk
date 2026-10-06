import AlgorithmXReactNativeSDK
import ExpoModulesCore
import UserNotifications

public final class AlgorithmXExpoAppDelegateSubscriber: ExpoAppDelegateSubscriber {
    private var enabled = false
    private var notificationDelegate: AlgorithmXExpoNotificationDelegate?

    public func subscriberDidRegister() {
        // Expo calls this before the app's didFinishLaunching starts React Native.
        guard let config = Bundle.main.object(forInfoDictionaryKey: "AlgorithmX") as? [String: String],
              let url = config["apiBaseUrl"], let partnerId = config["partnerId"] else { return }
        enabled = AlgorithmXReactNative.initialize(apiBaseUrl: url, partnerId: partnerId, appGroup: config["appGroup"])
        precondition(enabled, "AlgorithmX Expo configuration conflicts with existing native startup")
    }

    public func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        guard enabled else { return true }
        // Expo constructs its notification delegate before didFinishLaunching. Retain
        // and forward it so unrelated/local notifications keep the app's Expo flow.
        let center = UNUserNotificationCenter.current()
        let delegate = AlgorithmXExpoNotificationDelegate(previous: center.delegate)
        notificationDelegate = delegate
        center.delegate = delegate
        application.registerForRemoteNotifications()
        return true
    }

    public func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken token: Data) {
        if enabled { AlgorithmXReactNative.registerDeviceToken(token) }
    }

    public func application(
        _ application: UIApplication,
        didReceiveRemoteNotification userInfo: [AnyHashable: Any],
        fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        if enabled && AlgorithmXReactNative.handleRemoteNotification(userInfo, completionHandler: completionHandler) { return }
        // Expo aggregates subscriber results, and its own subscriber receives this too.
        completionHandler(.noData)
    }
}

private final class AlgorithmXExpoNotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    private let previous: UNUserNotificationCenterDelegate?

    init(previous: UNUserNotificationCenterDelegate?) {
        self.previous = previous
        super.init()
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter, willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        if AlgorithmXReactNative.handleForegroundNotification(notification, completionHandler: completionHandler) { return }
        if let previous, previous.responds(to: #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:willPresent:withCompletionHandler:))) {
            previous.userNotificationCenter?(center, willPresent: notification, withCompletionHandler: completionHandler)
        } else { completionHandler([]) }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        if AlgorithmXReactNative.handleNotificationResponse(response, completionHandler: completionHandler) { return }
        if let previous, previous.responds(to: #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:didReceive:withCompletionHandler:))) {
            previous.userNotificationCenter?(center, didReceive: response, withCompletionHandler: completionHandler)
        } else { completionHandler() }
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, openSettingsFor notification: UNNotification?) {
        previous?.userNotificationCenter?(center, openSettingsFor: notification)
    }
}
