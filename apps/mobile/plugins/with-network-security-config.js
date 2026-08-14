const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");
const { mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const productionNetworkSecurityConfig = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
`;

const debugNetworkSecurityConfig = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">10.0.2.2</domain>
        <domain includeSubdomains="false">localhost</domain>
    </domain-config>
</network-security-config>
`;

function withNetworkSecurityConfig(config) {
  config = withAndroidManifest(config, (androidConfig) => {
    const manifest = androidConfig.modResults.manifest;
    const application = androidConfig.modResults.manifest.application?.[0];
    if (!application) throw new Error("ANDROID_APPLICATION_NOT_FOUND");
    application.$["android:networkSecurityConfig"] = "@xml/network_security_config";
    application.$["android:allowBackup"] = "false";
    application.$["android:usesCleartextTraffic"] = "false";
    manifest.$ = { ...(manifest.$ ?? {}), "xmlns:tools": "http://schemas.android.com/tools" };
    const retainedPermissions = (manifest["uses-permission"] ?? []).filter((permission) =>
      ![
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.MANAGE_EXTERNAL_STORAGE",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
        "android.permission.READ_MEDIA_AUDIO"
      ].includes(permission.$?.["android:name"])
    );
    manifest["uses-permission"] = [
      ...retainedPermissions,
      { $: { "android:name": "android.permission.READ_EXTERNAL_STORAGE", "tools:node": "remove" } },
      { $: { "android:name": "android.permission.WRITE_EXTERNAL_STORAGE", "tools:node": "remove" } },
      { $: { "android:name": "android.permission.MANAGE_EXTERNAL_STORAGE", "tools:node": "remove" } },
      { $: { "android:name": "android.permission.READ_MEDIA_IMAGES", "tools:node": "remove" } },
      { $: { "android:name": "android.permission.READ_MEDIA_VIDEO", "tools:node": "remove" } },
      { $: { "android:name": "android.permission.READ_MEDIA_AUDIO", "tools:node": "remove" } }
    ];
    const mainActivity = application.activity?.find((activity) => activity.$?.["android:name"] === ".MainActivity");
    if (!mainActivity) throw new Error("ANDROID_MAIN_ACTIVITY_NOT_FOUND");
    const retainedFilters = (mainActivity["intent-filter"] ?? []).filter((filter) =>
      !filter.action?.some((action) => action.$?.["android:name"] === "android.intent.action.VIEW")
    );
    const viewAction = [{ $: { "android:name": "android.intent.action.VIEW" } }];
    const viewCategories = [
      { $: { "android:name": "android.intent.category.DEFAULT" } },
      { $: { "android:name": "android.intent.category.BROWSABLE" } }
    ];
    mainActivity["intent-filter"] = [
      ...retainedFilters,
      {
        action: viewAction,
        category: viewCategories,
        data: [{ $: { "android:scheme": "wooriai", "android:host": "oauth", "android:path": "/kakao" } }]
      },
      {
        action: viewAction,
        category: viewCategories,
        data: [{ $: {
          "android:scheme": "wooriai",
          "android:host": "items",
          "android:pathAdvancedPattern": "/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}"
        } }]
      },
      {
        action: viewAction,
        category: viewCategories,
        data: [{ $: { "android:scheme": "wooriai", "android:host": "pixel-lock" } }]
      }
    ];
    return androidConfig;
  });

  return withDangerousMod(config, [
    "android",
    async (androidConfig) => {
      const appRoot = join(androidConfig.modRequest.platformProjectRoot, "app", "src");
      const mainXmlDir = join(appRoot, "main", "res", "xml");
      const debugXmlDir = join(appRoot, "debug", "res", "xml");
      mkdirSync(mainXmlDir, { recursive: true });
      mkdirSync(debugXmlDir, { recursive: true });
      writeFileSync(join(mainXmlDir, "network_security_config.xml"), productionNetworkSecurityConfig, "utf8");
      writeFileSync(join(debugXmlDir, "network_security_config.xml"), debugNetworkSecurityConfig, "utf8");
      const stylesPath = join(appRoot, "main", "res", "values", "styles.xml");
      const styles = readFileSync(stylesPath, "utf8");
      if (!styles.includes("android:windowOptOutEdgeToEdgeEnforcement")) {
        writeFileSync(
          stylesPath,
          styles.replace(
            '<item name="android:windowLightNavigationBar">true</item>',
            '<item name="android:windowLightNavigationBar">true</item>\n    <item name="android:windowOptOutEdgeToEdgeEnforcement">true</item>'
          ),
          "utf8"
        );
      }
      return androidConfig;
    }
  ]);
}

module.exports = withNetworkSecurityConfig;
