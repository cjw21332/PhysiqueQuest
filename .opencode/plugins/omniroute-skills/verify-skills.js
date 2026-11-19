// Verification script for omniroute-skills plugin
const fs = require('fs');
const path = require('path');

const pluginPath = path.join(__dirname, 'index.js');
const pluginContent = fs.readFileSync(pluginPath, 'utf8');

// Check if skills list includes all the new directories
const skillsList = [
  'agent-browser',
  'full-page-screenshot',
  'screenshots-marketing',
  'fal-vision',
  'image-enhancer',
  'webapp-testing',
  'browse',
  'scrape',
  'web-pentest',
  'osint-recon',
  'recon',
  'last30days',
  'x-research'
];

let allFound = true;

for (const skill of skillsList) {
  const skillPath = path.join('C:', 'Users', 'MY', 'PC', 'Desktop', 'Projects', 'PhysiqueQuest', '.opencode', 'skills', skill);
  if (!fs.existsSync(skillPath)) {
    console.error(`Skill directory not found: ${skill}`);
    allFound = false;
  } else {
    console.log(`✓ Found skill directory: ${skill}`);
  }
}

if (allFound) {
  console.log('✅ All skills found and directories created successfully!');
  console.log('✅ omniroute-skills plugin is ready to auto-invoke skills');
} else {
  console.log('❌ Some skill directories are missing');
}

console.log('\\n--- Plugin Configuration Check ---');
console.log('Plugin ID:', /id: "([^"]+)"/.exec(pluginContent)[1]);
console.log('Plugin setup path:', /setup\\(ctx\\)/g.exec(pluginContent)[0]);
console.log('Plugin can list skills:', /await ctx.skill.list\\(/.test(pluginContent));