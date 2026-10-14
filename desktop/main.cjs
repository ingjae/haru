const {app,BrowserWindow,Tray,Menu,screen,ipcMain,shell,Notification,safeStorage,nativeImage,dialog,nativeTheme}=require('electron');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {desktopCredential,authError}=require('./google-auth.cjs');
const {parseMouseDown,shouldDismiss,menuBarPanelBounds}=require('./widget-dismissal.cjs');
const {createReminderScheduler,reminderBounds}=require('./reminder-scheduler.cjs');
const {createTaskScheduling}=require('./task-scheduling.cjs');
const {createGoogleService}=require('./google-service.cjs');
const {WIDTHS,menuBarWidth}=require('./menubar-layout.cjs');
const RAIL_WIDTH=24;
const positionModes=process.platform==='darwin'?['window','left','right','top','menubar','statusbar']:['window','left','right','top'];
const demoMode=process.argv.includes('--demo');
if(demoMode&&process.argv.includes('--dark'))nativeTheme.themeSource='dark';
if(demoMode)app.setPath('userData',path.join(app.getPath('temp'),'haru-product-demo'));

let layoutHelper=null,layoutTrusted=false;
function sendLayout(){
  if(!layoutHelper?.stdin.writable||!win)return;
  const a=screen.getDisplayMatching(win.getBounds()).workArea;
  layoutHelper.stdin.write(JSON.stringify({enabled:!!preferences.reserveSpace,edge:mode,...a,rail:RAIL_WIDTH})+'\n');
}
function startLayout(prompt=false){
  if(process.platform!=='darwin')return;
  if(layoutHelper){if(prompt&&!layoutTrusted)shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');sendLayout();return;}
  const binary=app.isPackaged?path.join(process.resourcesPath,'haru-layout'):path.join(__dirname,'bin/haru-layout');
  layoutHelper=spawn(binary,prompt?['--prompt']:[],{stdio:['pipe','pipe','pipe']});
  layoutHelper.stdout.setEncoding('utf8');
  let output='';layoutHelper.stdout.on('data',data=>{output+=data;let end;while((end=output.indexOf('\n'))>=0){const line=output.slice(0,end).trim();output=output.slice(end+1);if(line.startsWith('mouse-down ')){const point=parseMouseDown(line);if(win&&shouldDismiss(point,win.getBounds(),{expanded:expanded||(mode==='statusbar'&&win.isVisible()),editing,openedAt:lastOpenAt})){manualExpanded=false;if(mode==='statusbar')win.hide();else setExpansion(false);if(process.env.HARU_DEBUG_WIDGET==='1')console.info('outside-click collapsed');}}else if(line==='trusted'||line==='permission-required'){layoutTrusted=line==='trusted';win?.webContents.send('layout-status',{enabled:!!preferences.reserveSpace,trusted:layoutTrusted});}}});
  layoutHelper.on('error',()=>{layoutHelper=null;win?.webContents.send('layout-status',{enabled:false,trusted:false,error:'창 배치 도우미를 빌드한 뒤 다시 실행해 주세요.'});});
  layoutHelper.on('exit',()=>{layoutHelper=null;layoutTrusted=false;});
  layoutHelper.stdin.on('error',()=>{});
  sendLayout();
}
let trayDefault,marker,win,tray,origin,server,token=null,mode='window',loginPending=false,bubbleWindow,bubbleTimer,activeReminder,scheduledEvents=[];
let preferences={mode:'left',pinned:true,notifications:false,reminderBubble:true,reminderAnimation:'pop',reserveSpace:false,opacity:1,railBackground:true,showEvents:true,showTasks:true,collapsedTitles:demoMode,timelineStart:540,timelineEnd:1260,menuBarWidth:180};
let calendarView='day';
let expanded=false,expansionTimer,editing=false,manualExpanded=false,lastOpenAt=0,menuBarAnchor=null;
function secureStorage(){return safeStorage.isEncryptionAvailable()&&(process.platform!=='linux'||safeStorage.getSelectedStorageBackend()!=='basic_text');}
function activateForInteraction(){win.setFocusable(true);win.show();win.focus();}
function resolvedMenuBarWidth(){
  const b=tray?.getBounds(),d=b&&b.width>0?screen.getDisplayMatching(b):screen.getDisplayMatching(win.getBounds()),area=d.bounds;
  const stable=b&&b.width>0&&b.x>=area.x&&b.x+b.width<=area.x+area.width&&b.y>=area.y&&b.y<area.y+area.height;
  if(stable)menuBarAnchor={displayId:d.id,right:b.x+b.width};
  const effective=stable?b:menuBarAnchor?.displayId===d.id?{x:menuBarAnchor.right-1,width:1}:null;
  return menuBarWidth(preferences.menuBarWidth,d,effective);
}
function widgetState(){return {sourceGroups:preferences.sourceGroups,calendarView,edge:['left','right'].includes(mode),expanded,side:mode,notifications:!!preferences.notifications,reminderBubble:preferences.reminderBubble!==false,reminderAnimation:preferences.reminderAnimation,platform:process.platform,showEvents:preferences.showEvents!==false,showTasks:preferences.showTasks!==false,railBackground:!!preferences.railBackground,collapsedTitles:!!preferences.collapsedTitles,timelineStart:preferences.timelineStart,timelineEnd:preferences.timelineEnd,menuBar:mode==='statusbar',menuBarWidth:preferences.menuBarWidth,menuBarWidthPixels:resolvedMenuBarWidth()};}
function windowMaterial(){if(process.platform==='darwin')win.setVibrancy(['left','right'].includes(mode)&&!expanded?null:'popover');}
function setExpansion(value,force=false){
  if(!['left','right'].includes(mode)||(expanded===value&&!force))return;expanded=value;if(!value)calendarView='day';marker?.hide();windowMaterial();
  const area=screen.getDisplayMatching(win.getBounds()).workArea,width=Math.min(value?(calendarView==='day'?420:1180):RAIL_WIDTH,area.width);
  win.setBounds({x:mode==='left'?area.x:area.x+area.width-width,y:area.y,width,height:area.height});
  win.webContents.send('widget-state',widgetState());
  if(process.platform==='linux'&&value&&manualExpanded)activateForInteraction();
}
const preferencesPath=()=>path.join(app.getPath('userData'),'preferences.json');
let preferenceWrites=Promise.resolve();
function savePreferences(){const data=JSON.stringify(preferences);preferenceWrites=preferenceWrites.catch(()=>{}).then(async()=>{const file=preferencesPath(),temporary=file+'.tmp';await fs.writeFile(temporary,data,{mode:0o600});await fs.rename(temporary,file);});return preferenceWrites;}
const tokenPath=()=>path.join(app.getPath('userData'),'google-session.enc');
function external(url){const u=new URL(url);if(u.protocol!=='https:')throw Error('HTTPS 링크만 열 수 있습니다.');return shell.openExternal(u.href);}
async function persist(){if(!secureStorage())throw Error('시스템 암호화 저장소를 사용할 수 없습니다. Linux에서는 GNOME Keyring을 설치하고 잠금을 해제해 주세요.');await fs.writeFile(tokenPath(),safeStorage.encryptString(JSON.stringify(token)),{mode:0o600});}
async function credential(){
  let file=process.env.GOOGLE_OAUTH_CREDENTIALS;
  if(!file){const result=await dialog.showOpenDialog(win,{title:'Google Desktop OAuth 클라이언트 JSON 선택',properties:['openFile'],filters:[{name:'JSON',extensions:['json']}]});if(result.canceled)throw Error('Google 연결이 취소되었습니다.');file=result.filePaths[0];}
  let data;try{data=JSON.parse(await fs.readFile(file,'utf8'));}catch{throw Error('선택한 파일을 OAuth JSON으로 읽을 수 없습니다. Google Cloud에서 다운로드한 JSON을 선택해 주세요.');}
  return desktopCredential(data);
}
async function exchange(params){
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params),signal:AbortSignal.timeout(20000)});
  const data=await r.json();if(!r.ok)throw Error(authError(data.error));return data;
}
async function connect(extra=false){
  if(demoMode)throw Error('데모 모드입니다. 실제 Google 연결은 일반 실행에서 사용할 수 있습니다.');
  if(!secureStorage())throw Error('Google 연결에는 잠금 해제된 시스템 키링이 필요합니다. Linux에서는 GNOME Keyring을 확인해 주세요.');
  if(loginPending)throw Error('이미 Google 로그인이 진행 중입니다.');loginPending=true;
  try{
    const credentials=token?{client_id:token.client_id,client_secret:token.client_secret}:await credential();const state=crypto.randomBytes(32).toString('hex'),verifier=crypto.randomBytes(32).toString('base64url');
    const code=await new Promise((resolve,reject)=>{
      let timeout;const callback=http.createServer((req,res)=>{
        const u=new URL(req.url,'http://127.0.0.1');if(u.pathname!=='/callback'){res.writeHead(404);res.end();return;}
        if(u.searchParams.get('state')!==state){res.writeHead(400);res.end('Invalid state');return;}
        res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><script>history.replaceState(null,"","/connected")</script><p>'+ (u.searchParams.get('error')?'Google 인증이 취소되거나 거부되었습니다. Haru로 돌아가 설정을 확인해 주세요.':'Google 응답을 받았습니다. Haru에서 연결 결과를 확인해 주세요.')+'</p>');clearTimeout(timeout);callback.close();
        if(u.searchParams.get('error')||!u.searchParams.get('code'))reject(Error(authError(u.searchParams.get('error'))));else resolve({code:u.searchParams.get('code'),redirect_uri:`http://127.0.0.1:${callback.address()?.port || port}/callback`});
      });let port;
      callback.listen(0,'127.0.0.1',()=>{port=callback.address().port;const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');u.search=new URLSearchParams({client_id:credentials.client_id,redirect_uri:`http://127.0.0.1:${port}/callback`,response_type:'code',scope:['https://www.googleapis.com/auth/calendar.events',...(extra||token?.extended?['https://www.googleapis.com/auth/calendar.calendarlist.readonly','https://www.googleapis.com/auth/tasks']:[])].join(' '),access_type:'offline',prompt:'consent',state,code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();shell.openExternal(u.href).catch(error=>{clearTimeout(timeout);callback.close();reject(error);});});
      timeout=setTimeout(()=>{callback.close();reject(Error('로그인 시간이 초과되었습니다. 다시 연결해 주세요.'));},180000);callback.on('error',reject);
    });
    const result=await exchange({...credentials,...code,code_verifier:verifier,grant_type:'authorization_code'});
    token={...credentials,...result,extended:typeof result.scope==='string'&&['https://www.googleapis.com/auth/calendar.calendarlist.readonly','https://www.googleapis.com/auth/tasks'].every(scope=>result.scope.split(' ').includes(scope)),expires_at:Date.now()+result.expires_in*1000};await persist();return true;
  }finally{loginPending=false;}
}
async function access(){
  if(!token)throw Error('Google 캘린더를 먼저 연결해 주세요.');
  if(Date.now()>token.expires_at-60000){if(!token.refresh_token)throw Error('인증이 만료되었습니다. 다시 연결해 주세요.');const result=await exchange({client_id:token.client_id,client_secret:token.client_secret,refresh_token:token.refresh_token,grant_type:'refresh_token'});token={...token,...result,expires_at:Date.now()+result.expires_in*1000};await persist();}
  return token.access_token;
}
const google=createGoogleService(access),taskScheduling=createTaskScheduling(google);
function position(next){
  if(!positionModes.includes(next))return;marker?.hide();manualExpanded=false;mode=next;preferences.mode=next;savePreferences().catch(()=>{});
  const area=screen.getDisplayMatching(win.getBounds()).workArea;
  expanded=false;calendarView='day';const width=Math.min(['left','right'].includes(next)?RAIL_WIDTH:420,area.width),height=Math.min(660,area.height);
  const bounds=next==='left'?{x:area.x,y:area.y,width,height:area.height}:next==='right'?{x:area.x+area.width-width,y:area.y,width,height:area.height}:next==='top'?{x:area.x,y:area.y,width:area.width,height:Math.min(360,area.height)}:['menubar','statusbar'].includes(next)?{x:area.x+area.width-width,y:area.y,width,height}:{x:area.x+Math.round((area.width-Math.min(1100,area.width))/2),y:area.y+40,width:Math.min(1100,area.width),height:Math.min(800,area.height-40)};
  windowMaterial();win.setBounds(bounds);if(next==='statusbar')win.hide();else win.showInactive();
  if(tray){tray.setImage(trayDefault);tray.setTitle(next==='statusbar'?'Haru':'');tray.setToolTip('Haru · 오늘의 일정');}
  win.webContents.send('widget-state',widgetState());sendLayout();
}
function popover(){
  if(mode==='statusbar'){lastOpenAt=Date.now();if(win.isVisible()&&!editing){win.hide();return;}const b=tray.getBounds(),area=screen.getDisplayMatching(b).workArea;win.setBounds(menuBarPanelBounds(b,area));win.showInactive();return;}
  if(mode!=='menubar'){lastOpenAt=Date.now();manualExpanded=true;setExpansion(true);win.showInactive();return;}
  const area=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea,b=tray.getBounds();
  win.setBounds({x:Math.max(area.x,Math.min(b.x-190,area.x+area.width-420)),y:area.y,width:Math.min(420,area.width),height:Math.min(660,area.height)});win.showInactive();
}
const reminders=createReminderScheduler({notify:event=>showReminder(event)});
function schedule(events){scheduledEvents=Array.isArray(events)?events:[];reminders.update(scheduledEvents,!!preferences.notifications&&(!!token||demoMode));}
async function showBubble(event){
  if(!bubbleWindow||bubbleWindow.isDestroyed())return;activeReminder=event;clearTimeout(bubbleTimer);
  const area=screen.getDisplayMatching(win.getBounds()).workArea,date=new Date(event.start);
  bubbleWindow.setBounds(reminderBounds(win.getBounds(),area,mode,date.getHours()*60+date.getMinutes(),{start:preferences.timelineStart,end:preferences.timelineEnd}));
  bubbleWindow.webContents.send('reminder-show',{...event,side:mode,animation:preferences.reminderAnimation});bubbleWindow.showInactive();
  bubbleTimer=setTimeout(()=>bubbleWindow.hide(),event.preview?20000:8000);
}
function openReminder(){const reminder=activeReminder;clearTimeout(bubbleTimer);bubbleWindow?.hide();if(!reminder||reminder.preview)return;lastOpenAt=Date.now();manualExpanded=true;setExpansion(true);activateForInteraction();win.webContents.send('reminder-open-event',reminder);}
function showReminder(event){if(!preferences.notifications)return;if(preferences.reminderBubble!==false)showBubble(event);if(Notification.isSupported()&&!demoMode){try{const notification=new Notification({title:event.title,body:event.minutes===0?'일정이 지금 시작됩니다.':`${event.minutes}분 뒤 일정이 시작됩니다.`,silent:false});notification.on('click',()=>{activeReminder=event;openReminder();});notification.show();}catch{win.webContents.send('notification-error','시스템 알림을 표시하지 못했습니다. OS의 Haru 알림 설정을 확인해 주세요.');}}}
if(!app.requestSingleInstanceLock()){app.quit();}else app.whenReady().then(async()=>{
  try{preferences={...preferences,...JSON.parse(await fs.readFile(preferencesPath(),'utf8'))};}catch{}
  if(!positionModes.includes(preferences.mode))preferences.mode='left';
  if(process.platform!=='darwin')preferences.reserveSpace=false;
  if(!WIDTHS.includes(preferences.menuBarWidth))preferences.menuBarWidth=180;
  if(process.argv.includes('--max-menubar')){preferences.menuBarWidth=0;preferences.mode='statusbar';await savePreferences();}
  const {timelineRange}=await import('../public/calendar.js');
  try{timelineRange(preferences.timelineStart,preferences.timelineEnd);}catch{preferences.timelineStart=540;preferences.timelineEnd=1260;}
  if(process.argv.includes('--reserve-space')){preferences.reserveSpace=true;await savePreferences();}
  if(process.platform==='darwin')app.dock.setIcon(nativeImage.createFromPath(path.join(__dirname,'assets/haru.png')));
  if(!['none','slide','pop'].includes(preferences.reminderAnimation))preferences.reminderAnimation='pop';
  try{if(!demoMode&&secureStorage())token=JSON.parse(safeStorage.decryptString(await fs.readFile(tokenPath())));}catch{}
  server=http.createServer(async(req,res)=>{const files={'/fonts/NotoSansKR.ttf':'fonts/NotoSansKR.ttf','/menubar.js':'menubar.js','/source-groups.js':'source-groups.js','/':'index.html','/app.js':'app.js','/calendar.js':'calendar.js','/style.css':'style.css'};const file=files[req.url];if(!file){res.writeHead(404);res.end();return;}try{const body=await fs.readFile(path.join(__dirname,'../public',file));res.setHeader('Content-Type',file.endsWith('.ttf')?'font/ttf':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'");res.end(body);}catch{res.writeHead(500);res.end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
  win=new BrowserWindow({width:RAIL_WIDTH,height:800,minWidth:RAIL_WIDTH,minHeight:280,show:false,focusable:false,acceptFirstMouse:true,type:process.platform==='darwin'?'panel':undefined,frame:false,hasShadow:false,roundedCorners:false,skipTaskbar:true,title:'Haru · 오늘의 타임라인',transparent:true,backgroundColor:'#00000000',alwaysOnTop:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  marker=new BrowserWindow({width:20,height:26,show:false,focusable:false,type:process.platform==='darwin'?'panel':undefined,frame:false,transparent:true,backgroundColor:'#00000000',hasShadow:false,roundedCorners:false,skipTaskbar:true,resizable:false,alwaysOnTop:true,title:'Haru · 현재 시간 표시',webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
  marker.setIgnoreMouseEvents(true);
  if(process.platform==='darwin')marker.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
  await marker.loadFile(path.join(__dirname,'time-pointer.html'));
  if(process.platform==='darwin')win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
  win.webContents.setWindowOpenHandler(({url})=>{external(url).catch(()=>{});return{action:'deny'};});win.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==origin)event.preventDefault();});
  if(process.platform==='linux')win.on('blur',()=>{if(!editing&&expanded){manualExpanded=false;setExpansion(false);win.setFocusable(false);}});
  win.on('close',event=>{if(!app.quitting){event.preventDefault();win.showInactive();}});
  bubbleWindow=new BrowserWindow({width:304,height:116,show:false,focusable:false,acceptFirstMouse:true,type:process.platform==='darwin'?'panel':undefined,frame:false,transparent:true,hasShadow:false,skipTaskbar:true,resizable:false,alwaysOnTop:true,title:'Haru 알림',webPreferences:{preload:path.join(__dirname,'reminder-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  if(process.platform==='darwin')bubbleWindow.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
  await bubbleWindow.loadFile(path.join(__dirname,'reminder.html'));
  ipcMain.handle('reminder-open',event=>{if(event.sender!==bubbleWindow.webContents)throw Error('Unauthorized');openReminder();});
  ipcMain.handle('reminder-close',event=>{if(event.sender!==bubbleWindow.webContents)throw Error('Unauthorized');clearTimeout(bubbleTimer);bubbleWindow.hide();});
  const icon=trayDefault=nativeImage.createFromPath(path.join(__dirname,'assets/haru.png')).resize({width:20,height:20});
  tray=new Tray(icon);tray.setTitle('');tray.setToolTip('Haru · 오늘의 일정');tray.on('click',popover);
  const menu=Menu.buildFromTemplate([...positionModes.map((p,i)=>({label:['일반 창','왼쪽에 붙이기','오른쪽에 붙이기','위쪽에 붙이기','메뉴바 아래 패널','시스템 메뉴바 타임라인'][i],click:()=>position(p)})),{type:'separator'},{label:'Google 캘린더 열기',click:()=>external('https://calendar.google.com/calendar/u/0/r').catch(()=>{})},{label:'Google 캘린더 연결…',click:()=>{setExpansion(true);activateForInteraction();win.webContents.send('google-setup');}},{label:'종료',click:()=>app.quit()}]);tray.on('right-click',()=>tray.popUpContextMenu(menu));
  function handle(name,fn){ipcMain.handle(name,(event,...args)=>{if(event.sender!==win.webContents || new URL(event.senderFrame.url).origin!==origin)throw Error('Unauthorized');return fn(...args);});}
  handle('collapsed-titles',async value=>{if(typeof value!=='boolean')throw Error('제목 표시 설정을 확인해 주세요.');preferences.collapsedTitles=value;await savePreferences();win.webContents.send('widget-state',widgetState());return value;});
  handle('menubar-metrics',()=>({width:resolvedMenuBarWidth()}));
  handle('menubar-width',async value=>{if(!WIDTHS.includes(value))throw Error('메뉴바 폭을 확인해 주세요.');preferences.menuBarWidth=value;await savePreferences();win.webContents.send('widget-state',widgetState());});
  handle('menubar-image',(dataURL,tooltip)=>{if(mode!=='statusbar')return;if(typeof dataURL!=='string'||!dataURL.startsWith('data:image/png;base64,')||dataURL.length>100000)throw Error('잘못된 메뉴바 이미지입니다.');const icon=nativeImage.createEmpty();icon.addRepresentation({scaleFactor:2,dataURL});const size=icon.getSize();if(icon.isEmpty()||!Number.isInteger(size.width)||size.width<120||size.width>2000||size.height!==22)throw Error('잘못된 메뉴바 이미지 크기입니다.');tray.setImage(icon);tray.setTitle('');tray.setToolTip(typeof tooltip==='string'?tooltip.slice(0,1000):'Haru');if(process.env.HARU_DEBUG_WIDGET==='1'){fs.writeFile(path.join(app.getPath('temp'),'haru-menubar-preview.png'),icon.toPNG({scaleFactor:2})).catch(()=>{});console.info('menubar',JSON.stringify({image:size,bounds:tray.getBounds(),visiblePanel:win.isVisible()}));}});
  handle('time-pointer',y=>{if(expanded||!['left','right'].includes(mode)||typeof y!=='number'||!Number.isFinite(y)){marker.hide();return;}const b=win.getBounds(),area=screen.getDisplayMatching(b).bounds;if(y<0||y>b.height){marker.hide();return;}marker.setBounds({x:Math.max(area.x,b.x-20),y:Math.round(b.y+y-13),width:20,height:26});marker.showInactive();if(process.env.HARU_DEBUG_WIDGET==='1')console.info('time-pointer',JSON.stringify({rail:b,pointer:marker.getBounds(),visible:marker.isVisible(),focusable:marker.isFocusable(),focused:marker.isFocused(),reservedWidth:RAIL_WIDTH}));});
  handle('status',()=>({version:app.getVersion(),platform:process.platform,connected:!!token,extended:!!token?.extended,...widgetState(),pinned:!!preferences.pinned,reserveSpace:!!preferences.reserveSpace,layoutTrusted,opacity:preferences.opacity}));handle('connect',()=>connect());handle('connect-extended',()=>connect(true));
  handle('disconnect',async()=>{token=null;reminders.clear();scheduledEvents=[];bubbleWindow?.hide();await fs.rm(tokenPath(),{force:true});});
  handle('calendars',()=>google.calendars());
  handle('events',async(start,end,calendarId='primary')=>{if(!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||Date.parse(end)<=Date.parse(start))throw Error('잘못된 날짜입니다.');return google.events(calendarId,start,end);});
  async function safeEvent(input){const {eventPayload}=await import('../public/calendar.js');return eventPayload(input);}
  handle('create-event',async(calendarId,input)=>google.create(calendarId,await safeEvent(input)));
  handle('update',async(id,input,calendarId='primary')=>google.update(calendarId,id,await safeEvent(input)));
  handle('delete-event',(calendarId,id)=>google.remove(calendarId,id));
  handle('task-lists',()=>google.taskLists());handle('tasks',list=>taskScheduling.list(list));
  handle('create-task',(list,input)=>taskScheduling.create(list,input));
  handle('update-task',(list,id,input)=>taskScheduling.update(list,id,input));
  handle('delete-task',(list,id,calendarId)=>taskScheduling.remove(list,id,calendarId));
  handle('reserve-space',async value=>{preferences.reserveSpace=!!value;await savePreferences();if(value)startLayout(true);else sendLayout();return{enabled:!!preferences.reserveSpace,trusted:layoutTrusted};});
  handle('timeline-range',async(start,end)=>{const {timelineRange}=await import('../public/calendar.js');const range=timelineRange(start,end);preferences.timelineStart=range.startMinutes;preferences.timelineEnd=range.endMinutes;await savePreferences();win.webContents.send('widget-state',widgetState());return range;});
  handle('source-groups',async value=>{if(!value||!['calendars','taskLists'].every(key=>Array.isArray(value[key])&&value[key].length<=250&&value[key].every(id=>typeof id==='string'&&id.length>0&&id.length<=1024)))throw Error('그룹 선택을 확인해 주세요.');const previous=preferences.sourceGroups;preferences.sourceGroups={calendars:[...new Set(value.calendars)],taskLists:[...new Set(value.taskLists)]};try{await savePreferences();}catch(error){preferences.sourceGroups=previous;throw error;}win.webContents.send('widget-state',widgetState());return preferences.sourceGroups;});
  handle('display-kinds',async value=>{if(typeof value?.events!=='boolean'||typeof value?.tasks!=='boolean')throw Error('표시 설정을 확인해 주세요.');preferences.showEvents=value.events;preferences.showTasks=value.tasks;await savePreferences();win.webContents.send('widget-state',widgetState());});
  handle('rail-background',async value=>{if(typeof value!=='boolean')throw Error('배경 설정을 확인해 주세요.');preferences.railBackground=value;await savePreferences();win.webContents.send('widget-state',widgetState());return value;});
  handle('opacity',async value=>{if(typeof value!=='number'||!Number.isFinite(value)||value<0.35||value>1)throw Error('투명도 범위를 확인해 주세요.');win.setOpacity(value);marker.setOpacity(value);preferences.opacity=value;await savePreferences();return value;});
  handle('position',position);handle('pin',value=>{win.setAlwaysOnTop(!!value);marker.setAlwaysOnTop(!!value);preferences.pinned=!!value;return savePreferences();});handle('open-calendar',()=>external('https://calendar.google.com/calendar/u/0/r'));handle('open-meeting',external);handle('schedule',schedule);
  handle('calendar-view',value=>{if(!['day','week','month'].includes(value))throw Error('Invalid calendar view');calendarView=value;manualExpanded=true;lastOpenAt=Date.now();if(['left','right'].includes(mode))setExpansion(true,true);else {const area=screen.getDisplayMatching(win.getBounds()).workArea,width=Math.min(value==='day'?420:1180,area.width),height=Math.min(value==='day'?660:850,area.height);const b=win.getBounds();win.setBounds({x:Math.max(area.x,Math.min(b.x,area.x+area.width-width)),y:Math.max(area.y,Math.min(b.y,area.y+area.height-height)),width,height});win.webContents.send('widget-state',widgetState());}return widgetState();});
  handle('expand',value=>{if(value)lastOpenAt=Date.now();if(mode==='statusbar'&&!value){win.hide();return;}manualExpanded=!!value;setExpansion(manualExpanded||editing);});
  handle('editing',value=>{editing=!!value;if(editing){setExpansion(true);activateForInteraction();}else{win.blur();win.setFocusable(false);}});
  handle('notifications',async value=>{if(typeof value!=='boolean')throw Error('알림 설정을 확인해 주세요.');const previous=preferences.notifications;preferences.notifications=value;try{await savePreferences();}catch(error){preferences.notifications=previous;throw error;}schedule(scheduledEvents);if(!value){clearTimeout(bubbleTimer);bubbleWindow.hide();}win.webContents.send('widget-state',widgetState());return value;});
  handle('reminder-options',async value=>{if(typeof value?.bubble!=='boolean'||!['none','slide','pop'].includes(value.animation))throw Error('알림 표시 설정을 확인해 주세요.');preferences.reminderBubble=value.bubble;preferences.reminderAnimation=value.animation;await savePreferences();if(!value.bubble)bubbleWindow.hide();win.webContents.send('widget-state',widgetState());});
  handle('reminder-preview',()=>{manualExpanded=false;editing=false;setExpansion(false);return showBubble({id:'preview',title:'잠깐 쉬어갈 시간이에요',start:new Date().toISOString(),minutes:0,preview:true});});
  await win.loadURL(origin);
  preferences.opacity=typeof preferences.opacity==='number'&&Number.isFinite(preferences.opacity)?Math.max(.35,Math.min(1,preferences.opacity)):1;
  marker.setOpacity(preferences.opacity);marker.setAlwaysOnTop(!!preferences.pinned);win.setOpacity(preferences.opacity);win.setAlwaysOnTop(!!preferences.pinned);position(preferences.mode);
  startLayout(process.argv.includes('--reserve-space'));
  if(demoMode&&process.argv.includes('--smoke-test')){editing=true;setExpansion(true);try{await require('./linux-smoke.cjs').run(win);app.quit();}catch(error){console.error(error.message);app.exit(1);}return;}
  if(process.argv.includes('--show-panel'))setTimeout(()=>{if(demoMode)editing=true;if(mode==='statusbar')popover();else{manualExpanded=true;setExpansion(true);}},500);
  if(process.argv.includes('--google-setup'))win.webContents.send('google-setup');
  screen.on('display-metrics-changed',()=>{position(mode);sendLayout();});
  // Only explicit clicks, editors and timed reminders may expand the rail.
  expansionTimer=setInterval(()=>setExpansion(manualExpanded||editing),200);
});
app.on('before-quit',()=>{app.quitting=true;layoutHelper?.kill();reminders.clear();clearTimeout(bubbleTimer);clearInterval(expansionTimer);server?.close();});
app.on('window-all-closed',()=>{});app.on('activate',()=>{if(win)activateForInteraction();});
app.on('second-instance',()=>win?.showInactive());
