import { loadEnvFile } from 'node:process';
import { writeFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import { auditCoverage } from '../dist/pose-tracker/exercise-registry.js';
try {loadEnvFile('.env');} catch {}
const db=await mongoose.createConnection(process.env.EXERCISE_CATALOG_MONGODB_URI||process.env.MONGODB_URI,{serverSelectionTimeoutMS:5000}).asPromise();
const appDb=await mongoose.createConnection(process.env.MONGODB_URI,{serverSelectionTimeoutMS:5000}).asPromise();
try {
  const rows=await db.collection('exercisedb_catalog').find({},{projection:{_id:0}}).toArray();
  const configs=await appDb.collection('exerciseposetrackerconfigs').find().toArray();
  const audit=auditCoverage(rows,Object.fromEntries(configs.map(r=>[r.exerciseId,r.config])));
  await writeFile('../output/posetracker-exercise-coverage.json',JSON.stringify(audit,null,2));
  const {records,...counts}=audit;
  const report='# PoseTracker exercise coverage\n\nGenerated from the existing MongoDB catalog. Configuration coverage is not validated movement-analysis coverage. No live provider validation has been performed by this audit.\n\n'+Object.entries(counts).map(([k,v])=>`- ${k}: ${JSON.stringify(v)}`).join('\n')+'\n\n| Exercise ID | Name | Mode | Provider ID / reference | Capabilities | Validation | Limitations |\n|---|---|---|---|---|---|---|\n'+records.map(r=>[r.exerciseId,r.name,r.trackingMode,r.providerExerciseId??r.referenceUuid??'—',r.capabilities.join(', '),r.validationStatus,r.limitations.join(' ')].map(s=>String(s).replaceAll('|','/')).join(' | ')).map(s=>'| '+s+' |').join('\n')+'\n';
  await writeFile('../output/posetracker-exercise-coverage-report.md',report);
  console.log(counts);
  if(!audit.coverageComplete)process.exitCode=1;
}finally{await db.close();await appDb.close();}
