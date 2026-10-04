'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import NutritionDashboard from './NutritionDashboard';
import ReviewEstimate from './ReviewEstimate';
import AddFood from './AddFood';
import DailyLog from './DailyLog';
import FoodHistory from './FoodHistory';
import { type MealName, foodCatalog } from './types';
import BottomNav from '../Home/BottomNav';
import type { Profile } from '../Home/types';
import { useNutrition } from '../../hooks/useNutrition';
import { toScanImage } from '../../lib/scanImage';
import { api, ApiRequestError, ApiTimeoutError, type ScanAnalysis, type ScannedItem } from '../../lib/api';

type View = 'nutrition' | 'review' | 'add' | 'logs' | 'history';
type ScanStatus = 'loading' | 'ready' | 'error';
export default function ScanSection({ profile, onLogoutRequest }: { profile: Profile; onLogoutRequest?: () => void }) {
  const [view,setView]=useState<View>('nutrition');
  const [addReturnView,setAddReturnView]=useState<View>('nutrition');
  const [historyReturnView,setHistoryReturnView]=useState<View>('nutrition');
  const { meals, water, loading, error, addMeal, addMealsFromScan, setWater } = useNutrition();
  const [actionError,setActionError]=useState('');
  const [imageUrl,setImageUrl]=useState('');
  // The File is kept alongside the preview URL: analysis runs on the photo
  // itself, and an object URL cannot be re-read once its File is gone.
  const photo=useRef<File|null>(null);
  const [scanStatus,setScanStatus]=useState<ScanStatus>('loading');
  const [analysis,setAnalysis]=useState<ScanAnalysis|null>(null);
  const [scanError,setScanError]=useState('');
  const [selectedMeal,setSelectedMeal]=useState<MealName>('Dinner');
  const photoInput=useRef<HTMLInputElement>(null);
  useEffect(()=>()=>{if(imageUrl)URL.revokeObjectURL(imageUrl);},[imageUrl]);
  const scan=()=>photoInput.current?.click();

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
    photo.current=file;
    if(imageUrl)URL.revokeObjectURL(imageUrl);
    setImageUrl(URL.createObjectURL(file));
    setView('review');
    void analyse(file);
  };
  const add=(meal:MealName)=>{setAddReturnView(view);setSelectedMeal(meal);setView('add');};
  const openHistory=()=>{setHistoryReturnView(view);setView('history');};
  const saveScan=async(meal:MealName,items:ScannedItem[])=>{try{await addMealsFromScan({items,meal});setView('logs');}catch(err){setActionError(err instanceof Error?err.message:'Could not save meal.');}};
  const saveFood=async(food:typeof foodCatalog[number],meal:MealName,amount:number,unit:'grams'|'servings')=>{const scale=unit==='grams'?amount/100:amount;const now=new Date();try{await addMeal({name:food.name,meal,calories:Math.round(food.calories*scale),detail:`${food.name} · ${unit==='grams'?`${amount} g`:`${amount} serving(s)`}`,time:now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),source:'Manual',protein:food.protein*scale,carbs:food.carbs*scale,fat:food.fat*scale});setView('logs');}catch(err){setActionError(err instanceof Error?err.message:'Could not save meal.');}};
  const retake=()=>{setView('nutrition');window.setTimeout(()=>photoInput.current?.click(),0);};
  const retryScan=()=>{if(photo.current)void analyse(photo.current);};
  if (loading) return <section className="scan-section"><div className="profile-load-state" role="status"><h2>Loading nutrition…</h2><p>Connecting to your saved nutrition log.</p></div><BottomNav /></section>;
  return <section className="scan-section"><input ref={photoInput} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={e=>{onPhoto(e.target.files?.[0]);e.target.value='';}}/><div className="scan-content">
    {(error || actionError) && <p className="error" role="alert">{actionError || error}</p>}
    {view==='nutrition'&&<NutritionDashboard meals={meals} water={water} onScan={scan} onAdd={add} onLogs={()=>setView('logs')} onHistory={openHistory}/>}
    {view==='review'&&<ReviewEstimate imageUrl={imageUrl} status={scanStatus} analysis={analysis} error={scanError} onBack={()=>setView('nutrition')} onRetake={retake} onRetry={retryScan} onAddManual={add} onSave={saveScan}/>}

    {view==='add'&&<AddFood initialMeal={selectedMeal} onBack={()=>setView(addReturnView)} onSave={saveFood}/>}
    {view==='logs'&&<DailyLog meals={meals} water={water} onBack={()=>setView('nutrition')} onHistory={openHistory} onAdd={add} onWater={setWater}/>}
    {view==='history'&&<FoodHistory meals={meals} onBack={()=>setView(historyReturnView)}/>}
    </div>{view === 'nutrition' && <BottomNav />}</section>;
}
