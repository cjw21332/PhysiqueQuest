import { describe,it,expect,vi } from 'vitest';
import { ProductService,normalizeProduct,retailCode } from './product.service.js';

describe('packaged food lookup',()=>{
  it('preserves leading zeroes, expands UPC-E and reports check digit validity without rejecting',()=>{
    expect(retailCode('01234565','upc_e')).toEqual({code:'012345000065',checkDigitValid:true});
    expect(retailCode('4006381333931')).toEqual({code:'4006381333931',checkDigitValid:true});
    expect(retailCode('4006381333932')).toEqual({code:'4006381333932',checkDigitValid:false});
    expect(()=>retailCode('invalid')).toThrow();
  });
  it('keeps missing nutrients separate from genuine zero and caches successful requests',async()=>{
    const fetchJson=vi.fn().mockResolvedValue({status:1,product:{nutriments:{fat_100g:0,proteins_100g:12}}});
    const service=new ProductService({fetchJson} as never);
    const value=await service.lookup('4006381333931');
    expect(value.per100).toMatchObject({fat:0,protein:12,calories:null,carbs:null});
    expect(await service.lookup(value.code)).toEqual(value);
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });
  it('distinguishes missing and malformed responses',()=>{
    expect(()=>normalizeProduct('123',{status:0})).toThrow(/not found/i);
    expect(()=>normalizeProduct('123',{})).toThrow(/invalid/i);
  });
});

describe('format and cache boundaries',()=>{
  it.each([['96385074','ean_8'],['036000291452','upc_a'],['4006381333931','ean_13']])('accepts %s as %s',(code,format)=>expect(retailCode(code,format)).toEqual({code,checkDigitValid:true}));
  it.each([['96385074','upc_e'],['036000291452','ean_13'],['4006381333931','other'],['01234566','upc_e']])('accepts %s as %s without rejecting on format mismatch',(code,format)=>expect(retailCode(code,format).code).toBeTruthy());
  it('expires cached products and allows retry after failure',async()=>{
    vi.useFakeTimers();
    try {
      const raw={status:1,product:{product_name:'Label',nutriments:{sodium_100g:0,'added-sugars_100g':2,fiber_100g:-1}}};
      const fetchJson=vi.fn().mockRejectedValueOnce(new Error('Timeout')).mockResolvedValue(raw);
      const service=new ProductService({fetchJson} as never);
      await expect(service.lookup('96385074')).rejects.toThrow('Timeout');
      expect((await service.lookup('96385074')).per100).toMatchObject({sodium:0,addedSugar:2,fiber:null,cholesterol:null});
      vi.advanceTimersByTime(3600001);
      await service.lookup('96385074');
      expect(fetchJson).toHaveBeenCalledTimes(3);
    } finally {vi.useRealTimers();}
  });
});
