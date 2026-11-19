// Read-only source inventory. A lexical match is not proof of protection;
// classifications below come from the service review and linked test suites.
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const mutations = new Set(['create','save','insertOne','insertMany','updateOne','updateMany','findOneAndUpdate','findByIdAndUpdate','replaceOne','bulkWrite','deleteOne','deleteMany','findOneAndDelete']);
const groups = {
  activity: ['activity', 'PROTECTED AND TESTED', 'active fence/session; HTTP generation', 'lifecycle-remaining-writers e2e; unit tests'],
  auth: ['users, sessions, sign-ins, recovery/verification', 'PROTECTED — TEST COVERAGE INCOMPLETE', 'fence/session or atomic registration; token generation', 'registration, session-database, email-verification, password-recovery e2e'],
  coach: ['coach_programs', 'PROTECTED AND TESTED', 'fence/session; generation captured before catalog work', 'lifecycle-remaining-writers e2e; coach unit tests'],
  foodscan: ['food_scan_usage', 'PROTECTED AND TESTED', 'fence/session; stored generation; legacy quarantine', 'lifecycle-all-writers, lifecycle-usage-jobs, foodscan-persistence e2e'],
  jobs: ['analysis_jobs, analysis_results, users', 'PROTECTED AND TESTED', 'fence/session; stored generation; CAS lease', 'analysis-jobs, lifecycle-all-writers, lifecycle-processes e2e'],
  leaderboard: ['leaderboard_snapshots', 'PROTECTED — TEST COVERAGE INCOMPLETE', 'per-subject fence/session; generations captured before scoring', 'unit tests only'],
  notifications: ['notifications', 'PROTECTED AND TESTED', 'fence/session; request or reminder generation', 'lifecycle-all-writers e2e and unit tests'],
  nutrition: ['nutrition (meals, water, plans, receipts)', 'PROTECTED AND TESTED', 'fence/session; request and scan generation', 'actual-race, nutrition-integration, concurrency, persistence e2e'],
  profile: ['profiles', 'PROTECTED AND TESTED', 'fence/session; HTTP generation', 'lifecycle-remaining-writers and encryption e2e; unit tests'],
  progress: ['progress_entries', 'PROTECTED AND TESTED', 'fence/session; HTTP generation', 'lifecycle-all-writers e2e; unit tests'],
  push: ['push_devices, push_deliveries', 'PROTECTED — TEST COVERAGE INCOMPLETE', 'fence/session; stored generation; ambiguous sends not replayed', 'lifecycle-remaining-writers register e2e and push unit tests; delivery worker and real provider untested'],
  safety: ['safety_alert_events', 'PROTECTED — TEST COVERAGE INCOMPLETE', 'fence/session; generation across provider call', 'lifecycle-remaining-writers send e2e and safety unit tests; resolve and external delivery untested'],
  settings: ['settings', 'PROTECTED AND TESTED', 'fence/session; HTTP generation', 'lifecycle-all-writers and lifecycle-processes e2e'],
  storage: ['storage_uploads, storage_cleanup', 'EXTERNAL CLEANUP REQUIRED', 'metadata fenced; purge cleanup is deletion-authorized; owner-free retry receipts', 'storage and lifecycle-all-writers e2e; live S3 untested'],
  workouts: ['workout_sessions (sets, history, recordings)', 'PROTECTED AND TESTED', 'fence/session; HTTP generation; revision CAS', 'lifecycle-all-writers e2e; workout unit suites'],
};
function walk(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]); }
const rows=[];
for(const file of walk('src').filter(f=>f.endsWith('.ts')&&!f.endsWith('.spec.ts'))){
 const text=fs.readFileSync(file,'utf8'), ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
 function visit(node){
  if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&mutations.has(node.expression.name.text)){
   const target=node.expression.expression.getText(ast); if(target==='this.service'||target==='this.profileService'||target==='NestFactory')return;
   let method=node.parent; while(method&&!ts.isMethodDeclaration(method)&&!ts.isFunctionDeclaration(method))method=method.parent;
   const name=method?.name?.getText(ast)||'module'; const line=ast.getLineAndCharacterOfPosition(node.getStart(ast)).line+1;
   const category=file.split(path.sep)[1]; let info=groups[category];
   if(category==='exercises'||category==='pose-tracker') info=['shared administrator catalog','NOT APPLICABLE','not user-owned; admin attribution reviewed separately','catalog/pose tests'];
   if(category==='privacy')info=['lifecycle, deletion queue, audit, cleanup','PROTECTED — TEST COVERAGE INCOMPLETE','lifecycle state machine or operational maintenance; not ordinary active writes','lifecycle, privacy, migration and process-crash e2e; external object versioning untested'];
   if(file.includes('lifecycle-quota'))info=['auth_rate_limits','PROTECTED AND TESTED','fence/session; request generation; user ownership retained','lifecycle-all-writers and foodscan-persistence e2e'];
   if(file.includes('auth-throttle')||['requestRegistration','consumeRegistration','limit'].includes(name))info=['pre-auth abuse/code records','NOT APPLICABLE','public pre-account workflow; TTL; no authenticated owner','auth/registration unit and e2e'];
   if(!info)info=['REVIEW REQUIRED','UNPROTECTED','not classified','none'];
   rows.push(`| ${file.replaceAll('\\','/')} : ${line} — ${name} (${node.expression.name.text}) | ${info[0]} | ${info[2]} | ${info[3]} | ${info[1]} |`);
  } ts.forEachChild(node,visit);
 }visit(ast);
}
fs.writeFileSync('../docs/account-lifecycle-writer-inventory.md', '# Lifecycle writer inventory\n\nGenerated from the current source AST; classifications require the accompanying architecture review. Each row identifies the actual mutation. Operational purge/TTL deletion is distinguished from ordinary account writes. Tests do not prove every interleaving.\n\n| Service/method and line | Data | Fence, session and generation / deletion behavior | Evidence | Status |\n|---|---|---|---|---|\n'+rows.join('\n')+'\n');
console.log(`${rows.length} mutation call sites inventoried`);
