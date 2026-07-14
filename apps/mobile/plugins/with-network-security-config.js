const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");
const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const networkSecurityConfig = `<?xml version="1.0" encoding="utf-8"?>
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
    const application = androidConfig.modResults.manifest.application?.[0];
    if (!application) throw new Error("ANDROID_APPLICATION_NOT_FOUND");
    application.$["android:networkSecurityConfig"] = "@xml/network_security_config";
    return androidConfig;
  });

  return withDangerousMod(config, [
    "android",
    async (androidConfig) => {
      const xmlDir = join(androidConfig.modRequest.platformProjectRoot, "app", "src", "main", "res", "xml");
      mkdirSync(xmlDir, { recursive: true });
      writeFileSync(join(xmlDir, "network_security_config.xml"), networkSecurityConfig, "utf8");
      return androidConfig;
    }
  ]);
}

module.exports = withNetworkSecurityConfig;
