export function dayRange(date = new Date()) {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return { start, end };
}
export function meetingURL(event) {
  const candidates = [event.hangoutLink, ...(event.conferenceData?.entryPoints || []).filter(p=>p.entryPointType==='video').map(p=>p.uri)];
  for(const candidate of candidates){try{const url=new URL(candidate);if(url.protocol==='https:')return url.href;}catch{}}
  // Invitations often put the meeting link only in description or location.
  const text=[event.description,event.location].filter(Boolean).join(' ').replace(/&amp;/g,'&');
  const links=text.match(/(?<![\w.\/-])(?:https:\/\/)?(?:meet\.google\.com|(?:[\w-]+\.)?zoom\.us|teams\.microsoft\.com|teams\.live\.com)\/[^\s<>"']+/gi)||[];
  for(const link of links){try{const url=new URL(link.startsWith('https://')?link:'https://'+link.replace(/[),.;]+$/,''));if(url.protocol==='https:')return url.href;}catch{}}
  return null;
}
export function localInput(date) {
  const d = new Date(date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
export function eventPatch(title, start, end, reminder) {
  if (!title.trim()) throw new Error('일정 제목을 입력해 주세요.');
  const s = new Date(start), e = new Date(end);
  if (!Number.isFinite(+s) || !Number.isFinite(+e) || e <= s) throw new Error('종료 시간은 시작 시간보다 늦어야 합니다.');
  return { summary: title.trim(), start: { dateTime: s.toISOString() }, end: { dateTime: e.toISOString() }, reminders: { useDefault: false, overrides: reminder === 'none' ? [] : [{ method: 'popup', minutes: Number(reminder) }] } };
}

export function timelineRange(startMinutes=540,endMinutes=1260){
  if(!Number.isInteger(startMinutes)||!Number.isInteger(endMinutes)||startMinutes<0||endMinutes>1440||endMinutes-startMinutes<30)throw Error('종료 시간을 시작보다 최소 30분 뒤로 설정해 주세요.');
  return {startMinutes,endMinutes};
}
export function timelineTime(minutes){return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;}
export function outsideTimeline(event,start,range){
  return new Date(event.start.dateTime)<+start+range.startMinutes*60000||new Date(event.end.dateTime)>+start+range.endMinutes*60000;
}

export function dateInput(date=new Date()){return localInput(date).slice(0,10);}
export function validDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw Error('날짜를 확인해 주세요.');return value;}
export function nextDate(value){const d=new Date(validDate(value)+'T12:00:00');d.setDate(d.getDate()+1);return dateInput(d);}
export function slotTime(date,offset,height,from,to){const minutes=Math.max(from,Math.min(to-15,Math.floor((from+Math.max(0,offset)/Math.max(1,height)*(to-from))/15)*15));const d=new Date(date);d.setHours(0,minutes,0,0);return d;}
export function eventPayload(input){
  const {title,start,end,allDay=false,reminder='none',description='',location='',repeat='none',timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone}=input;
  if(typeof title!=='string'||!title.trim()||title.length>500)throw Error('일정 제목을 입력해 주세요 (500자 이내).');
  let patch;
  if(allDay){validDate(start);validDate(end);if(end<start)throw Error('종료 날짜를 확인해 주세요.');patch={summary:title.trim(),start:{date:start},end:{date:nextDate(end)},reminders:{useDefault:false,overrides:[]}};}
  else patch=eventPatch(title,start,end,reminder);
  const minutes=Number(reminder);if(reminder!=='none'&&(!Number.isInteger(minutes)||minutes<0||minutes>40320))throw Error('알림 시간을 확인해 주세요.');
  if(allDay&&reminder!=='none')patch.reminders.overrides=[{method:'popup',minutes}];
  if(typeof description!=='string'||description.length>8192||typeof location!=='string'||location.length>1024)throw Error('설명이나 장소가 너무 깁니다.');
  patch.description=description;patch.location=location;
  if(repeat!=='none'){if(!['DAILY','WEEKLY','MONTHLY','YEARLY'].includes(repeat))throw Error('반복 설정을 확인해 주세요.');if(!allDay){try{new Intl.DateTimeFormat('en',{timeZone}).format();}catch{throw Error('시간대를 확인해 주세요.');}patch.start.timeZone=patch.end.timeZone=timeZone;}patch.recurrence=['RRULE:FREQ='+repeat];}
  return patch;
}
export function taskPayload({title,notes='',due='',status='needsAction'}){if(typeof title!=='string'||!title.trim()||title.length>1024)throw Error('할일 제목을 입력해 주세요.');if(typeof notes!=='string'||notes.length>8192)throw Error('할일 설명이 너무 깁니다.');if(!['needsAction','completed'].includes(status))throw Error('할일 상태를 확인해 주세요.');return {title:title.trim(),notes,due:due?validDate(due)+'T00:00:00.000Z':null,status};}

// Completed tasks belong to today's completion list, regardless of their due date.
export function visibleTask(task,viewDate=new Date(),now=new Date()){
  if(task.deleted)return false;
  if(task.status==='completed')return dateInput(viewDate)===dateInput(now)&&Number.isFinite(Date.parse(task.completed))&&dateInput(task.completed)===dateInput(now);
  if(task.schedule){const day=dayRange(viewDate);return new Date(task.schedule.start)<day.end&&new Date(task.schedule.end)>day.start;}
  return !task.due||task.due.slice(0,10)===dateInput(viewDate);
}

export function taskSchedule(schedule){
  if(schedule==null)return null;
  if(typeof schedule.calendarId!=='string'||!schedule.calendarId||schedule.calendarId.length>1024)throw Error('할일 시간을 저장할 캘린더를 선택해 주세요.');
  if(typeof schedule.start!=='string'||typeof schedule.end!=='string')throw Error('할일 시작·종료 시간을 입력해 주세요.');
  const start=new Date(schedule.start),end=new Date(schedule.end);
  if(!Number.isFinite(+start)||!Number.isFinite(+end)||end<=start)throw Error('할일 종료 시간은 시작 시간보다 늦어야 합니다.');
  return {calendarId:schedule.calendarId,start:localInput(start),end:localInput(end)};
}
