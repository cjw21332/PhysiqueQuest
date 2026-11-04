import { useCallback, useEffect, useRef, useState } from 'react';
import {normalizeBarcode} from './barcodeInput';
import LabelForm from './LabelForm';
import FoodCamera from './FoodCamera';
import { api, type BarcodeProduct } from '../../lib/api';
import { mealNames, type FoodEntry, type MealName } from './types';

export default function BarcodeMeal({close,save,search}:{search:()=>void;close:()=>void;save:(entry:Omit<FoodEntry,'id'|'date'>)=>Promise<void>}) {
  const [editing,setEditing]=useState(false);
  const [manual,setManual]=useState(false);
  const [camera,setCamera]=useState(true);
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
      normalizeBarcode(input,kind);
      const result=await api.lookupBarcode(input.trim(),kind);
      setProduct(result);setUnit('amount');setQuantity(String(result.serving ?? 100));
    } catch(e){setError(e instanceof Error?e.message:'Product lookup failed. Try again.');}
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
  return <dialog ref={dialog} className="barcode-review" onCancel={e=>{e.preventDefault();if(!busy)close();}}>
    <header><h2>Scan barcode</h2><button disabled={busy} onClick={close}>Close</button></header>
    {editing ? <LabelForm format={format} code={code} product={product} cancel={()=>setEditing(false)} review={p=>{setProduct(p);setManual(true);setEditing(false);setError('');setUnit('amount');setQuantity(String(p.serving??p.packageAmount??100));}}/> : <>
    <form onSubmit={e=>{e.preventDefault();void lookup(code,format);}}>
      <label>Product barcode<input required inputMode="numeric" maxLength={14} value={code} disabled={busy} onChange={e=>{setCode(e.target.value);setProduct(null);}}/></label>
      <label>8-digit barcode type<select value={format==='upc_e'?'upc_e':''} onChange={e=>setFormat(e.target.value)}><option value="">EAN-8 (or full-length barcode)</option><option value="upc_e">UPC-E</option></select></label>
      <button disabled={busy}>Look up product</button><button disabled={busy} type="button" onClick={()=>setCamera(true)}>Scan again</button>
    </form>
    <button disabled={busy} onClick={()=>setEditing(true)}>Enter Nutrition Information Manually</button>
    {busy&&<p role="status">Working…</p>}{error&&<><p role="alert">{error}</p><button onClick={search}>Search food by name or brand</button></>}
    {product&&<><h3>{product.name}</h3><p>{product.brand} {product.quantity}</p>{product.image&&<img src={product.image} alt={product.name}/>}
    <p>{product.ingredients}</p>{product.allergens&&<p>Allergens: {product.allergens}</p>}
    <label>Unit<select value={unit} onChange={e=>{const next=e.target.value as typeof unit;setQuantity(String(next==='servings'?amount/product.serving!:amount));setUnit(next);}}><option value="amount">{product.basis}</option>{product.serving&&<option value="servings">Label servings</option>}</select></label>
    {product.packageAmount&&<button onClick={()=>{setUnit('amount');setQuantity(String(product.packageAmount));}}>Entire package</button>}
    <label>Amount consumed ({unit==='servings'?'servings':product.basis})<input type="number" min="0.01" step="any" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
    {product.servingLabel&&<small>Label serving: {product.servingLabel}</small>}
    <table><thead><tr><th>Nutrient</th><th>Per 100 {product.basis}</th><th>Your portion</th></tr></thead><tbody>{(Object.keys(product.per100) as (keyof BarcodeProduct['per100'])[]).map(k=><tr key={k}><th>{k} ({k==='calories'?'kcal':'g'})</th><td>{product.per100[k]??'Unavailable'}</td><td>{scaled(k)??'Unavailable'}</td></tr>)}</tbody></table>
    <label>Meal<select value={meal} onChange={e=>setMeal(e.target.value as MealName)}>{mealNames.map(m=><option key={m}>{m}</option>)}</select></label>
    <p>Barcode: {product.code || 'None'}</p>{manual ? <p>Source: manually entered nutrition label</p> : <a href={'https://world.openfoodfacts.org/product/'+product.code} target="_blank" rel="noreferrer">Open Food Facts · product data and image</a>}
    <button className="primary" disabled={!valid||busy} onClick={()=>void confirm()}>Save to {meal}</button></>}
    </>}
  </dialog>;
}
