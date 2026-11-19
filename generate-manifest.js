const fs = require('fs');
const path = require('path');
const HOME = process.env.USERPROFILE || process.env.HOME;

const SKILL_ROOTS = [
    { root: path.join(HOME, '.codex', 'skills'), prefix: 'codex' },
    { root: path.join(HOME, '.agents', 'skills'), prefix: 'agents' },
    { root: path.join(HOME, '.agents', 'skills-anthropic', 'skills'), prefix: 'agents-anthropic' },
    { root: path.join(HOME, 'Desktop', 'Projects', 'PhysiqueQuest', '.agents', 'skills'), prefix: 'physiquequest' },
    { root: path.join(HOME, '.config', 'opencode', 'skills', 'open-design', 'skills'), prefix: 'open-design' },
    { root: path.join(HOME, '.config', 'opencode', 'skills', 'emilkowalski-skills', 'skills'), prefix: 'emilkowalski' },
    { root: path.join(HOME, '.config', 'opencode', 'skills', 'gsap-skills', 'skills'), prefix: 'gsap' },
    { root: path.join(HOME, '.config', 'opencode', 'skills', 'hallmark', 'skills'), prefix: 'hallmark' },
    { root: path.join(HOME, '.config', 'opencode', 'skills', 'design-md', '.agents', 'skills'), prefix: 'design-md' },
    { root: path.join(HOME, '.config', 'opencode', 'skills', 'magicui', 'skills'), prefix: 'magicui' },
    { root: path.join(HOME, '.config', 'opencode', 'skills', 'scroll-world', 'skills'), prefix: 'scroll-world' },
    { root: path.join(HOME, '.config', 'opencode', 'skills', 'dimensional-drawing', 'skills'), prefix: 'dimensional-drawing' },
    { root: path.join(HOME, '.config', 'opencode', 'skills', 'taste', 'skills'), prefix: 'taste' },
    { root: path.join(HOME, '.config', 'opencode', 'skills', 'ui-ux-pro-max-skill', '.claude', 'skills'), prefix: 'ui-ux-pro-max' },
    { root: path.join(HOME, '.config', 'opencode', 'skills', 'bug-hunter', 'skills'), prefix: 'bug-hunter' },
    { root: path.join(HOME, '.config', 'opencode', 'skills', 'agentguard', 'skills'), prefix: 'agentguard' },
    { root: path.join(HOME, '.config', 'opencode', 'skills', 'cybersecurity-skills', 'skills'), prefix: 'cybersecurity' },
    { root: path.join(HOME, '.config', 'opencode', 'skills', 'cc-safety-net', 'skills'), prefix: 'cc-safety-net' },
    { root: path.join(HOME, '.config', 'opencode', 'skills', 'vbsec', 'skills'), prefix: 'vbsec' },
    { root: path.join(HOME, 'Desktop', 'Projects', 'PhysiqueQuest', '.opencode', 'skills'), prefix: 'ship-code' },
];

function findSkillDirs(root) {
    if (!fs.existsSync(root)) return [];
    return fs.readdirSync(root, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
}

function hasSkillMd(skillPath) {
    return fs.existsSync(path.join(skillPath, 'SKILL.md'));
}

let allSkills = [];
for (const { root, prefix } of SKILL_ROOTS) {
    const skillDirs = findSkillDirs(root);
    for (const dir of skillDirs) {
        const skillDir = path.join(root, dir);
        if (hasSkillMd(skillDir)) {
            let description = '';
            let name = dir;
            try {
                const content = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
                const descMatch = content.match(/description:\s*(.+)/);
                const nameMatch = content.match(/name:\s*(.+)/);
                if (descMatch) description = descMatch[1].trim();
                if (nameMatch) name = nameMatch[1].trim();
            } catch {}
            
            const skillPath = path.join(skillDir, 'SKILL.md');
            allSkills.push({
                id: dir,
                name: name,
                description: description,
                category: prefix,
                path: skillPath,
                installCommand: 'omniroute skills install --from-file "' + skillPath.replace(/\\/g, '\\\\') + '" --type custom --enable'
            });
        }
    }
}

allSkills.sort((a, b) => {
    if (a.id === 'smart-skill-router') return -1;
    if (b.id === 'smart-skill-router') return 1;
    return a.category.localeCompare(b.category) || a.id.localeCompare(b.id);
});

const manifest = {
    generated: new Date().toISOString(),
    totalSkills: allSkills.length,
    categories: [...new Set(allSkills.map(s => s.category))].length,
    skills: allSkills
};

fs.writeFileSync(
    path.join(__dirname, 'omniroute-skills-manifest.json'),
    JSON.stringify(manifest, null, 2)
);

console.log('Generated manifest with ' + allSkills.length + ' skills across ' + manifest.categories + ' categories');

const shellCommands = allSkills.map(s => s.installCommand).join('\n');
fs.writeFileSync(
    path.join(__dirname, 'install-all-skills.sh'),
    '#!/bin/bash\n# Auto-generated skill installation script\n\n' + shellCommands + '\n'
);
console.log('Saved install-all-skills.sh');

const psCommands = allSkills.map(s => 
    'if (Test-Path "' + s.path.replace(/\\/g, '\\\\') + '") { Write-Host "Installing: ' + s.id + '" -ForegroundColor Cyan; omniroute skills install --from-file "' + s.path.replace(/\\/g, '\\\\') + '" --type custom --enable } else { Write-Host "Missing: ' + s.id + '" -ForegroundColor Red }'
).join('\n');
fs.writeFileSync(
    path.join(__dirname, 'install-all-skills.ps1'),
    '# Auto-generated skill installation script\n\n' + psCommands + '\n'
);
console.log('Saved install-all-skills.ps1');