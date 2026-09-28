'use client';

import { useMemo, useState } from 'react';
import { foodCatalog, mealNames, type MealName } from './types';
import { Icon } from '../Home/icons';

export default function AddFood({ initialMeal, onBack, onSave }: { initialMeal: MealName; onBack: () => void; onSave: (food: typeof foodCatalog[number], meal: MealName, amount: number, unit: 'grams' | 'servings') => void }) {
  const [meal, setMeal] = useState<MealName>(initialMeal);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(foodCatalog[0]);
  const [amount, setAmount] = useState('150');
  const [unit, setUnit] = useState<'grams'|'servings'>('grams');
  const results = useMemo(()=>foodCatalog.filter(food=>food.name.toLowerCase().includes(query.toLowerCase())||food.group.toLowerCase().includes(query.toLowerCase())),[query]);
  const scale=unit==='grams'?Number(amount)/100:Number(amount);
  return <><header className="scan-header add-food-header"><button className="coach-back" onClick={onBack} aria-label="Back">‹</button><h2>Add food</h2></header><div className="scan-chips meal-select">{mealNames.map(item=><button className={meal===item?'active':''} key={item} onClick={()=>setMeal(item)}>{item}</button>)}</div><label className="food-search"><Icon name="scan" size={15}/><input placeholder="Search food" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="recent-foods"><b>Recent & frequent</b><div>{['Chicken breast','White rice','Egg','Banana'].map((name,i)=><button key={name} onClick={()=>{const match=foodCatalog[[0,3,5,6][i]];setSelected(match);setQuery('')}}>{name}</button>)}</div></div><section className="food-results"><div className="section-head"><h3>Results</h3><small>{results.length} found</small></div><div className="food-result-list">{results.slice(0,5).map(food=><button className={selected.name===food.name?'selected':''} key={food.name} onClick={()=>setSelected(food)}><i className={selected.name===food.name?'checked':''}/><span><b>{food.name}</b><small>{food.group} · {food.per}</small></span><strong>{food.calories} kcal</strong></button>)}</div></section><section className="portion-entry"><h3>Portion</h3><div className="quantity-row"><label><small>Quantity</small><input type="number" min="0" value={amount} onChange={e=>setAmount(e.target.value)}/></label><div className="scan-chips"><button className={unit==='grams'?'active':''} onClick={()=>setUnit('grams')}>grams</button><button className={unit==='servings'?'active':''} onClick={()=>setUnit('servings')}>servings</button></div></div><h3>Calculated nutrition</h3><small className="calculated-amount">{unit==='grams'?`${amount} g`:`${amount} serving(s)`}</small><FoodValue name="Calories" value={`${Math.round(selected.calories*scale)} kcal`}/><FoodValue name="Protein" value={`${(selected.protein*scale).toFixed(1)} g`}/><FoodValue name="Carbohydrates" value={`${(selected.carbs*scale).toFixed(1)} g`}/><FoodValue name="Fat" value={`${(selected.fat*scale).toFixed(1)} g`}/></section><footer className="scan-footer"><button className="primary" disabled={!Number(amount)} onClick={()=>onSave(selected,meal,Number(amount),unit)}>Save to {meal}</button></footer></>;
}
function FoodValue({name,value}:{name:string;value:string}){return <div className="food-value"><span>{name}</span><b>{value}</b></div>}
