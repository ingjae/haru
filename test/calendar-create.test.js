import test from 'node:test';
import assert from 'node:assert/strict';
import {eventPayload,taskPayload,slotTime,validDate,visibleTask} from '../public/calendar.js';
test('all-day end is exclusive, even across month/year boundaries',()=>{const p=eventPayload({title:'휴가',start:'2026-12-31',end:'2027-01-02',allDay:true});assert.deepEqual(p.start,{date:'2026-12-31'});assert.deepEqual(p.end,{date:'2027-01-03'});assert.throws(()=>eventPayload({title:'x',start:'2026-02-30',end:'2026-03-01',allDay:true}));});
test('timed recurring creation includes IANA zone and whitelists frequencies',()=>{const p=eventPayload({title:'집중',start:'2026-10-14T09:00',end:'2026-10-14T10:00',repeat:'WEEKLY',timeZone:'Asia/Seoul',description:'메모',location:'사무실'});assert.deepEqual(p.recurrence,['RRULE:FREQ=WEEKLY']);assert.equal(p.start.timeZone,'Asia/Seoul');assert.equal(p.description,'메모');assert.throws(()=>eventPayload({title:'x',start:'2026-10-14T09:00',end:'2026-10-14T10:00',reminder:'NaN'}));});
test('tasks keep date-only semantics and reject invalid state',()=>{assert.equal(taskPayload({title:'정리',due:'2026-10-14'}).due,'2026-10-14T00:00:00.000Z');assert.equal(taskPayload({title:'정리'}).due,null);assert.throws(()=>taskPayload({title:'',status:'completed'}));assert.throws(()=>taskPayload({title:'x',status:'other'}));assert.throws(()=>validDate('2026-13-01'));});
test('empty timeline clicks snap to quarter-hour and clamp range endpoints',()=>{const day=new Date(2026,9,14);assert.equal(slotTime(day,0,720,540,1260).getHours(),9);const middle=slotTime(day,95,720,540,1260);assert.equal(middle.getHours(),10);assert.equal(middle.getMinutes(),30);const end=slotTime(day,1000,720,540,1260);assert.equal(end.getHours(),20);assert.equal(end.getMinutes(),45);});

test('completed tasks show only on today using completion date rather than due date',()=>{
  const today=new Date(2026,9,14,13),yesterday=new Date(2026,9,13,23,59),midnight=new Date(2026,9,14,0);
  assert.equal(visibleTask({status:'completed',completed:yesterday.toISOString(),due:'2026-10-14T00:00:00Z'},today,today),false);
  assert.equal(visibleTask({status:'completed',completed:midnight.toISOString(),due:'2026-10-12T00:00:00Z'},today,today),true);
  assert.equal(visibleTask({status:'completed',completed:today.toISOString()},yesterday,today),false);
  assert.equal(visibleTask({status:'completed'},today,today),false);
  assert.equal(visibleTask({status:'completed',completed:'invalid'},today,today),false);
  assert.equal(visibleTask({deleted:true,status:'completed',completed:today.toISOString()},today,today),false);
  assert.equal(visibleTask({status:'needsAction'},today,today),true);
  assert.equal(visibleTask({status:'needsAction',due:'2026-10-13T00:00:00Z'},today,today),false);
});
