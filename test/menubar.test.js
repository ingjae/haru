import test from 'node:test';import assert from 'node:assert/strict';
import {menuBarModel} from '../public/menubar.js';
const at=h=>new Date(2026,9,13,h).toISOString();
const event=(s,e)=>({summary:'sample',start:{dateTime:at(s)},end:{dateTime:at(e)}});
test('menu bar model clips events to the selected range and keeps overlapping rows',()=>{
 const m=menuBarModel([event(8,10),event(9,11),event(22,23)],new Date(2026,9,13,15));
 assert.equal(m.segments.length,2);assert.equal(m.segments[0].start,0);assert.equal(m.segments[0].row,0);assert.equal(m.segments[1].row,1);assert.equal(m.current,.5);assert.equal(m.startLabel,'09:00');assert.equal(m.endLabel,'21:00');
});
test('empty and invalid events render safely; time outside the range has no marker',()=>{
 assert.deepEqual(menuBarModel([],new Date(2026,9,13,22)).segments,[]);
 assert.equal(menuBarModel([],new Date(2026,9,13,22)).current,null);
 assert.equal(menuBarModel([event(12,11)],new Date(2026,9,13,10)).count,0);
});
test('menu bar follows custom half-hour start and full-day end',()=>{
 const m=menuBarModel([],new Date(2026,9,13,12),510,1440);
 assert.equal(m.startLabel,'08:30');assert.equal(m.endLabel,'24:00');assert.ok(m.current>0&&m.current<1);
});
