import test from 'node:test';
import assert from 'node:assert/strict';
import { foodPhotoCrop, barcodeInsideFoodFrame } from '../../shared/foodCamera.ts';

test('photo crop excludes pixels outside the visible scan frame with cover scaling', () => {
  assert.deepEqual(foodPhotoCrop(1000,1000,500,500), {x:100,y:200,width:800,height:600});
  assert.deepEqual(foodPhotoCrop(2000,1000,500,1000), {x:800,y:200,width:400,height:600});
  assert.deepEqual(foodPhotoCrop(1000,2000,1000,500), {x:100,y:850,width:800,height:300});
});
test('barcode bounds must be fully inside the frame; missing bounds never match', () => {
  const bounds=(x,y,w,h)=>({origin:{x,y},size:{width:w,height:h}});
  assert.equal(barcodeInsideFoodFrame(bounds(150,250,200,200),1000,1000),true);
  for (const b of [undefined,bounds(0,0,100,100),bounds(850,250,100,100),bounds(200,750,100,100),bounds(200,200,0,0)]) {
    assert.equal(barcodeInsideFoodFrame(b,1000,1000),false);
  }
});
