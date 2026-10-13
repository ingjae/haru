import AppKit
import ApplicationServices

// Only geometry is read. No window titles, document content, or account data.
struct Layout: Decodable { let enabled: Bool; let edge: String; let x: Double; let y: Double; let width: Double; let height: Double; let rail: Double }
var layout: Layout?
let lock = NSLock()
DispatchQueue.global().async {
    while let line = readLine() {
        if let data = line.data(using: .utf8), let value = try? JSONDecoder().decode(Layout.self, from: data) {
            lock.lock(); layout = value; lock.unlock()
        }
    }
    exit(0)
}
func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
    var result: CFTypeRef?
    return AXUIElementCopyAttributeValue(element, name as CFString, &result) == .success ? result : nil
}
func setPoint(_ window: AXUIElement, _ point: CGPoint) -> Bool {
    var value = point
    guard let ax = AXValueCreate(.cgPoint, &value) else { return false }
    return AXUIElementSetAttributeValue(window, kAXPositionAttribute as CFString, ax) == .success
}
func setSize(_ window: AXUIElement, _ size: CGSize) -> Bool {
    var value = size
    guard let ax = AXValueCreate(.cgSize, &value) else { return false }
    return AXUIElementSetAttributeValue(window, kAXSizeAttribute as CFString, ax) == .success
}
let prompt = CommandLine.arguments.contains("--prompt")
var trusted = AXIsProcessTrustedWithOptions([kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: prompt] as CFDictionary)
func report(_ value: Bool) { print(value ? "trusted" : "permission-required"); fflush(stdout) }
report(trusted)
let nativeApplication = NSApplication.shared
nativeApplication.setActivationPolicy(.prohibited)
// Mouse-only monitor: no key input or content is observed.
let clickMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown, .otherMouseDown]) { event in
    guard let point = event.cgEvent?.location else { return }
    print("mouse-down \(point.x) \(point.y)"); fflush(stdout)
}
Timer.scheduledTimer(withTimeInterval: 0.6, repeats: true) { _ in
    let current = AXIsProcessTrusted()
    if current != trusted { trusted = current; report(current) }
    lock.lock(); let config = layout; lock.unlock()
    guard trusted, let c = config, c.enabled, ["left", "right"].contains(c.edge),
          let app = NSWorkspace.shared.frontmostApplication, app.processIdentifier != getpid(),
          app.bundleIdentifier != "com.github.Electron", app.bundleIdentifier != "com.ingjae.haru",
          app.bundleIdentifier != "com.apple.finder" else { return }
    let application = AXUIElementCreateApplication(app.processIdentifier)
    guard let windows = attribute(application, kAXWindowsAttribute) as? [AXUIElement] else { return }
    let area = CGRect(x: c.x, y: c.y, width: c.width, height: c.height)
    for window in windows {
        guard attribute(window, kAXSubroleAttribute) as? String == kAXStandardWindowSubrole,
              attribute(window, kAXMinimizedAttribute) as? Bool != true,
              attribute(window, "AXFullScreen") as? Bool != true,
              let rawPoint = attribute(window, kAXPositionAttribute), CFGetTypeID(rawPoint) == AXValueGetTypeID(),
              let rawSize = attribute(window, kAXSizeAttribute), CFGetTypeID(rawSize) == AXValueGetTypeID() else { continue }
        var point = CGPoint.zero; var size = CGSize.zero
        guard AXValueGetValue(rawPoint as! AXValue, .cgPoint, &point), AXValueGetValue(rawSize as! AXValue, .cgSize, &size) else { continue }
        let frame = CGRect(origin: point, size: size)
        // Do not pull windows in from other monitors or adjust dialogs.
        guard area.contains(CGPoint(x: frame.midX, y: frame.midY)), frame.maxY > area.minY, frame.minY < area.maxY else { continue }
        let left = area.minX + (c.edge == "left" ? c.rail : 0)
        let right = area.maxX - (c.edge == "right" ? c.rail : 0)
        let intersects = c.edge == "left" ? frame.minX < left && frame.maxX > area.minX : frame.maxX > right && frame.minX < area.maxX
        guard intersects else { continue }
        let targetWidth = min(size.width, right - left)
        let targetX = min(max(point.x, left), right - targetWidth)
        // Apps can reject sizes (e.g. minimum width). Leave them alone on failure.
        if abs(size.width - targetWidth) > 1 {
            guard setSize(window, CGSize(width: targetWidth, height: size.height)) else { continue }
            guard let updated = attribute(window, kAXSizeAttribute), CFGetTypeID(updated) == AXValueGetTypeID() else { continue }
            var actual = CGSize.zero
            guard AXValueGetValue(updated as! AXValue, .cgSize, &actual), actual.width <= right - left + 1 else { continue }
        }
        if abs(point.x - targetX) > 1 { _ = setPoint(window, CGPoint(x: targetX, y: point.y)) }
    }
}
RunLoop.main.run()
