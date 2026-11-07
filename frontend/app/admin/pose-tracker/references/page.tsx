'use client';
import { useEffect, useState } from 'react';
import { api } from '../../../../lib/api';
import { providerExercises, type TrackingConfig, type ConfigOverride } from '../../../../../backend/src/pose-tracker/exercise-registry';
import PoseTrackerSession from '../../../../sections/Coach/PoseTrackerSession';
import '../../../../sections/Coach/posetracker.css';

export default function PoseTrackerReferences() {
  const [rows,setRows]=useState<TrackingConfig[]>([]),[search,setSearch]=useState(''),[selected,setSelected]=useState<TrackingConfig|null>(null);
  const [form,setForm]=useState<ConfigOverride|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[testing,setTesting]=useState(false),[busy,setBusy]=useState(false);
  const load=()=>api.getPoseTrackerCoverage().then(a=>setRows(a.records)).catch(e=>setError(e.message));
  useEffect(()=>{void load();},[]);
  const choose=(row:TrackingConfig)=>{setSelected(row);setTesting(false);setNotice('');setForm({trackingMode:row.trackingMode,providerExerciseId:row.providerExerciseId,referenceUuid:row.referenceUuid,cameraOrientation:row.cameraOrientation,validationStatus:row.validationStatus==='documentation-mapped'?'pending':row.validationStatus,limitations:row.limitations,verificationNotes:row.verificationNotes??''});};
  const save=async()=>{
    if(!selected||!form||busy)return;setBusy(true);setError('');
    try {const saved=await api.savePoseTrackerConfig(selected.exerciseId,form);setSelected(saved);setNotice('Configuration saved. Pending references remain unavailable to ordinary users.');await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  return <main className="scene coach-dark-theme"><section className="pose-admin"><a href="/coach">Back to AI Coach</a><h1>PoseTracker reference management</h1><p>Administrator access required. {rows.length} catalog exercises represented. Configuration coverage is not validated movement-analysis coverage.</p>
    <p>Create a reference from one representative repetition in the <a href="https://app.posetracker.com/reference-movements/list" target="_blank" rel="noreferrer">PoseTracker dashboard</a>. Record the actual UUID and camera setup, save it as pending, then run a provider test. Verify the movement, equipment, orientation and returned events before marking it verified.</p>
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    <label>Search the complete catalog<input value={search} onChange={e=>setSearch(e.target.value)} maxLength={100}/></label>
    <div className="pose-admin-results">{rows.filter(r=>`${r.name} ${r.exerciseId} ${r.equipment.join(' ')}`.toLowerCase().includes(search.toLowerCase())).map(row=><button key={row.exerciseId} type="button" onClick={()=>choose(row)}>{row.name} · {row.equipment.join(', ')} · {row.validationStatus}</button>)}</div>
    {selected&&form&&<><h2>{selected.name}</h2><p>Equipment: {selected.equipment.join(', ')}. Target: {selected.targetMuscles.join(', ')}.</p>
      <label>Tracking mode<select value={form.trackingMode} onChange={e=>setForm({...form,trackingMode:e.target.value as ConfigOverride['trackingMode'],providerExerciseId:undefined,referenceUuid:undefined,validationStatus:'pending',verificationNotes:''})}><option value="unavailable">Unavailable / pending</option><option value="builtin">Built-in exercise</option><option value="reference">Custom reference</option></select></label>
      {form.trackingMode==='builtin'&&<label>Official provider exercise<select value={form.providerExerciseId??''} onChange={e=>setForm({...form,providerExerciseId:e.target.value,validationStatus:'pending',verificationNotes:''})}><option value="">Select an identifier</option>{providerExercises.map(id=><option key={id}>{id}</option>)}</select></label>}
      {form.trackingMode==='reference'&&<label>Actual reference UUID<input value={form.referenceUuid??''} onChange={e=>setForm({...form,referenceUuid:e.target.value,validationStatus:'pending',verificationNotes:''})}/></label>}
      <label>Camera orientation<select value={form.cameraOrientation} onChange={e=>setForm({...form,cameraOrientation:e.target.value as ConfigOverride['cameraOrientation'],validationStatus:'pending'})}>{['pending','front','side','reference'].map(v=><option key={v}>{v}</option>)}</select></label>
      <label>Validation status<select value={form.validationStatus} onChange={e=>setForm({...form,validationStatus:e.target.value as ConfigOverride['validationStatus']})}>{['pending','verified','disabled'].map(v=><option key={v}>{v}</option>)}</select></label>
      <label>Limitations (one per line)<textarea value={form.limitations.join('\n')} onChange={e=>setForm({...form,limitations:e.target.value.split('\n').filter(Boolean)})}/></label>
      <label>Provider verification evidence, equipment and camera notes<textarea value={form.verificationNotes??''} onChange={e=>setForm({...form,verificationNotes:e.target.value})}/></label>
      <button type="button" disabled={busy} onClick={()=>void save()}>Save configuration</button><button type="button" disabled={busy} onClick={()=>setTesting(true)}>Test saved configuration</button>
      {testing&&<PoseTrackerSession key={`${selected.exerciseId}:${selected.updatedAt}`} exercise={{_id:selected.exerciseId,name:selected.name,equipments:selected.equipment,targetMuscles:selected.targetMuscles}} adminTest onExit={()=>setTesting(false)} onVerified={evidence=>{setForm({...form,verificationNotes:evidence});setNotice('Provider event evidence added. Review the actual movement before selecting verified and saving.');setTesting(false);}}/>}
    </>}
  </section></main>;
}
