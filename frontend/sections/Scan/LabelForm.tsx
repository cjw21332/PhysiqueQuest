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
    try { if(barcode){const {code}=normalizeBarcode(barcode,barcode.length===8?format:'');barcode=code;} } catch(e){setError((e as Error).message);return;}
    review({code:barcode,name:field('name'),brand:field('brand'),servingLabel:field('description'),basis:unit,
      serving:basis==='serving'?weight:null,packageAmount:basis==='package'?weight:null,per100,
      image:'',quantity:'',ingredients:'',allergens:'',categories:'',countries:'',grade:''});
  }} className="space-y-4 text-sm max-h-[75vh] overflow-y-auto pr-2">
    <div className="flex justify-between items-center border-b pb-2">
      <h3 className="font-bold text-base">Enter Nutrition from Label</h3>
      <button type="button" onClick={cancel} className="text-gray-500 hover:text-gray-700">Cancel</button>
    </div>

    <div className="grid grid-cols-1 gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Product Name *</label>
        <input name="name" required pattern=".*\S.*" maxLength={120} defaultValue={product?.name} className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-green-500" placeholder="e.g. Protein Granola Bar" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Brand</label>
          <input name="brand" maxLength={120} defaultValue={product?.brand} className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. Quaker" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Barcode</label>
          <input name="barcode" defaultValue={product?.code ?? code} className="w-full border rounded px-3 py-2 text-sm" placeholder="Optional" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Serving Description *</label>
        <input name="description" maxLength={100} required defaultValue={product?.servingLabel} className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. 1 bar (45g)" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
          <select value={unit} onChange={e=>setUnit(e.target.value)} className="w-full border rounded px-2 py-2 text-sm bg-white"><option>g</option><option>ml</option></select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Label Values For</label>
          <select value={basis} onChange={e=>setBasis(e.target.value)} className="w-full border rounded px-2 py-2 text-sm bg-white"><option value="100">100 {unit}</option><option value="serving">One serving</option><option value="package">One package</option></select>
        </div>
      </div>
      {basis!=='100'&&<div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Quantity per {basis} ({unit}) *</label>
        <input name="weight" type="number" min="0.001" max="100000" step="any" required className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. 45" />
      </div>}
    </div>

    <div className="border-t pt-3">
      <h4 className="font-semibold text-xs text-gray-600 mb-2 uppercase tracking-wider">Macros &amp; Nutrients (Per 100{unit})</h4>
      <p className="text-xs text-gray-500 mb-3">Leave unlisted nutrients blank. Enter 0 only if label states 0.</p>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(labelFields).map(([key,label])=>(
          <div key={key}>
            <label className="block text-[11px] text-gray-600 mb-0.5">{label}</label>
            <input name={key} type="number" step="any" min="0" max="100000" inputMode="decimal" className="w-full border rounded px-2 py-1.5 text-sm" placeholder="0" />
          </div>
        ))}
      </div>
    </div>

    {error&&<p className="text-red-600 bg-red-50 p-2 rounded text-xs font-medium" role="alert">{error}</p>}

    <div className="flex gap-2 pt-2 border-t">
      <button type="button" onClick={cancel} className="flex-1 bg-gray-200 text-gray-800 py-2.5 rounded font-medium text-sm hover:bg-gray-300">Cancel</button>
      <button type="submit" className="flex-1 bg-green-600 text-white py-2.5 rounded font-medium text-sm hover:bg-green-700">Review Label</button>
    </div>
  </form>;
}
