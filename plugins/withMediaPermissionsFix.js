const { withAndroidManifest } = require('expo/config-plugins');

// expo-media-library plugin unconditionally adds READ_EXTERNAL_STORAGE,
// WRITE_EXTERNAL_STORAGE, and requestLegacyExternalStorage=true.
// On API 29+ none of these are needed: MediaStore allows writing own files
// without permission, and expo-image-picker uses the system Photo Picker.
// This plugin runs after expo-media-library to clean them up.
module.exports = (config) =>
  withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Remove requestLegacyExternalStorage from <application>
    const app = manifest.application?.[0];
    if (app?.$?.['android:requestLegacyExternalStorage']) {
      delete app.$['android:requestLegacyExternalStorage'];
    }

    // Fix storage permissions
    const perms = manifest['uses-permission'] ?? [];
    manifest['uses-permission'] = perms
      .filter((p) => p.$['android:name'] !== 'android.permission.READ_EXTERNAL_STORAGE')
      .map((p) => {
        if (p.$['android:name'] === 'android.permission.WRITE_EXTERNAL_STORAGE') {
          p.$['android:maxSdkVersion'] = '28';
        }
        return p;
      });

    return config;
  });
