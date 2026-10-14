'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import NutritionDashboard from './NutritionDashboard';
import ReviewEstimate from './ReviewEstimate';
import AddFood from './AddFood';
import DailyLog from './DailyLog';
import FoodHistory from './FoodHistory';
import EditMeal from './EditMeal';
import { type FoodEntry, type MealName } from './types';
import { canPreviewNutrition, createNutritionPreview, previewScan } from './nutritionPresentation';
import BottomNav from '../Home/BottomNav';
import { Icon } from '../Home/icons';
import type { Profile } from '../Home/types';
import { useNutrition } from '../../hooks/useNutrition';
import { toScanImage } from '../../lib/scanImage';
import { api, ApiRequestError, ApiTimeoutError, type ScanAnalysis, type ScannedItem } from '../../lib/api';
import { formatLocalDate } from '../../lib/localDate.mjs';

type View = 'nutrition' | 'review' | 'add' | 'logs' | 'history' | 'edit';
type ScanStatus = 'loading' | 'ready' | 'error';
export default function ScanSection({ profile, onLogoutRequest }: { profile: Profile; onLogoutRequest?: () => void }) {
  const [view,setView]=useState<View>('nutrition');
  const contentRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{contentRef.current?.scrollTo(0,0);},[view]);
  const [photoSourceOpen,setPhotoSourceOpen]=useState(false);
  const [addReturnView,setAddReturnView]=useState<View>('nutrition');
  const [historyReturnView,setHistoryReturnView]=useState<View>('nutrition');
  const { meals, water, loading, error, addMeal, addMealsFromScan, updateMeal, setWater: saveWater, refresh } = useNutrition();
  const [editingEntries, setEditingEntries] = useState<FoodEntry[]>([]);
  const [editingPreview, setEditingPreview] = useState(false);
  const edit = (entries: FoodEntry[]) => { setActionError(''); setEditingEntries(entries); setEditingPreview(preview); setView('edit'); };
  const saveEdit = async (entry: FoodEntry) => {
    if (editingPreview) {
      setPreviewSnapshot(current => ({ ...current, meals: current.meals.map(item => item.id === entry.id ? { ...entry, edited: true } : item) }));
      setNotice('Sample entry updated. Your account was not changed.');
    } else {
      // Send only editable DTO fields. Preserve provenance and original log time on the server.
      await updateMeal(entry.id, { name: entry.name, meal: entry.meal, calories: entry.calories, protein: entry.protein, carbs: entry.carbs, fat: entry.fat, ...(entry.fdcId && entry.fdcId > 0 ? { fdcId: entry.fdcId } : {}) });
    }
    setView('logs');
  };
  const [previewSnapshot, setPreviewSnapshot] = useState(() => createNutritionPreview());
  const [previewEligible,setPreviewEligible]=useState(false);
  useEffect(()=>{if(!loading)setPreviewEligible(canPreviewNutrition(loading,error,meals,water));},[loading,error,meals,water]);
  // Keep an explicitly established preview stable during background refreshes.
  // Real records, real water or errors always take precedence immediately.
  const preview = previewEligible && !error && meals.length === 0 && water === 0;
  const displayMeals = preview ? previewSnapshot.meals : meals;
  const displayWater = preview ? previewSnapshot.water : water;
  const todayMeals = displayMeals.filter(meal => meal.date === formatLocalDate());
  const [sampleReview, setSampleReview] = useState(false);
  const [notice,setNotice]=useState('');
  useEffect(()=>{if(!notice)return;const timer=window.setTimeout(()=>setNotice(''),3000);return()=>window.clearTimeout(timer);},[notice]);
  const setWater = async (value:number) => {
    if (preview) { setPreviewSnapshot(current=>({...current,water:value})); setNotice('Sample water updated. Your account was not changed.'); return; }
    await saveWater(value);
  };
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
    setSampleReview(false);
    photo.current=file;
    if(imageUrl)URL.revokeObjectURL(imageUrl);
    setImageUrl(URL.createObjectURL(file));
    setView('review');
    void analyse(file);
  };
  const add=(meal:MealName)=>{setActionError('');setAddReturnView(view);setSelectedMeal(meal);setView('add');};
  const openHistory=()=>{setHistoryReturnView(view);setView('history');};
  const addPreviewEntries=(entries:FoodEntry[])=>{setPreviewSnapshot(current=>({...current,meals:[...current.meals,...entries]}));setNotice('Sample entry added. Nothing was saved to your account.');setView('logs');};
  const saveScan=async(meal:MealName,items:ScannedItem[])=>{
    setActionError('');
    if(sampleReview){addPreviewEntries(items.map((item,index)=>({id:`preview-scan-${Date.now()}-${index}`,name:item.food_name,meal,calories:item.kcal,detail:`${item.food_name} · ${Math.round(item.est_weight_g)} g`,time:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',hour12:false}),source:'Scanned',protein:item.protein_g,carbs:item.carbs_g,fat:item.fat_g,date:formatLocalDate()})));return;}
    try{await addMealsFromScan({items,meal});setView('logs');}catch(err){setActionError(err instanceof Error?err.message:'Could not save meal.');throw err;}
  };
  const saveFood=async(food:{name:string;calories:number;protein:number;carbs:number;fat:number;fdcId:number;servingSizeG:number},meal:MealName,amount:number,unit:'grams'|'servings')=>{
    const grams=unit==='grams'?amount:amount*food.servingSizeG;const now=new Date();
    const entry={name:food.name,meal,calories:food.calories,detail:`${food.name} · ${unit==='grams'?`${amount} g`:`${amount} serving(s) (${Math.round(grams)} g)`}`,time:now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',hour12:false}),source:'Manual' as const,protein:food.protein,carbs:food.carbs,fat:food.fat,fdcId:food.fdcId};
    setActionError('');
    if(preview || food.fdcId < 0){addPreviewEntries([{...entry,id:`preview-food-${Date.now()}`,date:formatLocalDate()}]);return;}
    try{await addMeal(entry);setView('logs');}catch(err){setActionError(err instanceof Error?err.message:'Could not save meal.');throw err;}
  };
  const openSampleReview=()=>{setPhotoSourceOpen(false);setSampleReview(true);setImageUrl('/scan-meal-reference.png');setScanStatus('ready');setScanError('');setAnalysis(previewScan);setView('review');};
  const retake=()=>{setView('nutrition');setPhotoSourceOpen(true);};
  const retryScan=()=>{if(photo.current)void analyse(photo.current);};
  return <section className={`scan-section scan-reference scan-view-${view}`}>
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
        {preview&&<button type="button" className="scan-source-option" onClick={openSampleReview}><span className="scan-source-icon"><Icon name="meal" size={21}/></span><span><strong>View sample estimate</strong><small>Preview only · no photo analysis</small></span><Icon name="arrow" size={17}/></button>}
        <button type="button" className="scan-source-cancel" onClick={()=>setPhotoSourceOpen(false)}>Cancel</button>
      </section>
    </div>}
    <div ref={contentRef} className="scan-content">
    {loading && view === 'nutrition' ? <div className="profile-load-state" role="status"><h2>Loading nutrition…</h2><p>Connecting to your saved nutrition log.</p></div> : <>
    {(error || actionError) && <p className="error" role="alert">{actionError || error}</p>}
    {preview && (view!=='review'||sampleReview) && <p className="scan-preview-label">Sample preview · not your saved nutrition data</p>}
    {notice&&<p className="scan-preview-notice" role="status">{notice}</p>}
    {error&&<button type="button" className="scan-retry" onClick={()=>void refresh()}>Retry nutrition</button>}
    {view==='nutrition'&&<NutritionDashboard meals={todayMeals} historyMeals={displayMeals} water={displayWater} onScan={scan} onAdd={add} onLogs={()=>{if(!preview)void refresh();setView('logs');}} onHistory={openHistory}/>}
    {view==='review'&&<ReviewEstimate imageUrl={imageUrl} preview={sampleReview} status={scanStatus} analysis={analysis} error={scanError} onBack={()=>setView('nutrition')} onRetake={retake} onRetry={retryScan} onAddManual={add} onSave={saveScan}/>}

    {view==='add'&&<AddFood preview={preview} initialMeal={selectedMeal} onBack={()=>setView(addReturnView)} onSave={saveFood}/>}
    {view==='logs'&&<DailyLog meals={todayMeals} water={displayWater} onBack={()=>setView('nutrition')} onHistory={openHistory} onAdd={add} onEdit={edit} onWater={value=>{void setWater(value).then(()=>setActionError('')).catch(err=>setActionError(err instanceof Error?err.message:'Could not update water intake.'));}}/>}
    {view==='edit'&&editingEntries.length>0&&<EditMeal key={editingEntries[0].id} entries={editingEntries} onBack={()=>setView('logs')} onSave={saveEdit}/>}
    {view==='history'&&<FoodHistory meals={displayMeals} backLabel={historyReturnView==='logs' ? "Back to Today's Log" : 'Back to Nutrition'} onBack={()=>setView(historyReturnView)}/>}
    </>}
    </div>{(view === 'nutrition' || view === 'logs' || view === 'history') && <BottomNav />}</section>;
}
