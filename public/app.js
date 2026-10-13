import { dayRange, meetingURL, localInput, eventPatch } from './calendar.js';
const $ = id => document.getElementById(id);
const bridge = window.desktop;
let events = [], selected, connected = false, loading = false;
let widget={edge:false,expanded:false},toastTimer;
function applyWidget(state){widget=state;$('rail-collapse').hidden=!state.edge||!state.expanded;document.body.classList.toggle('collapsed-titles',!!state.collapsedTitles);$('collapsed-titles').checked=!!state.collapsedTitles;$('rail-background').checked=state.railBackground!==false;document.body.classList.toggle('rail-background-off',state.railBackground===false);document.body.classList.toggle('widget-right',state.side==='right');document.body.classList.toggle('edge-widget',!!state.edge);document.body.classList.toggle('widget-collapsed',!!state.edge&&!state.expanded);render();}
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
function openDetail(event) {
  bridge?.editing(true);
  selected = event; const allDay = !!event.start.date;
  $('title').value = event.summary || '(제목 없음)';
  $('start').value = allDay ? '' : localInput(event.start.dateTime);
  $('end').value = allDay ? '' : localInput(event.end.dateTime);
  $('start').disabled = $('end').disabled = allDay;
  const minutes = event.reminders?.overrides?.find(r=>r.method==='popup')?.minutes;
  $('reminder').value = minutes == null ? 'none' : String(minutes);
  if (minutes != null && ![0,5,10,30,60].includes(minutes)) {
    const option = document.createElement('option'); option.value=String(minutes); option.textContent=`${minutes}분 전`; $('reminder').append(option); $('reminder').value=String(minutes);
  }
  $('description').textContent = (event.location ? event.location+'\n\n' : '') + (event.description || '').replace(/<[^>]*>/g,'');
  const link=meetingURL(event); $('join').hidden=!link; $('join').href=link||'#';
  $('dialog-error').textContent=''; $('save').disabled=allDay;
  $('edit-note').textContent=allDay ? '종일 일정 수정은 Google 캘린더에서 지원합니다.' : connected ? '변경사항은 Google 캘린더에 저장됩니다. 기본 캘린더의 일정만 표시합니다.' : '샘플 변경사항은 앱을 닫으면 초기화됩니다.';
  $('detail').showModal();
}
function render() {
  const {start,end}=dayRange();
  const timed=events.filter(e=>e.start?.dateTime && e.end?.dateTime).sort((a,b)=>new Date(a.start.dateTime)-new Date(b.start.dateTime));
  $('count').textContent=events.length; $('meetings').textContent=events.filter(e=>meetingURL(e)).length;
  $('timeline').replaceChildren(); $('all-day').replaceChildren();
  events.filter(e=>e.start?.date).forEach(e=>{const b=document.createElement('button');b.textContent='종일 · '+(e.summary||'(제목 없음)');b.onclick=()=>openDetail(e);$('all-day').append(b);});
  const from=bridge?9:Math.min(8,...timed.map(e=>Math.max(0,(new Date(e.start.dateTime)-start)/3600000)));
  const to=bridge?21:Math.max(19,...timed.map(e=>Math.min(24,(new Date(e.end.dateTime)-start)/3600000)));
  const first=Math.floor(from),last=Math.ceil(to),scale=bridge?Math.max(12,($('timeline').clientHeight||window.innerHeight-220)/(last-first)):100;
  $('timeline').style.height=`${(last-first)*scale+12}px`;
  for(let h=first;h<=last;h++){const row=document.createElement('div');row.className='hour';row.style.height=`${scale}px`;row.style.minHeight=`${scale}px`;const s=document.createElement('span');s.textContent=widget.edge&&!widget.expanded?String(h).padStart(2,'0'):`${String(h).padStart(2,'0')}:00`;row.append(s);$('timeline').append(row);}
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
  if(bridge){const outside=timed.filter(e=>new Date(e.start.dateTime).getHours()<9||new Date(e.end.dateTime).getHours()>=21);for(const e of outside){const b=document.createElement('button');b.textContent=`${time(e.start.dateTime)} · ${e.summary||'일정'}`;b.onclick=()=>openDetail(e);$('all-day').append(b);}}
  document.querySelector('.demo-note').hidden=connected;
  $('account-status').textContent=connected?'기본 캘린더 연결됨':'샘플 일정을 보고 있어요';
  $('settings-account').textContent=$('account-status').textContent;
  $('connect').hidden=connected;$('disconnect').hidden=!connected;
  const pointer=$('timeline').querySelector('.now');
  bridge?.timePointer(widget.edge&&!widget.expanded&&pointer?pointer.getBoundingClientRect().top+1.5:null);
  bridge?.schedule(events);
}
async function refresh(){
  if(loading)return;loading=true;$('refresh').disabled=true;
  try{if(connected){const {start,end}=dayRange();events=await bridge.events(start.toISOString(),end.toISOString());}render();message('');return true;}
  catch(e){message(e.message);return false;}
  finally{loading=false;$('refresh').disabled=false;}
}
function googleSetup(){if($('settings').open)$('settings').close();if(!bridge){message('Google 연결은 macOS 데스크톱 앱에서 지원합니다.');return;}bridge.editing(true);$('google-progress').textContent='';if(!$('google-setup').open)$('google-setup').showModal();}
$('collapsed-titles').onchange=async()=>{const enabled=$('collapsed-titles').checked;try{await bridge?.collapsedTitles(enabled);}catch(error){$('collapsed-titles').checked=!enabled;message(error.message);}};
$('rail-background').onchange=async()=>{const enabled=$('rail-background').checked;try{if(bridge)await bridge.railBackground(enabled);else document.body.classList.toggle('rail-background-off',!enabled);}catch(error){$('rail-background').checked=!enabled;message(error.message);}};
let opacityTimer;
$('transparency').oninput=()=>{const value=Number($('transparency').value);$('transparency-value').textContent=`${value}%`;clearTimeout(opacityTimer);opacityTimer=setTimeout(()=>{if(bridge)bridge.opacity(1-value/100).catch(error=>message(error.message));else document.body.style.opacity=1-value/100;},70);};
$('rail-collapse').onclick=()=>bridge?.expand(false);
document.addEventListener('click',event=>{if(bridge&&widget.edge&&!widget.expanded&&!event.target.closest('button,dialog'))bridge.expand(true);});
$('settings-open').onclick=()=>{bridge?.editing(true);$('settings').showModal();};
$('settings-close').onclick=()=>$('settings').close();
$('settings').addEventListener('close',()=>bridge?.editing(false));
$('connect').onclick=googleSetup;
bridge?.onGoogleSetup(googleSetup);
$('google-close').onclick=()=>$('google-setup').close();
$('google-setup').addEventListener('close',()=>bridge?.editing(false));
$('google-setup').addEventListener('cancel',event=>{if($('google-login').disabled)event.preventDefault();});
$('google-console').onclick=()=>bridge?.openMeeting('https://console.cloud.google.com/apis/credentials');
$('google-login').onclick=async()=>{ $('google-login').disabled=true;$('google-close').disabled=true;$('google-progress').textContent='OAuth JSON을 선택하고 브라우저에서 로그인을 완료해 주세요.';try{await bridge.connect();connected=true;const loaded=await refresh();if(loaded)$('google-setup').close();else $('google-progress').textContent='Google 로그인은 완료됐지만 일정 조회가 실패했습니다. '+$('message').textContent;}catch(error){$('google-progress').textContent=error.message;}finally{$('google-login').disabled=false;$('google-close').disabled=false;}};

$('disconnect').onclick=async()=>{await bridge.disconnect();connected=false;events=samples();render();message('이 기기의 연결 정보를 삭제했습니다.');};
$('refresh').onclick=refresh;
$('close').onclick=()=>$('detail').close();
$('detail').addEventListener('close',()=>bridge?.editing(false));
$('notify').onclick=async()=>{try{if(bridge){await bridge.notifications();await bridge.schedule(events);message('앱이 실행 중일 때 일정 알림을 표시합니다. macOS 시스템 설정에서 Haru 알림을 허용해 주세요.');}else{message('시스템 알림은 데스크톱 앱에서 사용할 수 있습니다.');}}catch(e){message(e.message);}};
$('join').onclick=e=>{if(bridge){e.preventDefault();bridge.openMeeting($('join').href);}};
$('edit').onsubmit=async e=>{e.preventDefault();$('save').disabled=true;try{const patch=eventPatch($('title').value,$('start').value,$('end').value,$('reminder').value);if(connected){await bridge.update(selected.id,patch);}else{events=events.map(x=>x.id===selected.id?{...x,...patch}:x);} $('detail').close();await refresh();}catch(error){$('dialog-error').textContent=error.message;}finally{$('save').disabled=false;}};
if(bridge){
  document.body.classList.add('desktop-app');
  bridge.onWidget(applyWidget);
  const bubble=document.createElement('button');bubble.className='reminder-bubble';bubble.hidden=true;document.body.append(bubble);
  bridge.onReminder(event=>{bubble.textContent=`곧 시작 · ${time(event.start)}\n${event.title}`;bubble.hidden=false;bubble.onclick=()=>{const match=events.find(e=>e.id===event.id);if(match)openDetail(match);};clearTimeout(toastTimer);toastTimer=setTimeout(()=>{bubble.hidden=true;},8000);});
  const panel=document.createElement('div');panel.className='desktop-controls';
  for(const [mode,label] of [['window','일반 창'],['left','왼쪽'],['right','오른쪽'],['top','위쪽'],['menubar','메뉴바']]){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{$('settings').close();bridge.position(mode);};panel.append(b);} 
  const pin=document.createElement('button');pin.textContent='항상 위: 켜짐';let pinned=true;pin.onclick=()=>{pinned=!pinned;bridge.pin(pinned);pin.textContent=`항상 위: ${pinned?'켜짐':'꺼짐'}`;};panel.append(pin);
  const reserve=document.createElement('button');let reserved=false;
  function layoutStatus(state){reserved=state.enabled;reserve.textContent=`화면 공간 확보: ${reserved?'켜짐':'꺼짐'}`;if(state.error)message(state.error);else if(reserved&&!state.trusted)message('시스템 설정 → 개인정보 보호 및 보안 → 손쉬운 사용에서 haru-layout 도우미를 허용해 주세요. 활성 앱의 일반 창 위치·크기만 조정합니다.');}
  reserve.onclick=async()=>{try{layoutStatus(await bridge.reserveSpace(!reserved));}catch(error){message(error.message);}};
  bridge.onLayout(layoutStatus);bridge.status().then(state=>layoutStatus({enabled:state.reserveSpace,trusted:state.layoutTrusted}));panel.append(reserve);$('settings-layout').append(panel);
}
$('date-label').textContent=new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long'});
$('timezone').textContent=Intl.DateTimeFormat().resolvedOptions().timeZone;
events=samples();render();
if(bridge){window.addEventListener('resize',()=>requestAnimationFrame(render));bridge.status().then(async status=>{applyWidget(status);$('transparency').value=String(Math.round((1-(status.opacity??1))*100));$('transparency-value').textContent=$('transparency').value+'%';if(status.connected){connected=true;await refresh();}}).catch(e=>message(e.message));}
setInterval(()=>refresh(),60000);
