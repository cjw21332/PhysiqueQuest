#!/usr/bin/env node
/**
 * OmniRoute Skills Auto-Installer
 * Installs all 412 skills from local filesystem into OmniRoute
 * Run with: node install-skills.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HOME = process.env.USERPROFILE || process.env.HOME;
const SKILL_ROOTS = [
    // Codex skills (74)
    { root: path.join(HOME, '.codex', 'skills'), prefix: 'codex' },
    // Agents skills (82)
    { root: path.join(HOME, '.agents', 'skills'), prefix: 'agents' },
    // Agents Anthropic skills (19)
    { root: path.join(HOME, '.agents', 'skills-anthropic', 'skills'), prefix: 'agents-anthropic' },
    // PhysiqueQuest agents skills
    { root: path.join(HOME, 'Desktop', 'Projects', 'PhysiqueQuest', '.agents', 'skills'), prefix: 'physiquequest' },
    // OpenDesign skills (169)
    { root: path.join(HOME, '.config', 'opencode', 'skills', 'open-design', 'skills'), prefix: 'open-design' },
    // Emil Kowalski skills (18)
    { root: path.join(HOME, '.config', 'opencode', 'skills', 'emilkowalski-skills', 'skills'), prefix: 'emilkowalski' },
    // GSAP skills (8)
    { root: path.join(HOME, '.config', 'opencode', 'skills', 'gsap-skills', 'skills'), prefix: 'gsap' },
    // Hallmark skills
    { root: path.join(HOME, '.config', 'opencode', 'skills', 'hallmark', 'skills'), prefix: 'hallmark' },
    // Design-md skills (4)
    { root: path.join(HOME, '.config', 'opencode', 'skills', 'design-md', '.agents', 'skills'), prefix: 'design-md' },
    // MagicUI skills
    { root: path.join(HOME, '.config', 'opencode', 'skills', 'magicui', 'skills'), prefix: 'magicui' },
    // Scroll World skills
    { root: path.join(HOME, '.config', 'opencode', 'skills', 'scroll-world', 'skills'), prefix: 'scroll-world' },
    // Dimensional Drawing skills (2)
    { root: path.join(HOME, '.config', 'opencode', 'skills', 'dimensional-drawing', 'skills'), prefix: 'dimensional-drawing' },
    // Taste skills
    { root: path.join(HOME, '.config', 'opencode', 'skills', 'taste', 'skills'), prefix: 'taste' },
    // UI/UX Pro Max skills (7)
    { root: path.join(HOME, '.config', 'opencode', 'skills', 'ui-ux-pro-max-skill', '.claude', 'skills'), prefix: 'ui-ux-pro-max' },
    // Bug Hunter skills (10)
    { root: path.join(HOME, '.config', 'opencode', 'skills', 'bug-hunter', 'skills'), prefix: 'bug-hunter' },
    // Agentguard skills
    { root: path.join(HOME, '.config', 'opencode', 'skills', 'agentguard', 'skills'), prefix: 'agentguard' },
    // Cybersecurity skills (42)
    { root: path.join(HOME, '.config', 'opencode', 'skills', 'cybersecurity-skills', 'skills'), prefix: 'cybersecurity' },
    // CC Safety Net skills
    { root: path.join(HOME, '.config', 'opencode', 'skills', 'cc-safety-net', 'skills'), prefix: 'cc-safety-net' },
    // VBSEC skills (3)
    { root: path.join(HOME, '.config', 'opencode', 'skills', 'vbsec', 'skills'), prefix: 'vbsec' },
    // Ship code skill
    { root: path.join(HOME, 'Desktop', 'Projects', 'PhysiqueQuest', '.opencode', 'skills'), prefix: 'ship-code' },
];

function findSkillDirs(root) {
    if (!fs.existsSync(root)) return [];
    const dirs = fs.readdirSync(root, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
    return dirs;
}

function hasSkillMd(skillPath) {
    return fs.existsSync(path.join(skillPath, 'SKILL.md'));
}

function installSkill(skillPath, skillName) {
    try {
        const cmd = `omniroute skills install --from-file "${skillPath}" --type custom --enable`;
        execSync(cmd, { stdio: 'pipe', timeout: 60000, shell: true });
        return { success: true, skill: skillName };
    } catch (error) {
        return { success: false, skill: skillName, error: error.message };
    }
}

async function main() {
    console.log('🔍 Scanning for skills...\n');
    
    let allSkills = [];
    
    for (const { root, prefix } of SKILL_ROOTS) {
        const skillDirs = findSkillDirs(root);
        for (const dir of skillDirs) {
            const skillPath = path.join(root, dir, 'SKILL.md');
            if (hasSkillMd(path.join(root, dir))) {
                allSkills.push({
                    name: dir,
                    path: skillPath,
                    category: prefix
                });
            }
        }
        console.log(`  ${prefix}: ${skillDirs.length} dirs, ${skillDirs.filter(d => hasSkillMd(path.join(root, d))).length} with SKILL.md`);
    }
    
    console.log(`\n📦 Found ${allSkills.length} skills with SKILL.md\n`);
    
    // Sort: smart-skill-router first, then by category
    allSkills.sort((a, b) => {
        if (a.name === 'smart-skill-router') return -1;
        if (b.name === 'smart-skill-router') return 1;
        return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
    });
    
    console.log('🚀 Starting installation...\n');
    
    const results = { success: [], failed: [], skipped: [] };
    
    for (let i = 0; i < allSkills.length; i++) {
        const skill = allSkills[i];
        const progress = `[${i + 1}/${allSkills.length}]`;
        
        if (!fs.existsSync(skill.path)) {
            console.log(`${progress} ⏭️  SKIP (missing): ${skill.name}`);
            results.skipped.push(skill.name);
            continue;
        }
        
        process.stdout.write(`${progress} Installing: ${skill.name}... `);
        const result = installSkill(skill.path, skill.name);
        
        if (result.success) {
            console.log('✅');
            results.success.push(skill.name);
        } else {
            console.log(`❌ ${result.error?.split('\n')[0] || 'Unknown error'}`);
            results.failed.push({ name: skill.name, error: result.error });
        }
        
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 100));
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 INSTALLATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Successful: ${results.success.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);
    console.log(`⏭️  Skipped: ${results.skipped.length}`);
    console.log(`📦 Total: ${allSkills.length}`);
    
    if (results.failed.length > 0) {
        console.log('\n❌ Failed skills:');
        results.failed.forEach(f => console.log(`  - ${f.name}: ${f.error?.split('\n')[0]}`));
    }
    
    // Verify smart-skill-router is installed
    const hasSmartRouter = results.success.includes('smart-skill-router');
    console.log(`\n🎯 Smart Skill Router: ${hasSmartRouter ? '✅ INSTALLED' : '❌ MISSING'}`);
    
    if (!hasSmartRouter) {
        console.log('\n⚠️  IMPORTANT: Install smart-skill-router manually:');
        console.log('   omniroute skills install --from-file "C:\\Users\\MY PC\\.codex\\skills\\smart-skill-router\\SKILL.md" --type custom --enable');
    }
    
    console.log('\n🔍 Verifying installation...');
    try {
        const listOutput = execSync('omniroute skills list', { stdio: 'pipe', shell: true }).toString();
        const installedCount = (listOutput.match(/^\|/gm) || []).length;
        console.log(`📋 OmniRoute reports ${installedCount} skills installed`);
    } catch (e) {
        console.log('Could not verify with omniroute skills list');
    }
    
    // Save results
    fs.writeFileSync(
        path.join(__dirname, 'install-results.json'),
        JSON.stringify(results, null, 2)
    );
    console.log('\n💾 Results saved to install-results.json');
}

main().catch(console.error);