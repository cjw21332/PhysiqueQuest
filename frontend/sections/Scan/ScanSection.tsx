'use client';

import { useEffect, useRef, useState } from 'react';
import NutritionDashboard from './NutritionDashboard';
import ReviewEstimate from './ReviewEstimate';
import AddFood from './AddFood';
import DailyLog from './DailyLog';
import FoodHistory from './FoodHistory';
import { sampleMeals, type FoodEntry, type MealName, foodCatalog } from './types';
import BottomNav from '../Home/BottomNav';
import type { Profile } from '../Home/types';

type View = 'nutrition' | 'review' | 'add' | 'logs' | 'history';
export default function ScanSection({ profile, onLogoutRequest }: { profile: Profile; onLogoutRequest?: () => void }) {
  const [view,setView]=useState<View>('nutrition');
  const [meals,setMeals]=useState<FoodEntry[]>(sampleMeals);
  const [water,setWater]=useState(5);
  const [ready,setReady]=useState(false);
  const [imageUrl,setImageUrl]=useState('');
  const [selectedMeal,setSelectedMeal]=useState<MealName>('Dinner');
  const photoInput=useRef<HTMLInputElement>(null);
  useEffect(()=>{setReady(true);try{const saved=localStorage.getItem('physiquequest-food-log');if(saved){const data=JSON.parse(saved);if(Array.isArray(data.meals))setMeals(data.meals);if(Number.isFinite(data.water))setWater(data.water);}}catch{/* Use sample food entries if browser storage is unavailable. */}},[]);
  useEffect(()=>{if(ready)localStorage.setItem('physiquequest-food-log',JSON.stringify({meals,water}));},[meals,water,ready]);
  useEffect(()=>()=>{if(imageUrl)URL.revokeObjectURL(imageUrl);},[imageUrl]);
  const scan=()=>photoInput.current?.click();
  const onPhoto=(file?:File)=>{if(!file)return;if(imageUrl)URL.revokeObjectURL(imageUrl);setImageUrl(URL.createObjectURL(file));setView('review');};
  const add=(meal:MealName)=>{setSelectedMeal(meal);setView('add');};
  const saveScanned=(meal:MealName,portion:number)=>{const now=new Date();setMeals(current=>[...current,{id:`scan-${Date.now()}`,name:'Grilled chicken rice bowl',meal,calories:Math.round(620*portion),detail:'Grilled chicken · Rice · Mixed vegetables',time:now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),source:'Scanned',protein:48*portion,carbs:72*portion,fat:14*portion}]);setView('logs');};
  const saveFood=(food:typeof foodCatalog[number],meal:MealName,amount:number,unit:'grams'|'servings')=>{const scale=unit==='grams'?amount/100:amount;const now=new Date();setMeals(current=>[...current,{id:`food-${Date.now()}`,name:food.name,meal,calories:Math.round(food.calories*scale),detail:`${food.name} · ${unit==='grams'?`${amount} g`:`${amount} serving(s)`}`,time:now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),source:'Manual',protein:food.protein*scale,carbs:food.carbs*scale,fat:food.fat*scale}]);setView('logs');};
  const retake=()=>{setView('nutrition');window.setTimeout(()=>photoInput.current?.click(),0);};
  return <section className="scan-section"><input ref={photoInput} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={e=>{onPhoto(e.target.files?.[0]);e.target.value='';}}/><div className="scan-content">
    {view==='nutrition'&&<NutritionDashboard meals={meals} water={water} onScan={scan} onAdd={add} onLogs={()=>setView('logs')} onHistory={()=>setView('history')}/>}
    {view==='review'&&<ReviewEstimate imageUrl={imageUrl} onRetake={retake} onAddManual={add} onSave={saveScanned}/>}
    {view==='add'&&<AddFood initialMeal={selectedMeal} onBack={()=>setView('nutrition')} onSave={saveFood}/>}
    {view==='logs'&&<DailyLog meals={meals} water={water} onHistory={()=>setView('history')} onAdd={add} onWater={setWater}/>}
    {view==='history'&&<FoodHistory meals={meals} onBack={()=>setView('nutrition')}/>}
    </div><BottomNav /></section>;
}
