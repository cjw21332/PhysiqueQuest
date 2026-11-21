from pathlib import Path

source = Path('patches/replay-native-gate.cjs').read_text(encoding='utf8')
source = source.replace("const selectorMod = load(path.join(root,'shared/poseSubject.ts'));", "const framingMod = load(path.join(root,'shared/framingGuard.ts'));")
source = source.replace("const config=registry.resolveTrackingConfig(exercise), gate=gateMod.createPoseStartGate(), filter=filterMod.createLandmarkFilter(true);", "const config=registry.resolveTrackingConfig(exercise), gate=gateMod.createPoseStartGate(), filter=filterMod.createLandmarkFilter(true), framing=framingMod.createFramingGuard();")
source = source.replace("const g=gate.update(t,false); if(counting && !g.active){counter.suspend(); counting=false;}\n      continue;", "if(framing.update(t,false).suspend) counter.suspend(); const g=gate.update(t,false); if(counting && !g.active){counter.suspend(); counting=false;}\n      continue;")
source = source.replace("next=counter.update({landmarks:raw,timestamp:t,aspect:r.inputWidth/r.inputHeight});\n    } else {", "if(framing.update(t,false).suspend) counter.suspend(); continue;\n    } else {\n      if(framing.update(t,true).suspend) counter.suspend();")
source = source.replace('native-gate-development-diagnostic.json', 'framing-guard-development-diagnostic.json')
Path('patches/replay-framing-candidate.cjs').write_text(source,encoding='utf8')
