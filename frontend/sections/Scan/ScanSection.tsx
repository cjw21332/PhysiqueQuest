'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import NutritionDashboard from './NutritionDashboard';
import ReviewEstimate from './ReviewEstimate';
import AddFood from './AddFood';
import DailyLog from './DailyLog';
import FoodHistory from './FoodHistory';
import { type MealName } from './types';
import BottomNav from '../Home/BottomNav';
import { Icon } from '../Home/icons';
import type { Profile } from '../Home/types';
import { useNutrition } from '../../hooks/useNutrition';
import { toScanImage } from '../../lib/scanImage';
import { api, ApiRequestError, ApiTimeoutError, type ScanAnalysis, type ScannedItem } from '../../lib/api';
import { formatLocalDate } from '../../lib/localDate.mjs';

type View = 'nutrition' | 'review' | 'add' | 'logs' | 'history';
type ScanStatus = 'loading' | 'ready' | 'error';
export default function ScanSection({ profile, onLogoutRequest }: { profile: Profile; onLogoutRequest?: () => void }) {
  const [view,setView]=useState<View>('nutrition');
  const [photoSourceOpen,setPhotoSourceOpen]=useState(false);
  const [addReturnView,setAddReturnView]=useState<View>('nutrition');
  const [historyReturnView,setHistoryReturnView]=useState<View>('nutrition');
  const { meals, water, loading, error, addMeal, addMealsFromScan, setWater, refresh } = useNutrition();
  const todayMeals = meals.filter(meal => meal.date === formatLocalDate());
  const [actionError,setActionError]=useState('');
  const [imageUrl,setImageUrl]=useState('');
  // The File is kept alongside the preview URL: analysis runs on the photo
  // itself, and an object URL cannot be re-read once its File is gone.
  const photo=useRef<File|null>(null);
  const [scanStatus,setScanStatus]=useState<ScanStatus>('loading');
  const [analysis,setAnalysis]=useState<ScanAnalysis|null>(null);
  const [scanError,setScanError]=useState('');
  const [selectedMeal,setSelectedMeal]=useState<MealName>('Dinner');
  const cameraInput=useRef<HTMLInputElement>(null);
  const uploadInput=useRef<HTMLInputElement>(null);
  useEffect(()=>()=>{if(imageUrl)URL.revokeObjectURL(imageUrl);},[imageUrl]);
  useEffect(()=>{
    if(!photoSourceOpen)return;
    const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==='Escape')setPhotoSourceOpen(false);};
    window.addEventListener('keydown',closeOnEscape);
    return ()=>window.removeEventListener('keydown',closeOnEscape);
  },[photoSourceOpen]);
  const scan=()=>setPhotoSourceOpen(true);

  const analyse=useCallback(async(file:File)=>{
    setScanStatus('loading');setScanError('');setAnalysis(null);
    try{
      const image=await toScanImage(file);
      setAnalysis(await api.analyzeImage(image));
      setScanStatus('ready');
    }catch(err){
      // The client cap only fires when the server itself went quiet, so name the
      // limit rather than implying the photo was the problem. Nothing has been
      // saved at this point, which makes a retry of the same photo safe.
      // A provider quota refusal is the one failure an immediate retry cannot
      // fix, so it asks for a pause instead of presenting Try again as a fix.
      // An upstream timeout is usually the provider being slow or overloaded
      // rather than the photo, so it says so instead of blaming the picture.
      setScanError(err instanceof ApiTimeoutError?`The scan was still running after ${Math.round(err.timeoutMs/1000)} seconds. Nothing was saved, so you can try the same photo again.`:err instanceof ApiRequestError&&err.statusCode===429?`${err.message} Wait about a minute before scanning again — the limit is on how often the scanner can be used, not on this photo.`:err instanceof ApiRequestError&&(err.statusCode===504||err.error==='UPSTREAM_TIMEOUT')?`The food scanner did not answer in time, so nothing was saved. That is usually temporary — wait a moment and try the same photo again, or retake it closer and in better light if it keeps happening.`:err instanceof Error?err.message:'Could not analyse this photo.');
      setScanStatus('error');
    }
  },[]);

  const onPhoto=(file?:File)=>{
    if(!file)return;
    setPhotoSourceOpen(false);
    photo.current=file;
    if(imageUrl)URL.revokeObjectURL(imageUrl);
    setImageUrl(URL.createObjectURL(file));
    setView('review');
    void analyse(file);
  };
  const add=(meal:MealName)=>{setAddReturnView(view);setSelectedMeal(meal);setView('add');};
  const openHistory=()=>{setHistoryReturnView(view);setView('history');};
  const saveScan=async(meal:MealName,items:ScannedItem[])=>{try{await addMealsFromScan({items,meal});setView('logs');}catch(err){setActionError(err instanceof Error?err.message:'Could not save meal.');}};
  const saveFood=async(food:{name:string;calories:number;protein:number;carbs:number;fat:number;fdcId:number;servingSizeG:number},meal:MealName,amount:number,unit:'grams'|'servings')=>{const grams=unit==='grams'?amount:amount*food.servingSizeG;const now=new Date();try{await addMeal({name:food.name,meal,calories:food.calories,detail:`${food.name} · ${unit==='grams'?`${amount} g`:`${amount} serving(s) (${Math.round(grams)} g)`}`,time:now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),source:'Manual',protein:food.protein,carbs:food.carbs,fat:food.fat,fdcId:food.fdcId});setView('logs');}catch(err){setActionError(err instanceof Error?err.message:'Could not save meal.');}};
  const retake=()=>{setView('nutrition');setPhotoSourceOpen(true);};
  const retryScan=()=>{if(photo.current)void analyse(photo.current);};
  return <section className="scan-section">
    <input ref={cameraInput} className="visually-hidden" type="file" accept="image/*" capture="environment" aria-label="Take a meal photo" onChange={e=>{onPhoto(e.target.files?.[0]);e.target.value='';}}/>
    <input ref={uploadInput} className="visually-hidden" type="file" accept="image/*" aria-label="Upload a meal photo" onChange={e=>{onPhoto(e.target.files?.[0]);e.target.value='';}}/>
    {photoSourceOpen&&<div className="scan-source-overlay" onClick={()=>setPhotoSourceOpen(false)}>
      <section className="scan-source-dialog" role="dialog" aria-modal="true" aria-labelledby="scan-source-title" onClick={event=>event.stopPropagation()}>
        <h2 id="scan-source-title">Add a meal photo</h2>
        <p>Take a new photo or choose one from your device.</p>
        <button type="button" className="scan-source-option" autoFocus onClick={()=>cameraInput.current?.click()}>
          <span className="scan-source-icon"><Icon name="camera" size={21}/></span>
          <span><strong>Take a photo</strong><small>Open your camera</small></span>
          <Icon name="arrow" size={17}/>
        </button>
        <button type="button" className="scan-source-option" onClick={()=>uploadInput.current?.click()}>
          <span className="scan-source-icon"><Icon name="image" size={21}/></span>
          <span><strong>Upload a photo</strong><small>Choose from your photos or files</small></span>
          <Icon name="arrow" size={17}/>
        </button>
        <button type="button" className="scan-source-cancel" onClick={()=>setPhotoSourceOpen(false)}>Cancel</button>
      </section>
    </div>}
    <div className="scan-content">
    {loading && view === 'nutrition' ? <div className="profile-load-state" role="status"><h2>Loading nutrition…</h2><p>Connecting to your saved nutrition log.</p></div> : <>
    {(error || actionError) && <p className="error" role="alert">{actionError || error}</p>}
    {view==='nutrition'&&<NutritionDashboard meals={todayMeals} water={water} onScan={scan} onAdd={add} onLogs={()=>{void refresh();setView('logs');}} onHistory={openHistory}/>}
    {view==='review'&&<ReviewEstimate imageUrl={imageUrl} status={scanStatus} analysis={analysis} error={scanError} onBack={()=>setView('nutrition')} onRetake={retake} onRetry={retryScan} onAddManual={add} onSave={saveScan}/>}

    {view==='add'&&<AddFood initialMeal={selectedMeal} onBack={()=>setView(addReturnView)} onSave={saveFood}/>}
    {view==='logs'&&<DailyLog meals={todayMeals} water={water} onBack={()=>setView('nutrition')} onHistory={openHistory} onAdd={add} onWater={value=>{void setWater(value).then(()=>setActionError('')).catch(err=>setActionError(err instanceof Error?err.message:'Could not update water intake.'));}}/>}
    {view==='history'&&<FoodHistory meals={meals} onBack={()=>setView(historyReturnView)}/>}
    </>}
    </div>{(loading || view === 'nutrition' || view === 'logs') && <BottomNav />}</section>;
}
