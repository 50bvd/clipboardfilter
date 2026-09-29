// Minimal stand-in for the 'electron' module in unit tests (see setup.js).
module.exports = {
  app: { isPackaged: false, getVersion: () => '0.0.0', getPath: () => require('os').tmpdir() },
  net: {},
  protocol: {},
  systemPreferences: {}
};
