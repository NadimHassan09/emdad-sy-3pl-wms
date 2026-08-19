/**
 * Nest `assets` copy is unreliable with deleteOutDir in some builds.
 * Ensure pdf templates/styles/assets land in dist next to compiled pdf.service.js.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pairs = [
  ['src/pdf/styles', 'dist/src/pdf/styles'],
  ['src/pdf/templates', 'dist/src/pdf/templates'],
  ['src/pdf/assets', 'dist/src/pdf/assets'],
];

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

for (const [srcRel, destRel] of pairs) {
  copyDir(path.join(root, srcRel), path.join(root, destRel));
}

const jsonSrc = path.join(root, 'src/modules/client-portal/external-api/syria-address-hierarchy.json');
const jsonDestDir = path.join(root, 'dist/src/modules/client-portal/external-api');
if (fs.existsSync(jsonSrc)) {
  fs.mkdirSync(jsonDestDir, { recursive: true });
  fs.copyFileSync(jsonSrc, path.join(jsonDestDir, 'syria-address-hierarchy.json'));
}
