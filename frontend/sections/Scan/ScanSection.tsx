'use client';

import { useEffect, useRef, useState } from 'react';
import NutritionDashboard from './NutritionDashboard';
import ReviewEstimate from './ReviewEstimate';
import AddFood from './AddFood';
import DailyLog from './DailyLog';
import FoodHistory from './FoodHistory';
import { type MealName, foodCatalog } from './types';
import BottomNav from '../Home/BottomNav';
import type { Profile } from '../Home/types';
import { useNutrition } from '../../hooks/useNutrition';

type View = 'nutrition' | 'review' | 'add' | 'logs' | 'history';
export default function ScanSection({ profile, onLogoutRequest }: { profile: Profile; onLogoutRequest?: () => void }) {
  const [view,setView]=useState<View>('nutrition');
  const [addReturnView,setAddReturnView]=useState<View>('nutrition');
  const [historyReturnView,setHistoryReturnView]=useState<View>('nutrition');
  const { meals, water, loading, error, addMeal, setWater } = useNutrition();
  const [actionError,setActionError]=useState('');
  const [imageUrl,setImageUrl]=useState('');
  const [selectedMeal,setSelectedMeal]=useState<MealName>('Dinner');
  const photoInput=useRef<HTMLInputElement>(null);
  useEffect(()=>()=>{if(imageUrl)URL.revokeObjectURL(imageUrl);},[imageUrl]);
  const scan=()=>photoInput.current?.click();
  const onPhoto=(file?:File)=>{if(!file)return;if(imageUrl)URL.revokeObjectURL(imageUrl);setImageUrl(URL.createObjectURL(file));setView('review');};
  const add=(meal:MealName)=>{setAddReturnView(view);setSelectedMeal(meal);setView('add');};
  const openHistory=()=>{setHistoryReturnView(view);setView('history');};
  const saveScanned=async (meal:MealName,portion:number)=>{const now=new Date();try{await addMeal({name:'Grilled chicken rice bowl',meal,calories:Math.round(620*portion),detail:'Grilled chicken · Rice · Mixed vegetables',time:now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),source:'Scanned',protein:48*portion,carbs:72*portion,fat:14*portion});setView('logs');}catch(err){setActionError(err instanceof Error?err.message:'Could not save meal.');}};
  const saveFood=async (food:typeof foodCatalog[number],meal:MealName,amount:number,unit:'grams'|'servings')=>{const scale=unit==='grams'?amount/100:amount;const now=new Date();try{await addMeal({name:food.name,meal,calories:Math.round(food.calories*scale),detail:`${food.name} · ${unit==='grams'?`${amount} g`:`${amount} serving(s)`}`,time:now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),source:'Manual',protein:food.protein*scale,carbs:food.carbs*scale,fat:food.fat*scale});setView('logs');}catch(err){setActionError(err instanceof Error?err.message:'Could not save meal.');}};
  const retake=()=>{setView('nutrition');window.setTimeout(()=>photoInput.current?.click(),0);};
  if (loading) return <section className="scan-section"><div className="profile-load-state" role="status"><h2>Loading nutrition…</h2><p>Connecting to your saved nutrition log.</p></div><BottomNav /></section>;
  return <section className="scan-section"><input ref={photoInput} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={e=>{onPhoto(e.target.files?.[0]);e.target.value='';}}/><div className="scan-content">
    {(error || actionError) && <p className="error" role="alert">{actionError || error}</p>}
    {view==='nutrition'&&<NutritionDashboard meals={meals} water={water} onScan={scan} onAdd={add} onLogs={()=>setView('logs')} onHistory={openHistory}/>}
    {view==='review'&&<ReviewEstimate imageUrl={imageUrl} onBack={()=>setView('nutrition')} onRetake={retake} onAddManual={add} onSave={saveScanned}/>}
    {view==='add'&&<AddFood initialMeal={selectedMeal} onBack={()=>setView(addReturnView)} onSave={saveFood}/>}
    {view==='logs'&&<DailyLog meals={meals} water={water} onBack={()=>setView('nutrition')} onHistory={openHistory} onAdd={add} onWater={setWater}/>}
    {view==='history'&&<FoodHistory meals={meals} onBack={()=>setView(historyReturnView)}/>}
    </div>{view === 'nutrition' && <BottomNav />}</section>;
}
