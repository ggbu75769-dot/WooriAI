import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = resolve(__dirname, "..");
const repoRoot = resolve(mobileRoot, "..", "..");
const readMobile = (path: string) => readFileSync(resolve(mobileRoot, path), "utf8");
const readRepo = (path: string) => readFileSync(resolve(repoRoot, path), "utf8");

describe("Release 4H native profile boundary", () => {
  it("keeps the main Manifest backup, cleartext, storage permissions, and deep links fail-closed", () => {
    const manifest = readMobile("android/app/src/main/AndroidManifest.xml");
    expect(manifest).toContain('android:allowBackup="false"');
    expect(manifest).toContain('android:usesCleartextTraffic="false"');
    expect(manifest).toContain('android:name="android.permission.READ_EXTERNAL_STORAGE" tools:node="remove"');
    expect(manifest).toContain('android:name="android.permission.WRITE_EXTERNAL_STORAGE" tools:node="remove"');
    expect(manifest).toContain('android:name="android.permission.MANAGE_EXTERNAL_STORAGE" tools:node="remove"');
    expect(manifest).toContain('android:name="android.permission.READ_MEDIA_IMAGES" tools:node="remove"');
    expect(manifest).toContain('android:scheme="wooriai" android:host="oauth" android:path="/kakao"');
    expect(manifest).toContain('android:scheme="wooriai" android:host="items" android:pathAdvancedPattern="/[0-9a-fA-F]{8}-');
    expect(manifest).toContain('android:scheme="wooriai" android:host="pixel-lock"');
    expect(manifest).not.toContain('android:host="items" android:pathPattern="/.*"');
    expect(manifest).not.toContain('<data android:scheme="wooriai"/>');
    expect(manifest).not.toContain('android:scheme="com.anonymous.wooriai"');
  });

  it("permits emulator loopback only from the debug resource overlay", () => {
    const mainConfig = readMobile("android/app/src/main/res/xml/network_security_config.xml");
    const debugConfig = readMobile("android/app/src/debug/res/xml/network_security_config.xml");
    expect(mainConfig).toContain('cleartextTrafficPermitted="false"');
    expect(mainConfig).not.toContain("localhost");
    expect(mainConfig).not.toContain("10.0.2.2");
    expect(debugConfig).toContain("localhost");
    expect(debugConfig).toContain("10.0.2.2");
  });

  it("makes Expo prebuild reproduce the same strict main/debug split", () => {
    const plugin = readMobile("plugins/with-network-security-config.js");
    expect(plugin).toContain('application.$["android:allowBackup"] = "false"');
    expect(plugin).toContain('application.$["android:usesCleartextTraffic"] = "false"');
    expect(plugin).toContain('"tools:node": "remove"');
    expect(plugin).toContain('join(appRoot, "debug", "res", "xml")');
    expect(plugin).toContain('"android:host": "oauth"');
    expect(plugin).toContain('"android:host": "items"');
    expect(plugin).toContain('"android:host": "pixel-lock"');
    expect(plugin).toContain("android:windowOptOutEdgeToEdgeEnforcement");
    expect(readMobile("android/app/src/main/res/values/styles.xml")).toContain(
      '<item name="android:windowOptOutEdgeToEdgeEnforcement">true</item>'
    );
  });

  it("refuses a production APK with the current anonymous identity before Gradle signing", () => {
    const build = readRepo("scripts/build-android-apk.ts");
    const gradle = readMobile("android/app/build.gradle");
    expect(build).toContain('profile === "production"');
    expect(build).toContain("ANDROID_APPROVED_IDENTITY_REQUIRED");
    expect(gradle).toContain("ANDROID_PRODUCTION_SIGNING_REQUIRED");
  });

  it("targets the current Google Play API level with an explicit CI toolchain", () => {
    const rootGradle = readMobile("android/build.gradle");
    const appConfig = JSON.parse(readMobile("app.json"));
    const ci = readRepo(".github/workflows/ci.yml");
    expect(rootGradle).toContain("buildToolsVersion = findProperty('android.buildToolsVersion') ?: '36.0.0'");
    expect(rootGradle).toContain("compileSdkVersion = Integer.parseInt(findProperty('android.compileSdkVersion') ?: '36')");
    expect(rootGradle).toContain("targetSdkVersion = Integer.parseInt(findProperty('android.targetSdkVersion') ?: '36')");
    expect(appConfig.expo.plugins).toContainEqual([
      "expo-build-properties",
      { android: { buildToolsVersion: "36.0.0", compileSdkVersion: 36, kotlinVersion: "2.1.20", targetSdkVersion: 36 } }
    ]);
    expect(rootGradle).toContain("kotlinVersion = findProperty('android.kotlinVersion') ?: '2.1.20'");
    expect(rootGradle).toContain('ndkVersion = "27.1.12297006"');
    expect(ci).toContain('sdkmanager "platforms;android-36" "build-tools;36.0.0"');
  });

  it("gives React Native codegen the Android package for generated BuildConfig references", () => {
    const reactNativeConfig = readMobile("react-native.config.js");
    const gradle = readMobile("android/app/build.gradle");
    expect(reactNativeConfig).toContain('packageName: "com.anonymous.wooriai"');
    expect(reactNativeConfig).toContain('sourceDir: "./android"');
    expect(gradle).toContain('namespace "com.anonymous.wooriai"');
    expect(gradle).toContain("applicationId androidPackageName");
    expect(gradle).toContain("ANDROID_APPLICATION_ID_INVALID");
    expect(gradle).not.toContain("ANDROID_PACKAGE_NAME_MISMATCH");
  });
});
