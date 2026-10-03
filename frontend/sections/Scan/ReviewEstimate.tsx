'use client';

import { useState } from 'react';
import { Icon } from '../Home/icons';
import type { MealName } from './types';

export default function ReviewEstimate({ imageUrl, onBack, onRetake, onAddManual }: { imageUrl: string; onBack: () => void; onRetake: () => void; onAddManual: (meal: MealName) => void; onSave: (meal: MealName, portion: number) => void }) {
  const [meal, setMeal] = useState<MealName>('Dinner');
  return <><header className="scan-header"><div className="section-back-title"><button className="coach-back" onClick={onBack} aria-label="Back to Nutrition"><Icon name="arrow" size={24}/></button><h2>Review photo</h2></div><button onClick={onRetake}><Icon name="scan" size={13}/> Retake</button></header><div className="detected-foods"><div className="meal-photo">{imageUrl && <img src={imageUrl} alt="Selected meal for review"/>}<span><Icon name="meal" size={20}/></span></div><div className="detected-list"><b>Detected items</b><p>Image analysis is unavailable in Expo Go, so no food or macro values were inferred.</p></div></div><div className="scan-warning"><b>!</b><p><strong>Review manually before saving</strong><br/>Choose a meal and enter the actual food and nutrition values instead of relying on an estimate.</p></div><section className="scan-choice"><h3>Meal to log</h3><div className="scan-chips">{(['Breakfast','Lunch','Snack','Dinner'] as MealName[]).map(option=><button key={option} className={meal===option?'active':''} onClick={()=>setMeal(option)}>{option}</button>)}</div></section><footer className="scan-footer"><button className="primary" onClick={()=>onAddManual(meal)}>Enter meal manually</button></footer></>;
}
