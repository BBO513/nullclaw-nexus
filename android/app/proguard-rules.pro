# Capacitor ProGuard rules
-keep class com.getcapacitor.** { *; }
-keepclasseswithmembers class * {
  @com.getcapacitor.NativePlugin public *;
}
-keepclasseswithmembers class * {
  @com.getcapacitor.CapacitorPlugin public *;
}
-keep public class * extends com.getcapacitor.BridgeActivity
-keep public class * extends com.getcapacitor.Bridge

# Svelte/Webview specific rules if any
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
