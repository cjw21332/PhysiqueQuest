'use client';

import { useState } from 'react';
import type { FoodEntry } from './types';

export default function FoodHistory({ meals, onBack }: { meals: FoodEntry[]; onBack: () => void }) {
  const [range,setRange]=useState('7 days');
  const avg=Math.round(meals.reduce((sum,item)=>sum+item.calories,0)||1947);
  const bars=range==='7 days'?[66,58,83,49,68,62,35]:range==='30 days'?[48,62,54,70,66,81,57,75,63,87,58,72]:[54,60,63,69,65,71,74,83,78,87,80,93];
  return <><header className="scan-header add-food-header"><button className="coach-back" onClick={onBack} aria-label="Back">‹</button><h2>Food history</h2></header><div className="history-tabs">{['7 days','30 days','90 days'].map(item=><button key={item} className={range===item?'active':''} onClick={()=>setRange(item)}>{item}</button>)}</div><small className="history-caption">Today's logged intake</small><div className="history-total"><b>{(avg).toLocaleString()}</b> kcal</div><p className="history-target">{Math.max(0,2300-avg)} kcal under your 2,300 target</p><p className="history-sample-note">Previous days in this chart are sample data.</p><div className="history-chart">{bars.map((height,i)=><div key={i}><i className={i===2?'warn':i===bars.length-1?'latest':''} style={{height:`${height}%`}}/><small>{(range==='7 days'?['Th','F','S','Su','M','T','W']:[])[i]||`W${i+1}`}</small></div>)}<span>Target</span></div><section className="history-macros"><h3>Average macro split · sample</h3>{[['Protein',28],['Carbs',47],['Fat',25]].map(([label,value])=><div className="history-macro" key={label as string}><div><span>{label}</span><b>{value}%</b></div><div className="macro-track"><i style={{width:`${value}%`}}/></div></div>)}</section><section className="history-records"><h3>Records</h3>{meals.slice().reverse().map(entry=><div className="history-entry" key={entry.id}><span><b>{entry.meal} · {entry.name}</b><small>{entry.source} · {entry.time}</small></span><strong>{entry.calories} kcal</strong></div>)}</section></>;
}
