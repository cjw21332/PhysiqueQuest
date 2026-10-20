const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const root = path.resolve(__dirname, '../../frontend');
const files = ['app/globals.css', 'app/theme.css', 'app/scrollbars.css', 'sections/Coach/coach-reference.css', 'sections/Coach/libraryreference.css'];
const report = [];
for (const file of files) {
  const location = path.join(root, file);
  const before = fs.readFileSync(location, 'utf8');
  const css = postcss.parse(before);
  let duplicates = 0, legacyNavigation = 0, emptyRules = 0;
  function clean(container) {
    const seen = new Map();
    for (const node of [...(container.nodes ?? [])].reverse()) {
      if (node.type === 'rule') {
        // Only equal selectors in the very same unconditional context can supersede each other.
        for (const decl of [...node.nodes].reverse()) {
          if (decl.type !== 'decl') continue;
          const key = JSON.stringify([node.selector, decl.prop, Boolean(decl.important)]);
          if (seen.get(key) === decl.value) { decl.remove(); duplicates++; }
          else if (!seen.has(key)) seen.set(key, decl.value);
        }
      } else if (node.type === 'atrule' && ['media', 'supports', 'container', 'layer'].includes(node.name)) clean(node);
    }
  }
  clean(css);
  css.walkRules(rule => {
    // Shared navigation now owns these dimensions, including accessibility reflow.
    if (rule.selector.includes(',') || !rule.selector.endsWith('.home-bottom-nav')) return;
    if (rule.selector === ':root .home-bottom-nav[aria-label]') return;
    rule.walkDecls(decl => {
      if (!decl.important && ['height', 'flex', 'flex-basis'].includes(decl.prop)) { decl.remove(); legacyNavigation++; }
    });
  });
  css.walkRules(rule => { if (!rule.nodes.length) { rule.remove(); emptyRules++; } });
  const after = css.toString();
  fs.writeFileSync(location, after);
  report.push({ file, beforeBytes: Buffer.byteLength(before), afterBytes: Buffer.byteLength(after), duplicates, legacyNavigation, emptyRules });
}
console.log(JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(__dirname, 'cleanup-results.json'), JSON.stringify(report, null, 2) + '\n');
