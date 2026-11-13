import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { HttpService } from '../../common/foodscan/http.service.js';
import { notFound, serviceUnavailable } from '../../common/foodscan/errors.js';

export interface RetailCodeResult { code: string; checkDigitValid: boolean; }

export function retailCode(input: string, format?: string): RetailCodeResult {
  let code = input.trim();
  if (format === 'upc_e' && /^[01]\d{7}$/.test(code)) {
    const [n,a,b,c,d,e,f,k] = code;
    code = n + (f <= '2' ? a+b+f+'0000'+c+d+e : f === '3' ? a+b+c+'00000'+d+e : f === '4' ? a+b+c+d+'00000'+e : a+b+c+d+e+'0000'+f) + k;
  }
  const digits = z.string().regex(/^\d{6,14}$/, 'Enter a retail barcode with 6 to 14 digits').parse(code);
  const sum = [...digits].reverse().reduce((s,n,i) => s + Number(n)*(i%2 ? 3 : 1),0);
  // Check digit validity is advisory only: Open Food Facts is the authority on
  // whether a code maps to a real product. Rejecting on a bad check digit
  // blocks legitimate barcodes whose print or symbology doesn't carry one.
  return { code: digits, checkDigitValid: sum % 10 === 0 };
}
const fields = 'product_name,brands,image_front_small_url,quantity,product_quantity,serving_size,serving_quantity,serving_quantity_unit,product_quantity_unit,ingredients_text,allergens,categories,countries,nutriscore_grade,nutriments';
export function normalizeProduct(code: string, raw: unknown) {
  const record = z.object({status:z.number(),product:z.record(z.string(),z.unknown()).optional()}).safeParse(raw);
  if (!record.success) throw serviceUnavailable('Invalid response from Open Food Facts');
  if (record.data.status === 0) throw notFound('Product not found in Open Food Facts');
  const p = record.data.product;
  if (record.data.status !== 1 || !p) throw serviceUnavailable('Invalid product response');
  if (!Object.keys(p).some(key => fields.split(',').includes(key))) throw serviceUnavailable('Product details unavailable');
  const str = (key:string) => typeof p[key] === 'string' ? p[key] as string : '';
  const n = z.record(z.string(),z.unknown()).safeParse(p.nutriments);
  const nutrient = (key:string) => {
    const v = n.success ? n.data[key+'_100g'] : null;
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
  };
  const unit = str('serving_quantity_unit') || str('product_quantity_unit');
  const basis = /^(ml|l)$/i.test(unit) ? 'ml' : 'g';
  const serving = Number(p.serving_quantity);
  return {code, name:str('product_name') || 'Product '+code, brand:str('brands'), image:str('image_front_small_url'), quantity:str('quantity'), servingLabel:str('serving_size'), basis,
    packageAmount: str('product_quantity_unit') === basis && Number(p.product_quantity)>0 ? Number(p.product_quantity) : null,
    serving: unit === basis && Number.isFinite(serving) && serving > 0 ? serving : null,
    ingredients:str('ingredients_text'), allergens:str('allergens'), categories:str('categories'), countries:str('countries'), grade:str('nutriscore_grade'),
    per100:{calories:nutrient('energy-kcal'),protein:nutrient('proteins'),carbs:nutrient('carbohydrates'),fat:nutrient('fat'),saturatedFat:nutrient('saturated-fat'),fiber:nutrient('fiber'),sugars:nutrient('sugars'),sodium:nutrient('sodium'),transFat:nutrient('trans-fat'),addedSugar:nutrient('added-sugars'),cholesterol:nutrient('cholesterol')} };
}
@Injectable()
export class ProductService {
  private cache = new Map<string,{until:number,product:ReturnType<typeof normalizeProduct>}>();
  constructor(private http:HttpService) {}
  async lookup(input:string,format?:string) {
    const { code } = retailCode(input,format);
    const hit = this.cache.get(code);
    if (hit && hit.until > Date.now()) return hit.product;
    const raw = await this.http.fetchJson<unknown>('https://world.openfoodfacts.org/api/v2/product/'+code+'.json?fields='+fields,{upstream:'Open Food Facts',timeoutMs:6000,retryServerErrors:true,headers:{'User-Agent':'PhysiqueQuest/1.0 (https://github.com/cjw21332/PhysiqueQuest)'}});
    const product = normalizeProduct(code,raw);
    if(this.cache.size >= 500) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(code,{until:Date.now()+3600000,product});
    return product;
  }
}
