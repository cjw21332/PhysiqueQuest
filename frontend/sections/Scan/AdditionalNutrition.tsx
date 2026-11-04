import { nutrientTotal } from './nutrientTotal';
import type { FoodEntry } from './types';

const nutrients={saturatedFat:'Saturated fat',transFat:'Trans fat',fiber:'Fiber',sugars:'Total sugars',addedSugar:'Added sugars',sodium:'Sodium',cholesterol:'Cholesterol'} as const;
export default function AdditionalNutrition({entries}:{entries:FoodEntry[]}) {
  if(!entries.some(entry=>Object.keys(nutrients).some(key=>entry[key as keyof typeof nutrients]!=null))) return null;
  return <details><summary>Additional nutrients</summary>{(Object.keys(nutrients) as (keyof typeof nutrients)[]).map(key=>{
    const sum=nutrientTotal(entries,entry=>entry[key]);
    return <div className="food-value" key={key}><span>{nutrients[key]}</span><b>{sum===null?'Incomplete':sum.toLocaleString(undefined,{maximumFractionDigits:4})+' g'}</b></div>;
  })}</details>;
}
