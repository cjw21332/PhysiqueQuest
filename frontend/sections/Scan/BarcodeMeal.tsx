import { useCallback, useEffect, useRef, useState } from 'react';
import {normalizeBarcode} from './barcodeInput';
import LabelForm from './LabelForm';
import FoodCamera from './FoodCamera';
import { api, type BarcodeProduct } from '../../lib/api';
import { mealNames, type FoodEntry, type MealName } from './types';

export default function BarcodeMeal({close,save,search}:{search:()=>void;close:()=>void;save:(entry:Omit<FoodEntry,'id'|'date'>)=>Promise<void>}) {
  const [editing,setEditing]=useState(false);
  const [manual,setManual]=useState(false);
  const [camera,setCamera]=useState(false);
  const [code,setCode]=useState('');
  const [format,setFormat]=useState('');
  const [product,setProduct]=useState<BarcodeProduct|null>(null);
  const [quantity,setQuantity]=useState('100');
  const [meal,setMeal]=useState<MealName>('Dinner');
  const [busy,setBusy]=useState(false);
  const lock=useRef(false);
  const [error,setError]=useState('');
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(!camera)dialog.current?.showModal();},[camera]);
  const lookup=useCallback(async(input:string,kind:string)=>{
    if(lock.current)return;
    lock.current=true;setCamera(false);setCode(input);setFormat(kind);setError('');setBusy(true);setProduct(null);setManual(false);
    try {
      const { code } = normalizeBarcode(input, kind);
      const result = await api.lookupBarcode(code, kind);
      setProduct(result);
      setUnit('amount');
      setQuantity(String(result.serving ?? 100));
    } catch (e) {
      if (e instanceof Error && e.message.includes('404')) {
        setError('Product not found in database. Please enter details manually.');
      } else {
        setError(e instanceof Error ? e.message : 'Product lookup failed. Please check your connection.');
      }
    }
    finally {lock.current=false;setBusy(false);}
  },[]);
  const [unit,setUnit]=useState<'amount'|'servings'>('amount');
  if(camera)return <FoodCamera onClose={close} onGallery={()=>setCamera(false)} onCapture={()=>{}} onBarcode={lookup}/>;
  const amount=Number(quantity)*(unit==='servings' && product?.serving ? product.serving : 1);
  const valid=Number.isFinite(amount)&&amount>0&&amount<=100000;
  const scaled=(key:keyof BarcodeProduct['per100'])=>{
    const value=product?.per100[key];
    return value==null||!valid?null:Number((value*amount/100).toPrecision(10));
  };
  async function confirm(){
    if(!product||!valid||lock.current)return;
    lock.current=true;setBusy(true);setError('');
    try {await save({name:product.name.slice(0,120),meal,source:manual?'Manual':'Barcode',barcode:product.code || undefined,brand:product.brand.slice(0,120),servingQuantity:amount,servingUnit:product.basis,detail:amount+' '+product.basis+' · '+(manual?'Manual label':'Open Food Facts')+' · '+product.servingLabel,time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),calories:scaled('calories'),protein:scaled('protein'),carbs:scaled('carbs'),fat:scaled('fat'),fiber:scaled('fiber'),sugars:scaled('sugars'),sodium:scaled('sodium'),transFat:scaled('transFat'),saturatedFat:scaled('saturatedFat'),addedSugar:scaled('addedSugar'),cholesterol:scaled('cholesterol')});}
    catch(e){setError(e instanceof Error?e.message:'Could not save meal');}
    finally{lock.current=false;setBusy(false);}
  }
  return <dialog ref={dialog} aria-labelledby="barcode-title" className="barcode-review" onCancel={e=>{e.preventDefault();if(!busy)close();}}>
    <header className="flex justify-between items-center mb-4 border-b pb-2">
      <div><p className="barcode-eyebrow">FOOD DIARY</p><h2 id="barcode-title">Add a packaged food</h2><p className="barcode-intro">Scan the barcode or enter its digits to find nutrition details.</p></div>
      <button type="button" className="barcode-close" aria-label="Close barcode dialog" disabled={busy} onClick={close}>×</button>
    </header>
    {editing ? <LabelForm format={format} code={code} product={product} cancel={()=>setEditing(false)} review={p=>{setProduct(p);setManual(true);setEditing(false);setError('');setUnit('amount');setQuantity(String(p.serving??p.packageAmount??100));}}/> : <>
    <form onSubmit={e=>{e.preventDefault();void lookup(code,format);}} className="space-y-4 mb-4">
      <div>
        <label htmlFor="barcode-code" className="block text-sm font-medium mb-1">Barcode number</label>
        <div className="flex gap-2">
          <input id="barcode-code" aria-describedby="barcode-help" required inputMode="numeric" maxLength={14} value={code} disabled={busy} onChange={e=>{setCode(e.target.value);setFormat('');setProduct(null);setError('');}} className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="e.g. 4006381333931" />
          <button disabled={busy} className="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50">Look up</button>
        </div>
        <p id="barcode-help" className="barcode-help">Enter the numbers printed below the barcode.</p>
        {code.length===8 && <label className="barcode-format">8-digit barcode type<select value={format==='upc_e'?'upc_e':''} onChange={e=>setFormat(e.target.value)}><option value="">EAN-8</option><option value="upc_e">UPC-E</option></select></label>}
      </div>
      <div className="barcode-alternatives">
        <button type="button" className="barcode-option" disabled={busy} onClick={()=>setCamera(true)}>Scan with camera</button>
        <button type="button" className="barcode-option" disabled={busy} onClick={()=>setEditing(true)}>Enter nutrition manually</button>
      </div>
    </form>
    {busy && <div className="text-center py-4 text-gray-600 animate-pulse" role="status">Searching product database...</div>}
    {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-4 text-sm" role="alert">
      <p>{error}</p>
      <div className="mt-2 flex gap-2">
        <button className="bg-red-600 text-white px-3 py-1 rounded text-xs" onClick={()=>{setEditing(true);setError('');}}>Enter Manually</button>
        <button className="bg-gray-200 text-gray-800 px-3 py-1 rounded text-xs" onClick={search}>Search by Name</button>
      </div>
    </div>}
    {product&&<div className="space-y-4 border-t pt-4">
      <div className="flex gap-4 items-center">
        {product.image && <img src={product.image} alt={product.name} className="w-16 h-16 object-contain border rounded"/>}
        <div>
          <h3 className="font-semibold text-base">{product.name}</h3>
          <p className="text-xs text-gray-500">{product.brand} {product.quantity}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="portion-unit" className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
          <select id="portion-unit" className="w-full border rounded px-2 py-1.5 text-sm" value={unit} onChange={e=>{const next=e.target.value as typeof unit;setQuantity(String(next==='servings'?amount/product.serving!:amount));setUnit(next);}}>
            <option value="amount">{product.basis}</option>
            {product.serving&&<option value="servings">Label servings</option>}
          </select>
        </div>
        <div>
          <label htmlFor="portion-amount" className="block text-xs font-medium text-gray-600 mb-1">Amount ({unit==='servings'?'servings':product.basis})</label>
          <input id="portion-amount" className="w-full border rounded px-2 py-1.5 text-sm" type="number" min="0.01" step="any" value={quantity} onChange={e=>setQuantity(e.target.value)}/>
        </div>
      </div>
      {product.servingLabel&&<small className="text-gray-500 block">Label serving: {product.servingLabel}</small>}

      <div className="border rounded overflow-hidden text-xs">
        <table className="w-full text-left">
          <thead className="bg-gray-100 border-b">
            <tr><th className="p-2">Nutrient</th><th className="p-2">Per 100{product.basis}</th><th className="p-2">Your portion</th></tr>
          </thead>
          <tbody>
            {(Object.keys(product.per100) as (keyof BarcodeProduct['per100'])[]).map(k=>(
              <tr key={k} className="border-b last:border-0">
                <td className="p-2 capitalize font-medium">{k} ({k==='calories'?'kcal':'g'})</td>
                <td className="p-2">{product.per100[k]??'—'}</td>
                <td className="p-2 font-semibold">{scaled(k)??'—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <label htmlFor="barcode-meal" className="block text-xs font-medium text-gray-600 mb-1">Log to Meal</label>
        <select id="barcode-meal" className="w-full border rounded px-2 py-1.5 text-sm" value={meal} onChange={e=>setMeal(e.target.value as MealName)}>{mealNames.map(m=><option key={m}>{m}</option>)}</select>
      </div>

      <button className="w-full bg-green-600 text-white font-semibold py-2.5 rounded hover:bg-green-700 disabled:opacity-50 text-sm" disabled={!valid||busy} onClick={()=>void confirm()}>Save to {meal}</button>
    </div>}
    </>}
  </dialog>;
}
