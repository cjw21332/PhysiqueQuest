// Type-check patch payloads against the real frontend/mobile projects without
// applying patches, writing the index, or changing the baseline source.
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd(), payload = path.join(root, 'patches/files');
const files = ['shared/movementTelemetry.ts','frontend/hooks/useGenericRepTracking.ts','frontend/sections/Coach/GenericTrackingSession.tsx','mobile/PoseTrackerNative.tsx'];
const key = p => path.resolve(p).replaceAll('\\','/').toLowerCase();
const overrides = new Map(files.map(relative => [key(path.join(root,relative)), fs.readFileSync(path.join(payload,relative),'utf8')]));
let failures = 0;
for (const project of ['frontend','mobile']) {
  const configPath = path.join(root,project,'tsconfig.json');
  const config = ts.readConfigFile(configPath,ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config,ts.sys,path.dirname(configPath));
  const options = { ...parsed.options, noEmit:true, incremental:false };
  const host = ts.createCompilerHost(options), readFile = host.readFile.bind(host), fileExists = host.fileExists.bind(host);
  host.readFile = file => overrides.get(key(file)) ?? readFile(file);
  host.fileExists = file => overrides.has(key(file)) || fileExists(file);
  const program = ts.createProgram(parsed.fileNames,options,host);
  const errors = ts.getPreEmitDiagnostics(program);
  console.log(JSON.stringify({ project, candidateDiagnostics:errors.length }));
  if (errors.length) console.log(ts.formatDiagnosticsWithColorAndContext(errors,{getCanonicalFileName:p=>p,getCurrentDirectory:()=>root,getNewLine:()=> '\n'}));
  failures += errors.length;
}
process.exitCode = failures ? 1 : 0;
