import 'reflect-metadata';
import { execFileSync } from 'node:child_process';
import { chromium, type Browser, type BrowserContext } from 'playwright';
import ts from 'typescript';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { loadEnvFile } from 'node:process';
import { createConnection, Types } from 'mongoose';
import { WorkoutSession, WorkoutSessionSchema } from '../src/workouts/schemas/workout-session.schema.js';
import { WorkoutsService } from '../src/workouts/workouts.service.js';

try { loadEnvFile('.env'); } catch {}
it.skipIf(process.env.PQ_OFFLINE_DB_TEST !== '1')('restores a manual journal and retries an acknowledged database write without duplicating a workout', async () => {
  const dbName = 'pq_offline_test_' + randomUUID().replaceAll('-','').slice(0,16);
  const connection = await createConnection(process.env.MONGODB_URI!, {dbName,serverSelectionTimeoutMS:5000}).asPromise();
  const profile = await mkdtemp(join(tmpdir(),'pq-offline-'));
  const user = new Types.ObjectId();
  let context: BrowserContext | undefined;
  let remote: Browser | undefined;
  const device = process.env.PQ_ANDROID_DEVICE;
  const adb = (...args:string[]) => execFileSync('adb',['-s',device!,...args],{encoding:'utf8'}).trim();
  const testApp = 'com.physiquequest.offlineverification';
  try {
    const model = connection.model(WorkoutSession.name,WorkoutSessionSchema);
    const service = new WorkoutsService(model);
    await service.onModuleInit();
    await connection.collection('account_lifecycle').insertOne({_id:user,status:'active',generation:0,writeVersion:0});
    let loseResponse = true;
    async function reopen() {
      if (device) {
        await remote?.close();
        adb('shell','am','force-stop',testApp);
        adb('shell','am','start','-W','-n',testApp+'/.OfflineActivity');
        const pid = adb('shell','pidof',testApp);
        adb('forward','tcp:18394','localabstract:webview_devtools_remote_'+pid);
        remote = await chromium.connectOverCDP('http://127.0.0.1:18394');
        context = remote.contexts()[0];
      } else {
        await context?.close();
        context = await chromium.launchPersistentContext(profile,{headless:true});
      }
      await context.route('http://localhost:18393/**',async route => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/') return route.fulfill({contentType:'text/html',body:'<script>window.process={env:{}};window.loadModule=path=>import(path)</script>'});
        if (path.startsWith('/lib/')) {
          const name = path.slice(5);
          if (!/^[A-Za-z0-9]+(?:\.mjs)?$/.test(name)) return route.abort();
          const source = await readFile(join('..','frontend','lib',name.includes('.') ? name : name+'.ts'),'utf8');
          return route.fulfill({contentType:'text/javascript',body:name.endsWith('.mjs') ? source : ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText});
        }
        if (route.request().headers().authorization !== 'Bearer test-owner') return route.fulfill({status:401,json:{}});
        const id = path.split('/')[3], body = route.request().postDataJSON();
        try {
          const result = path === '/api/workouts' ? await service.create(String(user),body) :
            path.endsWith('/sets') ? await service.saveSet(String(user),id,body) : await service.complete(String(user),id,body);
          if (loseResponse) { loseResponse = false; return route.abort(); }
          return route.fulfill({json:result});
        } catch (e) { return route.fulfill({status:409,json:{message:String(e)}}); }
      });
      const page = device ? context.pages()[0] : await context.newPage();
      await page.goto('http://localhost:18393/');
      await page.evaluate(async user => {
        const w = window as any;
        w.api = (await w.loadModule('/lib/api')).api;
        w.session = (await w.loadModule('/lib/session')).session;
        w.suggest = (await w.loadModule('/lib/trainingProgress')).suggestedWorkingSet;
        w.login = (id:string) => w.session.set({user:{id},access_token:'test-owner',expires_in:3600},location.origin+'/api');
        w.login(user);
      },String(user));
      return page;
    }
    let page = await reopen();
    await context!.setOffline(true);
    const id = await page.evaluate(async () => {
      const api = (window as any).api;
      const workout = await api.startManualWorkout({kind:'create',data:{requestKey:crypto.randomUUID(),routineName:'Test routine',startedAt:new Date(Date.now()-80000).toISOString(),exerciseIds:['press'],exercises:[{exerciseId:'press',name:'Press',equipment:'Dumbbells',sets:2}]}});
      await api.saveWorkoutSet(workout._id,0,{exerciseId:'press',setId:'press:0',setIndex:0,reps:8,loadKg:10,status:'completed',source:'manual'});
      return workout._id;
    });
    page = await reopen();
    await context!.setOffline(true);
    const suggestion = await page.evaluate(async id => {
      const w = window as any;
      const active = await w.api.getActiveWorkout();
      if (active._id !== id || active.sets[0].reps !== 8) throw Error('Active set lost');
      await w.api.saveWorkoutSet(id,1,{exerciseId:'press',setId:'press:1',setIndex:1,reps:9,loadKg:12,status:'completed',source:'manual'});
      const done = await w.api.completeWorkout(id,{expectedRevision:2,endedAt:new Date().toISOString(),exerciseResults:[]});
      const history = await w.api.getAllWorkouts(true);
      return [w.suggest(history,'press','Dumbbells',done.endedAt),w.suggest([done],'press','Dumbbells',done.endedAt)];
    },id);
    expect(suggestion[0]).toEqual(suggestion[1]);
    expect(suggestion[0]).toMatchObject({reps:9,weightKg:12});
    await context!.setOffline(false);
    await page.evaluate(() => (window as any).api.syncManualWorkouts());
    expect(await model.countDocuments({userId:user})).toBe(1);
    expect(await page.evaluate(id => (window as any).api.workoutSyncStatus(id),id)).toMatchObject({pending:4});
    page = await reopen();
    await page.evaluate(() => (window as any).login('other-account'));
    expect(await page.evaluate(() => (window as any).api.latestLocalReport())).toBeNull();
    await page.evaluate(() => (window as any).api.syncManualWorkouts());
    await page.evaluate(id => (window as any).login(id),String(user));
    await page.evaluate(() => (window as any).api.syncManualWorkouts());
    expect(await page.evaluate(id => (window as any).api.workoutSyncStatus(id),id)).toMatchObject({pending:0});
    const records = await model.find({userId:user}).lean();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({status:'completed',exerciseResults:[{exerciseId:'press',reps:17,loadKg:12}]});
    expect(records[0].sets).toHaveLength(2);
  } finally {
    if (device) {
      await remote?.close();
      adb('forward','--remove','tcp:18394');
      adb('shell','am','force-stop',testApp);
    } else await context?.close();
    await rm(profile,{recursive:true,force:true});
    if (connection.name === dbName && /^pq_offline_test_[a-f0-9]{16}$/.test(dbName)) await connection.dropDatabase();
    await connection.close();
  }
},90000);
