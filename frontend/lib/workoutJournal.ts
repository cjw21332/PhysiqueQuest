import type { WorkoutSessionRecord, WorkoutExerciseSnapshot, WorkoutSetResult } from './api';
import { createRequestKey } from './requestKey';

type Create = { requestKey: string; exerciseIds: string[]; exercises: WorkoutExerciseSnapshot[]; startedAt: string; routineName?: string; timezone?: string };
type Action = { kind: 'create'; data: Create } | { kind: 'sets'; data: { result: WorkoutSetResult; expectedRevision: number } } |
  { kind: 'routine'; data: { exercises: WorkoutExerciseSnapshot[]; routineName?: string; expectedRevision: number } } |
  { kind: 'pause'; data: { paused: boolean; occurredAt: string; expectedRevision: number } } |
  { kind: 'complete'; data: { endedAt: string; exerciseResults: NonNullable<WorkoutSessionRecord['exerciseResults']>; expectedRevision: number } };
type Operation = Action & { id: string; createdAt: string };
export type Journal = { owner: string; id: string; workout: WorkoutSessionRecord; operations: Operation[]; serverId?: string; attempts: number; error?: string };
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('physiquequest-workouts', 2);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('history')) req.result.createObjectStore('history');
      if (req.result.objectStoreNames.contains('sessions')) return;
      const store = req.result.createObjectStore('sessions', { keyPath: ['owner','id'] });
      store.createIndex('owner','owner');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function journals(owner: string): Promise<Journal[]> {
  const db = await open();
  try {
    return await new Promise<Journal[]>((resolve,reject) => {
      const req = db.transaction('sessions').objectStore('sessions').index('owner').getAll(owner);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally { db.close(); }
}
export async function changeJournal(owner: string, id: string, change: (old?: Journal) => Journal | null, findActive = false): Promise<Journal | null> {
  const db = await open();
  try {
    return await new Promise<Journal | null>((resolve,reject) => {
      const tx = db.transaction('sessions','readwrite');
      const store = tx.objectStore('sessions');
      const req = findActive ? store.index('owner').getAll(owner) : store.get([owner,id]);
      let next: Journal | null = null;
      tx.oncomplete = () => resolve(next);
      tx.onabort = () => reject(tx.error ?? new Error('Workout storage interrupted.'));
      req.onsuccess = () => {
        try {
          const existing = findActive ? (req.result as Journal[]).find(row => row.id === id || row.workout.status === 'active') : req.result;
          next = change(existing);
          if (next) store.put(next); else store.delete([owner,id]);
        } catch (error) { tx.abort(); reject(error); }
      };
    });
  } finally { db.close(); }
}
export async function recordAction(owner: string, id: string, action: Action) {
  const row = await changeJournal(owner,id, old => {
    const operation = { ...action, id: createRequestKey(), createdAt: new Date().toISOString() };
    if (action.kind === 'create') {
      if (old) return old;
      const { startedAt, exercises, routineName, exerciseIds } = action.data;
      return { owner,id,attempts:0,operations:[operation],workout:{_id:id, startedAt, routineName, exercises, exerciseIds, status:'active', revision:0, sets:[], pausedSeconds:0} };
    }
    if (!old || old.workout.status !== 'active' || old.workout.revision !== action.data.expectedRevision) throw new Error('Workout changed. Reopen it before editing.');
    const workout = { ...old.workout };
    const sets = workout.sets ?? [];
    if (action.kind === 'sets') {
      const set = action.data.result;
      const exercise = workout.exercises?.find(row => row.exerciseId === set.exerciseId);
      if (!exercise || set.setIndex < 0 || set.setIndex >= exercise.sets || set.setId !== set.exerciseId + ':' + set.setIndex) throw new Error('Invalid workout set.');
      if (sets.some(row => row.setId === set.setId && JSON.stringify(row) === JSON.stringify(set))) return old;
      workout.sets = [...sets.filter(row => row.setId !== set.setId),set];
    } else if (action.kind === 'routine') {
      const rows = action.data.exercises;
      if (sets.some(set => !rows.some(row => row.exerciseId === set.exerciseId && row.sets > set.setIndex))) throw new Error('An exercise with saved sets cannot be removed.');
      workout.exercises = rows;
      workout.exerciseIds = rows.map(row => row.exerciseId);
      workout.routineName = action.data.routineName ?? workout.routineName;
    } else if (action.kind === 'pause') {
      if (action.data.paused === Boolean(workout.pausedAt)) return old;
      if (action.data.paused) workout.pausedAt = action.data.occurredAt;
      else {
        workout.pausedSeconds = (workout.pausedSeconds ?? 0) + seconds(workout.pausedAt!,action.data.occurredAt);
        delete workout.pausedAt;
      }
    } else {
      const ended = action.data.endedAt;
      if (workout.exercises?.some(row => Array.from({length:row.sets},(_,i) => row.exerciseId + ':' + i).some(id => !sets.some(set => set.setId === id)))) throw new Error('Review or skip every set before finishing.');
      workout.endedAt = ended;
      workout.status = 'completed';
      workout.durationSeconds = Math.max(0,seconds(workout.startedAt,ended) - (workout.pausedSeconds ?? 0) - (workout.pausedAt ? seconds(workout.pausedAt,ended) : 0));
      workout.exerciseResults = workout.exercises?.map(row => {
        const done = sets.filter(set => set.exerciseId === row.exerciseId && set.status === 'completed');
        return { exerciseId:row.exerciseId, reps:done.reduce((sum,set) => sum+set.reps,0), ...(done.some(set => set.loadKg !== undefined) ? {loadKg:Math.max(...done.map(set => set.loadKg ?? 0))} : {}) };
      });
    }
    workout.revision = action.data.expectedRevision + 1;
    return { ...old,workout,operations:[...old.operations,operation] };
  }, action.kind === 'create');
  return row!.workout;
}
function seconds(start: string,end: string) { return Math.max(0,Math.floor((Date.parse(end)-Date.parse(start))/1000)); }

export async function workoutHistorySnapshot(owner: string, records?: WorkoutSessionRecord[]): Promise<WorkoutSessionRecord[]> {
  const db = await open();
  try {
    return await new Promise((resolve,reject) => {
      const tx = db.transaction('history',records ? 'readwrite' : 'readonly');
      const store = tx.objectStore('history');
      const req = records ? store.put(records,owner) : store.get(owner);
      tx.oncomplete = () => resolve(records ?? req.result ?? []);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
