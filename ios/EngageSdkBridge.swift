import AlgorithmXSDK
import Foundation
import React

// ─── Native setup (host AppDelegate + JS `init`) ─────────────────────────────

/// Initializes the native SDK once and attaches the JS event bridge. Both the host
/// AppDelegate and the JS `init` call go through here; a different URL is rejected.
///
/// Call it from `application(_:didFinishLaunchingWithOptions:)` so a silent
/// APNs push that launches the app is handled before JavaScript starts.
@objc(AlgorithmXReactNative)
public final class AlgorithmXReactNative: NSObject {
    private static let lock = NSLock()
    private static var configuredUrl: String?

    /// Returns `false` if the SDK was already initialized with a different URL.
    @discardableResult
    @objc public static func initialize(apiBaseUrl: String) -> Bool {
        initialize(apiBaseUrl: apiBaseUrl, appGroup: nil)
    }

    /// Same, sharing the SDK config with your Notification Service Extension through
    /// `appGroup` so it can report delivered + impression (see the iOS guide).
    @discardableResult
    @objc public static func initialize(apiBaseUrl: String, appGroup: String?) -> Bool {
        let url = apiBaseUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard !url.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return false }
        lock.lock()
        defer { lock.unlock() }
        if let configuredUrl { return configuredUrl == url }
        if let appGroup = appGroup {
            AlgorithmX.shared.initialize(apiBaseUrl: url, appGroup: appGroup)
        } else {
            AlgorithmX.shared.initialize(apiBaseUrl: url)
        }
        EventBridge.shared.attachToSdk()
        configuredUrl = url
        return true
    }
}

// ─── Native callbacks → JS events ────────────────────────────────────────────

/// Owns the SDK listener objects (the SDK only keeps weak references) and
/// buffers events until JavaScript subscribes, so a notification tap that cold
/// launches the app still reaches JS.
final class EventBridge: NSObject, AlgoWebViewListener, NotificationClickListener,
    DeepLinkHandler, ActionButtonHandler, CampaignInteractionListener
{
    static let shared = EventBridge()
    static let eventNames = [
        "onWebViewTrigger", "onNotificationClick", "onCustomAction", "onActionHandled",
        "onDeepLink", "onActionButton", "onCampaignInteraction",
    ]
    private static let maxBuffered = 50

    private let queue = DispatchQueue(label: "algorithmx.rn.events")
    private weak var emitter: RCTEventEmitter?
    private var buffered: [(name: String, body: [String: Any])] = []

    func attachToSdk() {
        let sdk = AlgorithmX.shared
        sdk.webViewListener = self
        sdk.notificationClickListener = self
        sdk.deepLinkHandler = self
        sdk.actionButtonHandler = self
        sdk.campaignInteractionListener = self
    }

    func startObserving(_ module: RCTEventEmitter) {
        queue.async {
            self.emitter = module
            let pending = self.buffered
            self.buffered.removeAll()
            pending.forEach { module.sendEvent(withName: $0.name, body: $0.body) }
        }
    }

    func stopObserving(_ module: RCTEventEmitter) {
        queue.async {
            if self.emitter === module { self.emitter = nil }
        }
    }

    private func emit(_ name: String, _ body: [String: Any]) {
        let safeBody = jsonSafe(body)
        queue.async {
            if let emitter = self.emitter {
                emitter.sendEvent(withName: name, body: safeBody)
            } else {
                self.buffered.append((name, safeBody))
                if self.buffered.count > Self.maxBuffered { self.buffered.removeFirst() }
            }
        }
    }

    // Return values are fixed: JS cannot answer synchronously. Taps still run the
    // SDK's default routing; deep links and action buttons are left to JS.

    func onWebViewTrigger(campaignId: String, webviewUrl: String, dynamicContent: [String: Any]?) {
        emit("onWebViewTrigger", [
            "campaignId": campaignId,
            "url": webviewUrl,
            "dynamicContent": dynamicContent ?? [:],
        ])
    }

    func onNotificationClick(data: [String: Any]) -> Bool {
        emit("onNotificationClick", data)
        return false
    }

    func onCustomAction(action: String?, data: [String: Any]) -> Bool {
        emit("onCustomAction", ["action": action ?? NSNull(), "data": data])
        return true
    }

    func onActionHandled(action: String, data: [String: Any]) {
        emit("onActionHandled", ["action": action, "data": data])
    }

    func onDeepLinkReceived(url: URL) -> Bool {
        emit("onDeepLink", ["url": url.absoluteString])
        return true
    }

    func onActionButtonClicked(
        buttonId: String, actionText: String, title: String, notificationData: [String: Any]
    ) -> Bool {
        emit("onActionButton", [
            "buttonId": buttonId,
            "actionText": actionText,
            "title": title,
            "notificationData": notificationData,
        ])
        return true
    }

    func onCampaignInteraction(
        campaignId: String, variationId: String, interactionType: String, payload: [String: Any]
    ) {
        emit("onCampaignInteraction", [
            "campaignId": campaignId,
            "variationId": variationId,
            "interactionType": interactionType,
            "payload": payload,
        ])
    }
}

/// Keeps event bodies bridgeable: nested maps/arrays stay, anything else becomes a string.
private func jsonSafe(_ value: [String: Any]) -> [String: Any] {
    value.mapValues(jsonSafeValue)
}

private func jsonSafeValue(_ value: Any) -> Any {
    switch value {
    case let map as [String: Any]: return jsonSafe(map)
    case let map as [AnyHashable: Any]:
        return jsonSafe(Dictionary(uniqueKeysWithValues: map.map { ("\($0.key)", $0.value) }))
    case let list as [Any]: return list.map(jsonSafeValue)
    case is String, is NSNumber, is NSNull: return value
    default: return "\(value)"
    }
}

private func anyHashableMap(_ map: [String: Any]) -> [AnyHashable: Any] {
    Dictionary(uniqueKeysWithValues: map.map { (AnyHashable($0.key), $0.value) })
}

// ─── JS module ───────────────────────────────────────────────────────────────

@objc(EngageSdkModule)
final class EngageSdkModule: RCTEventEmitter {

    override static func requiresMainQueueSetup() -> Bool { false }

    override func supportedEvents() -> [String]! { EventBridge.eventNames }

    override func startObserving() { EventBridge.shared.startObserving(self) }

    override func stopObserving() { EventBridge.shared.stopObserving(self) }

    // JS `init`. Named `configure` because `init…` selectors belong to
    // Objective-C's initializer family.
    @objc(configure:resolver:rejecter:)
    func configure(apiBaseUrl: String, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        if AlgorithmXReactNative.initialize(apiBaseUrl: apiBaseUrl) {
            resolve(nil)
        } else {
            reject("E_INIT", "AlgorithmX is already initialized with a different apiBaseUrl", nil)
        }
    }

    // ─── Identity & events ──────────────────────────────────────────────────

    @objc(setDeviceFingerprint:)
    func setDeviceFingerprint(_ fingerprint: String) {
        AlgorithmX.shared.setDeviceFingerprint(fingerprint)
    }

    @objc(getDeviceFingerprint:rejecter:)
    func getDeviceFingerprint(resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        resolve(AlgorithmX.shared.getDeviceFingerprint())
    }

    @objc(identify:attributes:)
    func identify(userId: String, attributes: [String: Any]) {
        AlgorithmX.shared.identifyUser(userId: userId, attributes: attributes.isEmpty ? nil : attributes)
    }

    @objc(resetIdentity)
    func resetIdentity() {
        AlgorithmX.shared.resetIdentity()
    }

    @objc(trackEvent:payload:)
    func trackEvent(name: String, payload: [String: Any]) {
        AlgorithmX.shared.trackEvent(name, properties: payload.isEmpty ? nil : payload)
    }

    @objc(trackCampaignInteraction:variationId:interactionType:payload:sessionId:)
    func trackCampaignInteraction(
        campaignId: String,
        variationId: String,
        interactionType: String,
        payload: [String: Any],
        sessionId: String?
    ) {
        AlgorithmX.shared.trackCampaignInteraction(
            campaignId: campaignId,
            variationId: variationId,
            interactionType: interactionType,
            payload: payload.isEmpty ? nil : payload,
            sessionId: sessionId
        )
    }

    @objc(updateNotificationStatus:status:errorMessage:)
    func updateNotificationStatus(notificationId: Int, status: Int, errorMessage: String?) {
        guard let value = AlgorithmX.NotificationEventStatus(rawValue: status) else { return }
        AlgorithmX.shared.updateNotificationStatus(
            notificationId: notificationId, status: value, errorMessage: errorMessage
        )
    }

    // ─── Push ───────────────────────────────────────────────────────────────

    @objc(registerDeviceToken:)
    func registerDeviceToken(_ token: String) {
        AlgorithmX.shared.registerDeviceToken(token)
    }

    /// For apps that route APNs payloads through JS; the usual wiring is the
    /// AppDelegate calling `AlgorithmX.shared.handleNotification` directly.
    @objc(handleSilentNotification:)
    func handleSilentNotification(_ userInfo: [String: Any]) {
        AlgorithmX.shared.handleNotification(userInfo: anyHashableMap(userInfo)) {}
    }

    @objc(handleNotificationResponse:userInfo:)
    func handleNotificationResponse(actionIdentifier: String, userInfo: [String: Any]) {
        AlgorithmX.shared.handleNotificationResponse(
            actionIdentifier: actionIdentifier, userInfo: anyHashableMap(userInfo)
        ) {}
    }

    // ─── WebView campaigns ─────────────────────────────────────────────────

    @objc(triggerWebView:webviewUrl:dynamicContent:)
    func triggerWebView(campaignId: String, webviewUrl: String, dynamicContent: [String: Any]) {
        AlgorithmX.shared.triggerWebView(
            campaignId: campaignId,
            webviewUrl: webviewUrl,
            dynamicContent: dynamicContent.isEmpty ? nil : dynamicContent
        )
    }

    // ─── Diagnostics ───────────────────────────────────────────────────────

    @objc(getQueueSize:rejecter:)
    func getQueueSize(resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        resolve(AlgorithmX.shared.getQueueSize())
    }

    /// iOS exposes one queue: the WebView campaign queue.
    @objc(getWebViewQueueSize:rejecter:)
    func getWebViewQueueSize(resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        resolve(AlgorithmX.shared.getQueueSize())
    }

    @objc(clearWebViewQueue:rejecter:)
    func clearWebViewQueue(resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        resolve(AlgorithmX.shared.clearWebViewQueue())
    }

    @objc(clearAllWebViewData:rejecter:)
    func clearAllWebViewData(resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        resolve(AlgorithmX.shared.clearAllWebViewData())
    }

    @objc(getDisplayStats:variationId:resolver:rejecter:)
    func getDisplayStats(
        campaignId: String, variationId: String,
        resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock
    ) {
        resolve(AlgorithmX.shared.getDisplayStats(campaignId: campaignId, variationId: variationId))
    }
}
