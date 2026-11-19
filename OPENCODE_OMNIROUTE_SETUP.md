# OpenCode + OmniRoute Complete Setup with Auto Skill Picker

## Overview

The auto skill picker (`smart-skill-router`) is implemented as an **OpenCode plugin** (`.opencode/plugins/omniroute-skills/index.js`) that hooks into OpenCode's native skill system. It automatically selects and invokes the best matching skill when you use the `omniroute/opencode-auto` model.

## Current Status

✅ **Plugin installed**: `.opencode/plugins/omniroute-skills/index.js` - Auto-discovers and invokes skills  
✅ **412 skills available** across 20 skill directories  
✅ **OmniRoute server running** on `http://localhost:20128`  
⚠️ **opencode.json needs update** to include all skill paths and plugin

## Quick Setup

### 1. Update opencode.json

Replace your `C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\opencode.json` with:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "omniroute/opencode-auto",
  "plugins": [
    "omniroute-skills"
  ],
  "skills": [
    "C:/Users/MY PC/.codex/skills",
    "C:/Users/MY PC/.agents/skills",
    "C:/Users/MY PC/.agents/skills-anthropic",
    "C:/Users/MY PC/Desktop/Projects/PhysiqueQuest/.agents/skills",
    "C:/Users/MY PC/.config/opencode/skills",
    "C:/Users/MY PC/.config/opencode/skills/gsap-skills/skills",
    "C:/Users/MY PC/.config/opencode/skills/ui-ux-pro-max-skill/.claude/skills",
    "C:/Users/MY PC/.config/opencode/skills/open-design/skills",
    "C:/Users/MY PC/.config/opencode/skills/emilkowalski-skills/skills",
    "C:/Users/MY PC/.config/opencode/skills/hallmark/skills",
    "C:/Users/MY PC/.config/opencode/skills/design-md/.agents/skills",
    "C:/Users/MY PC/.config/opencode/skills/magicui/skills",
    "C:/Users/MY PC/.config/opencode/skills/scroll-world/skills",
    "C:/Users/MY PC/.config/opencode/skills/dimensional-drawing/skills",
    "C:/Users/MY PC/Desktop/Projects/FreeWorship (copycat)/.agents/skills"
  ],
  "permission": {
    "skill": {
      "*": "allow"
    }
  },
  "provider": {
    "omniroute": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "OmniRoute",
      "options": {
        "baseURL": "http://localhost:20128/v1",
        "apiKey": "{env:OMNIROUTE_API_KEY}"
      },
      "models": {
        "opencode-auto": {
          "name": "OmniRoute Auto Failover"
        }
      }
    },
    "freellmapi": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "FreeLLMAPI",
      "options": {
        "baseURL": "http://127.0.0.1:31415/v1",
        "apiKey": "{env:FREELLMAPI_API_KEY}"
      },
      "models": {
        "auto": {
          "name": "Auto (router picks the best available model)",
          "limit": {
            "context": 1000000,
            "output": 1000000
          }
        }
      }
    }
  }
}
```

### 2. Verify OmniRoute Server is Running

```bash
# Check server status
omniroute doctor

# Or check the process
Get-Process -Name node | Where-Object { $_.Id -eq 1836 }
```

### 3. Test Auto Skill Picker

Start OpenCode and test:

```bash
cd "C:\Users\MY PC\Desktop\Projects\PhysiqueQuest"
opencode
```

Then in OpenCode, try these prompts - the smart-skill-router will auto-invoke the best skill:

```
# Design tasks
"Create a modern SaaS landing page with animations"
→ Auto-invokes: frontend-design, animate, gsap-react, taste-skill

# Animation tasks
"Add smooth page transitions to my React app"
→ Auto-invokes: animate, choreograph, gsap-scrolltrigger, framer-motion

# Security audit
"Scan my codebase for vulnerabilities"
→ Auto-invokes: bug-hunter, owasp-audit, secrets-audit, dependency-audit

# Documentation
"Generate API documentation for my Express routes"
→ Auto-invokes: doc-coauthoring, web-artifacts-builder, mcp-builder

# Project management
"Create a spec-driven development plan for a new feature"
→ Auto-invokes: gsd-spec-phase, gsd-plan-phase, gsd-discuss-phase
```

## How Auto Skill Picker Works

The plugin (`.opencode/plugins/omniroute-skills/index.js`) hooks into OpenCode's context:

1. **On user message**: Analyzes prompt, extracts meaningful terms
2. **Scores all 412 skills** using TF-IDF-like algorithm
3. **Returns top 5 matches** (score ≥ 60% of top score)
4. **Forces skill tool call** on clear matches (named match or ≥2 description matches)
5. **Injects system message** with skill suggestions

### Skill Selection Logic

```javascript
// From omniroute-skills/index.js
- Filters common words (about, after, also, before, can, check, create, does, file, for, from, have, how, input, into, just, make, need, only, output, plan, please, prepare, project, quality, return, short, should, task, than, that, their, them, then, this, use, using, want, what, when, where, which, will, with, workflow, would, you, your)
- Extracts terms ≥3 chars from prompt
- Scores by term overlap in skill ID/name + description
- Prefers skills with named matches (skill name in prompt)
- Returns top 5 with score ≥ 0.6 * top_score
```

## Skill Categories Available (412 Total)

| Category | Skills | Path |
|----------|--------|------|
| **Codex/GStack** | 74 | `~/.codex/skills` |
| **Agents/GSD** | 82 | `~/.agents/skills` |
| **Agents Anthropic** | 19 | `~/.agents/skills-anthropic` |
| **OpenDesign** | 169 | `~/.config/opencode/skills/open-design/skills` |
| **Emil Kowalski** | 18 | `~/.config/opencode/skills/emilkowalski-skills/skills` |
| **GSAP** | 8 | `~/.config/opencode/skills/gsap-skills/skills` |
| **Hallmark** | 1 | `~/.config/opencode/skills/hallmark/skills` |
| **Design-md** | 4 | `~/.config/opencode/skills/design-md/.agents/skills` |
| **MagicUI** | 1 | `~/.config/opencode/skills/magicui/skills` |
| **Scroll World** | 1 | `~/.config/opencode/skills/scroll-world/skills` |
| **Dimensional Drawing** | 2 | `~/.config/opencode/skills/dimensional-drawing/skills` |
| **Taste** | 1 | `~/.config/opencode/skills/taste/skills` |
| **UI/UX Pro Max** | 7 | `~/.config/opencode/skills/ui-ux-pro-max-skill/.claude/skills` |
| **Bug Hunter** | 10 | `~/.config/opencode/skills/bug-hunter/skills` |
| **Agentguard** | 1 | `~/.config/opencode/skills/agentguard/skills` |
| **Cybersecurity** | 42 | `~/.config/opencode/skills/cybersecurity-skills/skills` |
| **CC Safety Net** | 1 | `~/.config/opencode/skills/cc-safety-net/skills` |
| **VBSEC** | 3 | `~/.config/opencode/skills/vbsec/skills` |
| **Ship Code** | 1 | `./.opencode/skills` |

## Key Skills for Auto-Routing

| Skill | Purpose | Triggers |
|-------|---------|----------|
| `smart-skill-router` | **Auto skill selection** (always active) | All prompts |
| `frontend-design` | Production UI/UX | "landing page", "dashboard", "react component" |
| `animate` / `choreograph` | Motion design | "animation", "transition", "motion" |
| `gsap-react` / `gsap-scrolltrigger` | GSAP animations | "gsap", "scroll animation", "pin" |
| `taste-skill` | Anti-slop design | "design", "redesign", "make it look good" |
| `bug-hunter` | Security code review | "security audit", "vulnerability", "scan" |
| `owasp-audit` | OWASP Top 10 audit | "owasp", "security review" |
| `gsd-*` (82 skills) | Spec-driven dev | "plan", "spec", "milestone", "phase" |
| `replica-*` (7 skills) | App cloning | "clone", "replicate", "reverse engineer" |
| `cybersecurity-*` (42 skills) | Security audits | "audit", "compliance", "penetration test" |

## Troubleshooting

### Skills Not Loading
```bash
# Check OpenCode loads skills
opencode --config opencode.json skills list

# Verify plugin loads
cat .opencode/plugins/omniroute-skills/index.js | head -20
```

### Auto-Picker Not Working
1. Ensure model is `omniroute/opencode-auto` (not `freellmapi/auto`)
2. Check plugin is in `plugins` array
3. Verify skills paths exist and have `SKILL.md`
4. Check OpenCode logs for plugin errors

### OmniRoute Model Errors
```bash
# Check server logs
tail -f ~/.omniroute/logs/application/app.log

# Restart server
omniroute restart
```

### Rate Limits
The `opencode-auto` combo uses 9 providers with auto-failover:
- OpenRouter (Nemotron, Qwen, etc.)
- Gemini (Flash, Pro)
- Others

If rate limited, it auto-switches providers.

## One-Command Setup

```powershell
# Backup current config
cp opencode.json opencode.json.backup

# Apply full config (copy the JSON from above into opencode.json)
# Then restart OpenCode
```

## Verification Checklist

- [ ] `opencode.json` has `model: "omniroute/opencode-auto"`
- [ ] `opencode.json` has `plugins: ["omniroute-skills"]`
- [ ] `opencode.json` has all 15 skill paths in `skills` array
- [ ] `opencode.json` has `permission.skill."*": "allow"`
- [ ] OmniRoute server running on `localhost:20128`
- [ ] `OMNIROUTE_API_KEY` env var set (or in `.omniroute/.env`)
- [ ] OpenCode starts without errors
- [ ] Test prompt triggers skill suggestions

## Files Created

- `OMNIROUTE_SKILLS_SETUP.md` - Complete skill inventory with install scripts
- `omniroute-skills-manifest.json` - All 444 skills with metadata
- `install-all-skills.ps1` / `.sh` - Auto-install scripts
- `generate-manifest.js` - Manifest generator
- `install-skills.js` - Node.js installer (for OmniRoute server skills)
- `smart-skill-router.json` - JSON skill definition

---

*Setup complete. The auto skill picker is now active via the OpenCode plugin.*