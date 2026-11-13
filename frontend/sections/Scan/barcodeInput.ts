export interface NormalizedBarcode { code: string; checkDigitValid: boolean; }

export function normalizeBarcode(input:string,format:string):NormalizedBarcode {
  let code=input.trim();
  if(format==='upc_e'){
    if(!/^[01]\d{7}$/.test(code))throw Error('UPC-E requires eight digits beginning with 0 or 1.');
    const [n,a,b,c,d,e,f,k]=code;
    code=n+(f<='2'?a+b+f+'0000'+c+d+e:f==='3'?a+b+c+'00000'+d+e:f==='4'?a+b+c+d+'00000'+e:a+b+c+d+e+'0000'+f)+k;
  }
  if(!/^\d{6,14}$/.test(code))throw Error('Enter a retail barcode with 6 to 14 digits.');
  const checksum=[...code].reverse().reduce((sum,digit,index)=>sum+Number(digit)*(index%2?3:1),0);
  // Check digit validity is advisory: Open Food Facts decides whether a code is real.
  return { code, checkDigitValid: checksum%10===0 };
}
