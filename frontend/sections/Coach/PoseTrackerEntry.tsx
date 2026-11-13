'use client';
import { Icon } from '../Home/icons';
import { useEffect, useRef, useState } from 'react';
import { api, type ExerciseRecord } from '../../lib/api';
import PoseTrackerSession from './PoseTrackerSession';
export default function PoseTrackerEntry({exerciseId,name}:{exerciseId:string;name:string}) {
  const [open,setOpen]=useState(false), [exercise,setExercise]=useState<ExerciseRecord|null>(null),[error,setError]=useState('');
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    if(!open)return;let active=true;dialog.current?.showModal();setExercise(null);setError('');
    void api.getExercise(exerciseId).then(row=>{if(active)setExercise(row);}).catch(()=>{if(active)setError('Could not load this exercise. Manual workout logging remains available.');});
    const opener=document.activeElement instanceof HTMLElement?document.activeElement:null;
    return()=>{active=false;dialog.current?.close();opener?.focus();};
  },[open,exerciseId]);
  return <><button type="button" className="secondary pose-tracking-entry" onClick={()=>setOpen(true)} aria-label={`PoseTracker options for ${name}`}>PoseTracker options</button>{open&&<dialog ref={dialog} className="library-dialog" onCancel={()=>setOpen(false)}>{exercise?<PoseTrackerSession key={exercise._id} exercise={exercise} onExit={()=>setOpen(false)}/>:<div className="pose-tracker-session"><button type="button" aria-label="Close tracking" onClick={()=>setOpen(false)}><Icon name="close" size={19}/></button><p role={error?'alert':'status'}>{error||'Loading exercise configuration…'}</p></div>}</dialog>}</>;
}
