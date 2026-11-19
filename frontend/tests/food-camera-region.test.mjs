import test from 'node:test';
import assert from 'node:assert/strict';
import { foodPhotoCrop } from '../../shared/foodCamera.ts';

test('photo crop excludes pixels outside the visible scan frame with cover scaling', () => {
  assert.deepEqual(foodPhotoCrop(1000,1000,500,500), {x:100,y:200,width:800,height:600});
  assert.deepEqual(foodPhotoCrop(2000,1000,500,1000), {x:800,y:200,width:400,height:600});
  assert.deepEqual(foodPhotoCrop(1000,2000,1000,500), {x:100,y:850,width:800,height:300});
});
