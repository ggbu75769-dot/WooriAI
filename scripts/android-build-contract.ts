import { createHash } from "node:crypto";
import { posix, win32 } from "node:path";

export type AndroidBuildProfile = "standalone" | "production";

export type AndroidBuildCliOptions = {
  profile: AndroidBuildProfile;
  cleanRequested: boolean;
  resumeAfterClean: boolean;
  help: boolean;
};

export type PixelApkBuildCliOptions = {
  resumeAfterTimeout: boolean;
  help: boolean;
};

function parseProfile(value: string | undefined): AndroidBuildProfile {
  if (!value) throw new Error("ANDROID_BUILD_PROFILE_VALUE_REQUIRED");
  if (value !== "standalone" && value !== "production") {
    throw new Error(`UNKNOWN_BUILD_PROFILE: "${value}" (expected "standalone" or "production")`);
  }
  return value;
}

export function parseAndroidBuildCli(args: string[], buildProfileEnv: string | undefined): AndroidBuildCliOptions {
  let profileFromCli: AndroidBuildProfile | undefined;
  let cleanRequested = false;
  let resumeAfterClean = false;
  let help = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--") continue;
    if (argument === "--help" || argument === "-h") {
      help = true;
      continue;
    }
    if (argument === "--clean" || argument === "--clean-generated") {
      cleanRequested = true;
      continue;
    }
    if (argument === "--resume-after-clean") {
      resumeAfterClean = true;
      continue;
    }
    if (argument === "--profile") {
      if (profileFromCli) throw new Error("ANDROID_BUILD_PROFILE_DUPLICATE");
      profileFromCli = parseProfile(args[index + 1]);
      index += 1;
      continue;
    }
    if (argument.startsWith("--profile=")) {
      if (profileFromCli) throw new Error("ANDROID_BUILD_PROFILE_DUPLICATE");
      profileFromCli = parseProfile(argument.slice("--profile=".length));
      continue;
    }
    throw new Error(`UNKNOWN_ANDROID_BUILD_ARGUMENT: "${argument}"`);
  }

  if (cleanRequested && resumeAfterClean) {
    throw new Error("ANDROID_BUILD_FLAGS_CONFLICT: --clean and --resume-after-clean cannot be combined.");
  }

  return {
    profile: profileFromCli ?? parseProfile(buildProfileEnv ?? "standalone"),
    cleanRequested,
    resumeAfterClean,
    help
  };
}

export function formatAndroidBuildHelp() {
  return [
    "Usage: pnpm android:build-apk -- [options]",
    "",
    "Output: project root (wooriai-<version>-release-<profile>.apk)",
    "",
    "Options:",
    "  --profile <standalone|production>  Select the embedded runtime profile (default: standalone)",
    "  --clean, --clean-generated         Remove scoped Android generated outputs before building",
    "  --resume-after-clean               Resume an interrupted clean build without forcing every task",
    "  -h, --help                         Print this help without starting Gradle"
  ].join("\n");
}

export function parsePixelApkBuildCli(args: string[]): PixelApkBuildCliOptions {
  let resumeAfterTimeout = false;
  let help = false;

  for (const argument of args) {
    if (argument === "--") continue;
    if (argument === "--help" || argument === "-h") {
      help = true;
      continue;
    }
    if (argument === "--resume-after-timeout") {
      resumeAfterTimeout = true;
      continue;
    }
    throw new Error(`UNKNOWN_PIXEL_APK_BUILD_ARGUMENT: "${argument}"`);
  }

  return { resumeAfterTimeout, help };
}

export function formatPixelApkBuildHelp() {
  return [
    "Usage: pnpm pixel:android:build-apk -- [options]",
    "",
    "Output: project root (wooriai-pixel-<sha256>.apk)",
    "",
    "Options:",
    "  --resume-after-timeout  Resume partial outputs from a timed-out forced rebuild",
    "  -h, --help              Print this help without starting Gradle"
  ].join("\n");
}

export function createPixelApkBuildResumeMetadata(
  resumeModeRequested: boolean,
  autoResumedAfterTimeout: boolean
) {
  return {
    resumeAfterTimeout: resumeModeRequested || autoResumedAfterTimeout,
    resumeModeRequested,
    autoResumedAfterTimeout
  };
}

export function sha256Bytes(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

export function createApkArtifactMetadata(bytes: Uint8Array) {
  return {
    apkSha256: sha256Bytes(bytes),
    apkBytes: bytes.byteLength
  };
}

export function createGradleInvocation(
  platform: NodeJS.Platform,
  javaHome: string,
  androidDir: string,
  gradlew: string,
  taskArgs: string[]
) {
  if (platform !== "win32") return { command: gradlew, args: [...taskArgs] };
  return {
    command: win32.join(javaHome, "bin", "java.exe"),
    args: [
      "-Xmx64m",
      "-Xms64m",
      "-Dorg.gradle.appname=gradlew",
      "-classpath",
      win32.join(androidDir, "gradle", "wrapper", "gradle-wrapper.jar"),
      "org.gradle.wrapper.GradleWrapperMain",
      ...taskArgs
    ]
  };
}

export function createExpoPrebuildInvocation(
  platform: NodeJS.Platform,
  nodeExecutable: string,
  mobileRoot: string
) {
  const pathApi = platform === "win32" ? win32 : posix;
  return {
    command: nodeExecutable,
    args: [
      pathApi.join(mobileRoot, "node_modules", "expo", "bin", "cli"),
      "prebuild",
      "--platform",
      "android",
      "--no-install"
    ]
  };
}
