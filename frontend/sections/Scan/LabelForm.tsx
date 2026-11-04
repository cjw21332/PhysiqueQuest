import {normalizeBarcode} from './barcodeInput';
import { useState } from 'react';
import type { BarcodeProduct } from '../../lib/api';

export const labelFields = {calories:'Energy (kcal)',protein:'Protein (g)',carbs:'Carbohydrates (g)',fat:'Total fat (g)',saturatedFat:'Saturated fat (g)',transFat:'Trans fat (g)',fiber:'Fiber (g)',sugars:'Total sugars (g)',addedSugar:'Added sugars (g)',sodium:'Sodium (g)',cholesterol:'Cholesterol (g)'} as const;
type Key = keyof typeof labelFields;

export default function LabelForm({product,code,format,review,cancel}:{format:string;product:BarcodeProduct|null;code:string;review:(p:BarcodeProduct)=>void;cancel:()=>void}) {
  const [error,setError]=useState('');
  const [basis,setBasis]=useState('100');
  const [unit,setUnit]=useState(product?.basis ?? 'g');
  return <form onSubmit={e=>{
    e.preventDefault();
    const data=new FormData(e.currentTarget);
    const field=(name:string)=>String(data.get(name)??'').trim();
    const weight=basis==='100'?100:Number(field('weight'));
    const per100={} as BarcodeProduct['per100'];
    for(const key of Object.keys(labelFields) as Key[]) {
      const input=field(key);
      per100[key]=input===''?null:Number(input)*100/weight;
    }
    let barcode=field('barcode');
    try { if(barcode)barcode=normalizeBarcode(barcode,barcode.length===8?format:''); } catch(e){setError((e as Error).message);return;}
    review({code:barcode,name:field('name'),brand:field('brand'),servingLabel:field('description'),basis:unit,
      serving:basis==='serving'?weight:null,packageAmount:basis==='package'?weight:null,per100,
      image:'',quantity:'',ingredients:'',allergens:'',categories:'',countries:'',grade:''});
  }}>
    <h3>Enter nutrition from the label</h3>
    <label>Product name<input name="name" required pattern=".*\S.*" maxLength={120} defaultValue={product?.name}/></label>
    <label>Brand<input name="brand" maxLength={120} defaultValue={product?.brand}/></label>
    <label>Barcode (optional)<input name="barcode" pattern="([0-9]{8}|[0-9]{12,14})" defaultValue={product?.code ?? code}/></label>
    <label>Serving description<input name="description" maxLength={100} required defaultValue={product?.servingLabel}/></label>
    <label>Unit<select value={unit} onChange={e=>setUnit(e.target.value)}><option>g</option><option>ml</option></select></label>
    <label>Label values are for<select value={basis} onChange={e=>setBasis(e.target.value)}><option value="100">100 {unit}</option><option value="serving">One serving</option><option value="package">One package</option></select></label>
    {basis!=='100'&&<label>Quantity per {basis} ({unit})<input name="weight" type="number" min="0.001" max="100000" step="any" required/></label>}
    <p>Leave unlisted nutrients blank. Enter zero only when the label states zero.</p>
    {Object.entries(labelFields).map(([key,label])=><label key={key}>{label}<input name={key} type="number" step="any" min="0" max="100000" inputMode="decimal"/></label>)}
    {error&&<p role="alert">{error}</p>}
    <button>Review label</button><button type="button" onClick={cancel}>Cancel</button>
  </form>;
}
