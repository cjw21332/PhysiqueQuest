const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const config = getDefaultConfig(__dirname);
// Expo auto-discovers workspace packages, but shared is a plain source folder.
config.watchFolders.push(path.resolve(__dirname, '../shared'));
config.resolver.assetExts.push('task');
module.exports = config;
