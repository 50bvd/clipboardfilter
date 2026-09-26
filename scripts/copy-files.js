// Copies the static renderer files next to the compiled TypeScript output.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });
for (const file of ['src/renderer.html', 'src/renderer.js', 'src/styles.css']) {
  fs.copyFileSync(path.join(root, file), path.join(dist, path.basename(file)));
}
