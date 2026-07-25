import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import sharp from "sharp";

const splashDensities = [
  ["mdpi", 288],
  ["hdpi", 432],
  ["xhdpi", 576],
  ["xxhdpi", 864],
  ["xxxhdpi", 1152]
] as const;

const launcherDensities = [
  ["mdpi", 48],
  ["hdpi", 72],
  ["xhdpi", 96],
  ["xxhdpi", 144],
  ["xxxhdpi", 192]
] as const;

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function writeWhenChanged(path: string, bytes: Buffer | string) {
  const next = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, "utf8");
  if (existsSync(path) && readFileSync(path).equals(next)) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, next);
  return true;
}

function resolveConfigAsset(mobileRoot: string, configuredPath: string, field: string) {
  const path = resolve(mobileRoot, configuredPath);
  if (!existsSync(path)) {
    throw new Error(`ANDROID_BRANDING_ASSET_MISSING field=${field} path=${path}`);
  }
  return path;
}

/**
 * A checked-in Expo config is the branding source of truth, while the generated
 * Android directory is intentionally ignored. When that directory already
 * exists, Expo prebuild does not run during an incremental APK build. Keep its
 * native splash and launcher resources synchronized before source binding.
 */
export async function syncAndroidBrandingResources(mobileRoot: string, androidDir: string) {
  const appJsonPath = join(mobileRoot, "app.json");
  const appJson = JSON.parse(readFileSync(appJsonPath, "utf8")) as {
    expo?: {
      icon?: string;
      splash?: { image?: string };
    };
  };
  const iconConfig = appJson.expo?.icon;
  const splashConfig = appJson.expo?.splash?.image;
  if (!iconConfig || !splashConfig) {
    throw new Error("ANDROID_BRANDING_CONFIG_INCOMPLETE: expo.icon and expo.splash.image are required.");
  }

  const iconPath = resolveConfigAsset(mobileRoot, iconConfig, "expo.icon");
  const splashPath = resolveConfigAsset(mobileRoot, splashConfig, "expo.splash.image");
  const resRoot = join(androidDir, "app", "src", "main", "res");
  if (!existsSync(resRoot)) {
    throw new Error(`ANDROID_RESOURCE_ROOT_MISSING ${resRoot}`);
  }

  const changed: string[] = [];
  const backgroundPath = join(resRoot, "drawable", "ic_launcher_background.xml");
  const backgroundXml = [
    '<layer-list xmlns:android="http://schemas.android.com/apk/res/android">',
    '  <item android:drawable="@color/splashscreen_background"/>',
    "  <item>",
    '    <bitmap android:gravity="center" android:src="@drawable/splashscreen_logo"/>',
    "  </item>",
    "</layer-list>",
    ""
  ].join("\n");
  if (writeWhenChanged(backgroundPath, backgroundXml)) changed.push(backgroundPath);

  for (const [density, size] of splashDensities) {
    const outputPath = join(resRoot, `drawable-${density}`, "splashscreen_logo.png");
    const bytes = await sharp(splashPath)
      .resize(size, size, { fit: "contain" })
      .png()
      .toBuffer();
    if (writeWhenChanged(outputPath, bytes)) changed.push(outputPath);
  }

  for (const [density, size] of launcherDensities) {
    const bytes = await sharp(iconPath)
      .resize(size, size, { fit: "cover" })
      .webp({ quality: 100, lossless: true })
      .toBuffer();
    for (const name of ["ic_launcher.webp", "ic_launcher_round.webp"]) {
      const outputPath = join(resRoot, `mipmap-${density}`, name);
      if (writeWhenChanged(outputPath, bytes)) changed.push(outputPath);
    }
  }

  return {
    status: "SYNCED" as const,
    iconSha256: sha256(readFileSync(iconPath)),
    splashSha256: sha256(readFileSync(splashPath)),
    changed
  };
}
