'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import NutritionDashboard from './NutritionDashboard';
import ReviewEstimate from './ReviewEstimate';
import AddFood from './AddFood';
import FoodHistory from './FoodHistory';
import FoodCamera from './FoodCamera';
import PhotoConfirmation from './PhotoConfirmation';
import FoodDescriptionDialog from './FoodDescriptionDialog';
import EditMeal from './EditMeal';
import DietaryPlan, { planTargets } from './DietaryPlan';
import SupplementGuide from './SupplementGuide';
import DayPicker from './DayPicker';
import { type FoodEntry, type MealName } from './types';
import { defaultMeal } from './defaultMeal';
import { canPreviewNutrition, createNutritionPreview, previewScan } from './nutritionPresentation';
import BottomNav from '../Home/BottomNav';
import { Icon } from '../Home/icons';
import type { Profile } from '../Home/types';
import { useNutrition } from '../../hooks/useNutrition';
import { toScanImage } from '../../lib/scanImage';
import { api, ApiRequestError, ApiTimeoutError, type ScanAnalysis, type ScannedItem } from '../../lib/api';
import { formatLocalDate } from '../../lib/localDate.mjs';
import { useBackendConnection } from '../../hooks/useBackendConnection';
import { useScreenRoute } from '../../hooks/useScreenRoute';
import OutcomeDialog from '../../components/OutcomeDialog';
import { beginPendingScanSave, clearPendingScanSave, readPendingScanSave, scanSaveScope, withScanSaveLock, type PendingScanSave } from '../../lib/scanSaveRecovery';
import './scanExperience.css';

type View = 'nutrition' | 'review' | 'add' | 'history' | 'edit' | 'plan' | 'supplements';
type ScanStatus = 'loading' | 'ready' | 'error';
export default function ScanSection({ profile }: { profile: Profile }) {
  const connected = useBackendConnection();
  const [view,setView]=useScreenRoute<View>('/scan', { nutrition: '', review: '/review', add: '/add-food', history: '/history', edit: '/edit-meal', plan: '/plan', supplements: '/supplements' }, 'nutrition');
  const contentRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{contentRef.current?.scrollTo(0,0);},[view]);
  const [photoSourceOpen,setPhotoSourceOpen]=useState(false);
  const [cameraOpen,setCameraOpen]=useState(false);
  const [uploadPending,setUploadPending]=useState<File|null>(null);
  const [descriptionOpen,setDescriptionOpen]=useState(false);
  const [description,setDescription]=useState('');
  const scanDescription=useRef('');
  const analysisRequest=useRef<AbortController | null>(null);
  const analysisGeneration=useRef(0);
  const cancelAnalysis=useCallback(()=>{ analysisGeneration.current++; analysisRequest.current?.abort(); analysisRequest.current=null; },[]);
  useEffect(()=>()=>cancelAnalysis(),[cancelAnalysis]);
  useEffect(()=>{ if (view !== 'review') cancelAnalysis(); },[view,cancelAnalysis]);
  const [highlightedMeal,setHighlightedMeal]=useState<MealName>();
  // The day being viewed and logged; meals and water can be back-filled for missed days.
  const [day, setDay] = useState(formatLocalDate());
  const { dietaryPlan, previousCalorieTarget, meals, water, loading, error, addMeal, addMealsFromScan, updateMeal, deleteMeal, setWater: saveWater, refresh } = useNutrition(day);
  const targets = dietaryPlan ? planTargets(dietaryPlan) : undefined;
  const [editingEntries, setEditingEntries] = useState<FoodEntry[]>([]);
  const [editingPreview, setEditingPreview] = useState(false);
  const edit = (entries: FoodEntry[]) => { setActionError(''); setEditingEntries(entries); setEditingPreview(preview); setView('edit'); };
  const saveEdit = async (entry: FoodEntry) => {
    if (editingPreview) {
      setPreviewSnapshot(current => ({ ...current, meals: current.meals.map(item => item.id === entry.id ? { ...entry, edited: true } : item) }));
      setNotice('Sample entry updated. Your account was not changed.');
    } else {
      // Send only editable DTO fields. Preserve provenance and original log time on the server.
      await updateMeal(entry.id, { name: entry.name, meal: entry.meal, calories: entry.calories, protein: entry.protein, carbs: entry.carbs, fat: entry.fat, saturatedFat: entry.saturatedFat, transFat: entry.transFat, fiber: entry.fiber, sugars: entry.sugars, addedSugar: entry.addedSugar, sodium: entry.sodium, cholesterol: entry.cholesterol, ...(entry.servingSizeG ? { servingSizeG: entry.servingSizeG } : {}), ...(entry.estWeightG ? { estWeightG: entry.estWeightG, servingQuantity: entry.estWeightG, servingUnit: 'g', detail: entry.detail } : {}), ...(entry.fdcId && entry.fdcId > 0 ? { fdcId: entry.fdcId } : {}) });
    }
    setHighlightedMeal(entry.meal); setView('nutrition');
  };
  const [previewSnapshot, setPreviewSnapshot] = useState(() => createNutritionPreview());
  const [previewEligible,setPreviewEligible]=useState(false);
  const [previewRequested,setPreviewRequested]=useState(false);
  useEffect(()=>{if(!loading)setPreviewEligible(canPreviewNutrition(loading,error,meals,water));},[loading,error,meals,water]);
  // Keep an explicitly established preview stable during background refreshes.
  // Real records, real water or errors always take precedence immediately.
  const preview = previewRequested && previewEligible && !error && meals.length === 0 && water === 0;
  const displayMeals = preview ? previewSnapshot.meals : meals;
  const displayWater = preview ? previewSnapshot.water : water;
  const todayMeals = displayMeals.filter(meal => meal.date === day);
  const loggedDays = new Set(displayMeals.flatMap(meal => meal.date ? [meal.date] : []));
  const [sampleReview, setSampleReview] = useState(false);
  const [notice,setNotice]=useState('');
  const setWater = async (value:number) => {
    if (preview) { setPreviewSnapshot(current=>({...current,water:value})); setNotice('Sample water updated. Your account was not changed.'); return; }
    await saveWater(value);
  };
  const [actionError,setActionError]=useState('');
  const [imageUrl,setImageUrl]=useState('');
  // The File is kept alongside the preview URL: analysis runs on the photo
  // itself, and an object URL cannot be re-read once its File is gone.
  const photo=useRef<File|null>(null);
  const [pendingSave,setPendingSave]=useState<PendingScanSave|null>(null);
  const [recoveryError,setRecoveryError]=useState('');
  const [recovering,setRecovering]=useState(false);
  const loadRecovery=useCallback(()=>{ try { const scope=scanSaveScope(); setPendingSave(scope ? readPendingScanSave(scope) : null); setRecoveryError(''); } catch { setRecoveryError('A previous meal save cannot be read. Do not save it again until it can be checked.'); } },[]);
  useEffect(()=>{if(!loading)loadRecovery();},[loading,loadRecovery]);
  useEffect(()=>{window.addEventListener('storage',loadRecovery);return()=>window.removeEventListener('storage',loadRecovery);},[loadRecovery]);
  const [scanStatus,setScanStatus]=useState<ScanStatus>('loading');
  const [analysis,setAnalysis]=useState<ScanAnalysis|null>(null);
  useEffect(() => {
    if (view === 'edit' && !editingEntries.length) window.history.replaceState(null, '', '/scan');
    if (view === 'review' && !imageUrl) window.history.replaceState(null, '', '/scan');
  }, [view, editingEntries.length, imageUrl]);
  const [scanError,setScanError]=useState('');
  const [selectedMeal,setSelectedMeal]=useState<MealName>(defaultMeal);
  const uploadInput=useRef<HTMLInputElement>(null);
  useEffect(()=>()=>{if(imageUrl)URL.revokeObjectURL(imageUrl);},[imageUrl]);
  useEffect(()=>{
    if(!photoSourceOpen)return;
    const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==='Escape')setPhotoSourceOpen(false);};
    window.addEventListener('keydown',closeOnEscape);
    return ()=>window.removeEventListener('keydown',closeOnEscape);
  },[photoSourceOpen]);
  const scan=()=>setPhotoSourceOpen(true);

  const analyse=useCallback(async(file:File, foodDescription = '')=>{
    if (analysisRequest.current) return;
    const controller = new AbortController();
    analysisRequest.current = controller;
    const generation = ++analysisGeneration.current;
    setScanStatus('loading');setScanError('');setAnalysis(null);
    try{
      const image=await toScanImage(file);
      if (controller.signal.aborted || generation !== analysisGeneration.current) return;
      const result = await api.analyzeImage(image, undefined, foodDescription, controller.signal);
      if (controller.signal.aborted || generation !== analysisGeneration.current) return;
      setAnalysis(result);
      setScanStatus('ready');
    }catch(err){
      if (controller.signal.aborted || generation !== analysisGeneration.current) return;
      // The client cap only fires when the server itself went quiet, so name the
      // limit rather than implying the photo was the problem. Nothing has been
      // saved at this point, which makes a retry of the same photo safe.
      // A provider quota refusal is the one failure an immediate retry cannot
      // fix, so it asks for a pause instead of presenting Try again as a fix.
      // An upstream timeout is usually the provider being slow or overloaded
      // rather than the photo, so it says so instead of blaming the picture.
      setScanError(err instanceof ApiTimeoutError?`The scan was still running after ${Math.round(err.timeoutMs/1000)} seconds. Nothing was saved, so you can try the same photo again.`:err instanceof ApiRequestError&&err.statusCode===429?`${err.message} Wait about a minute before scanning again — the limit is on how often the scanner can be used, not on this photo.`:err instanceof ApiRequestError && err.statusCode === 500 ? 'The food scanner could not complete the analysis. Please try again.' : err instanceof ApiRequestError&&(err.statusCode===504||err.error==='UPSTREAM_TIMEOUT')?`The food scanner did not answer in time, so nothing was saved. That is usually temporary — wait a moment and try the same photo again, or retake it closer and in better light if it keeps happening.`:err instanceof Error?err.message:'Could not analyse this photo.');
      setScanStatus('error');
    } finally { if (analysisRequest.current === controller) analysisRequest.current = null; }
  },[]);

  const onPhoto=(file?:File, foodDescription = '')=>{
    if(!file)return;
    setPhotoSourceOpen(false);
    setPreviewRequested(false);
    setSampleReview(false);
    photo.current=file;
    scanDescription.current = foodDescription;
    if(imageUrl)URL.revokeObjectURL(imageUrl);
    setImageUrl(URL.createObjectURL(file));
    setView('review');
    void analyse(file, foodDescription);
  };
  const add=(meal:MealName)=>{setActionError('');setSelectedMeal(meal);setView('add');};
  const openHistory=()=>setView('history');
  const addPreviewEntries=(entries:FoodEntry[])=>{setPreviewSnapshot(current=>({...current,meals:[...current.meals,...entries]}));setHighlightedMeal(entries[0]?.meal);setNotice('Sample entry added. Nothing was saved to your account.');setView('nutrition');};
  const saveScan=async(meal:MealName,items:ScannedItem[])=>{
    setActionError('');
    if(sampleReview){addPreviewEntries(items.map((item,index)=>({id:`preview-scan-${Date.now()}-${index}`,name:item.food_name,meal,calories:item.kcal!,detail:`${item.food_name} · ${Math.round(item.est_weight_g)} g`,time:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',hour12:false}),source:'Scanned',protein:item.protein_g!,carbs:item.carbs_g!,fat:item.fat_g!,date:formatLocalDate()})));return;}
    try{
      const scope=scanSaveScope(); if(!scope)throw new Error('Sign in again before saving this meal.');
      await withScanSaveLock(scope,async()=>{
        const pending=beginPendingScanSave(scope,meal,items,day,new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',hour12:false}));
        setPendingSave(pending);
        await addMealsFromScan({...pending.payload,meal:pending.payload.meal as MealName});
        clearPendingScanSave(scope,pending.key);setPendingSave(null);
      });
      setHighlightedMeal(meal);setView('nutrition');setNotice(`Saved to ${meal}. Your meal diary has been updated.`);
    }catch(err){setActionError(err instanceof Error?err.message:'Could not confirm the meal save.');throw err;}
  };
  const recoverSave=async()=>{
    const scope=scanSaveScope(); if(!scope || recovering)return;
    setRecovering(true);setRecoveryError('');
    try{
      await withScanSaveLock(scope,async()=>{
        const pending=readPendingScanSave(scope);if(!pending){setPendingSave(null);return;}
        const receipt=await api.getScanSaveReceipt(pending.key);
        if(receipt.status!=='confirmed')await addMealsFromScan({...pending.payload,meal:pending.payload.meal as MealName});
        clearPendingScanSave(scope,pending.key);setPendingSave(null);
      });
      await refresh();setHighlightedMeal(pendingSave?.payload.meal as MealName | undefined);setView('nutrition');setNotice('The previous meal save is confirmed. Your meal diary has been updated.');
    }catch(err){setRecoveryError(err instanceof Error?err.message:'Could not confirm the previous meal save. Try again.');}
    finally{setRecovering(false);}
  };
  const saveFood=async(food:{name:string;calories:number|null;protein:number|null;carbs:number|null;fat:number|null;fdcId:number;servingSizeG:number},meal:MealName,amount:number,unit:'grams'|'servings')=>{
    const grams=unit==='grams'?amount:amount*food.servingSizeG;const now=new Date();
    const entry={name:food.name,meal,calories:food.calories,detail:`${food.name} · ${unit==='grams'?`${amount} g`:`${amount} serving(s) (${Math.round(grams)} g)`}`,time:now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',hour12:false}),source:'Manual' as const,protein:food.protein,carbs:food.carbs,fat:food.fat,fdcId:food.fdcId,estWeightG:grams,...(food.servingSizeG>0?{servingSizeG:food.servingSizeG}:{})};
    setActionError('');
    if(preview || food.fdcId < 0){addPreviewEntries([{...entry,id:`preview-food-${Date.now()}`,date:day}]);return;}
    try{await addMeal(entry);setHighlightedMeal(meal);setView('nutrition');setNotice(`Saved to ${meal}. Your meal diary has been updated.`);}catch(err){setActionError(err instanceof Error?err.message:'Could not save meal.');throw err;}
  };
  const openSampleReview=()=>{setPhotoSourceOpen(false);setSampleReview(true);setImageUrl('/scan-meal-reference.png');setScanStatus('ready');setScanError('');setAnalysis(previewScan);setView('review');};
  const retake=()=>{cancelAnalysis();setView('nutrition');setPhotoSourceOpen(true);};
  const retryScan=()=>{if(photo.current)void analyse(photo.current, scanDescription.current);};
  if (!connected) return <section className="scan-section scan-reference scan-view-nutrition">
    <div ref={contentRef} className="scan-content">
    {loading ? <div className="profile-load-state" role="status" aria-label="Loading nutrition" aria-busy="true"><div className="section-placeholder" aria-hidden="true" /></div> : error ? <p>Your saved nutrition is unavailable.</p> :
      view === 'history' ? <FoodHistory targets={targets} previousCalorieTarget={previousCalorieTarget} meals={meals} onBack={()=>setView('nutrition')}/> :
      view === 'supplements' ? <SupplementGuide profile={profile} onBack={()=>setView('nutrition')}/> :
      view === 'plan' ? dietaryPlan ? <DietaryPlan key="offline-plan" readOnly saved={dietaryPlan} profile={profile} meals={todayMeals} onBack={()=>setView('nutrition')}/> : <p>No saved dietary plan.</p> :
      <NutritionDashboard readOnly targets={targets} onPlan={()=>setView('plan')} onSupplements={()=>setView('supplements')} meals={meals.filter(row=>row.date===day)} historyMeals={meals} water={water} onWater={async()=>{}} onScan={()=>{}} onAdd={()=>{}} onEdit={()=>{}} onHistory={openHistory}/>}
    </div>
    <BottomNav/>
  </section>;
  return <section className={`scan-section scan-reference scan-view-${view}`}>
    <input ref={uploadInput} className="visually-hidden" type="file" accept="image/*,.heic,.heif" aria-label="Upload a meal photo" onChange={e=>{const file=e.target.files?.[0];if(file){setDescription('');setPhotoSourceOpen(false);setUploadPending(file);}e.target.value='';}}/>
    {cameraOpen && <FoodCamera onClose={()=>setCameraOpen(false)} onCapture={file=>{setCameraOpen(false);setDescription('');setUploadPending(file);setDescriptionOpen(true);}} onGallery={()=>{setCameraOpen(false);uploadInput.current?.click();}} />}
    {uploadPending && !descriptionOpen && <PhotoConfirmation file={uploadPending} onCancel={()=>setUploadPending(null)} onConfirm={()=>setDescriptionOpen(true)}/>}
    {uploadPending && descriptionOpen && <FoodDescriptionDialog value={description} onChange={setDescription} onClose={()=>setDescriptionOpen(false)} onAnalyse={value=>{const file=uploadPending;setDescriptionOpen(false);setUploadPending(null);onPhoto(file,value);}}/>}
    {photoSourceOpen&&<div className="scan-source-overlay" onClick={()=>setPhotoSourceOpen(false)}>
      <section className="scan-source-dialog" role="dialog" aria-modal="true" aria-labelledby="scan-source-title" onClick={event=>event.stopPropagation()}>
        <h2 id="scan-source-title">Add a meal photo</h2>
        <p>Take a new photo or choose one from your device.</p>
        <button type="button" className="scan-source-option" autoFocus onClick={()=>{setPhotoSourceOpen(false);setCameraOpen(true);}}>
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
    {loading && view === 'nutrition' ? <div className="profile-load-state" role="status" aria-label="Loading nutrition" aria-busy="true"><div className="section-placeholder" aria-hidden="true" /></div> : <>
    {error && <p className="error" role="alert">{error}</p>}
    {pendingSave && <section className="scan-warning" aria-label="Meal save recovery"><p><strong>Previous meal save needs checking</strong><br/>Its outcome is unknown. Check it before saving another scan.</p><button className="scan-retry" type="button" disabled={recovering} onClick={()=>void recoverSave()}>{recovering?'Checking…':'Check and recover'}</button></section>}
    {recoveryError && <p className="error" role="alert">{recoveryError}</p>}
    {preview && (view!=='review'||sampleReview) && <p className="scan-preview-label">Sample preview · not your saved nutrition data <button type="button" onClick={()=>{setPreviewRequested(false);setSampleReview(false);setNotice('');setActionError('');setView('nutrition');}}>Start my log</button></p>}
    {!preview && previewEligible && !loading && !error && meals.length===0 && water===0 && view==='nutrition' && <button type="button" className="scan-preview-toggle" onClick={()=>{setPreviewSnapshot(createNutritionPreview());setPreviewRequested(true);}}>View sample nutrition</button>}
    {error&&<button type="button" className="scan-retry" onClick={()=>void refresh()}>Retry nutrition</button>}
    {view==='nutrition'&&<NutritionDashboard dayPicker={<DayPicker day={day} onDay={setDay} loggedDays={loggedDays}/>} mealsHeading={day===formatLocalDate()?"Today's meals":`Meals on ${new Date(`${day}T12:00:00`).toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'})}`} targets={targets} onPlan={()=>setView('plan')} onSupplements={()=>setView('supplements')} meals={todayMeals} historyMeals={displayMeals} water={displayWater} onWater={setWater} onScan={scan} onAdd={add} onEdit={edit} onHistory={openHistory} highlightedMeal={highlightedMeal}/>}
    {view==='supplements'&&<SupplementGuide profile={profile} onBack={()=>setView('nutrition')}/>}
    {view==='plan'&&<DietaryPlan saved={dietaryPlan} profile={profile} meals={todayMeals} onBack={()=>setView('nutrition')}/>}
    {view==='review'&&<ReviewEstimate imageUrl={imageUrl} preview={sampleReview} status={scanStatus} analysis={analysis} error={scanError} onBack={()=>{cancelAnalysis();setView('nutrition');}} onRetake={retake} onRetry={retryScan} onAddManual={add} onSave={saveScan}/>}

    {view==='add'&&<AddFood preview={preview} initialMeal={selectedMeal} onBack={()=>setView('nutrition')} onSave={saveFood}/>}
    {view==='edit'&&editingEntries.length>0&&<EditMeal key={editingEntries[0].id} entries={editingEntries} onBack={()=>setView('nutrition')} onSave={saveEdit} onDelete={async entry => { if(editingPreview){setPreviewSnapshot(current => ({ ...current, meals: current.meals.filter(item => item.id !== entry.id) }));} else await deleteMeal(entry.id); setHighlightedMeal(entry.meal); setView('nutrition'); }}/>}
    {view==='history'&&<FoodHistory targets={targets} previousCalorieTarget={previousCalorieTarget} meals={displayMeals} backLabel="Back to Nutrition" onBack={()=>setView('nutrition')}/>}
    </>}
    </div>{(view === 'nutrition' || view === 'history' || view === 'plan' || view === 'supplements') && <BottomNav />}
    {actionError && <OutcomeDialog kind="error" title="Could not save meal" message={actionError} onClose={()=>setActionError('')} actionLabel="Try again"/>}
    {notice && !actionError && <OutcomeDialog kind={notice.includes('Sample') ? 'info' : 'success'} title={notice.includes('Sample') ? 'Sample updated' : 'Meal saved'} message={notice} onClose={()=>setNotice('')}/>}
  </section>;
}
