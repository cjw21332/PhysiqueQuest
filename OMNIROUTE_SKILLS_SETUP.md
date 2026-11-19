# OmniRoute Skills Complete Setup

This document provides a comprehensive setup to install all 412 available skills into OmniRoute and enable the auto skill picker (smart-skill-router).

## Quick Start

Run the following commands in your terminal to install all skills and configure auto skill routing:

```bash
# 1. Install the smart-skill-router first (enables auto skill selection)
omniroute skills install --from-file "C:\Users\MY PC\.codex\skills\smart-skill-router\SKILL.md" --type custom --enable

# 2. Install all Codex skills (gstack, replica, etc.)
omniroute skills install --from-file "C:\Users\MY PC\.codex\skills\gstack\SKILL.md" --type custom --enable
# ... repeat for each skill directory

# 3. Install all Agent skills (GSD, design, etc.)
omniroute skills install --from-file "C:\Users\MY PC\.agents\skills\frontend-design\SKILL.md" --type custom --enable
# ... repeat for each skill directory

# 4. Install OpenDesign skills (169 skills)
omniroute skills install --from-file "C:\Users\MY PC\.config\opencode\skills\open-design\skills\frontend-design\SKILL.md" --type custom --enable
# ... repeat for each skill directory

# 5. Install specialized skills (animation, cybersecurity, etc.)
# ... repeat for each skill directory
```

## Automated Installation Script

Since there are 412 skills, use this PowerShell script to automate installation:

```powershell
# Save as install-all-skills.ps1 and run in PowerShell

$skillPaths = @(
    # Codex skills (74)
    "C:\Users\MY PC\.codex\skills\gstack\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-autoplan\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-benchmark\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-benchmark-models\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-browse\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-canary\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-captain\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-careful\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-claude-code\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-context-restore\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-context-save\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-cso\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-design-consultation\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-design-html\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-design-motion\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-design-review\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-design-shotgun\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-deslop-shared-libs\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-devex-review\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-diagram\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-document-generate\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-document-release\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-eval-plan\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-freeze\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-guard\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-health\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-investigate\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-ios-clean\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-ios-design-review\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-ios-fix\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-ios-qa\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-ios-sync\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-land-and-deploy\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-landing-report\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-learn\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-make-pdf\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-modernize\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-office-hours\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-open-gstack-browser\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-pair-agent\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-plan-ceo-review\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-plan-design-review\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-plan-devex-review\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-plan-eng-review\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-plan-tune\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-qa\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-qa-only\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-retro\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-review\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-scrape\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-setup-browser-cookies\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-setup-deploy\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-setup-gbrain\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-ship\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-skillify\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-spec\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-sync-gbrain\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-test-audit\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-ubicloud\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-unfreeze\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-upgrade\SKILL.md",
    "C:\Users\MY PC\.codex\skills\gstack-write-skill\SKILL.md",
    "C:\Users\MY PC\.codex\skills\replica-architect\SKILL.md",
    "C:\Users\MY PC\.codex\skills\replica-backend\SKILL.md",
    "C:\Users\MY PC\.codex\skills\replica-brand\SKILL.md",
    "C:\Users\MY PC\.codex\skills\replica-build\SKILL.md",
    "C:\Users\MY PC\.codex\skills\replica-deploy\SKILL.md",
    "C:\Users\MY PC\.codex\skills\replica-design\SKILL.md",
    "C:\Users\MY PC\.codex\skills\replica-diff\SKILL.md",
    "C:\Users\MY PC\.codex\skills\replica-entrepreneur\SKILL.md",
    "C:\Users\MY PC\.codex\skills\replica-launch\SKILL.md",
    "C:\Users\MY PC\.codex\skills\replica-recon\SKILL.md",
    "C:\Users\MY PC\.codex\skills\replica-test\SKILL.md",
    "C:\Users\MY PC\.codex\skills\smart-skill-router\SKILL.md",
    
    # Agents skills (82)
    "C:\Users\MY PC\.agents\skills\banner-design\SKILL.md",
    "C:\Users\MY PC\.agents\skills\brand\SKILL.md",
    "C:\Users\MY PC\.agents\skills\design\SKILL.md",
    "C:\Users\MY PC\.agents\skills\design-system\SKILL.md",
    "C:\Users\MY PC\.agents\skills\find-skills\SKILL.md",
    "C:\Users\MY PC\.agents\skills\frontend-design\SKILL.md",
    # ... GSD skills (74 skills)
    "C:\Users\MY PC\.agents\skills\gsd-add-tests\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-ai-integration-phase\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-audit-fix\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-audit-milestone\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-audit-uat\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-autonomous\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-capture\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-cleanup\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-code-review\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-complete-milestone\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-config\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-debug\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-discuss-phase\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-docs-update\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-eval-review\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-execute-phase\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-explore\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-extract-learnings\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-fast\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-forensics\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-graphify\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-health\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-help\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-import\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-inbox\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-ingest-docs\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-manager\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-map-codebase\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-mempalace-capture\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-mempalace-recall\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-milestone-summary\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-mvp-phase\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-new-milestone\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-new-project\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-next\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-ns-context\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-ns-ideate\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-ns-manage\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-ns-project\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-ns-review\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-ns-workflow\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-onboard\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-pause-work\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-phase\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-plan-phase\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-plan-review-convergence\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-pr-branch\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-profile-user\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-progress\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-quick\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-quick-batch\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-resume-work\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-review\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-review-backlog\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-secure-phase\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-settings\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-ship\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-sketch\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-spec-phase\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-spike\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-stats\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-surface\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-thread\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-ui-phase\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-ui-review\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-ultraplan-phase\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-undo\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-update\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-validate-phase\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-verify-work\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-workspace\SKILL.md",
    "C:\Users\MY PC\.agents\skills\gsd-workstreams\SKILL.md",
    "C:\Users\MY PC\.agents\skills\impeccable\SKILL.md",
    "C:\Users\MY PC\.agents\skills\slides\SKILL.md",
    "C:\Users\MY PC\.agents\skills\ui-styling\SKILL.md",
    "C:\Users\MY PC\.agents\skills\ui-ux-pro-max\SKILL.md",
    
    # Agents Anthropic skills (19)
    "C:\Users\MY PC\.agents\skills-anthropic\skills\academy-guide\SKILL.md",
    "C:\Users\MY PC\.agents\skills-anthropic\skills\algorithmic-art\SKILL.md",
    "C:\Users\MY PC\.agents\skills-anthropic\skills\brand-guidelines\SKILL.md",
    "C:\Users\MY PC\.agents\skills-anthropic\skills\canvas-design\SKILL.md",
    "C:\Users\MY PC\.agents\skills-anthropic\skills\claude-api\SKILL.md",
    "C:\Users\MY PC\.agents\skills-anthropic\skills\discernment-nudge\SKILL.md",
    "C:\Users\MY PC\.agents\skills-anthropic\skills\doc-coauthoring\SKILL.md",
    "C:\Users\MY PC\.agents\skills-anthropic\skills\docx\SKILL.md",
    "C:\Users\MY PC\.agents\skills-anthropic\skills\frontend-design\SKILL.md",
    "C:\Users\MY PC\.agents\skills-anthropic\skills\internal-comms\SKILL.md",
    "C:\Users\MY PC\.agents\skills-anthropic\skills\mcp-builder\SKILL.md",
    "C:\Users\MY PC\.agents\skills-anthropic\skills\pdf\SKILL.md",
    "C:\Users\MY PC\.agents\skills-anthropic\skills\pptx\SKILL.md",
    "C:\Users\MY PC\.agents\skills-anthropic\skills\skill-creator\SKILL.md",
    "C:\Users\MY PC\.agents\skills-anthropic\skills\slack-gif-creator\SKILL.md",
    "C:\Users\MY PC\.agents\skills-anthropic\skills\theme-factory\SKILL.md",
    "C:\Users\MY PC\.agents\skills-anthropic\skills\web-artifacts-builder\SKILL.md",
    "C:\Users\MY PC\.agents\skills-anthropic\skills\webapp-testing\SKILL.md",
    "C:\Users\MY PC\.agents\skills-anthropic\skills\xlsx\SKILL.md",
    
    # PhysiqueQuest agents skills
    "C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\.agents\skills\frontend-design\SKILL.md",
    
    # OpenDesign skills (169) - key ones
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\frontend-design\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\frontend-dev\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\frontend-skill\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\frontend-slides\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\design-review\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\design-consultation\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\design-brief\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\design-md\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\brand-extract\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\brand-guidelines\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\brandkit\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\copywriting\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\creative-director\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\d3-visualization\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\artifacts-builder\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\imagegen\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\imagegen-frontend-web\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\imagegen-frontend-mobile\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\imagen\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\fal-generate\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\fal-3d\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\fal-image-edit\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\fal-video-edit\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\fal-vision\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\fal-upscale\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\fal-restore\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\fal-train\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\fal-tryon\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\fal-kling-o3\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\fal-lip-sync\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\fal-realtime\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\replicate\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\remotion\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\sora\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\video-hyperframes\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\video-downloader\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\youtube-clipper\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\animate\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\choreograph\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\gestures\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\animation-performance\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\improve-animations\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\remove-animations\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\review-animations\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\find-animation-opportunities\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\animation-vocabulary\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\mobile-native\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\apple-design\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\apple-hig\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\gsap-core\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\gsap-react\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\gsap-scrolltrigger\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\gsap-timeline\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\gsap-plugins\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\gsap-frameworks\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\gsap-performance\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\gsap-utils\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\emil-design-eng\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\emilkowalski-motion\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\impeccable-design-polish\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\break-ui\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\ask-sonner\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\prototype\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\pick-ui-library\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\write-swift\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\threejs\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\shader-dev\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\webgl-experience\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\webgl-raymarched-hero\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\webgl-particle-galaxy\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\webgl-liquid-metal\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\webgl-liquid-iridescence\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\webgl-holographic-foil\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\webgl-halftone-drift\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\webgl-depth-gallery\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\webgl-distortion-grain\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\webgl-caustic-pool\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\webgl-aurora-veil\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\mockup-device-3d\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\full-page-screenshot\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\screenshots-marketing\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\image-enhancer\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\image-to-code-skill\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\hand-drawn-diagrams\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\diagram\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\pptx\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\pptx-generator\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\pptx-html-fidelity-audit\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\slides\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\html-ppt\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\docs-page\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\faq-page\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\blog-post\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\article-magazine\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\email-marketing\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\landing-page\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\waitlist-page\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\pricing-page\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\saas-landing\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\dashboard\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\data-report\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\finance-report\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\eng-runbook\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\meeting-notes\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\invoice\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\release-notes-one-pager\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\resume-modern\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\card-twitter\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\card-xiaohongshu\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\social-x-post-card\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\social-reddit-card\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\social-spotify-card\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\github-dashboard\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\social-media-dashboard\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\social-carousel\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\web-clone\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\web-prototype\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\web-prototype-taste-editorial\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\web-prototype-taste-brutalist\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\web-prototype-taste-soft\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\mobile-app\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\mobile-onboarding\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\login-flow\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\web-design-guidelines\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\platform-design\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\accessibility-audit\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\shadcn-ui\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\stitch-loop\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\stitch-skill\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\theme-factory\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\color-expert\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\minimalist-skill\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\brutalist-skill\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\soft-skill\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\taste-skill\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\taste-skill-v1\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\design-taste-frontend\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\design-taste-frontend-v1\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\redesign-skill\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\reference-design-contract\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\enhance-prompt\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\marketing-psychology\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\domain-name-brainstormer\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\doc\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\docx\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\pdf\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\xlsx\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\minimax-docx\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\minimax-pdf\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\speech\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\slack-gif-creator\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\gif-sticker-maker\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\hatch-pet\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\figma-use\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\figma-extract\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\figma-generate-design\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\figma-generate-library\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\figma-implement-design\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\figma-create-design-system-rules\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\figma-create-new-file\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\figma-code-connect-components\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\pixelbin-media\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\library-curator\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\export-download-debugging\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\export-nextjs-handoff\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\create-hyperframes-launch\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\create-image-campaign\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\create-live-artifact-ops\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\create-prototype-dashboard\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\create-slides-pitch\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\create-video-storyboard\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\deploy-vercel-static\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\od-media-generation\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\od-new-generation\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\od-default\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\od-code-migration\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\od-figma-migration\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\od-next-strategy\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\od-next-media-inputs\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\od-plugin-authoring\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\od-plugin-contribute-open-design\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\od-plugin-publish-github\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\od-share-to-community\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\od-tune-collab\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\od-web-effect-extractor\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\extend-plugin-author\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\share-github-pr\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\refine-critique-loop\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\import-screenshot-to-prototype\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\import-smoke-test\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\open-design\skills\registry-starter\SKILL.md",
    
    # Emil Kowalski skills (18)
    "C:\Users\MY PC\.config\opencode\skills\emilkowalski-skills\skills\animate\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\emilkowalski-skills\skills\animate-expo\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\emilkowalski-skills\skills\animation-performance\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\emilkowalski-skills\skills\animation-vocabulary\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\emilkowalski-skills\skills\apple-design\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\emilkowalski-skills\skills\ask-sonner\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\emilkowalski-skills\skills\break-ui\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\emilkowalski-skills\skills\choreograph\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\emilkowalski-skills\skills\emil-design-eng\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\emilkowalski-skills\skills\find-animation-opportunities\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\emilkowalski-skills\skills\gestures\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\emilkowalski-skills\skills\improve-animations\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\emilkowalski-skills\skills\mobile-native\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\emilkowalski-skills\skills\pick-ui-library\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\emilkowalski-skills\skills\prototype\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\emilkowalski-skills\skills\remove-animations\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\emilkowalski-skills\skills\review-animations\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\emilkowalski-skills\skills\write-swift\SKILL.md",
    
    # GSAP skills (8)
    "C:\Users\MY PC\.config\opencode\skills\gsap-skills\skills\gsap-core\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\gsap-skills\skills\gsap-frameworks\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\gsap-skills\skills\gsap-performance\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\gsap-skills\skills\gsap-plugins\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\gsap-skills\skills\gsap-react\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\gsap-skills\skills\gsap-scrolltrigger\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\gsap-skills\skills\gsap-timeline\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\gsap-skills\skills\gsap-utils\SKILL.md",
    
    # Hallmark skills
    "C:\Users\MY PC\.config\opencode\skills\hallmark\skills\hallmark\SKILL.md",
    
    # Design-md skills (4)
    "C:\Users\MY PC\.config\opencode\skills\design-md\.agents\skills\agent-dx-cli-scale\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\design-md\.agents\skills\ink\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\design-md\.agents\skills\tdd\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\design-md\.agents\skills\typed-service-contracts\SKILL.md",
    
    # MagicUI skills
    "C:\Users\MY PC\.config\opencode\skills\magicui\skills\magic-ui\SKILL.md",
    
    # Scroll World skills
    "C:\Users\MY PC\.config\opencode\skills\scroll-world\skills\scroll-world\SKILL.md",
    
    # Dimensional Drawing skills (2)
    "C:\Users\MY PC\.config\opencode\skills\dimensional-drawing\skills\dimensional-drawing\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\dimensional-drawing\skills\dimensional-drawing-motion\SKILL.md",
    
    # Taste skills
    "C:\Users\MY PC\.config\opencode\skills\taste\skills\taste-skill\SKILL.md",
    
    # UI/UX Pro Max skills (7)
    "C:\Users\MY PC\.config\opencode\skills\ui-ux-pro-max-skill\.claude\skills\banner-design\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\ui-ux-pro-max-skill\.claude\skills\brand\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\ui-ux-pro-max-skill\.claude\skills\design\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\ui-ux-pro-max-skill\.claude\skills\design-system\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\ui-ux-pro-max-skill\.claude\skills\slides\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\ui-ux-pro-max-skill\.claude\skills\ui-styling\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\ui-ux-pro-max-skill\.claude\skills\ui-ux-pro-max\SKILL.md",
    
    # Bug Hunter skills (10)
    "C:\Users\MY PC\.config\opencode\skills\bug-hunter\skills\commit-security-scan\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\bug-hunter\skills\doc-lookup\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\bug-hunter\skills\fixer\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\bug-hunter\skills\hunter\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\bug-hunter\skills\recon\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\bug-hunter\skills\referee\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\bug-hunter\skills\security-review\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\bug-hunter\skills\skeptic\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\bug-hunter\skills\threat-model-generation\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\bug-hunter\skills\vulnerability-validation\SKILL.md",
    
    # Agentguard skills
    "C:\Users\MY PC\.config\opencode\skills\agentguard\skills\agentguard\SKILL.md",
    
    # Cybersecurity skills (42)
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\agent-supply-chain-audit\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\ai-risk-management\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\api-audit\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\breach-patterns\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\business-logic-testing\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\cicd-security\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\cloud-audit\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\container-audit\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\control-audit\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\crypto-audit\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\csf-mapping\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\dependency-audit\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\disk-forensics\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\finding-triage\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\fuzzing-harness\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\hipaa-audit\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\iam-audit\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\incident-triage\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\log-watch\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\malware-triage\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\mobile-audit\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\native-code-review\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\osint-recon\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\owasp-audit\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\patch-sweep\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\pci-audit\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\personal-opsec\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\privacy-engineering\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\prompt-injection\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\recon\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\red-team-engagement\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\scanner-pipeline\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\secrets-audit\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\security-comms\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\security-start\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\siem-detection\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\soc-operations\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\threat-hunting\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\threat-modeling\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\variant-analysis\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\vuln-research\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\cybersecurity-skills\skills\web-pentest\SKILL.md",
    
    # CC Safety Net skills
    "C:\Users\MY PC\.config\opencode\skills\cc-safety-net\skills\cc-safety-net\SKILL.md",
    
    # VBSEC skills (3)
    "C:\Users\MY PC\.config\opencode\skills\vbsec\skills\antigravity\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\vbsec\skills\codex\SKILL.md",
    "C:\Users\MY PC\.config\opencode\skills\vbsec\skills\vbs-scan-security\SKILL.md",
    
    # Ship code skill
    "C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\.opencode\skills\ship-code\SKILL.md"
)

$successCount = 0
$failCount = 0

foreach ($skillPath in $skillPaths) {
    if (Test-Path $skillPath) {
        Write-Host "Installing: $skillPath" -ForegroundColor Cyan
        try {
            omniroute skills install --from-file $skillPath --type custom --enable
            $successCount++
            Write-Host "  ✓ Success" -ForegroundColor Green
        }
        catch {
            $failCount++
            Write-Host "  ✗ Failed: $_" -ForegroundColor Red
        }
    }
    else {
        $failCount++
        Write-Host "  ✗ Not found: $skillPath" -ForegroundColor Red
    }
}

Write-Host "`n=== Summary ===" -ForegroundColor Yellow
Write-Host "Successful: $successCount" -ForegroundColor Green
Write-Host "Failed: $failCount" -ForegroundColor Red
```

## Manual Verification

After installation, verify all skills are loaded:

```bash
# List all installed skills
omniroute skills list

# Verify smart-skill-router is enabled
omniroute skills get smart-skill-router

# Test auto skill selection
omniroute chat "Create a modern landing page with animations"
```

## Auto Skill Picker Configuration

The `smart-skill-router` skill enables automatic skill selection. Once installed and enabled, OmniRoute will:

1. **Analyze your prompt** to understand the task
2. **Match against available skills** using keyword/term matching
3. **Auto-invoke the best matching skill** without requiring explicit skill names
4. **Fall back to general capability** when no skill matches

### How It Works

The smart-skill-router uses a TF-IDF-like scoring algorithm:
- Extracts meaningful terms from your prompt (filters common words)
- Scores each skill by term overlap in skill name/description
- Returns top 5 matches with score ≥ 60% of top score
- Forces skill tool call on clear matches (named match or ≥2 description matches)

### Configuration in opencode.json

Your `opencode.json` should include the smart-skill-router plugin:

```json
{
  "plugins": [
    "omniroute-skills"
  ],
  "model": "omniroute/opencode-auto",
  "provider": {
    "omniroute": {
      "models": {
        "opencode-auto": {
          "name": "OmniRoute Auto Failover"
        }
      }
    }
  }
}
```

The plugin is already installed at `.opencode/plugins/omniroute-skills/index.js` and will auto-activate when using the `omniroute/opencode-auto` model.

## Skill Categories Summary

| Category | Count | Description |
|----------|-------|-------------|
| **Codex / GStack** | 74 | Engineering workflow, deployment, debugging, iOS QA |
| **Agents / GSD** | 82 | Project management, spec-driven development, milestones |
| **Agents Anthropic** | 19 | Documentation, brand, design, API skills |
| **OpenDesign** | 169 | Design, animation, video, 3D, frontend, Figma |
| **Emil Kowalski** | 18 | Animation, motion, UI polish, gestures |
| **GSAP** | 8 | GreenSock animation library skills |
| **Hallmark** | 1 | High-end web design |
| **Design-md** | 4 | CLI scaling, TDD, typed contracts |
| **MagicUI** | 1 | shadcn/ui component library |
| **Scroll World** | 1 | 3D scroll experiences |
| **Dimensional Drawing** | 2 | Technical drawings, motion |
| **Taste** | 1 | Anti-slop design |
| **UI/UX Pro Max** | 7 | Premium design system |
| **Bug Hunter** | 10 | Security code review |
| **Agentguard** | 1 | AI agent security |
| **Cybersecurity** | 42 | Full security audit suite |
| **CC Safety Net** | 1 | Safety guardrails |
| **VBSEC** | 3 | Security scanning |
| **Ship Code** | 1 | Git commit/push automation |
| **Total Unique** | **412** | |

## Troubleshooting

### Skill Not Loading
```bash
# Check if skill file exists and has valid SKILL.md
cat "C:\path\to\skill\SKILL.md"

# Reinstall with verbose output
omniroute skills install --from-file "path\SKILL.md" --type custom --enable -v
```

### Auto Skill Picker Not Working
1. Ensure `smart-skill-router` is installed and enabled
2. Check plugin is loaded: `omniroute skills list | findstr smart-skill-router`
3. Use model `omniroute/opencode-auto` (not freellmapi/auto)
4. Verify plugin in `.opencode/plugins/omniroute-skills/index.js`

### Rate Limits / Model Errors
The omniroute server auto-fails across 9+ providers (OpenRouter, Gemini, etc.). Check logs:
```bash
tail -f "C:\Users\MY PC\.omniroute\logs\application\app.log"
```

## One-Command Install (Recommended)

Run this single command to install everything:

```powershell
# In PowerShell as Administrator
Set-ExecutionPolicy Bypass -Scope Process -Force
irm "https://raw.githubusercontent.com/your-repo/install-all-skills.ps1" | iex
```

Or save the PowerShell script above as `install-all-skills.ps1` and run:
```powershell
.\install-all-skills.ps1
```

---

*Generated on 2026-11-10 | 412 unique skills cataloged*


## Claude Code Skill Inventory (2026-11-11)

Measured for the Claude Code installation on this machine. See note about OmniRoute/opencode catalog at the top of this file — the 412 in the table above is the OmniRoute/opencode catalog, not Claude Code.

## What this Claude Code session actually exposes

| Source | Skills exposed |
|---|---|
| user (`~/.claude/skills`) | 155 |
| `dataviz` (harness) | 1 |
| ponytail@DietrichGebert | 6 |
| superpowers@claude-plugins-official | 15 |
| mattpocock-skills@mattpocock | 27 (manifest; 39 folders on disk) |
| document-skills@anthropic-agent-skills | 4 (`docx`, `pdf`, `pptx`, `xlsx`) |
| example-skills@anthropic-agent-skills | 12 |
| anthropic-skills (inline/builtin in this session) | 9 |
| ecc@ecc | 314 on disk (manifest reports 412 incl. 98 legacy command shims) |
| Harness built-ins (`update-config`, `keybindings-help`, `code-review`, `simplify`, `fewer-permission-prompts`, `loop`, `claude-api`, `workflow-authoring`, `run`, `plugin-authoring`, `init`, `security-review`) | 12 |
| **Grand total actually usable here** | **≈555** (≈653 with ecc's manifest 412) |

## Skill files on disk (all roots, incl. other apps)

| Root | SKILL.md files |
|---|---|
| user (`~/.claude/skills`) | 155 (exposed); nested copies inside `gstack/` are duplicates, excluded |
| ponytail plugin | 6 |
| superpowers plugin | 15 |
| mattpocock plugin | 39 |
| document-skills cache | 19 (only 4 enabled) |
| example-skills cache | 19 (only 12 enabled) |
| ecc plugin | 314 |
| project repo (`.agents/skills`, `.opencode/skills`) | 2 |
| Codex (`~/.codex/skills`) | 82 |
| Agents (`~/.agents/skills`) | 82 |
| opencode (`~/.config/opencode/skills`) | ~505 unique names (676 files, nested duplicates) |
| **Total on disk** | **~1,240 unique / ~1,410 files** |

Notes:
- The two Anthropic caches contain the same 19 folders; only the 16 skills named in the enabled plugins' manifests are loaded.
- ecc's `docs/` (incl. `docs/es/`) copies are excluded everywhere. `.agents` mirror directories inside `~/.claude/skills/gstack` are excluded — they duplicate the top-level gstack install.
- `~/.codex/skills` and `~/.agents/skills` are different sets (Codex: gstack/replica/smart-skill-router + 5 `.system`; agents: gsd-*, design/impeccable).
- `context-mode@context-mode` is listed as enabled in settings but is not installed on disk (no cache/marketplace entry found).

## user (~/.claude/skills) — 155

| # | Skill | Description |
|---|---|---|
| 1 | `_gstack-command` | Router for the gstack skill suite. (gstack) |
| 2 | `autoplan` | Auto-review pipeline — reads the full CEO, design, eng, and DX review skills from disk and runs them sequentially with auto-decisions using  |
| 3 | `benchmark` | Web performance regression detection. (gstack) |
| 4 | `benchmark-models` | Cross-model benchmark for gstack skills. (gstack) |
| 5 | `browse` | Drive a real browser through Aside: open a page, read it, click through a flow, take screenshots, check console errors. (gstack) |
| 6 | `canary` | Post-deploy canary monitoring. (gstack) |
| 7 | `captain` | Run a crew of coding agents from one controller (also /crew): lanes send READY blocks and never merge; the controller merges through trains, |
| 8 | `careful` | Safety guardrails for destructive commands. (gstack) |
| 9 | `claude-code` | | |
| 10 | `codex` | OpenAI Codex CLI wrapper — three modes. (gstack) |
| 11 | `connect-chrome` | Launch GStack Browser — AI-controlled Chromium with the sidebar extension baked in. |
| 12 | `context-restore` | Restore working context saved earlier by /context-save. (gstack) |
| 13 | `context-save` | Save working context. (gstack) |
| 14 | `cso` | Security audit: supported static findings; qualified profiles add reproduction and repair candidates. (gstack) |
| 15 | `design-consultation` | Design consultation: understands your product, researches the landscape, proposes a complete design system (aesthetic, typography, color, la |
| 16 | `design-html` | Design finalization: generates production-quality Pretext-native HTML/CSS. (gstack) |
| 17 | `design-motion` | Design motion: animate an approved design into a seamless MP4 and GIF loop. (gstack) |
| 18 | `design-review` | Designer's eye QA: finds visual inconsistency, spacing issues, hierarchy problems, AI slop patterns, and slow interactions — then fixes them |
| 19 | `design-shotgun` | Design shotgun: generate multiple AI design variants, open a comparison board, collect structured feedback, and iterate. (gstack) |
| 20 | `deslop-shared-libs` | Find worthwhile shared-code extractions in recent work. (gstack) |
| 21 | `devex-review` | Live developer experience audit. (gstack) |
| 22 | `diagram` | Turn an English description (or mermaid source) into a diagram triplet: the source, an editable .excalidraw file you can open on excalidraw. |
| 23 | `document-generate` | Generate missing documentation from scratch for a feature, module, or entire project. (gstack) |
| 24 | `document-release` | Release documentation audit. (gstack) |
| 25 | `eval-plan` | | |
| 26 | `freeze` | Restrict file edits to a specific directory for the session. (gstack) |
| 27 | `gsd-add-tests` | Generate tests for a completed phase based on UAT criteria and implementation |
| 28 | `gsd-ai-integration-phase` | Generate an AI-SPEC.md design contract for phases that involve building AI systems. |
| 29 | `gsd-audit-fix` | Autonomous audit-to-fix pipeline — find issues, classify, fix, test, commit |
| 30 | `gsd-audit-milestone` | Audit milestone completion against original intent before archiving |
| 31 | `gsd-audit-uat` | Cross-phase audit of all outstanding UAT and verification items |
| 32 | `gsd-autonomous` | Run all remaining phases autonomously — discuss→plan→execute per phase |
| 33 | `gsd-capture` | Capture ideas, tasks, notes, and seeds to their destination |
| 34 | `gsd-cleanup` | Archive accumulated phase directories from completed milestones |
| 35 | `gsd-code-review` | Review source files changed during a phase for bugs, security issues, and code quality problems |
| 36 | `gsd-complete-milestone` | Archive completed milestone and prepare for next version |
| 37 | `gsd-config` | Configure GSD settings — workflow toggles, advanced knobs, integrations, and model profile |
| 38 | `gsd-debug` | Systematic debugging with persistent state across context resets |
| 39 | `gsd-discuss-phase` | Gather phase context through adaptive questioning before planning. |
| 40 | `gsd-docs-update` | Generate or update project documentation verified against the codebase |
| 41 | `gsd-eval-review` | Audit an executed AI phase's evaluation coverage and produce an EVAL-REVIEW.md remediation plan. |
| 42 | `gsd-execute-phase` | SDD phase execution — execute all plans in a phase with dependency-aware wave parallelization |
| 43 | `gsd-explore` | Socratic ideation and idea routing — think through ideas before committing to plans |
| 44 | `gsd-extract-learnings` | Extract decisions, lessons, patterns, and surprises from completed phase artifacts |
| 45 | `gsd-fast` | Execute a trivial task inline — no subagents, no planning overhead |
| 46 | `gsd-forensics` | Post-mortem investigation for failed GSD workflows — diagnoses what went wrong. |
| 47 | `gsd-graphify` | Build, query, and inspect the project knowledge graph in .planning/graphs/ |
| 48 | `gsd-health` | Diagnose planning directory health and optionally repair issues |
| 49 | `gsd-help` | Show available GSD commands and usage guide |
| 50 | `gsd-import` | Ingest external plans with conflict detection against project decisions before writing anything. |
| 51 | `gsd-inbox` | Triage and review open GitHub issues and PRs against project templates and contribution guidelines. |
| 52 | `gsd-ingest-docs` | Bootstrap or merge a .planning/ setup from existing ADRs, PRDs, SPECs, and docs in a repo. |
| 53 | `gsd-manager` | Interactive command center for managing multiple phases from one terminal |
| 54 | `gsd-map-codebase` | Analyze codebase with parallel mapper agents to produce .planning/codebase/ documents |
| 55 | `gsd-mempalace-capture` | File a phase artifact into MemPalace; mirror decision facts into its temporal KG |
| 56 | `gsd-mempalace-recall` | Recall decisions, patterns, and surprises from MemPalace before planning |
| 57 | `gsd-milestone-summary` | Generate a comprehensive project summary from milestone artifacts for team onboarding and review |
| 58 | `gsd-mvp-phase` | Plan a phase as a vertical MVP slice — user story, SPIDR splitting, then plan-phase |
| 59 | `gsd-new-milestone` | Start a new milestone cycle — update PROJECT.md and route to requirements |
| 60 | `gsd-new-project` | Initialize a new project with deep context gathering and PROJECT.md |
| 61 | `gsd-next` | Smart entry — detect project state and route to the right next GSD action. |
| 62 | `gsd-ns-context` | codebase intel | map graphify docs learnings mempalace |
| 63 | `gsd-ns-ideate` | exploration capture | explore sketch spike spec capture |
| 64 | `gsd-ns-manage` | config workspace | workstreams thread update ship inbox |
| 65 | `gsd-ns-project` | project lifecycle | milestones audits summary |
| 66 | `gsd-ns-review` | quality gates | code review debug audit security eval ui |
| 67 | `gsd-ns-workflow` | workflow | discuss plan execute verify phase progress |
| 68 | `gsd-onboard` | Guide existing codebase onboarding through mapping, doc ingest, and planning setup |
| 69 | `gsd-pause-work` | Create context handoff when pausing work mid-phase |
| 70 | `gsd-phase` | Multi-phase management — add, insert, remove, or edit phases in ROADMAP.md (roadmap phase CRUD) |
| 71 | `gsd-plan-phase` | Create detailed phase plan (PLAN.md) with verification loop |
| 72 | `gsd-plan-review-convergence` | Cross-AI plan convergence - replan until review concerns are resolved. |
| 73 | `gsd-pr-branch` | Create a clean PR branch by filtering out .planning/ commits — ready for code review |
| 74 | `gsd-profile-user` | Generate developer behavioral profile and create Claude-discoverable artifacts |
| 75 | `gsd-progress` | Check progress, advance workflow, or dispatch freeform intent — the unified GSD situational command |
| 76 | `gsd-quick` | Execute a quick task with GSD guarantees (atomic commits, state tracking) but skip optional agents |
| 77 | `gsd-quick-batch` | Batch several `/gsd-quick`-shaped tasks together — planned, dispatched, and merged as one run |
| 78 | `gsd-resume-work` | Resume work from previous session with full context restoration |
| 79 | `gsd-review` | Request cross-AI peer review of phase plans from external AI CLIs |
| 80 | `gsd-review-backlog` | Review and promote backlog items to active milestone |
| 81 | `gsd-secure-phase` | Retroactively verify threat mitigations for a completed phase |
| 82 | `gsd-settings` | Configure GSD workflow toggles and model profile |
| 83 | `gsd-ship` | Create PR, run review, and prepare for merge after verification passes |
| 84 | `gsd-sketch` | Sketch UI/design ideas with throwaway HTML mockups, or propose what to sketch next (frontier mode) |
| 85 | `gsd-spec-phase` | Clarify WHAT a phase delivers with ambiguity scoring; produces a SPEC.md before discuss-phase. |
| 86 | `gsd-spike` | Spike an idea through experiential exploration, or propose what to spike next (frontier mode) |
| 87 | `gsd-stats` | Display project statistics — phases, plans, requirements, git metrics, and timeline |
| 88 | `gsd-surface` | Toggle which skills are surfaced — apply a profile, list, or disable a cluster without reinstall |
| 89 | `gsd-thread` | Manage persistent context threads for cross-session work |
| 90 | `gsd-ui-phase` | Generate UI design contract (UI-SPEC.md) for frontend phases |
| 91 | `gsd-ui-review` | Retroactive 6-pillar visual audit of implemented frontend code |
| 92 | `gsd-ultraplan-phase` | [BETA] Offload plan phase to Claude Code's ultraplan cloud; review in browser and import back. |
| 93 | `gsd-undo` | Safe git revert. Roll back phase or plan commits using the phase manifest with dependency checks. |
| 94 | `gsd-update` | Update GSD to latest version with changelog display |
| 95 | `gsd-validate-phase` | Retroactively audit and fill Nyquist validation gaps for a completed phase |
| 96 | `gsd-verify-work` | Validate built features through conversational UAT |
| 97 | `gsd-workspace` | Manage GSD workspaces — create, list, or remove isolated workspace environments |
| 98 | `gsd-workstreams` | Manage parallel workstreams — list, create, switch, status, progress, complete, and resume |
| 99 | `gstack` | Router for the gstack skill suite. (gstack) |
| 100 | `gstack-upgrade` | Upgrade gstack to the latest version. |
| 101 | `guard` | Full safety mode: destructive command warnings + directory-scoped edits. (gstack) |
| 102 | `health` | Code quality dashboard. (gstack) |
| 103 | `imagegen` | Generate or edit raster images when the task benefits from AI-created bitmap visuals such as photos, illustrations, textures, sprites, mocku |
| 104 | `impeccable` | Use when the user wants to design, redesign, shape, critique, audit, polish, simplify, harden, animate, or otherwise improve a frontend inte |
| 105 | `investigate` | Systematic debugging with root cause investigation. (gstack) |
| 106 | `ios-clean` | Remove the DebugBridge SPM package and all #if DEBUG wiring from an iOS app. (gstack) |
| 107 | `ios-design-review` | Visual design audit for iOS apps on real hardware. (gstack) |
| 108 | `ios-fix` | Autonomous iOS bug fixer. (gstack) |
| 109 | `ios-qa` | Live-device iOS QA for SwiftUI apps. (gstack) |
| 110 | `ios-sync` | Regenerate the iOS debug bridge against the latest upstream gstack templates. (gstack) |
| 111 | `land-and-deploy` | Land and deploy workflow. (gstack) |
| 112 | `landing-report` | Read-only queue dashboard for workspace-aware ship. (gstack) |
| 113 | `learn` | Manage project learnings. |
| 114 | `make-pdf` | Turn any markdown file into a publication-quality PDF. (gstack) |
| 115 | `modernize` | Bring an aging pull request onto its current base and decide whether it should still exist: MODERNIZE, REWORK or CLOSE, with range-diff proo |
| 116 | `office-hours` | YC Office Hours — two modes. (gstack) |
| 117 | `open-gstack-browser` | Launch GStack Browser — AI-controlled Chromium with the sidebar extension baked in. |
| 118 | `openai-docs` | Use for Codex models/pricing, scheduled tasks, skills, settings, setup, troubleshooting, customization, automations, and self-knowledge—incl |
| 119 | `pair-agent` | Pair a remote AI agent with your browser. (gstack) |
| 120 | `plan-ceo-review` | CEO/founder-mode plan review. (gstack) |
| 121 | `plan-design-review` | Designer's eye plan review — interactive, like CEO and Eng review. (gstack) |
| 122 | `plan-devex-review` | Interactive developer experience plan review. (gstack) |
| 123 | `plan-eng-review` | Eng manager-mode plan review. (gstack) |
| 124 | `plan-tune` | Self-tuning question sensitivity + developer psychographic for gstack (v1: observational). (gstack) |
| 125 | `qa` | Fix browser/API/CLI/job/worker/webhook bugs. (gstack) |
| 126 | `qa-only` | Report browser/API/CLI/job/worker/webhook bugs. (gstack) |
| 127 | `replica-architect` | >- |
| 128 | `replica-backend` | >- |
| 129 | `replica-brand` | >- |
| 130 | `replica-build` | >- |
| 131 | `replica-deploy` | >- |
| 132 | `replica-design` | >- |
| 133 | `replica-diff` | >- |
| 134 | `replica-entrepreneur` | >- |
| 135 | `replica-launch` | >- |
| 136 | `replica-recon` | >- |
| 137 | `replica-test` | >- |
| 138 | `retro` | Weekly engineering retrospective. (gstack) |
| 139 | `review` | Pre-landing PR review. (gstack) |
| 140 | `review-agent` | Perform a read-only, defect-first review of a specified code change and return every actionable finding. Use when another agent delegates re |
| 141 | `scrape` | Pull data from a web page through the Aside browser — your real, already signed-in sessions. (gstack) |
| 142 | `setup-browser-cookies` | Import cookies from your real Chromium browser into the headless browse session. (gstack) |
| 143 | `setup-deploy` | Configure deployment settings for /land-and-deploy. |
| 144 | `setup-gbrain` | Set up gbrain for this coding agent: install the CLI, initialize a local PGLite or Supabase brain, register MCP, capture per-remote trust po |
| 145 | `ship` | Ship workflow: detect + merge base branch, run tests, review diff, bump VERSION, update CHANGELOG, commit, push, create PR. (gstack) |
| 146 | `skill-creator` | Create or update a Codex skill with appropriately scoped instructions and any needed supporting resources. |
| 147 | `skill-installer` | Install Codex skills into $CODEX_HOME/skills from a curated list or a GitHub repo path. Use when a user asks to list installable skills, ins |
| 148 | `skillify` | Codify the most recent successful /scrape flow into a permanent browser-skill on disk. (gstack) |
| 149 | `smart-skill-router` | Route a user's task to the best currently installed skill or natural combination of skills without requiring skill names. Use for any task w |
| 150 | `spec` | Turn vague intent into a precise, executable spec in five phases. (gstack) |
| 151 | `sync-gbrain` | Keep gbrain current with this repo's code and refresh agent search guidance in CLAUDE.md. (gstack) |
| 152 | `test-audit` | Find low-value or duplicate tests and the test-only code they keep alive. (gstack) |
| 153 | `ubicloud` | Run a heavy suite, build or eval on an ephemeral 16-vCPU Ubicloud VM: TTL-named VMs, a reaper, quota preflight and a hang watchdog. (gstack) |
| 154 | `unfreeze` | Clear the freeze boundary set by /freeze, allowing edits to all directories again. (gstack) |
| 155 | `write-skill` | Write a new agent skill or improve one without bloat: the edit ladder, levels, drift and size checks, full diets. (gstack) |

## ponytail@DietrichGebert — 6

| # | Skill | Description |
|---|---|---|
| 1 | `ponytail` | > |
| 2 | `ponytail-audit` | > |
| 3 | `ponytail-debt` | > |
| 4 | `ponytail-gain` | > |
| 5 | `ponytail-help` | > |
| 6 | `ponytail-review` | > |

## superpowers@claude-plugins-official — 15

| # | Skill | Description |
|---|---|---|
| 1 | `brainstorming` | You MUST use this before any creative work - creating features, building components, adding functionality, modifying behavior, or planning a |
| 2 | `diagnosing-superpowers` | Use when a superpowers session went wrong and your human partner wants to know why — repeated work, ignored plans, stumbles, poor results, a |
| 3 | `dispatching-parallel-agents` | Use when facing 2+ independent tasks that can be worked on without shared state or sequential dependencies |
| 4 | `executing-plans` | Use when executing an implementation plan in the current session as the implementer yourself — your human partner chose inline execution, or |
| 5 | `finishing-a-development-branch` | Use when implementation is complete, all tests pass, and you need to decide how to integrate the work |
| 6 | `receiving-code-review` | Use when receiving code review feedback, before implementing suggestions, especially if feedback seems unclear or technically questionable - |
| 7 | `requesting-code-review` | Use when completing tasks, implementing major features, or before merging to verify work meets requirements |
| 8 | `subagent-driven-development` | Use when executing implementation plans with independent tasks in the current session |
| 9 | `systematic-debugging` | Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes |
| 10 | `test-driven-development` | Use when implementing any feature or bugfix, before writing implementation code |
| 11 | `using-git-worktrees` | Use when starting feature work that needs isolation from current workspace or before executing implementation plans - ensures an isolated wo |
| 12 | `using-superpowers` | Use when starting any conversation - establishes how to find and use skills, requiring skill invocation before ANY response including clarif |
| 13 | `verification-before-completion` | Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and  |
| 14 | `writing-plans` | Use when you have a spec or requirements for a multi-step task, before touching code |
| 15 | `writing-skills` | Use when creating new skills, editing existing skills, or verifying skills work before deployment |

## mattpocock-skills@mattpocock — 39

| # | Skill | Description |
|---|---|---|
| 1 | `engineering/ask-matt` | Ask which skill or flow fits your situation. A router over the skills in this repo. |
| 2 | `engineering/code-review` | Review the changes since a fixed point (commit, branch, tag, or merge-base) along two axes: Standards (does the code follow this repo's docu |
| 3 | `engineering/codebase-design` | Shared vocabulary for designing deep modules. Use when the user wants to design or improve a module's interface, find deepening opportunitie |
| 4 | `engineering/diagnosing-bugs` | Diagnosis loop for hard bugs and performance regressions. Use when the user says "diagnose"/"debug this", or reports something broken/throwi |
| 5 | `engineering/domain-modeling` | Build and sharpen a project's domain model. Use when discussing codebase terminology, writing or editing a GLOSSARY.md, or recording or edit |
| 6 | `engineering/grill-with-docs` | A relentless interview to sharpen a plan or design, which also creates docs (ADR's and glossary) as we go. |
| 7 | `engineering/implement` | Implement a piece of work based on a spec or set of tickets. |
| 8 | `engineering/implement-spec` | Implement the result of /to-spec and /to-tickets in code. |
| 9 | `engineering/improve-codebase-architecture` | Scan a codebase for deepening opportunities, present them as a visual HTML report, then grill through whichever one you pick. |
| 10 | `engineering/pr` | Use when writing a PR body. |
| 11 | `engineering/prototype` | Build a throwaway prototype to answer a design question. Use when the user wants to sanity-check whether a state model or logic feels right, |
| 12 | `engineering/research` | Investigate a question against high-trust primary sources and capture the findings as a Markdown file in the repo. Use when the user wants a |
| 13 | `engineering/retro` | Conduct a retrospective on a coding session. |
| 14 | `engineering/setup-matt-pocock-skills` | Configure this repo for the engineering skills: set up its issue tracker, triage label vocabulary, and domain doc layout. Run once before fi |
| 15 | `engineering/tdd` | Test-driven development. Use when the user wants to build features or fix bugs test-first, mentions "red-green-refactor", or wants integrati |
| 16 | `engineering/to-spec` | Turn the current conversation into a spec and publish it to the project issue tracker: no interview, just synthesis of what you've already d |
| 17 | `engineering/to-tickets` | Break a plan, spec, or the current conversation into a set of tracer-bullet tickets, each declaring its blocking edges, published to the con |
| 18 | `engineering/triage` | Move issues and external PRs through a state machine of triage roles, categorise, verify, grill if needed, and write agent-ready briefs. |
| 19 | `engineering/wayfinder` | Plan a huge chunk of work (more than one agent session can hold) as a shared map of decision tickets on your issue tracker, and resolve them |
| 20 | `engineering/wizard` | Generate an interactive bash wizard that walks a human through steps only they can perform. Use when provisioning infrastructure, setting up |
| 21 | `in-progress/chief-of-staff` | Pursue a long-running goal in a single session by co-ordinating subagents. |
| 22 | `in-progress/claude-handoff` | Hand the current conversation off to a fresh background agent that picks up the work immediately. |
| 23 | `in-progress/loop-me` | Grill me about specs for the workflows I want to build, within this workspace. |
| 24 | `in-progress/setup-ts-deep-modules` | Wire dependency-cruiser into a TypeScript repo so each package is a deep module, with implementation hidden in subfolders and reachable only |
| 25 | `in-progress/software-factory` | Shared language for designing a software factory: the tasks it runs and the services it plugs into. |
| 26 | `in-progress/writing-beats` | Writing, exploit; assemble raw material into a journey of beats, grounding each term before a beat leans on it. |
| 27 | `in-progress/writing-fragments` | Writing, explore: mine raw fragments, no structure yet. |
| 28 | `in-progress/writing-shape` | Writing, exploit: shape raw material into an article, paragraph by paragraph. |
| 29 | `misc/git-guardrails-claude-code` | Set up Claude Code hooks to block dangerous git commands (push, reset --hard, clean, branch -D, etc.) before they execute. Use when user wan |
| 30 | `misc/migrate-to-shoehorn` | Migrate test files from `as` type assertions to @total-typescript/shoehorn. Use when user mentions shoehorn, wants to replace `as` in tests, |
| 31 | `misc/scaffold-exercises` | Create exercise directory structures with sections, problems, solutions, and explainers that pass linting. Use when user wants to scaffold e |
| 32 | `misc/setup-pre-commit` | Set up Husky pre-commit hooks with lint-staged (Prettier), type checking, and tests in the current repo. Use when user wants to add pre-comm |
| 33 | `productivity/grill-me` | A relentless interview to sharpen a plan or design. |
| 34 | `productivity/grilling` | Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trig |
| 35 | `productivity/handoff` | Compact the current conversation into a handoff document for another agent to pick up. |
| 36 | `productivity/teach` | Teach the user a new skill or concept, within this workspace. |
| 37 | `productivity/to-questionnaire` | Turn a decision you can't fully answer into a questionnaire for someone else to fill in. |
| 38 | `productivity/wait-what` | Stop. That last message did not land: re-pitch it. |
| 39 | `productivity/writing-for-agents` | Writing documents for agents. Use when creating or editing skills, or modifying AGENTS.md or CLAUDE.md. |

## document-skills@anthropic-agent-skills — 19

| # | Skill | Description |
|---|---|---|
| 1 | `academy-guide` | > |
| 2 | `algorithmic-art` | Creating algorithmic art using p5.js with seeded randomness and interactive parameter exploration. Use this when users request creating art  |
| 3 | `brand-guidelines` | Applies Anthropic's official brand colors and typography to any sort of artifact that may benefit from having Anthropic's look-and-feel. Use |
| 4 | `canvas-design` | Create beautiful visual art in .png and .pdf documents using design philosophy. You should use this skill when the user asks to create a pos |
| 5 | `claude-api` | |- |
| 6 | `discernment-nudge` | > |
| 7 | `doc-coauthoring` | Guide users through a structured workflow for co-authoring documentation. Use when user wants to write documentation, proposals, technical s |
| 8 | `docx` | Use this skill whenever the user wants to create, read, edit, or manipulate Word documents (.docx files) or Word templates (.dotx files). Tr |
| 9 | `frontend-design` | Guidance for distinctive, intentional visual design when building new UI or reshaping an existing one. Helps with aesthetic direction, typog |
| 10 | `internal-comms` | A set of resources to help me write all kinds of internal communications, using the formats that my company likes to use. Claude should use  |
| 11 | `mcp-builder` | Guide for creating high-quality MCP (Model Context Protocol) servers that enable LLMs to interact with external services through well-design |
| 12 | `pdf` | Use this skill whenever the user wants to do anything with PDF files. This includes reading or extracting text/tables from PDFs, combining o |
| 13 | `pptx` | Use this skill any time a .pptx or .potx file is involved in any way — as input, output, or both. This includes: creating slide decks, pitch |
| 14 | `skill-creator` | Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, ed |
| 15 | `slack-gif-creator` | Knowledge and utilities for creating animated GIFs optimized for Slack. Provides constraints, validation tools, and animation concepts. Use  |
| 16 | `theme-factory` | Toolkit for styling artifacts with a theme. These artifacts can be slides, docs, reportings, HTML landing pages, etc. There are 10 pre-set t |
| 17 | `web-artifacts-builder` | Suite of tools for creating elaborate, multi-component claude.ai HTML artifacts using modern frontend web technologies (React, Tailwind CSS, |
| 18 | `webapp-testing` | Toolkit for interacting with and testing local web applications using Playwright. Supports verifying frontend functionality, debugging UI be |
| 19 | `xlsx` | Use this skill any time a spreadsheet file is the primary input or output. This means any task where the user wants to: open, read, edit, or |

## example-skills@anthropic-agent-skills — 19

| # | Skill | Description |
|---|---|---|
| 1 | `academy-guide` | > |
| 2 | `algorithmic-art` | Creating algorithmic art using p5.js with seeded randomness and interactive parameter exploration. Use this when users request creating art  |
| 3 | `brand-guidelines` | Applies Anthropic's official brand colors and typography to any sort of artifact that may benefit from having Anthropic's look-and-feel. Use |
| 4 | `canvas-design` | Create beautiful visual art in .png and .pdf documents using design philosophy. You should use this skill when the user asks to create a pos |
| 5 | `claude-api` | |- |
| 6 | `discernment-nudge` | > |
| 7 | `doc-coauthoring` | Guide users through a structured workflow for co-authoring documentation. Use when user wants to write documentation, proposals, technical s |
| 8 | `docx` | Use this skill whenever the user wants to create, read, edit, or manipulate Word documents (.docx files) or Word templates (.dotx files). Tr |
| 9 | `frontend-design` | Guidance for distinctive, intentional visual design when building new UI or reshaping an existing one. Helps with aesthetic direction, typog |
| 10 | `internal-comms` | A set of resources to help me write all kinds of internal communications, using the formats that my company likes to use. Claude should use  |
| 11 | `mcp-builder` | Guide for creating high-quality MCP (Model Context Protocol) servers that enable LLMs to interact with external services through well-design |
| 12 | `pdf` | Use this skill whenever the user wants to do anything with PDF files. This includes reading or extracting text/tables from PDFs, combining o |
| 13 | `pptx` | Use this skill any time a .pptx or .potx file is involved in any way — as input, output, or both. This includes: creating slide decks, pitch |
| 14 | `skill-creator` | Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, ed |
| 15 | `slack-gif-creator` | Knowledge and utilities for creating animated GIFs optimized for Slack. Provides constraints, validation tools, and animation concepts. Use  |
| 16 | `theme-factory` | Toolkit for styling artifacts with a theme. These artifacts can be slides, docs, reportings, HTML landing pages, etc. There are 10 pre-set t |
| 17 | `web-artifacts-builder` | Suite of tools for creating elaborate, multi-component claude.ai HTML artifacts using modern frontend web technologies (React, Tailwind CSS, |
| 18 | `webapp-testing` | Toolkit for interacting with and testing local web applications using Playwright. Supports verifying frontend functionality, debugging UI be |
| 19 | `xlsx` | Use this skill any time a spreadsheet file is the primary input or output. This means any task where the user wants to: open, read, edit, or |

## ecc@ecc — 314

| # | Skill | Description |
|---|---|---|
| 1 | `accessibility` | Design, implement, and audit accessible UI to WCAG 2.2 Level AA across Web, iOS, and Android — semantic ARIA roles and labels, accessibility |
| 2 | `agent-architecture-audit` | Full-stack diagnostic for agent and LLM applications. Audits the 12-layer agent stack for wrapper regression, memory pollution, tool discipl |
| 3 | `agent-eval` | Head-to-head comparison of coding agents (Claude Code, Aider, Codex, etc.) on custom tasks with pass rate, cost, time, and consistency metri |
| 4 | `agent-harness-construction` | Design and optimize AI agent action spaces, tool definitions, and observation formatting for higher completion rates. Use when defining or r |
| 5 | `agent-introspection-debugging` | Structured self-debugging workflow for AI agent failures using capture, diagnosis, contained recovery, and introspection reports. Use when a |
| 6 | `agent-payment-x402` | Add x402 payment execution to AI agents with per-task budgets, spending controls, and non-custodial wallets. Supports Base through agentwall |
| 7 | `agent-runtime-gateway-smoke-test` | Verify a local agent API, temporary gateway tunnel, and remote sandbox callback with a tool-free task, then restore the original app connect |
| 8 | `agent-security-hardening` | Security hardening guidance for AI agent frameworks that process untrusted content, invoke tools, write workspace files, manage runtime iden |
| 9 | `agent-self-evaluation` | Use after completing any non-trivial task. The agent self-rates its output on 5 axes — accuracy, completeness, clarity, actionability, conci |
| 10 | `agent-sort` | Build an evidence-backed ECC install plan for a specific repo by sorting skills, commands, rules, hooks, and extras into DAILY vs LIBRARY bu |
| 11 | `agentic-engineering` | Operate as an agentic engineer using eval-first execution, decomposition, and cost-aware model routing. Use when planning or executing engin |
| 12 | `agentic-os` | Build persistent multi-agent operating systems on Claude Code. Covers kernel architecture, specialist agents, slash commands, file-based mem |
| 13 | `ai-first-engineering` | Engineering operating model for teams where AI agents generate a large share of implementation output. Use when setting team process, review |
| 14 | `ai-regression-testing` | Regression testing strategies for AI-assisted development. Sandbox-mode API testing without database dependencies, automated bug-check workf |
| 15 | `android-clean-architecture` | Clean Architecture patterns for Android and Kotlin Multiplatform projects — module structure, dependency rules, UseCases, Repositories, and  |
| 16 | `angular-developer` | Generates Angular code and provides architectural guidance. Trigger when creating projects, components, or services, or for best practices o |
| 17 | `api-connector-builder` | Build a new API connector or provider by matching the target repo's existing integration pattern exactly. Use when adding one more integrati |
| 18 | `api-design` | REST API design patterns including resource naming, status codes, pagination, filtering, error responses, versioning, and rate limiting for  |
| 19 | `architecture-decision-records` | Capture architectural decisions as numbered ADR markdown files in docs/adr/ with context, alternatives considered, consequences, and an inde |
| 20 | `article-writing` | Write articles, guides, blog posts, tutorials, newsletter issues, and other long-form content in a distinctive voice derived from supplied e |
| 21 | `automation-audit-ops` | Evidence-first automation inventory and overlap audit workflow for ECC. Use when the user wants to know which jobs, hooks, connectors, MCP s |
| 22 | `autonomous-agent-harness` | Transform Claude Code into a fully autonomous agent system with persistent memory, scheduled operations, computer use, and task queuing. Rep |
| 23 | `autonomous-loops` | Patterns and architectures for autonomous Claude Code loops — from simple sequential pipelines to RFC-driven multi-agent DAG systems. Retain |
| 24 | `backend-patterns` | Backend architecture patterns, API design, database optimization, and server-side best practices for Node.js, Express, and Next.js API route |
| 25 | `benchmark` | Measure performance baselines and detect regressions across browser Core Web Vitals (LCP, INP, CLS, page weight), API endpoint latency perce |
| 26 | `benchmark-methodology` | Score a scoped competitor set into comparable profile cards: nine weighted dimensions (positioning, voice, visual craft, offer packaging, ev |
| 27 | `benchmark-optimization-loop` | Convert 'make it faster' requests into a bounded measured optimization loop — baseline first, generate one-hypothesis variants, benchmark ea |
| 28 | `bengali-nlp` | Bengali (Bangla) text processing patterns including Unicode normalization, script detection, tokenization, conjunct handling, and Bangla-spe |
| 29 | `blender-motion-state-inspection` | Use this skill when inspecting Blender characters, rigs, poses, animation retargeting, ground contact, facing direction, or model-vs-motion  |
| 30 | `blueprint` | Turn a one-line objective into a step-by-step construction plan for multi-session, multi-agent engineering projects: one-PR-sized steps with |
| 31 | `brand-discovery` | Run a structured, resumable multi-session brand identity interview across 8 modules (purpose, positioning, audience, personality, voice, nar |
| 32 | `brand-voice` | Build a source-derived writing style profile from real posts, essays, launch notes, docs, or site copy, then reuse that profile across conte |
| 33 | `brownfield-retrospective` | Run the ECC engineering process retroactively against an existing project slice. Audit current state, reconstruct past decisions, produce a  |
| 34 | `browser-qa` | Run automated post-deploy UI verification with a browser automation MCP (claude-in-chrome, Playwright, or Puppeteer): console-error and Core |
| 35 | `bun-runtime` | Bun as runtime, package manager, bundler, and test runner. When to choose Bun vs Node, migration notes, and Vercel support. |
| 36 | `canary-watch` | Use this skill to monitor and verify a deployed URL after releases — checks HTTP endpoints, SSE streams, static assets, console errors, and  |
| 37 | `carrier-relationship-management` | Manage truckload, LTL, and intermodal carrier portfolios: sourcing and FMCSA vetting, freight rate and fuel-surcharge negotiation, RFPs and  |
| 38 | `change-impact` | >- |
| 39 | `cisco-ios-patterns` | Cisco IOS and IOS-XE review patterns for show commands, config hierarchy, wildcard masks, ACL placement, interface hygiene, and safe change- |
| 40 | `ck` | Persistent per-project memory for Claude Code (Context Keeper) driven by deterministic Node.js /ck commands: init, save, resume, info, list, |
| 41 | `claude-devfleet` | Orchestrate multi-agent coding tasks via Claude DevFleet — plan projects, dispatch parallel agents in isolated worktrees, monitor progress,  |
| 42 | `click-path-audit` | Trace every user-facing button/touchpoint through its full state change sequence to find bugs where functions individually work but cancel e |
| 43 | `clickhouse-io` | ClickHouse database patterns, query optimization, analytics, and data engineering best practices for high-performance analytical workloads.  |
| 44 | `code-tour` | Create CodeTour `.tour` files — persona-targeted, step-by-step walkthroughs with real file and line anchors. Use for onboarding tours, archi |
| 45 | `codebase-onboarding` | Analyze an unfamiliar codebase and generate a structured onboarding guide with architecture map, key entry points, conventions, and a starte |
| 46 | `codehealth-mcp` | Real-time structural Code Health via CodeScene MCP — review before edits, verify score deltas after changes, gate commits and PRs. Use when  |
| 47 | `coding-standards` | Baseline cross-project coding conventions for naming, readability, immutability, and code-quality review. Use detailed frontend or backend s |
| 48 | `competitive-platform-analysis` | Use when scoping a competitive landscape — identifying, categorising, and score-filtering a competitor set before any benchmarking begins. D |
| 49 | `competitive-report-structure` | Assemble scored competitor profile cards (from benchmark-methodology) into a decision-grade competitive report with landscape map, competito |
| 50 | `compose-multiplatform-patterns` | Compose Multiplatform and Jetpack Compose patterns for KMP projects — state management, navigation, theming, performance, and platform-speci |
| 51 | `config-gc` | Garbage collection for your Claude Code configuration. Periodically scans ~/.claude (skills, memory, hooks, permissions, MCP servers, caches |
| 52 | `configure-ecc` | Run the conversational ECC setup wizard inside the current harness: inventory the install, collect scope (user/project/local) and hook mode  |
| 53 | `connections-optimizer` | Reorganize the user's X and LinkedIn network with review-first pruning, add/follow recommendations, and channel-specific warm outreach draft |
| 54 | `content-engine` | Create platform-native content systems for X, LinkedIn, TikTok, YouTube, newsletters, and repurposed multi-platform campaigns. Use when the  |
| 55 | `content-hash-cache-pattern` | Cache expensive file processing results using SHA-256 content hashes — path-independent, auto-invalidating, with service layer separation. U |
| 56 | `context-and-decisions` | >- |
| 57 | `context-budget` | Routes live context checks to the native Codex or Claude Code meter without scanning files, and performs a bounded static component audit on |
| 58 | `continuous-agent-loop` | Patterns for continuous autonomous agent loops with quality gates, evals, and recovery controls. Use when running an agent loop that must se |
| 59 | `continuous-learning` | [DEPRECATED - use continuous-learning-v2] Legacy v1 stop-hook skill extractor. v2 is a strict superset with instinct-based, project-scoped,  |
| 60 | `continuous-learning-v2` | Instinct-based learning system that observes sessions via hooks, creates atomic instincts with confidence scoring, and evolves them into ski |
| 61 | `contract-first` | Coordinate frontend/backend or service-to-service work through one authoritative machine-checkable contract (OpenAPI, AsyncAPI, Protocol Buf |
| 62 | `conventional-commit-review` | Reviews staged changes and drafts a Conventional Commits-compliant commit message with the right type, scope, and length. Use before committ |
| 63 | `cost-aware-llm-pipeline` | Cost optimization patterns for LLM API usage — model routing by task complexity, budget tracking, retry logic, and prompt caching. Use when  |
| 64 | `cost-tracking` | Track and report Claude Code token usage, spending, and budgets from the local ECC cost-tracker metrics log. Use when the user asks about co |
| 65 | `council` | Convene a four-voice council for ambiguous decisions, tradeoffs, and go/no-go calls. Use when multiple valid paths exist and you need struct |
| 66 | `council-multi-model` | Add one optional external Codex critique after the existing council has produced a decision draft. Use when an ambiguous, high-consequence d |
| 67 | `counterparty-channel-discipline` | Per-channel strict prompts, mention gating, silent observation, and a communication autonomy policy for agents that sit in shared channels w |
| 68 | `cpp-coding-standards` | C++ coding standards based on the C++ Core Guidelines (isocpp.github.io). Use when writing, reviewing, or refactoring C++ code to enforce mo |
| 69 | `cpp-testing` | Use only when writing/updating/fixing C++ tests, configuring GoogleTest/CTest, diagnosing failing or flaky tests, or adding coverage/sanitiz |
| 70 | `crosspost` | Multi-platform content distribution across X, LinkedIn, Threads, and Bluesky. Adapts content per platform using content-engine patterns. Nev |
| 71 | `csharp-testing` | C# and .NET testing patterns with xUnit, FluentAssertions, mocking, integration tests, and test organization best practices. Use when writin |
| 72 | `customer-billing-ops` | Operate customer billing workflows such as subscriptions, refunds, churn triage, billing-portal recovery, and plan analysis using connected  |
| 73 | `customs-trade-compliance` | Codified customs and trade compliance expertise — HS/HTS tariff classification with GRI rules, commercial invoices and entry documentation,  |
| 74 | `dart-flutter-patterns` | Production-ready Dart and Flutter patterns covering null safety, immutable state with Freezed, async composition, widget architecture, state |
| 75 | `dashboard-builder` | Build monitoring dashboards that answer real operator questions for Grafana, SigNoz, and similar platforms. Use when turning metrics into a  |
| 76 | `data-scraper-agent` | Build a fully automated AI-powered data collection agent for any public source — job boards, prices, news, GitHub, sports, anything. Runs on |
| 77 | `data-throughput-accelerator` | Diagnose and accelerate large data movement — ingestion, backfill, export, ETL, warehouse loading, manifest catch-up, and table synchronizat |
| 78 | `database-migrations` | Safe, reversible database migration patterns: forward-only production changes, expand-contract zero-downtime renames, concurrent indexes, ba |
| 79 | `deep-research` | Produce cited research reports from multiple web sources using firecrawl and exa MCP tools — plan sub-questions, search and deep-read source |
| 80 | `deepseek-harness-setup` | Install and operate Everything Claude Code (ECC) on the DeepSeek Harness (DSH): native skill roots (~/.dsh/skills, .agents/skills), the @dee |
| 81 | `defi-amm-security` | Security checklist for Solidity AMM contracts, liquidity pools, and swap flows. Covers reentrancy, CEI ordering, donation or inflation attac |
| 82 | `delivery-gate` | Stop hook that blocks Claude from finishing until quality checks pass. Detects rationalization patterns (surface text heuristics), stale lea |
| 83 | `deployment-patterns` | Deployment workflows, CI/CD pipeline patterns, Docker containerization, health checks, rollback strategies, and production readiness checkli |
| 84 | `design-system` | Generate a design system from an existing codebase or audit one for visual consistency: extract tokens (colors, typography, spacing, shadows |
| 85 | `dev-team` | Simulate a collaborative dev team session where multiple role-based personas (PM, Architect, Developer, QA) respond to the same problem toge |
| 86 | `django-celery` | Django + Celery async task patterns — configuration, task design, beat scheduling, retries, canvas workflows, monitoring, and testing. Use w |
| 87 | `django-patterns` | Django architecture patterns, REST API design with DRF, ORM best practices, caching, signals, middleware, and production-grade Django apps.  |
| 88 | `django-security` | Django security best practices, authentication, authorization, CSRF protection, SQL injection prevention, XSS prevention, and secure deploym |
| 89 | `django-tdd` | Django testing strategies with pytest-django, TDD methodology, factory_boy, mocking, coverage, and testing Django REST Framework APIs. Use w |
| 90 | `django-verification` | Run the full Django verification loop — environment check, mypy/ruff/black linting, migration safety, pytest with coverage targets, pip-audi |
| 91 | `dmux-workflows` | Multi-agent orchestration using dmux (tmux pane manager for AI agents). Patterns for parallel agent workflows across Claude Code, Codex, Ope |
| 92 | `docker-patterns` | Docker and Docker Compose patterns for local development, hardened CLI installer harnesses, container security, networking, volumes, and mul |
| 93 | `docs-governance` | Route broad documentation-governance requests to existing ECC skills and run an opt-in, read-only audit of mapped documentation roles, links |
| 94 | `documentation-lookup` | Use up-to-date library and framework docs via Context7 MCP instead of training data. Activates for setup questions, API references, code exa |
| 95 | `dotnet-patterns` | Idiomatic C# and .NET patterns, conventions, dependency injection, async/await, and best practices for building robust, maintainable .NET ap |
| 96 | `dynamic-workflow-mode` | Design task-local harnesses, eval gates, and reusable skill extraction for Claude dynamic workflow mode and other adaptive agent harnesses.  |
| 97 | `e2e-testing` | Playwright E2E testing patterns, Page Object Model, configuration, CI/CD integration, artifact management, and flaky test strategies. Use wh |
| 98 | `ecc-guide` | Answer questions about ECC by reading the live repo surface — agents, skills, commands, hooks, rules, install profiles, and docs — instead o |
| 99 | `ecc-recipes` | Map a described workflow to the right ECC command group with run-order and stop condition, or browse all command-group recipe families read  |
| 100 | `ecc-tools-cost-audit` | Evidence-first ECC Tools burn and billing audit workflow. Use when investigating runaway PR creation, quota bypass, premium-model leakage, d |
| 101 | `email-ops` | Evidence-first mailbox triage, drafting, send verification, and sent-mail-safe follow-up workflow for ECC. Use when the user wants to organi |
| 102 | `energy-procurement` | Procure electricity and natural gas for commercial and industrial facilities: tariff and rate-schedule optimization, demand-charge mitigatio |
| 103 | `enterprise-agent-ops` | Operational controls for long-lived or cloud-hosted agent systems — runtime lifecycle (start, pause, stop, restart), observability (logs, me |
| 104 | `error-handling` | Patterns for robust error handling across TypeScript, Python, and Go. Covers typed errors, error boundaries, retries, circuit breakers, and  |
| 105 | `esign-field-placement` | Deterministic method for placing signature, date, and text fields in a web e-signature composer through a browser automation session, using  |
| 106 | `eval-harness` | Eval-driven development (EDD) framework for AI coding sessions — define capability and regression evals before coding, grade with code-based |
| 107 | `evm-token-decimals` | Prevent silent decimal mismatch bugs across EVM chains. Covers runtime decimal lookup, chain-aware caching, bridged-token precision drift, a |
| 108 | `exa-search` | Neural search via Exa MCP for web, code, and company research. Use when the user needs web search, code examples, company intel, people look |
| 109 | `fal-ai-media` | Unified media generation via fal.ai MCP — image, video, and audio. Covers text-to-image (Nano Banana), text/image-to-video (Seedance, Kling, |
| 110 | `fastapi-patterns` | FastAPI best practices covering project structure, Pydantic v2 schemas, dependency injection, async handlers, authentication, authorization, |
| 111 | `finance-billing-ops` | Evidence-first revenue, pricing, refunds, team-billing, and billing-model truth workflow for ECC. Use when the user wants a sales snapshot,  |
| 112 | `flox-environments` | Create reproducible, cross-platform (macOS/Linux) development environments with Flox, a declarative Nix-based environment manager. Use when  |
| 113 | `flutter-dart-code-review` | Library-agnostic Flutter/Dart code review checklist covering widget best practices, state management patterns (BLoC, Riverpod, Provider, Get |
| 114 | `foundation-models-on-device` | Apple FoundationModels framework for on-device LLM — text generation, guided generation with @Generable, tool calling, and snapshot streamin |
| 115 | `frontend-a11y` | Accessibility patterns for React and Next.js — semantic HTML, ARIA attributes, form labeling, keyboard navigation, focus management, and scr |
| 116 | `frontend-design-direction` | Set an ECC-specific frontend design direction for production UI work. Use when building or improving websites, dashboards, applications, com |
| 117 | `frontend-patterns` | Frontend development patterns for React, Next.js, state management, performance optimization, and UI best practices. Use when building or re |
| 118 | `frontend-slides` | Create stunning, animation-rich HTML presentations from scratch or by converting PowerPoint files. Use when the user wants to build a presen |
| 119 | `fsharp-testing` | F# testing patterns with xUnit, FsUnit, Unquote, FsCheck property-based testing, integration tests, and test organization best practices. Us |
| 120 | `gan-style-harness` | GAN-inspired Generator-Evaluator agent harness for building high-quality applications autonomously. Based on Anthropic's March 2026 harness  |
| 121 | `gateguard` | PreToolUse fact-forcing gate that denies the first Edit/Write/Bash (including MultiEdit and NotebookEdit) attempt until the agent presents c |
| 122 | `generating-python-installer` | Commercial-grade Python installer expert for Windows: Nuitka extreme compilation, dist slimming, DLL footprint analysis, and Inno Setup pack |
| 123 | `git-workflow` | Git workflow patterns including branching strategies, commit conventions, keeping history clean and readable, tidying local commits before m |
| 124 | `github-ops` | GitHub repository operations, automation, and management. Issue triage, PR management, CI/CD operations, release management, and security mo |
| 125 | `golang-patterns` | Idiomatic Go patterns, best practices, and conventions for building robust, efficient, and maintainable Go applications. Use when writing or |
| 126 | `golang-testing` | Go testing patterns including table-driven tests, subtests, benchmarks, fuzzing, and test coverage. Follows TDD methodology with idiomatic G |
| 127 | `google-workspace-ops` | Operate across Google Drive, Docs, Sheets, and Slides as one workflow surface for plans, trackers, decks, and shared documents. Use when the |
| 128 | `growth-log` | Write growth log entries that extract reusable patterns from completed work — root cause, transferable rule, and a recognizable signal — ins |
| 129 | `healthcare-cdss-patterns` | Clinical Decision Support System (CDSS) development patterns. Drug interaction checking, dose validation, clinical scoring (NEWS2, qSOFA), a |
| 130 | `healthcare-emr-patterns` | EMR/EHR development patterns for healthcare applications. Clinical safety, encounter workflows, prescription generation, clinical decision s |
| 131 | `healthcare-eval-harness` | Patient safety evaluation harness for healthcare application deployments. Automated test suites for CDSS accuracy, PHI exposure, clinical wo |
| 132 | `healthcare-phi-compliance` | Protected Health Information (PHI) and PII compliance patterns for healthcare applications: data classification, row-level access control, t |
| 133 | `hermes-imports` | Convert local Hermes operator workflows into sanitized ECC skills and release-pack artifacts. Use when preparing a Hermes workflow for publi |
| 134 | `hexagonal-architecture` | Design, implement, and refactor Ports & Adapters systems with clear domain boundaries, dependency inversion, and testable use-case orchestra |
| 135 | `hipaa-compliance` | HIPAA-specific entrypoint for healthcare privacy and security work. Use when a task is explicitly framed around HIPAA, PHI handling, covered |
| 136 | `homelab-network-readiness` | Readiness checklist for homelab VLAN segmentation, local DNS filtering (Pi-hole, AdGuard Home), and WireGuard-style remote access. Use when  |
| 137 | `homelab-network-setup` | Practical home and homelab network planning for gateways, switches, access points, IP ranges, DHCP reservations, DNS, cabling, and common be |
| 138 | `homelab-pihole-dns` | Pi-hole installation, blocklist management, DNS-over-HTTPS setup, DHCP integration, local DNS records, and troubleshooting broken DNS resolu |
| 139 | `homelab-vlan-segmentation` | Segmenting home networks into VLANs for IoT, guest, trusted, and server traffic using UniFi, pfSense/OPNsense, and MikroTik — including swit |
| 140 | `homelab-wireguard-vpn` | WireGuard VPN server setup, peer configuration, key generation, split tunneling vs full tunnel routing, and remote access to a home network  |
| 141 | `hookify-rules` | Create and configure hookify rules — markdown files with YAML frontmatter that match bash, file, prompt, or stop events by regex or conditio |
| 142 | `i18n-sync` | Translate and synchronize application JSON locale files using source-key usage, project terminology, and focused validation. Use when adding |
| 143 | `inherit-legacy-style` | Prevent AI style drift on legacy projects by scanning the codebase for implicit conventions, resolving conflicts with the operator one at a  |
| 144 | `intent-driven-development` | Turn ambiguous or high-impact product and engineering changes into scoped, verifiable acceptance criteria before or alongside implementation |
| 145 | `inventory-demand-planning` | Codified demand planning expertise for multi-location retailers: demand forecasting method selection, ABC/XYZ segmentation, safety stock and |
| 146 | `investor-materials` | Create and update pitch decks, one-pagers, investor memos, accelerator applications, financial models, and fundraising materials. Use when t |
| 147 | `investor-outreach` | Draft cold emails, warm intro blurbs, follow-ups, update emails, and investor communications for fundraising. Use when the user wants outrea |
| 148 | `ios-icon-gen` | Generate iOS app icons as PNG imagesets for Xcode asset catalogs from SF Symbols (5000+ Apple-native) or Iconify API (275k+ open source icon |
| 149 | `issue-review` | Review a GitHub issue the way /code-review reviews a PR. Fetches the issue with the gh CLI, checks the report against the current codebase,  |
| 150 | `iterative-retrieval` | Pattern for progressively refining context retrieval to solve the subagent context problem. Use when a subagent lacks the context it needs a |
| 151 | `ito-baskets` | Read-only Itô basket and prediction-market data skill. Index the live basket catalog, compare a basket against user-supplied research or a w |
| 152 | `ito-compute` | Query live GPU inventory, submit an authenticated Itô fixed-rate RFQ, inspect RFQ or procurement status, revoke device credentials, and run  |
| 153 | `ito-inference` | Inspect the availability of model serving on a completed Itô compute booking and, when the canonical backend becomes available, hand off an  |
| 154 | `ito-training` | Inspect the availability of ML training on a completed Itô compute booking and, when the canonical backend becomes available, hand off an ex |
| 155 | `java-coding-standards` | Java coding standards for Spring Boot and Quarkus services: naming, immutability, Optional usage, streams, exceptions, generics, CDI, reacti |
| 156 | `jira-integration` | Use this skill when retrieving Jira tickets, analyzing requirements, updating ticket status, adding comments, or transitioning issues. Provi |
| 157 | `jpa-patterns` | JPA/Hibernate patterns for entity design, relationships, query optimization, transactions, auditing, indexing, pagination, and pooling in Sp |
| 158 | `knowledge-ops` | Knowledge base management, ingestion, sync, and retrieval across multiple storage layers (local files, MCP memory, vector stores, Git repos) |
| 159 | `kotlin-coroutines-flows` | Kotlin Coroutines and Flow patterns for Android and KMP — structured concurrency, Flow operators, StateFlow, error handling, and testing. Us |
| 160 | `kotlin-exposed-patterns` | JetBrains Exposed ORM patterns including DSL queries, DAO pattern, transactions, HikariCP connection pooling, Flyway migrations, and reposit |
| 161 | `kotlin-ktor-patterns` | Ktor server patterns including routing DSL, plugins, authentication, Koin DI, kotlinx.serialization, WebSockets, and testApplication testing |
| 162 | `kotlin-patterns` | Idiomatic Kotlin patterns, best practices, and conventions for building robust, efficient, and maintainable Kotlin applications with corouti |
| 163 | `kotlin-testing` | Kotlin testing patterns with Kotest, MockK, coroutine testing, property-based testing, and Kover coverage. Follows TDD methodology with idio |
| 164 | `kubernetes-patterns` | Kubernetes workload patterns, resource management, RBAC, probes, autoscaling, ConfigMap/Secret handling, and kubectl debugging for productio |
| 165 | `laravel-patterns` | Laravel architecture patterns, routing/controllers, Eloquent ORM, service layers, queues, events, caching, and API resources for production  |
| 166 | `laravel-plugin-discovery` | Discover and evaluate Laravel packages via LaraPlugins.io MCP. Use when the user wants to find plugins, check package health, or assess Lara |
| 167 | `laravel-security` | Laravel security best practices — authentication, authorization, Eloquent safety, CSRF, XSS prevention, API security, and secure deployment  |
| 168 | `laravel-tdd` | Laravel testing strategies with PHPUnit, Pest, model factories, HTTP tests, Sanctum authentication testing, mocking, and coverage. Use when  |
| 169 | `laravel-verification` | Verification loop for Laravel projects: env checks, linting, static analysis, tests with coverage, security scans, and deployment readiness. |
| 170 | `latency-critical-systems` | Optimize and verify latency-sensitive systems — realtime dashboards, market data feeds, streaming agents, execution gateways, queues, and ca |
| 171 | `lead-intelligence` | AI-native lead intelligence and outreach pipeline. Replaces Apollo, Clay, and ZoomInfo with agent-powered signal scoring, mutual ranking, wa |
| 172 | `liquid-glass-design` | iOS 26 Liquid Glass design system — dynamic glass material with blur, reflection, and interactive morphing for SwiftUI, UIKit, and WidgetKit |
| 173 | `living-docs-governance` | Keep a long-lived project's documentation from rotting by assigning existing project docs clear constitution, map, status, and history roles |
| 174 | `llm-trading-agent-security` | Security patterns for autonomous trading agents with wallet or transaction authority. Covers prompt injection, spend limits, pre-send simula |
| 175 | `logistics-exception-management` | Codified freight-exception handling expertise for shipment delays, damages, losses, shortages, and carrier disputes, with escalation protoco |
| 176 | `loop-design-check` | Design a goal-oriented agent loop or review one for failure modes: spinning, Goodhart-gaming the verifier, or running a wrong answer to comp |
| 177 | `mailtrap-email-integration` | Guides agents through integrating transactional email sending via Mailtrap's Email API, including sandbox testing, domain verification, and  |
| 178 | `make-interfaces-feel-better` | Apply concrete design-engineering details that make interfaces feel polished. Use when reviewing or improving UI spacing, typography, border |
| 179 | `manim-video` | Build reusable Manim explainers for technical concepts, graphs, system diagrams, and product walkthroughs, then hand off to the wider ECC vi |
| 180 | `market-research` | Conduct market research, competitive analysis, investor due diligence, and industry intelligence with source attribution and decision-orient |
| 181 | `marketing-campaign` | End-to-end marketing campaign planning and execution. Covers audience research, positioning, campaign angle definition, landing page copy, e |
| 182 | `master-agreement-generator` | Generate review drafts of counterparty master agreements from one template plus a JSON spec, with role-selected clauses and a Schedule A wor |
| 183 | `mcp-dependency-review` | Statically review MCP configuration for mutable package references before approval or CI, without executing discovered MCP servers. Use when |
| 184 | `mcp-server-patterns` | Build MCP servers with Node/TypeScript SDK — tools, resources, prompts, Zod validation, stdio vs Streamable HTTP. Use Context7 or official M |
| 185 | `messages-ops` | Evidence-first live messaging workflow for ECC. Use when the user wants to read texts or DMs, recover a recent one-time code, inspect a thre |
| 186 | `ml-adoption-playbook` | End-to-end methodology for AI agents and software engineers to add machine learning algorithms to existing non-ML codebases. Covers problem  |
| 187 | `mle-workflow` | Production machine-learning engineering workflow for data contracts, reproducible training, model evaluation, deployment, monitoring, and ro |
| 188 | `module-governance` | >- |
| 189 | `module-regression` | >- |
| 190 | `motion-advanced` | Advanced motion patterns for React / Next.js — drag & drop, gestures, text animations, SVG path drawing, custom hooks, imperative sequences  |
| 191 | `motion-foundations` | Motion tokens, spring presets, performance rules, device adaptation, accessibility enforcement, and SSR safety for React / Next.js using mot |
| 192 | `motion-patterns` | Production-ready animation patterns for React / Next.js — button, modal, toast, stagger, page transitions, exit animations, scroll, and layo |
| 193 | `mybatis-patterns` | MyBatis and MyBatis-Spring patterns for mapper design, XML and annotation SQL, result mapping, dynamic SQL safety, transactions, batching, p |
| 194 | `mysql-patterns` | MySQL and MariaDB schema, query, indexing, transaction, replication, and connection-pool patterns for production backends. Use when designin |
| 195 | `nanoclaw-repl` | Operate and extend NanoClaw, ECC's zero-dependency session-aware REPL, with persistent markdown-backed sessions and slash commands for model |
| 196 | `nasiko-control-plane` | Manage the experimental Nasiko CLI lifecycle through ECC — read-only status checks, consent-gated install of the pinned qualified version wi |
| 197 | `nestjs-patterns` | NestJS architecture patterns for modules, controllers, providers, DTO validation, guards, interceptors, config, and production-grade TypeScr |
| 198 | `netmiko-ssh-automation` | Safe Python Netmiko patterns for read-only collection, bounded batch SSH, TextFSM parsing, guarded config changes, timeouts, and network aut |
| 199 | `network-bgp-diagnostics` | Diagnostics-only BGP troubleshooting patterns for neighbor state, route exchange, prefix policy, AS path inspection, and safe evidence colle |
| 200 | `network-config-validation` | Pre-deployment checks for router and switch configuration, including dangerous commands, duplicate addresses, subnet overlaps, stale referen |
| 201 | `network-interface-health` | Diagnose interface errors, drops, CRCs, duplex mismatches, flapping, speed negotiation issues, and counter trends on routers, switches, and  |
| 202 | `nextjs-turbopack` | Next.js 16+ and Turbopack guidance — incremental Rust bundling, file-system caching, faster dev startup and HMR, Turbopack vs webpack tradeo |
| 203 | `nodejs-keccak256` | Prevent Ethereum hashing bugs in JavaScript and TypeScript. Node's sha3-256 is NIST SHA3, not Ethereum Keccak-256, and silently breaks selec |
| 204 | `nutrient-document-processing` | Process, convert, OCR, extract, redact, sign, and fill documents using the Nutrient DWS API. Works with PDFs, DOCX, XLSX, PPTX, HTML, and im |
| 205 | `nuxt4-patterns` | Nuxt 4 app patterns for hydration safety, performance, route rules, lazy loading, and SSR-safe data fetching with useFetch and useAsyncData. |
| 206 | `openclaw-persona-forge` | 为 OpenClaw AI Agent 锻造完整的龙虾灵魂方案。根据用户偏好或随机抽卡， 输出身份定位、灵魂描述(SOUL.md)、角色化底线规则、名字和头像生图提示词。 如当前环境提供已审核的生图 skill，可自动生成统一风格头像图片。 当用户需要创建、设计或定制 OpenC |
| 207 | `opensource-pipeline` | Open-source pipeline: fork, sanitize, and package private projects for safe public release. Chains 3 agents (forker, sanitizer, packager). T |
| 208 | `operator-approval-loop` | Operator approval contract with internal filing notices for agent-drafted outbound messages, hashed drafts, epoch-keyed decisions, durable d |
| 209 | `orch-add-feature` | Orchestrate building a brand-new feature end to end — research, plan, TDD implementation, review, and gated commit — by delegating each phas |
| 210 | `orch-build-mvp` | Orchestrate bootstrapping a working MVP from a design or spec document — ingest the SDD/PRD, plan thin vertical slices, scaffold the first e |
| 211 | `orch-change-feature` | Orchestrate altering an existing, working feature to new desired behavior — update its tests to the new spec, change the implementation to m |
| 212 | `orch-fix-defect` | Orchestrate fixing a bug — reproduce it as a failing regression test, fix to green, review, and gated commit — by delegating each phase to t |
| 213 | `orch-pipeline` | Shared orchestration engine behind the orch-* skill family — the gated Research-Plan-TDD-Review-Commit pipeline, size classifier, agent and  |
| 214 | `orch-refine-code` | Orchestrate a behavior-preserving refactor — confirm tests are green, restructure without changing behavior, keep tests green, review, and g |
| 215 | `osint-investigation` | Sparse-clue OSINT investigation methodology for extracting overlooked leads, connecting fragmented evidence, and testing explanations across |
| 216 | `parallel-execution-optimizer` | Speed up a task by turning it into a dependency graph of parallel lanes with a lane matrix, batched reads and checks, write surfaces isolate |
| 217 | `perl-patterns` | Modern Perl 5.36+ idioms, best practices, and conventions for building robust, maintainable Perl applications. Use when writing or reviewing |
| 218 | `perl-security` | Comprehensive Perl security covering taint mode, input validation, safe process execution, DBI parameterized queries, web security (XSS/SQLi |
| 219 | `perl-testing` | Perl testing patterns using Test2::V0, Test::More, prove runner, mocking, coverage with Devel::Cover, and TDD methodology. Use when writing  |
| 220 | `plan-canvas` | Open plans and HTML artifacts in a local browser canvas where the human annotates elements, chats, and approves or requests changes without  |
| 221 | `plan-orchestrate` | Read a plan document, decompose it into steps, classify each step, and emit the ready-to-paste ECC slash command for that step, carrying the |
| 222 | `plankton-code-quality` | Write-time code quality enforcement using Plankton — auto-formatting, linting, and Claude-powered fixes on every file edit via hooks. Use wh |
| 223 | `postgres-patterns` | PostgreSQL database patterns for query optimization, schema design, indexing, and security. Based on Supabase best practices. Use when desig |
| 224 | `prediction-market-oracle-research` | Research prediction markets as data sources or oracle signals for products, agents, dashboards, and corporate decision intelligence. Use for |
| 225 | `prediction-market-risk-review` | Review prediction-market, basket, oracle, and trading-agent workflows for compliance, safety, data-quality, privacy, and execution risk. Use |
| 226 | `prisma-patterns` | Prisma ORM patterns for TypeScript backends — schema design, query optimization, transactions, pagination, and critical traps like updateMan |
| 227 | `product-capability` | Translate PRD intent, roadmap asks, or product discussions into an implementation-ready capability plan that exposes constraints, invariants |
| 228 | `product-lens` | Validate the why before building through four product diagnostics — a YC-style product diagnostic that produces PRODUCT-BRIEF.md with a go/n |
| 229 | `production-audit` | Local-evidence production readiness audit for shipped apps, pre-launch reviews, post-merge checks, and "what breaks in prod?" questions with |
| 230 | `production-scheduling` | Codified expertise for production scheduling, job sequencing, line balancing, changeover optimization, and bottleneck resolution in discrete |
| 231 | `project-flow-ops` | Operate execution flow across GitHub and Linear by triaging issues and pull requests, linking active work, and keeping GitHub public-facing  |
| 232 | `prompt-caching-strategy` | >- |
| 233 | `prompt-optimizer` | Analyze draft prompts, detect intent and missing context, match ECC commands, skills, and agents, and output a ready-to-paste optimized prom |
| 234 | `python-patterns` | Pythonic idioms, PEP 8 standards, type hints, and best practices for building robust, efficient, and maintainable Python applications. Use w |
| 235 | `python-testing` | Python testing strategies using pytest, TDD methodology, fixtures, mocking, parametrization, and coverage requirements. Use when writing pyt |
| 236 | `pytorch-patterns` | PyTorch deep learning patterns and best practices for building robust, efficient, and reproducible training pipelines, model architectures,  |
| 237 | `quality-nonconformance` | Quality control and non-conformance management for regulated manufacturing (FDA 21 CFR 820, IATF 16949, AS9100): NCR lifecycle and dispositi |
| 238 | `quarkus-patterns` | Quarkus 3.x LTS architecture patterns with Camel for messaging, RESTful API design, CDI services, data access with Panache, and async proces |
| 239 | `quarkus-security` | Quarkus security implementation patterns: JWT and OIDC authentication, @RolesAllowed RBAC and SecurityIdentity checks, Bean Validation and c |
| 240 | `quarkus-tdd` | Test-driven development for Quarkus 3.x LTS using JUnit 5, Mockito, REST Assured, Camel testing, and JaCoCo. Use when adding features, fixin |
| 241 | `quarkus-verification` | Verification loop for Quarkus projects: build, static analysis (Checkstyle, PMD, SpotBugs), tests with JaCoCo coverage, OWASP dependency and |
| 242 | `rails-patterns` | Ruby on Rails framework patterns for Rails 7.1+ and 8.x apps. Covers the directory contract, skinny controllers with service objects, form o |
| 243 | `ralphinho-rfc-pipeline` | Split an RFC into a multi-agent execution DAG — decompose into work units with dependencies and acceptance tests, run research, plan, implem |
| 244 | `react-native-patterns` | React Native and Expo app patterns — Expo Router navigation, state separation (server/client/route/form), TanStack Query data fetching with  |
| 245 | `react-patterns` | React 18/19 patterns including hooks discipline, server/client component boundaries, Suspense + error boundaries, form actions, data fetchin |
| 246 | `react-performance` | React and Next.js performance optimization patterns adapted from Vercel Engineering's React Best Practices (https://github.com/vercel-labs/a |
| 247 | `react-testing` | React component testing with React Testing Library, Vitest/Jest, MSW for network mocking, accessibility assertions with axe, and the decisio |
| 248 | `recsys-pipeline-architect` | Design composable recommendation, ranking, and feed pipelines using the six-stage Source→Hydrator→Filter→Scorer→Selector→SideEffect framewor |
| 249 | `recursive-decision-ledger` | Run repeated rollouts ("Prime Gauss" style recursive prompting) while keeping an append-only decision ledger of trials, marks, coherence che |
| 250 | `redis-patterns` | Redis data structure patterns, caching strategies, distributed locks, rate limiting, pub/sub, and connection management for production appli |
| 251 | `regex-vs-llm-structured-text` | Decision framework for parsing structured text (quizzes, forms, invoices, receipts, tables) with a hybrid regex-first pipeline — regex extra |
| 252 | `remotion-video-creation` | Best practices for Remotion - Video creation in React. 29 domain-specific rules covering 3D, animations, audio, captions, charts, transition |
| 253 | `repo-scan` | Bootstrap pointer that installs the external repo-scan skill from a pinned, reviewable commit. Use when repo-scan must be installed before r |
| 254 | `research-ops` | Evidence-first current-state research workflow for ECC. Use when the user wants fresh facts, comparisons, enrichment, or a recommendation bu |
| 255 | `returns-reverse-logistics` | Codified expertise for returns authorization, receipt and inspection, disposition decisions, refund processing, fraud detection, and warrant |
| 256 | `rules-distill` | Scan skills to extract cross-cutting principles and distill them into rules — append, revise, or create new rule files. Use when the same pr |
| 257 | `rust-patterns` | Idiomatic Rust patterns, ownership, error handling, traits, concurrency, and best practices for building safe, performant applications. Use  |
| 258 | `rust-testing` | Rust testing patterns including unit tests, integration tests, async testing, property-based testing, mocking, and coverage. Follows TDD met |
| 259 | `safety-guard` | Guard against destructive operations with three modes: Careful intercepts dangerous commands (rm -rf, git push --force, DROP TABLE) for conf |
| 260 | `santa-method` | Multi-agent adversarial verification: two independent reviewers with the same rubric must both pass before output ships, with a fix-and-re-r |
| 261 | `scientific-db-pubmed-database` | Direct PubMed and NCBI E-utilities search workflows for biomedical literature, MeSH queries, PMID lookup, citation retrieval, and API-backed |
| 262 | `scientific-db-uspto-database` | USPTO patent and trademark data workflow for official record lookup, PatentSearch queries, TSDR checks, assignment data, and reproducible IP |
| 263 | `scientific-pkg-gget` | gget CLI and Python workflow for quick genomic database queries, sequence lookup, BLAST-style searches, enrichment checks, and reproducible  |
| 264 | `scientific-thinking-literature-review` | Systematic literature-review workflow for academic, biomedical, technical, and scientific topics, including search planning, source screenin |
| 265 | `scientific-thinking-scholar-evaluation` | Structured scholarly-work evaluation for papers, proposals, literature reviews, methods sections, evidence quality, citation support, and re |
| 266 | `search-first` | Research-before-coding workflow: search npm/PyPI, MCP servers, skills, and GitHub for existing tools before writing custom code, then adopt, |
| 267 | `security-bounty-hunter` | Hunt for exploitable, bounty-worthy security issues in repositories. Focuses on remotely reachable vulnerabilities that qualify for real rep |
| 268 | `security-review` | Use this skill when adding authentication, handling user input, working with secrets, creating API endpoints, or implementing payment/sensit |
| 269 | `security-scan` | Scan your Claude Code configuration (.claude/ directory) for security vulnerabilities, misconfigurations, and injection risks using AgentShi |
| 270 | `seo` | Audit, plan, and implement SEO improvements across technical SEO, on-page optimization, structured data, Core Web Vitals, and content strate |
| 271 | `skill-comply` | Visualize whether skills, rules, and agent definitions are actually followed — auto-generates scenarios at 3 prompt strictness levels, runs  |
| 272 | `skill-host-compat` | Lint ECC skills for Codex/Cursor-safe frontmatter and Claude-only substitutions before a skill PR. |
| 273 | `skill-scout` | Search existing local, marketplace, GitHub, and web skill sources before creating a new skill. Use when the user wants to create, build, for |
| 274 | `skill-stocktake` | Use when auditing Claude skills and commands for quality. Supports Quick Scan (changed skills only) and Full Stocktake modes with sequential |
| 275 | `social-graph-ranker` | Weighted social-graph ranking for warm intro discovery, bridge scoring, and network gap analysis across X and LinkedIn. Use when the user wa |
| 276 | `social-publisher` | Agent-driven scheduling and publishing of social media posts across 13 platforms via SocialClaw. Use when the user wants to publish to X, Li |
| 277 | `springboot-patterns` | Spring Boot architecture patterns, REST API design, layered services, data access, caching, async processing, and logging. Use for Java Spri |
| 278 | `springboot-security` | Spring Security best practices for authn/authz, validation, CSRF, secrets, headers, rate limiting, and dependency security in Java Spring Bo |
| 279 | `springboot-tdd` | Test-driven development for Spring Boot using JUnit 5, Mockito, MockMvc, Testcontainers, and JaCoCo. Use when adding features, fixing bugs,  |
| 280 | `springboot-verification` | Run the full Spring Boot verification loop — Maven or Gradle build, SpotBugs, PMD, and Checkstyle static analysis, unit and Testcontainers i |
| 281 | `story-lifecycle` | Manage a file-based epic → story → sprint development loop without requiring an external project management tool. Creates and tracks epics,  |
| 282 | `strategic-compact` | Suggests manual context compaction at logical intervals to preserve context through task phases rather than arbitrary auto-compaction. Use w |
| 283 | `swift-actor-persistence` | Thread-safe data persistence in Swift using actors — in-memory cache with file-backed storage, eliminating data races by design. Use when pe |
| 284 | `swift-concurrency-6-2` | Swift 6.2 Approachable Concurrency — single-threaded by default, @concurrent for explicit background offloading, isolated conformances for m |
| 285 | `swift-protocol-di-testing` | Protocol-based dependency injection for testable Swift code — mock file system, network, and external APIs using focused protocols and Swift |
| 286 | `swiftui-patterns` | SwiftUI architecture patterns, state management with @Observable, view composition, navigation, performance optimization, and modern iOS/mac |
| 287 | `taste` | Creative-direction layer for music videos and short-form edits in the angelcore / cloud-trance / hyperpop family — a named-genre aesthetic v |
| 288 | `taste-application` | Generate new video against a distilled style pack and cut it into a finished piece - plan takes from the reference's cut rhythm, generate on |
| 289 | `taste-distillation` | Measure a set of reference videos into a reusable style pack - colour grade as a 3D LUT, cut rhythm as a shot-length distribution, hero stil |
| 290 | `tasteforge-video` | Use for file-driven multimodal image, video, and 3D-asset discovery; taste interviews; distill or apply workflows; style-pack validation; ed |
| 291 | `tdd-workflow` | Test-driven development workflow: write a failing test first, watch it fail, implement the smallest change to green, then refactor with 80%+ |
| 292 | `team-agent-orchestration` | Run team-based orchestration for agent squads: work items with owners and scope, agent Kanban state, branch isolation, control pane visibili |
| 293 | `team-builder` | Interactive picker that discovers available agent personas via the claude agents command and agents/ markdown globs, groups them into domain |
| 294 | `terminal-opener` | Open an executable and its argument array in a visible terminal window through a reusable, shell-free launch plan with dry-run, JSON, capabi |
| 295 | `terminal-ops` | Evidence-first repo execution workflow for ECC. Use when the user wants a command run, a repo checked, a CI failure debugged, or a narrow fi |
| 296 | `test-collaboration` | Inventory and govern a project's test assets. Connect requirements, business rules, risks, bugs, and cross-boundary contracts to stable TEST |
| 297 | `tinystruct-patterns` | Expert guidance for developing with the tinystruct Java framework. Use when working on the tinystruct codebase or any project built on tinys |
| 298 | `token-budget-advisor` | Offer a choice of response depth (25%/50%/75%/100%) with token estimates before answering, then answer at that level. Use when the user asks |
| 299 | `token-card` | Render a token-usage stat card from local Claude Code, Codex, Gemini CLI, and OpenCode session logs and commit it into the repository as a f |
| 300 | `typescript-patterns` | TypeScript patterns for strict, type-safe, maintainable code in modern TypeScript and JavaScript applications. Covers strict compiler config |
| 301 | `ui-demo` | Record polished UI demo videos using Playwright. Use when the user asks to create a demo, walkthrough, screen recording, or tutorial video o |
| 302 | `ui-to-vue` | Use when the user has UI screenshots or design exports that need batch conversion into Vue 3 components, especially with Vant, Element Plus, |
| 303 | `uncloud` | Use when managing an Uncloud cluster — deploying services, configuring Caddy ingress, adding static proxy routes for non-cluster devices, pu |
| 304 | `unified-memory` | Share durable, inspectable context and handoffs between Claude, Codex, Hermes, Cursor, OpenCode, and other agents through the local ECC Memo |
| 305 | `unified-notifications-ops` | Operate notifications as one ECC-native workflow across GitHub, Linear, desktop alerts, hooks, and connected communication surfaces. Use whe |
| 306 | `verification-loop` | Run a six-phase verification of a Claude Code session's work — build, type check, lint, tests with coverage, security grep, and diff review  |
| 307 | `video-editing` | AI-assisted video editing workflows for cutting, structuring, and augmenting real footage. Covers the full pipeline from raw capture through |
| 308 | `videodb` | Ingest, index, search, edit, and monitor video and audio with the VideoDB Python SDK — upload from files, URLs, or RTSP feeds, build spoken  |
| 309 | `visa-doc-translate` | Translate visa document images (bank deposit, employment, income, and retirement certificates; HEIC, PNG, or JPG) into English via OCR and p |
| 310 | `vite-patterns` | Vite build tool patterns including config, plugins, HMR, env variables, proxy setup, SSR, library mode, dependency pre-bundling, and build o |
| 311 | `vue-patterns` | Vue.js 3 Composition API patterns, component architecture, reactivity best practices, Pinia state management, Vue Router navigation, and Nux |
| 312 | `windows-desktop-e2e` | E2E testing for Windows native desktop apps (WPF, WinForms, Win32/MFC, Qt) using pywinauto and Windows UI Automation. Use when writing E2E t |
| 313 | `workspace-surface-audit` | Audit the active repo, MCP servers, plugins, connectors, env surfaces, and harness setup, then recommend the highest-value ECC-native skills |
| 314 | `x-api` | X/Twitter API integration for posting tweets, threads, reading timelines, search, and analytics. Covers OAuth auth patterns, rate limits, an |
