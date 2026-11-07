import test from 'node:test';
import assert from 'node:assert/strict';
import {createProviderRepQuality} from './providerRepQuality.mjs';
test('only unique provider repetitions graded A or B count toward the threshold',()=>{const c=createProviderRepQuality();assert.deepEqual(c.update(1,'A'),{total:1,clean:1,graded:1});assert.deepEqual(c.update(1,'A'),{total:1,clean:1,graded:1});assert.deepEqual(c.update(2,'C'),{total:2,clean:1,graded:2});assert.deepEqual(c.update(3),{total:3,clean:1,graded:2});assert.deepEqual(c.update(4,'B'),{total:4,clean:2,graded:3});});
test('missing events, malformed grades and out-of-order counts cannot invent clean reps',()=>{const c=createProviderRepQuality();assert.deepEqual(c.update(3,'B'),{total:3,clean:1,graded:1});assert.deepEqual(c.update(2,'A'),{total:3,clean:1,graded:1});assert.deepEqual(c.update(4,'X'),{total:4,clean:1,graded:1});assert.deepEqual(c.update(NaN,'A'),{total:4,clean:1,graded:1});});
