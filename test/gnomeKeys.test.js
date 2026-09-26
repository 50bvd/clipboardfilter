const test = require('node:test');
const assert = require('node:assert/strict');
const {
  toGnomeAccelerator, parseGVariantStringArray, gvariantString, gvariantStringArray, isGnomeLikeDesktop
} = require('../dist/gnomeKeys');

test('Electron accelerators are converted to GNOME syntax', () => {
  assert.equal(toGnomeAccelerator('CommandOrControl+Shift+V'), '<Control><Shift>v');
  assert.equal(toGnomeAccelerator('CommandOrControl+Alt+B'), '<Control><Alt>b');
  assert.equal(toGnomeAccelerator('Super+F12'), '<Super>F12');
  assert.equal(toGnomeAccelerator('Control+Shift+PageDown'), '<Control><Shift>Page_Down');
  assert.equal(toGnomeAccelerator('Alt+num5'), '<Alt>KP_5');
  assert.equal(toGnomeAccelerator('Alt+Space'), '<Alt>space');
  assert.equal(toGnomeAccelerator('Hyper+V'), null);
  assert.equal(toGnomeAccelerator(''), null);
});

test('gsettings string arrays are parsed and serialized', () => {
  assert.deepEqual(parseGVariantStringArray('@as []'), []);
  assert.deepEqual(parseGVariantStringArray("['/a/custom0/', '/b/clipboardfilter/']\n"), ['/a/custom0/', '/b/clipboardfilter/']);
  assert.equal(gvariantStringArray([]), '@as []');
  assert.equal(gvariantStringArray(['/a/', '/b/']), "['/a/', '/b/']");
  assert.equal(gvariantString("/opt/it's \\ app --paste"), "'/opt/it\\'s \\\\ app --paste'");
  assert.deepEqual(parseGVariantStringArray(gvariantStringArray(["x'y", 'z'])), ["x'y", 'z']);
});

test('GNOME-based desktops are detected', () => {
  for (const d of ['GNOME', 'ubuntu:GNOME', 'GNOME-Classic:GNOME', 'Budgie:GNOME', 'Pantheon', 'Unity']) assert.ok(isGnomeLikeDesktop(d), d);
  for (const d of ['KDE', 'XFCE', 'sway', 'Hyprland', '']) assert.ok(!isGnomeLikeDesktop(d), d);
});
