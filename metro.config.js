const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for .mjs and .cjs files which are commonly used in modern libraries like axios and Sentry
config.resolver.sourceExts.push('mjs', 'cjs');

module.exports = config;
