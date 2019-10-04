/* eslint-disable @typescript-eslint/no-var-requires */
const blacklist = require('metro-config/src/defaults/blacklist');

module.exports = {
  getTransformModulePath() {
    return require.resolve('react-native-typescript-transformer');
  },
  getSourceExts() {
    return ['ts', 'tsx'];
  },
  getBlacklistRE () {
    return blacklist([/\/youi\/build\/.*/u]);
  },
};
