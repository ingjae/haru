import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarRange,calendarDays,dateInput,eventOnDay,shiftCalendar} from './public/calendar.js';
test('month includes six Monday-based weeks across year boundaries',()=>{const d=new Date('2026-12-31T12:00:00');const days=calendarDays(d,'month');assert.equal(days.length,42);assert.equal(days[0].getDay(),1);assert.equal(dateInput(days[0]),'2026-11-30');assert.equal(dateInput(days.at(-1)),'2027-01-10');});
test('week spans local Monday through exclusive next Monday',()=>{const r=calendarRange(new Date('2026-10-18T12:00:00'),'week');assert.equal(dateInput(r.start),'2026-10-12');assert.equal(dateInput(r.end),'2026-10-19');});
test('month navigation does not overflow from the 31st',()=>{assert.equal(dateInput(shiftCalendar(new Date('2026-01-31T12:00:00'),'month',1)),'2026-02-01');});
test('all-day and midnight boundaries exclude the ending day',()=>{const e={start:{date:'2026-10-14'},end:{date:'2026-10-16'}};assert.equal(eventOnDay(e,new Date('2026-10-15T12:00:00')),true);assert.equal(eventOnDay(e,new Date('2026-10-16T12:00:00')),false);});
