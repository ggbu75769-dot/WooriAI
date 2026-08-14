module.exports = {
  project: {
    android: {
      packageName: "com.anonymous.wooriai",
      sourceDir: "./android"
    }
  },
  dependencies: {
    expo: {
      platforms: {
        android: {
          packageImportPath: "import expo.modules.ExpoModulesPackage;",
          packageInstance: "new ExpoModulesPackage()"
        }
      }
    }
  }
};
