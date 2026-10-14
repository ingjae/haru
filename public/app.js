import {menuBarModel,drawMenuBar} from './menubar.js';
import { dayRange, meetingURL, localInput, eventPayload, taskPayload, dateInput, nextDate, slotTime, visibleTask, timelineRange, timelineTime, outsideTimeline } from './calendar.js';
const $ = id => document.getElementById(id);
const bridge = window.desktop;
let events = [], sampleEvents=[], todayEvents=[], tasks=[], calendars=[{id:'primary',summary:'기본 캘린더',accessRole:'owner'}], taskLists=[{id:'@default',title:'내 할일'}], selected, connected = false, extended=false, loading = false, viewDate=new Date(),calendarId='primary',taskListId='@default',saving=false,taskError='';
let widget={edge:false,expanded:false},toastTimer;
function applyWidget(state){widget=state;if(state.edge&&!state.expanded&&dateInput(viewDate)!==dateInput()){viewDate=new Date();events=todayEvents;dateLabel();refresh();}$('timeline-start').value=String(state.timelineStart??540);$('timeline-end').value=String(state.timelineEnd??1260);$('rail-collapse').hidden=(!state.edge||!state.expanded)&&!state.menuBar;$('menubar-width').value=String(state.menuBarWidth??180);$('menubar-width').closest('label').hidden=state.platform==='linux';document.querySelectorAll('[data-position]').forEach(b=>b.hidden=state.platform==='linux'&&['menubar','statusbar'].includes(b.dataset.position));const reserveButton=$('reserve-space-button');if(reserveButton)reserveButton.hidden=state.platform==='linux';document.body.classList.toggle('collapsed-titles',!!state.collapsedTitles);$('collapsed-titles').checked=!!state.collapsedTitles;$('rail-background').checked=state.railBackground!==false;document.body.classList.toggle('rail-background-off',state.railBackground===false);document.body.classList.toggle('widget-right',state.side==='right');document.body.classList.toggle('edge-widget',!!state.edge);document.body.classList.toggle('widget-collapsed',!!state.edge&&!state.expanded);render();}
const time = value => new Date(value).toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit',hour12:false});
function message(text) { $('message').textContent = text; $('settings-message').textContent=text; }
function samples() {
  const day = new Date();
  const at = (h,m=0) => { const d = new Date(day); d.setHours(h,m,0,0); return d.toISOString(); };
  return [
    {id:'demo-1',summary:'하루 계획 & 집중 시간',start:{dateTime:at(9)},end:{dateTime:at(10)},description:'오늘의 가장 중요한 일을 정리하는 시간입니다.'},
    {id:'demo-2',summary:'팀 스탠드업',start:{dateTime:at(10,30)},end:{dateTime:at(11)},description:'Google 캘린더를 연결하면 실제 화상회의 링크가 표시됩니다.'},
    {id:'demo-3',summary:'점심 & 가벼운 산책',start:{dateTime:at(12)},end:{dateTime:at(13)}},
    {id:'demo-4',summary:'프로젝트 리뷰',start:{dateTime:at(14)},end:{dateTime:at(15,30)}}
  ];
}
function writable(){return !connected||['owner','writer'].includes(calendars.find(c=>c.id===calendarId)?.accessRole);}
function itemKind(){return $('item-kind').value;}
function syncForm(){const task=itemKind()==='task',allDay=$('all-day-toggle').checked;$('event-fields').hidden=task;$('task-due-label').hidden=!task;for(const id of ['start','end']){$(id).required=!task;$(id).type=allDay?'date':'datetime-local';} $('repeat-label').hidden=!!selected?.id;$('save').disabled=task?connected&&!extended:!writable();$('edit-note').textContent=task?(connected?'Google 할일에 저장됩니다. 시간은 지원되지 않으며 날짜만 저장합니다.':'샘플 할일입니다. 앱 종료 시 초기화됩니다.'):selected?.recurringEventId?'반복 일정의 이번 회차만 변경·삭제합니다. 전체 반복 수정은 Google 캘린더에서 할 수 있습니다.':connected?(writable()?'Google 캘린더에 저장됩니다.':'읽기 전용 캘린더입니다.'):'샘플 일정입니다. 앱 종료 시 초기화됩니다. 반복 전개는 Google 연결 후 지원합니다.';}
function openDetail(event) {
  bridge?.editing(true);selected=event;
  const task=event.kind==='task',allDay=!!event.start?.date;
  $('item-kind').value=task?'task':'event';$('item-kind-label').hidden=!!event.id;
  $('detail-heading').textContent=event.id?(task?'할일 상세':'일정 상세'):'새 일정 또는 할일';
  $('title').value=task?event.title||'':event.summary||'';$('all-day-toggle').checked=allDay;
  syncForm();
  if(!task){$('start').value=allDay?event.start.date:localInput(event.start.dateTime);if(allDay){const last=new Date(event.end.date+'T12:00:00');last.setDate(last.getDate()-1);$('end').value=dateInput(last);}else $('end').value=localInput(event.end.dateTime);}
  $('task-due').value=task?event.due?.slice(0,10)||'':dateInput(viewDate);
  const minutes=event.reminders?.overrides?.find(r=>r.method==='popup')?.minutes;
  $('reminder').value=minutes==null?'none':String(minutes);
  if(minutes!=null&&![0,5,10,30,60].includes(minutes)){const option=document.createElement('option');option.value=String(minutes);option.textContent=`${minutes}분 전`;$('reminder').append(option);$('reminder').value=String(minutes);}
  $('repeat').value='none';$('location').value=event.location||'';$('description').value=task?event.notes||'':event.description||'';
  const link=task?null:meetingURL(event);$('join').hidden=!link;$('join').href=link||'#';
  $('dialog-error').textContent='';$('delete-item').textContent='삭제';$('delete-item').hidden=!event.id||(!task&&!writable());$('save').textContent=event.id?'변경 저장':'만들기';
  $('detail').showModal();$('title').focus();
}
function createAt(start=new Date()){if(connected&&!writable()){message('읽기 전용 캘린더입니다. 다른 캘린더를 선택해 주세요.');return;}const end=new Date(+start+3600000);openDetail({start:{dateTime:start.toISOString()},end:{dateTime:end.toISOString()}});}
$('new-item').onclick=()=>{const d=new Date(viewDate);d.setHours(new Date().getHours(),Math.ceil(new Date().getMinutes()/15)*15,0,0);createAt(d);};
$('item-kind').onchange=syncForm;
$('all-day-toggle').onchange=()=>{const allDay=$('all-day-toggle').checked;const values=['start','end'].map(id=>$(id).value);syncForm();['start','end'].forEach((id,i)=>{$(id).value=allDay?values[i].slice(0,10):values[i]+'T09:00';});};
function renderTasks(){ const visible=tasks.filter(t=>visibleTask(t,viewDate));$('tasks-list').replaceChildren();$('tasks-message').textContent=taskError||(connected&&!extended?'설정에서 Google 할일 권한을 연결해 주세요.':visible.length?'':'이 날짜의 할일이 없습니다. ＋에서 추가할 수 있어요.');for(const task of visible){const row=document.createElement('div');row.className='task-row'+(task.status==='completed'?' completed':'');const check=document.createElement('input');check.type='checkbox';check.checked=task.status==='completed';check.setAttribute('aria-label',task.title+' 완료');check.onchange=async()=>{check.disabled=true;try{const input={title:task.title,notes:task.notes||'',due:task.due?.slice(0,10)||'',status:check.checked?'completed':'needsAction'};if(connected)await bridge.updateTask(taskListId,task.id,input);else Object.assign(task,taskPayload(input),{completed:check.checked?new Date().toISOString():null});await refresh();}catch(error){check.checked=!check.checked;message(error.message);}finally{check.disabled=false;}};const button=document.createElement('button');button.textContent=task.title;button.onclick=()=>openDetail({...task,kind:'task'});row.append(check,button);$('tasks-list').append(row);}}
function dateLabel(){$('count-label').textContent=dateInput(viewDate)===dateInput()?'오늘의 일정':'선택한 날의 일정';$('view-date').value=dateInput(viewDate);$('date-label').textContent=viewDate.toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long'});document.querySelector('h1').textContent=dateInput(viewDate)===dateInput()?'오늘의 일정':'하루의 일정';}
async function navigate(date){if(loading)return;viewDate=new Date(date);dateLabel();await refresh();}
$('previous-day').onclick=()=>{const d=new Date(viewDate);d.setDate(d.getDate()-1);navigate(d);};$('next-day').onclick=()=>{const d=new Date(viewDate);d.setDate(d.getDate()+1);navigate(d);};$('go-today').onclick=()=>navigate(new Date());$('view-date').onchange=()=>{if($('view-date').value)navigate($('view-date').value+'T12:00:00');};$('view-date').onfocus=()=>bridge?.editing(true);$('view-date').onblur=()=>bridge?.editing(false);
$('calendar-select').onchange=()=>{if(loading){$('calendar-select').value=calendarId;return;}calendarId=$('calendar-select').value;refresh();};$('task-list-select').onchange=()=>{if(loading){$('task-list-select').value=taskListId;return;}taskListId=$('task-list-select').value;refresh();};
function listOptions(){for(const [id,list,key,label,value] of [['calendar-select',calendars,'id','summary',calendarId],['task-list-select',taskLists,'id','title',taskListId]]){$(id).replaceChildren();for(const item of list){const option=document.createElement('option');option.value=item[key];option.textContent=item[label]||item[key];$(id).append(option);}$(id).value=value;}}
async function loadLists(){if(!connected||!extended){listOptions();return;}const errors=[];try{calendars=await bridge.calendars();if(!calendars.some(c=>c.id===calendarId))calendarId=calendars.find(c=>c.primary)?.id||calendars[0]?.id||'primary';}catch(error){errors.push(error.message);}try{taskLists=await bridge.taskLists();if(!taskLists.some(l=>l.id===taskListId))taskListId=taskLists[0]?.id||'@default';}catch(error){errors.push(error.message);}listOptions();if(errors.length)message(errors.join(' '));}
function render() {
  const visibleEvents=widget.showEvents===false?[]:events;$('show-events').setAttribute('aria-pressed',String(widget.showEvents!==false));$('show-tasks').setAttribute('aria-pressed',String(widget.showTasks!==false));$('tasks-section').hidden=widget.showTasks===false;
  const {start,end}=dayRange(viewDate);
  const timed=visibleEvents.filter(e=>e.start?.dateTime && e.end?.dateTime).sort((a,b)=>new Date(a.start.dateTime)-new Date(b.start.dateTime));
  $('count').textContent=visibleEvents.length; $('meetings').textContent=visibleEvents.filter(e=>meetingURL(e)).length;
  $('timeline').replaceChildren(); $('all-day').replaceChildren();
  visibleEvents.filter(e=>e.start?.date).forEach(e=>{const b=document.createElement('button');b.textContent='종일 · '+(e.summary||'(제목 없음)');b.onclick=()=>openDetail(e);$('all-day').append(b);});
  const range=timelineRange(widget.timelineStart??540,widget.timelineEnd??1260);
  const from=bridge?range.startMinutes/60:Math.min(8,...timed.map(e=>Math.max(0,(new Date(e.start.dateTime)-start)/3600000)));
  const to=bridge?range.endMinutes/60:Math.max(19,...timed.map(e=>Math.min(24,(new Date(e.end.dateTime)-start)/3600000)));
  const first=from,last=to,scale=bridge?Math.max(12,Math.max(24,($('timeline').clientHeight||window.innerHeight-220)-14)/(last-first)):100;
  $('timeline').style.height=`${(last-first)*scale+12}px`;
  const ticks=[first];for(let h=Math.floor(first)+1;h<last;h++)ticks.push(h);ticks.push(last);
  for(let i=0;i<ticks.length;i++){const h=ticks[i],row=document.createElement('div');row.className='hour';const height=i===ticks.length-1?12:(ticks[i+1]-h)*scale;row.style.height=`${height}px`;row.style.minHeight=`${height}px`;const s=document.createElement('span');s.textContent=widget.edge&&!widget.expanded?String(Math.floor(h)).padStart(2,'0'):timelineTime(Math.round(h*60));row.append(s);$('timeline').append(row);}

  const group=[]; let groupEnd=-Infinity;
  function flush(){const lanes=[];for(const item of group){let lane=lanes.findIndex(x=>x<=item.s);if(lane<0)lane=lanes.length;lanes[lane]=item.e;item.lane=lane;} const base=widget.edge&&!widget.expanded?0:78,gutter=base+(widget.edge&&!widget.expanded?0:12);for(const item of group){item.b.style.left=`calc(${base}px + (100% - ${gutter}px) * ${item.lane/lanes.length})`;item.b.style.width=`calc((100% - ${gutter}px) / ${lanes.length} - 2px)`;}group.length=0;}
  timed.forEach((e,i)=>{
    const s=Math.max(+start+first*3600000,new Date(e.start.dateTime)),finish=Math.min(+start+last*3600000,new Date(e.end.dateTime));
    if(s>=finish)return;
    if(s>=groupEnd){flush();groupEnd=-Infinity;}
    const b=document.createElement('button');b.className=`event tint-${i%4}`;b.title=`${e.summary||'일정'} · ${time(e.start.dateTime)}`;b.style.top=`${((s-start)/3600000-first)*scale}px`;b.style.height=`${Math.max(5,(finish-s)/3600000*scale-2)}px`;
    const title=document.createElement('strong');title.textContent=e.summary||'(제목 없음)';b.append(title);
    if(finish-s>=25*60000){const label=document.createElement('span');label.className='event-time';label.textContent=`${time(e.start.dateTime)} — ${time(e.end.dateTime)}`;b.append(label);}
    b.onclick=()=>openDetail(e);$('timeline').append(b);group.push({s,e:finish,b});groupEnd=Math.max(groupEnd,finish);
  });flush();
  const hour=(Date.now()-start)/3600000;
  if(hour>=first && hour<last){const line=document.createElement('div');line.className='now';line.setAttribute('aria-label',`현재 ${time(Date.now())}`);line.style.top=`${(hour-first)*scale}px`;const label=document.createElement('span');label.textContent=time(Date.now());line.append(label);$('timeline').append(line);}
  if(bridge){const outside=timed.filter(e=>outsideTimeline(e,start,range));for(const e of outside){const b=document.createElement('button');b.textContent=`${time(e.start.dateTime)} · ${e.summary||'일정'}`;b.onclick=()=>openDetail(e);$('all-day').append(b);}}
  document.querySelector('.demo-note').hidden=connected;$('connect-extended').hidden=!connected||extended;
  document.querySelector('.section-heading h2').firstChild.textContent=dateInput(viewDate)===dateInput()?'오늘의 타임라인 ':'하루의 타임라인 ';
  $('account-status').textContent=connected?'Google 캘린더 연결됨':'샘플 일정을 보고 있어요';
  $('settings-account').textContent=$('account-status').textContent;
  $('connect').hidden=connected;$('disconnect').hidden=!connected;
  const pointer=$('timeline').querySelector('.now');
  bridge?.timePointer(widget.edge&&!widget.expanded&&pointer?pointer.getBoundingClientRect().top+1.5:null);
  renderMenuBar();
  bridge?.schedule(todayEvents);renderTasks();if(widget.showTasks!==false){for(const task of tasks.filter(t=>visibleTask(t,viewDate)&&(t.status==='completed'||t.due?.slice(0,10)===dateInput(viewDate)))){const chip=document.createElement('button');chip.className='task-chip'+(task.status==='completed'?' completed':'');chip.textContent=(task.status==='completed'?'✓ ':'○ ')+task.title;chip.title='할일 · 클릭하여 수정';chip.onclick=()=>openDetail({...task,kind:'task'});$('all-day').append(chip);}}
  $('timeline').onclick=event=>{if(event.target.closest('.event')||widget.edge&&!widget.expanded)return;const rect=$('timeline').getBoundingClientRect();createAt(slotTime(viewDate,event.clientY-rect.top+$('timeline').scrollTop,(last-first)*scale,Math.round(first*60),Math.round(last*60)));};
  $('timeline').onkeydown=event=>{if(event.target===$('timeline')&&event.key==='Enter'){event.preventDefault();const d=new Date(viewDate);d.setHours(first,0,0,0);createAt(d);}};
}
let menuBarRendering=false;
async function renderMenuBar(){if(!bridge||!widget.menuBar||menuBarRendering)return;menuBarRendering=true;try{const {width}=await bridge.menuBarMetrics();const now=new Date(),model=menuBarModel(widget.showEvents===false?[]:todayEvents,now,widget.timelineStart??540,widget.timelineEnd??1260);const tooltip=`Haru · ${model.startLabel}–${model.endLabel}\n${connected?'Google 캘린더':'샘플 일정'} · 오늘 시간 일정 ${model.count}개${model.nextTitle?'\n다음/진행 중: '+model.nextTime+' '+model.nextTitle:''}`;await bridge.menuBarImage(drawMenuBar(model,width,now,window.matchMedia('(prefers-color-scheme: dark)').matches),tooltip);}catch(error){message(error.message);}finally{menuBarRendering=false;}}

for(const [id,key] of [['show-events','showEvents'],['show-tasks','showTasks']]){$(id).onclick=async()=>{const next={...widget,[key]:widget[key]===false};try{if(bridge)await bridge.displayKinds({events:next.showEvents!==false,tasks:next.showTasks!==false});else applyWidget(next);}catch(error){message(error.message);}};}
$('menubar-width').onchange=()=>bridge?.menuBarWidth(Number($('menubar-width').value)).catch(error=>message(error.message));
setInterval(renderMenuBar,15000);
async function refresh(){
  if(loading)return false;loading=true;$('refresh').disabled=true;let warning='';
  try{if(connected){const {start,end}=dayRange(viewDate);events=await bridge.events(start.toISOString(),end.toISOString(),calendarId);if(dateInput(viewDate)===dateInput())todayEvents=events;else {const today=dayRange();todayEvents=await bridge.events(today.start.toISOString(),today.end.toISOString(),calendarId);}if(extended){try{tasks=await bridge.tasks(taskListId);taskError='';}catch(error){tasks=[];taskError=warning=error.message;}}}else {const range=dayRange(viewDate);events=sampleEvents.filter(e=>new Date(e.start.dateTime||e.start.date+'T00:00:00')<range.end&&new Date(e.end.dateTime||e.end.date+'T00:00:00')>range.start);todayEvents=sampleEvents.filter(e=>e.start?.date===dateInput()||e.start?.dateTime&&dateInput(e.start.dateTime)===dateInput());}render();message(warning);return true;}
  catch(error){events=[];todayEvents=[];render();message(error.message);return false;}
  finally{loading=false;$('refresh').disabled=false;}
}
function googleSetup(){if($('settings').open)$('settings').close();if(!bridge){message('Google 연결은 macOS 데스크톱 앱에서 지원합니다.');return;}bridge.editing(true);$('google-progress').textContent='';if(!$('google-setup').open)$('google-setup').showModal();}
for(let minute=0;minute<=1440;minute+=30){for(const id of ['timeline-start','timeline-end']){if(id==='timeline-start'&&minute===1440)continue;const option=document.createElement('option');option.value=String(minute);option.textContent=timelineTime(minute);$(id).append(option);}}
$('timeline-start').value='540';$('timeline-end').value='1260';
async function changeTimeline(start,end){try{timelineRange(start,end);if(bridge)await bridge.timelineRange(start,end);else applyWidget({...widget,timelineStart:start,timelineEnd:end});message('타임라인 시간을 저장했습니다.');}catch(error){message(error.message);}}
$('timeline-apply').onclick=()=>changeTimeline(Number($('timeline-start').value),Number($('timeline-end').value));
$('timeline-reset').onclick=()=>changeTimeline(540,1260);
$('collapsed-titles').onchange=async()=>{const enabled=$('collapsed-titles').checked;try{await bridge?.collapsedTitles(enabled);}catch(error){$('collapsed-titles').checked=!enabled;message(error.message);}};
$('rail-background').onchange=async()=>{const enabled=$('rail-background').checked;try{if(bridge)await bridge.railBackground(enabled);else document.body.classList.toggle('rail-background-off',!enabled);}catch(error){$('rail-background').checked=!enabled;message(error.message);}};
let opacityTimer;
$('transparency').oninput=()=>{const value=Number($('transparency').value);$('transparency-value').textContent=`${value}%`;clearTimeout(opacityTimer);opacityTimer=setTimeout(()=>{if(bridge)bridge.opacity(1-value/100).catch(error=>message(error.message));else document.body.style.opacity=1-value/100;},70);};
$('calendar-open').onclick=async()=>{try{if(bridge)await bridge.openCalendar();else window.open('https://calendar.google.com/calendar/u/0/r','_blank','noopener,noreferrer');}catch(error){message('Google 캘린더를 열지 못했습니다. '+error.message);}};
$('rail-collapse').onclick=()=>bridge?.expand(false);
document.addEventListener('click',event=>{if(bridge&&widget.edge&&!widget.expanded&&!event.target.closest('button,dialog'))bridge.expand(true);});
$('settings-open').onclick=()=>{bridge?.editing(true);$('settings').showModal();};
$('settings-close').onclick=()=>$('settings').close();
$('settings').addEventListener('close',()=>bridge?.editing(false));
$('connect').onclick=googleSetup;
$('connect-extended').onclick=async()=>{bridge?.editing(true);$('connect-extended').disabled=true;try{if(!bridge)throw Error('Google 연결은 macOS 앱에서 지원합니다.');await bridge.connectExtended();connected=true;extended=!!(await bridge.status()).extended;if(!extended)throw Error('캘린더 목록과 Google 할일 권한을 모두 선택해 주세요.');await loadLists();const loaded=await refresh();if(loaded&&!taskError)message('추가 권한을 연결했습니다.');}catch(error){message(error.message);}finally{$('connect-extended').disabled=false;bridge?.editing(false);}};
bridge?.onGoogleSetup(googleSetup);
$('google-close').onclick=()=>$('google-setup').close();
$('google-setup').addEventListener('close',()=>bridge?.editing(false));
$('google-setup').addEventListener('cancel',event=>{if($('google-login').disabled)event.preventDefault();});
$('google-console').onclick=()=>bridge?.openMeeting('https://console.cloud.google.com/apis/credentials');
$('google-login').onclick=async()=>{ $('google-login').disabled=true;$('google-close').disabled=true;$('google-progress').textContent='OAuth JSON을 선택하고 브라우저에서 로그인을 완료해 주세요.';try{await bridge.connect();connected=true;const status=await bridge.status();extended=status.extended;await loadLists();const loaded=await refresh();if(loaded)$('google-setup').close();else $('google-progress').textContent='Google 로그인은 완료됐지만 일정 조회가 실패했습니다. '+$('message').textContent;}catch(error){$('google-progress').textContent=error.message;}finally{$('google-login').disabled=false;$('google-close').disabled=false;}};

$('disconnect').onclick=async()=>{await bridge.disconnect();connected=false;extended=false;taskError='';tasks=[];calendars=[{id:'primary',summary:'기본 캘린더',accessRole:'owner'}];taskLists=[{id:'@default',title:'내 할일'}];calendarId='primary';taskListId='@default';listOptions();events=samples();sampleEvents=events;todayEvents=events;render();message('이 기기의 연결 정보를 삭제했습니다.');};
$('refresh').onclick=refresh;
$('close').onclick=()=>{if(!saving)$('detail').close();};
$('detail').addEventListener('cancel',event=>{if(saving)event.preventDefault();});
$('detail').addEventListener('close',()=>bridge?.editing(false));
$('notify').onclick=async()=>{try{if(bridge){await bridge.notifications();await bridge.schedule(events);message('앱이 실행 중일 때 일정 알림을 표시합니다. macOS 시스템 설정에서 Haru 알림을 허용해 주세요.');}else{message('시스템 알림은 데스크톱 앱에서 사용할 수 있습니다.');}}catch(e){message(e.message);}};
$('join').onclick=e=>{if(bridge){e.preventDefault();bridge.openMeeting($('join').href);}};
$('edit').onsubmit=async event=>{event.preventDefault();if(saving)return;saving=true;$('save').disabled=true;$('delete-item').disabled=true;$('close').disabled=true;try{if(itemKind()==='task'){const input={title:$('title').value,notes:$('description').value,due:$('task-due').value,status:selected?.status||'needsAction'};const patch=taskPayload(input);if(connected){if(!extended)throw Error('설정에서 Google 할일 권한을 먼저 연결해 주세요.');if(selected.id)await bridge.updateTask(taskListId,selected.id,input);else await bridge.createTask(taskListId,input);}else if(selected.id)tasks=tasks.map(t=>t.id===selected.id?{...t,...patch}:t);else tasks.push({id:crypto.randomUUID(),...patch});}else{const input={title:$('title').value,start:$('start').value,end:$('end').value,allDay:$('all-day-toggle').checked,reminder:$('reminder').value,description:$('description').value,location:$('location').value,repeat:selected.id?'none':$('repeat').value};const patch=eventPayload(input);if(connected){if(selected.id)await bridge.update(selected.id,input,calendarId);else await bridge.createEvent(calendarId,input);}else if(selected.id)sampleEvents=sampleEvents.map(e=>e.id===selected.id?{...e,...patch}:e);else sampleEvents.push({id:crypto.randomUUID(),...patch});} $('detail').close();await refresh();}catch(error){$('dialog-error').textContent=error.message;}finally{saving=false;$('delete-item').disabled=false;$('close').disabled=false;syncForm();}};
$('delete-item').onclick=async()=>{if(saving)return;if($('delete-item').textContent==='삭제'){$('delete-item').textContent='삭제 확인';$('dialog-error').textContent='정말 삭제하려면 삭제 확인을 눌러 주세요. 반복 일정은 이번 회차만 삭제합니다.';return;}saving=true;$('save').disabled=$('delete-item').disabled=$('close').disabled=true;try{if(itemKind()==='task'){if(connected)await bridge.deleteTask(taskListId,selected.id);else tasks=tasks.filter(t=>t.id!==selected.id);}else{if(connected)await bridge.deleteEvent(calendarId,selected.id);else sampleEvents=sampleEvents.filter(e=>e.id!==selected.id);} $('detail').close();await refresh();}catch(error){$('dialog-error').textContent=error.message;}finally{saving=false;$('delete-item').disabled=false;$('close').disabled=false;syncForm();}};
if(bridge){
  document.body.classList.add('desktop-app');
  bridge.onWidget(applyWidget);
  const bubble=document.createElement('button');bubble.className='reminder-bubble';bubble.hidden=true;document.body.append(bubble);
  bridge.onReminder(event=>{bubble.textContent=`곧 시작 · ${time(event.start)}\n${event.title}`;bubble.hidden=false;bubble.onclick=()=>{const match=events.find(e=>e.id===event.id);if(match)openDetail(match);};clearTimeout(toastTimer);toastTimer=setTimeout(()=>{bubble.hidden=true;},8000);});
  const panel=document.createElement('div');panel.className='desktop-controls';
  for(const [mode,label] of [['window','일반 창'],['left','왼쪽'],['right','오른쪽'],['top','위쪽'],['menubar','메뉴바 아래'],['statusbar','메뉴바 타임라인']]){const b=document.createElement('button');b.dataset.position=mode;b.textContent=label;b.onclick=()=>{$('settings').close();bridge.position(mode);};panel.append(b);}
  const pin=document.createElement('button');pin.textContent='항상 위: 켜짐';let pinned=true;pin.onclick=()=>{pinned=!pinned;bridge.pin(pinned);pin.textContent=`항상 위: ${pinned?'켜짐':'꺼짐'}`;};panel.append(pin);
  const reserve=document.createElement('button');reserve.id='reserve-space-button';let reserved=false;
  function layoutStatus(state){reserved=state.enabled;reserve.textContent=`화면 공간 확보: ${reserved?'켜짐':'꺼짐'}`;if(state.error)message(state.error);else if(reserved&&!state.trusted)message('시스템 설정 → 개인정보 보호 및 보안 → 손쉬운 사용에서 haru-layout 도우미를 허용해 주세요. 활성 앱의 일반 창 위치·크기만 조정합니다.');}
  reserve.onclick=async()=>{try{layoutStatus(await bridge.reserveSpace(!reserved));}catch(error){message(error.message);}};
  bridge.onLayout(layoutStatus);bridge.status().then(state=>layoutStatus({enabled:state.reserveSpace,trusted:state.layoutTrusted}));panel.append(reserve);$('settings-layout').append(panel);
}
dateLabel();listOptions();
$('timezone').textContent=Intl.DateTimeFormat().resolvedOptions().timeZone;
events=samples();sampleEvents=events;todayEvents=events;render();
if(bridge){window.addEventListener('resize',()=>requestAnimationFrame(render));bridge.status().then(async status=>{applyWidget(status);$('app-version').textContent=`v${status.version}`;$('transparency').value=String(Math.round((1-(status.opacity??1))*100));$('transparency-value').textContent=$('transparency').value+'%';if(status.connected){connected=true;extended=!!status.extended;events=[];render();try{await loadLists();}catch{}await refresh();}}).catch(e=>message(e.message));}
setInterval(()=>refresh(),60000);
