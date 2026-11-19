// Support `npx expo start` from the repository root as well as the mobile workspace.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
if (!config.resolver.assetExts.includes('task')) config.resolver.assetExts.push('task');
module.exports = config;
