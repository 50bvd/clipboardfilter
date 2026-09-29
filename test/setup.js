// Loaded before every test file (see the "test" script). The modules under
// test import 'electron' but the tests only call their pure functions:
// resolve 'electron' to a stub so that the tests never need (or download)
// the Electron binary, and test files running in parallel cannot race on it.
const Module = require('module');
const path = require('path');

const STUB = path.join(__dirname, 'electron-stub.js');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  return request === 'electron' ? STUB : resolve.call(this, request, ...rest);
};
