import test from 'node:test';
import assert from 'node:assert/strict';
import {dayRange,meetingURL,eventPatch,localInput} from '../public/calendar.js';

test('day boundaries use the local calendar date',()=>{
  const date=new Date(2026,9,13,17,45),{start,end}=dayRange(date);
  assert.equal(start.getHours(),0);assert.equal(start.getDate(),13);assert.equal(end.getDate(),14);assert.equal(date.getHours(),17);
});
test('meeting links accept video HTTPS links and reject executable links',()=>{
  assert.equal(meetingURL({conferenceData:{entryPoints:[{entryPointType:'phone',uri:'tel:123'},{entryPointType:'video',uri:'https://meet.google.com/abc-defg-hij'}]}}),'https://meet.google.com/abc-defg-hij');
  assert.equal(meetingURL({hangoutLink:'javascript:alert(1)'}),null);
  assert.equal(meetingURL({}),null);
});
test('calendar updates preserve times and set popup reminders',()=>{
  const result=eventPatch(' 팀 회의 ','2026-10-13T10:00','2026-10-13T11:00','10');
  assert.equal(result.summary,'팀 회의');assert.equal(new Date(result.end.dateTime)-new Date(result.start.dateTime),3600000);
  assert.deepEqual(result.reminders,{useDefault:false,overrides:[{method:'popup',minutes:10}]});
  assert.deepEqual(eventPatch('회의','2026-10-13T10:00','2026-10-13T11:00','none').reminders.overrides,[]);
});
test('invalid edits cannot be sent to Google',()=>{
  assert.throws(()=>eventPatch('','2026-10-13T10:00','2026-10-13T11:00','5'));
  assert.throws(()=>eventPatch('회의','2026-10-13T11:00','2026-10-13T10:00','5'));
  assert.throws(()=>eventPatch('회의','invalid','invalid','5'));
});
test('date input formatting preserves local wall-clock time',()=>assert.equal(localInput(new Date(2026,9,13,9,5)),'2026-10-13T09:05'));

test('meeting links in invitation text are recognized safely',()=>{
  assert.equal(meetingURL({description:'회의 링크 :\nmeet.google.com/abc-defg-hij'}),'https://meet.google.com/abc-defg-hij');
  assert.equal(meetingURL({description:'<a href="https://us02web.zoom.us/j/123?pwd=example&amp;x=1">참가</a>'}),'https://us02web.zoom.us/j/123?pwd=example&x=1');
  assert.equal(meetingURL({location:'https://teams.microsoft.com/l/meetup-join/example'}),'https://teams.microsoft.com/l/meetup-join/example');
  assert.equal(meetingURL({description:'https://meet.google.com.evil.example/abc'}),null);
  assert.equal(meetingURL({description:'http://meet.google.com/abc-defg-hij'}),null);
});

test('timeline ranges default to 09–21 and support half-hour boundaries and midnight',async()=>{
 const {timelineRange,timelineTime}=await import('../public/calendar.js');
 assert.deepEqual(timelineRange(),{startMinutes:540,endMinutes:1260});
 assert.deepEqual(timelineRange(510,1110),{startMinutes:510,endMinutes:1110});
 assert.equal(timelineTime(510),'08:30');assert.equal(timelineTime(1440),'24:00');
 assert.deepEqual(timelineRange(0,1440),{startMinutes:0,endMinutes:1440});
 for(const args of [[1260,540],[-30,1260],[540,1500],[540,550],[NaN,1260]])assert.throws(()=>timelineRange(...args));
});
test('outside-range buttons use exact boundaries, including next-day end times',async()=>{
 const {outsideTimeline,timelineRange}=await import('../public/calendar.js');
 const start=new Date(2026,9,13),range=timelineRange();
 const event=(h,end)=>({start:{dateTime:new Date(2026,9,13,h).toISOString()},end:{dateTime:new Date(2026,9,13,end).toISOString()}});
 assert.equal(outsideTimeline(event(9,21),start,range),false);
 assert.equal(outsideTimeline(event(8,10),start,range),true);
 assert.equal(outsideTimeline(event(20,24),start,range),true);
 assert.equal(outsideTimeline(event(0,24),start,timelineRange(0,1440)),false);
});
