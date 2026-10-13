const {app,BrowserWindow,Tray,Menu,screen,ipcMain,shell,Notification,safeStorage,nativeImage,dialog}=require('electron');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {desktopCredential,authError}=require('./google-auth.cjs');
const RAIL_WIDTH=24;
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
  let output='';layoutHelper.stdout.on('data',data=>{output+=data;let end;while((end=output.indexOf('\n'))>=0){const line=output.slice(0,end).trim();output=output.slice(end+1);layoutTrusted=line==='trusted';win?.webContents.send('layout-status',{enabled:!!preferences.reserveSpace,trusted:layoutTrusted});}});
  layoutHelper.on('error',()=>{layoutHelper=null;win?.webContents.send('layout-status',{enabled:false,trusted:false,error:'창 배치 도우미를 빌드한 뒤 다시 실행해 주세요.'});});
  layoutHelper.on('exit',()=>{layoutHelper=null;layoutTrusted=false;});
  layoutHelper.stdin.on('error',()=>{});
  sendLayout();
}
let marker,win,tray,origin,server,token=null,mode='window',alertEnabled=false,timers=[],loginPending=false;
let preferences={mode:'left',pinned:true,notifications:false,reserveSpace:false,opacity:1,railBackground:true,collapsedTitles:false};
let expanded=false,toastUntil=0,hoverTimer,editing=false;
function activateForInteraction(){win.setFocusable(true);win.show();win.focus();}
function widgetState(){return {edge:['left','right'].includes(mode),expanded,side:mode,railBackground:!!preferences.railBackground,collapsedTitles:!!preferences.collapsedTitles};}
function setExpansion(value){
  if(!['left','right'].includes(mode)||expanded===value)return;expanded=value;marker?.hide();
  const area=screen.getDisplayMatching(win.getBounds()).workArea,width=Math.min(value?420:RAIL_WIDTH,area.width);
  win.setBounds({x:mode==='left'?area.x:area.x+area.width-width,y:area.y,width,height:area.height});
  win.webContents.send('widget-state',widgetState());
}
const preferencesPath=()=>path.join(app.getPath('userData'),'preferences.json');
function savePreferences(){return fs.writeFile(preferencesPath(),JSON.stringify(preferences),{mode:0o600});}
const tokenPath=()=>path.join(app.getPath('userData'),'google-session.enc');
function external(url){const u=new URL(url);if(u.protocol!=='https:')throw Error('HTTPS 링크만 열 수 있습니다.');return shell.openExternal(u.href);}
async function persist(){if(!safeStorage.isEncryptionAvailable())throw Error('시스템 암호화 저장소를 사용할 수 없습니다.');await fs.writeFile(tokenPath(),safeStorage.encryptString(JSON.stringify(token)),{mode:0o600});}
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
async function connect(){
  if(loginPending)throw Error('이미 Google 로그인이 진행 중입니다.');loginPending=true;
  try{
    const credentials=await credential();const state=crypto.randomBytes(32).toString('hex'),verifier=crypto.randomBytes(32).toString('base64url');
    const code=await new Promise((resolve,reject)=>{
      let timeout;const callback=http.createServer((req,res)=>{
        const u=new URL(req.url,'http://127.0.0.1');if(u.pathname!=='/callback'){res.writeHead(404);res.end();return;}
        if(u.searchParams.get('state')!==state){res.writeHead(400);res.end('Invalid state');return;}
        res.setHeader('Content-Type','text/plain; charset=utf-8');res.end(u.searchParams.get('error')?'Google 인증이 취소되거나 거부되었습니다. Haru로 돌아가 설정을 확인해 주세요.':'Google 응답을 받았습니다. Haru에서 연결 결과를 확인해 주세요.');clearTimeout(timeout);callback.close();
        if(u.searchParams.get('error')||!u.searchParams.get('code'))reject(Error(authError(u.searchParams.get('error'))));else resolve({code:u.searchParams.get('code'),redirect_uri:`http://127.0.0.1:${callback.address()?.port || port}/callback`});
      });let port;
      callback.listen(0,'127.0.0.1',()=>{port=callback.address().port;const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');u.search=new URLSearchParams({client_id:credentials.client_id,redirect_uri:`http://127.0.0.1:${port}/callback`,response_type:'code',scope:'https://www.googleapis.com/auth/calendar.events',access_type:'offline',prompt:'consent',state,code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();shell.openExternal(u.href).catch(error=>{clearTimeout(timeout);callback.close();reject(error);});});
      timeout=setTimeout(()=>{callback.close();reject(Error('로그인 시간이 초과되었습니다. 다시 연결해 주세요.'));},180000);callback.on('error',reject);
    });
    const result=await exchange({...credentials,...code,code_verifier:verifier,grant_type:'authorization_code'});
    token={...credentials,...result,expires_at:Date.now()+result.expires_in*1000};await persist();return true;
  }finally{loginPending=false;}
}
async function access(){
  if(!token)throw Error('Google 캘린더를 먼저 연결해 주세요.');
  if(Date.now()>token.expires_at-60000){if(!token.refresh_token)throw Error('인증이 만료되었습니다. 다시 연결해 주세요.');const result=await exchange({client_id:token.client_id,client_secret:token.client_secret,refresh_token:token.refresh_token,grant_type:'refresh_token'});token={...token,...result,expires_at:Date.now()+result.expires_in*1000};await persist();}
  return token.access_token;
}
async function calendar(endpoint,options={}){
  const response=await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events${endpoint}`,{...options,headers:{Authorization:`Bearer ${await access()}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(20000)});
  if(!response.ok){if(response.status===401)throw Error('Google 인증이 만료되었습니다. 연결을 해제하고 다시 연결해 주세요.');if(response.status===403)throw Error('캘린더 접근이 거부되었습니다. Calendar API 활성화와 계정 권한을 확인해 주세요.');throw Error(`캘린더 요청 실패 (${response.status}). 잠시 후 다시 시도해 주세요.`);}return response.json();
}
function position(next){
  if(!['window','left','right','top','menubar'].includes(next))return;marker?.hide();mode=next;preferences.mode=next;savePreferences().catch(()=>{});
  const area=screen.getDisplayMatching(win.getBounds()).workArea;
  expanded=false;const width=Math.min(['left','right'].includes(next)?RAIL_WIDTH:420,area.width),height=Math.min(660,area.height);
  const bounds=next==='left'?{x:area.x,y:area.y,width,height:area.height}:next==='right'?{x:area.x+area.width-width,y:area.y,width,height:area.height}:next==='top'?{x:area.x,y:area.y,width:area.width,height:Math.min(360,area.height)}:next==='menubar'?{x:area.x+area.width-width,y:area.y,width,height}:{x:area.x+Math.round((area.width-Math.min(1100,area.width))/2),y:area.y+40,width:Math.min(1100,area.width),height:Math.min(800,area.height-40)};
  win.setBounds(bounds);win.showInactive();
  win.webContents.send('widget-state',widgetState());sendLayout();
}
function popover(){
  if(mode!=='menubar'){win.showInactive();return;}
  const area=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea,b=tray.getBounds();
  win.setBounds({x:Math.max(area.x,Math.min(b.x-190,area.x+area.width-420)),y:area.y,width:Math.min(420,area.width),height:Math.min(660,area.height)});win.showInactive();
}
function schedule(events){
  timers.forEach(clearTimeout);timers=[];if(!alertEnabled||!token)return;
  for(const event of events.slice(0,2500)){
    if(!event.start?.dateTime || event.reminders?.useDefault)continue;
    const minute=event.reminders?.overrides?.find(r=>r.method==='popup')?.minutes;if(minute==null)continue;
    const delay=new Date(event.start.dateTime)-minute*60000-Date.now();if(delay<=0||delay>2147483647)continue;
    timers.push(setTimeout(()=>{toastUntil=Date.now()+8000;setExpansion(true);win.webContents.send('reminder',{id:event.id,title:event.summary||'일정 알림',start:event.start.dateTime});const n=new Notification({title:event.summary||'일정 알림',body:'일정이 곧 시작됩니다.',silent:false});n.on('click',()=>{activateForInteraction();});n.show();},delay));
  }
}
if(!app.requestSingleInstanceLock()){app.quit();}else app.whenReady().then(async()=>{
  try{preferences={...preferences,...JSON.parse(await fs.readFile(preferencesPath(),'utf8'))};}catch{}
  if(process.argv.includes('--reserve-space')){preferences.reserveSpace=true;await savePreferences();}
  alertEnabled=!!preferences.notifications;
  try{if(safeStorage.isEncryptionAvailable())token=JSON.parse(safeStorage.decryptString(await fs.readFile(tokenPath())));}catch{}
  server=http.createServer(async(req,res)=>{const files={'/':'index.html','/app.js':'app.js','/calendar.js':'calendar.js','/style.css':'style.css'};const file=files[req.url];if(!file){res.writeHead(404);res.end();return;}try{const body=await fs.readFile(path.join(__dirname,'../public',file));res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'");res.end(body);}catch{res.writeHead(500);res.end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
  win=new BrowserWindow({width:RAIL_WIDTH,height:800,minWidth:RAIL_WIDTH,minHeight:280,show:false,focusable:false,acceptFirstMouse:true,type:process.platform==='darwin'?'panel':undefined,frame:false,hasShadow:false,roundedCorners:false,skipTaskbar:true,title:'Haru · 오늘의 타임라인',transparent:true,backgroundColor:'#00000000',alwaysOnTop:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  marker=new BrowserWindow({width:20,height:26,show:false,focusable:false,type:process.platform==='darwin'?'panel':undefined,frame:false,transparent:true,backgroundColor:'#00000000',hasShadow:false,roundedCorners:false,skipTaskbar:true,resizable:false,alwaysOnTop:true,title:'Haru · 현재 시간 표시',webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
  marker.setIgnoreMouseEvents(true);
  if(process.platform==='darwin')marker.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
  await marker.loadFile(path.join(__dirname,'time-pointer.html'));
  if(process.platform==='darwin')win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
  win.webContents.setWindowOpenHandler(({url})=>{external(url).catch(()=>{});return{action:'deny'};});win.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==origin)event.preventDefault();});
  win.on('close',event=>{if(!app.quitting){event.preventDefault();win.showInactive();}});
  const icon=nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==');
  tray=new Tray(icon);tray.setTitle('◷');tray.setToolTip('Haru · 오늘의 일정');tray.on('click',popover);
  const menu=Menu.buildFromTemplate([...['window','left','right','top','menubar'].map((p,i)=>({label:['일반 창','왼쪽에 붙이기','오른쪽에 붙이기','위쪽에 붙이기','메뉴바 패널'][i],click:()=>position(p)})),{type:'separator'},{label:'Google 캘린더 연결…',click:()=>{setExpansion(true);activateForInteraction();win.webContents.send('google-setup');}},{label:'종료',click:()=>app.quit()}]);tray.on('right-click',()=>tray.popUpContextMenu(menu));
  function handle(name,fn){ipcMain.handle(name,(event,...args)=>{if(event.sender!==win.webContents || new URL(event.senderFrame.url).origin!==origin)throw Error('Unauthorized');return fn(...args);});}
  handle('collapsed-titles',async value=>{if(typeof value!=='boolean')throw Error('제목 표시 설정을 확인해 주세요.');preferences.collapsedTitles=value;await savePreferences();win.webContents.send('widget-state',widgetState());return value;});
  handle('time-pointer',y=>{if(expanded||!['left','right'].includes(mode)||typeof y!=='number'||!Number.isFinite(y)){marker.hide();return;}const b=win.getBounds(),area=screen.getDisplayMatching(b).bounds;if(y<0||y>b.height){marker.hide();return;}marker.setBounds({x:Math.max(area.x,b.x-20),y:Math.round(b.y+y-13),width:20,height:26});marker.showInactive();if(process.env.HARU_DEBUG_WIDGET==='1')console.info('time-pointer',JSON.stringify({rail:b,pointer:marker.getBounds(),visible:marker.isVisible(),focusable:marker.isFocusable(),focused:marker.isFocused(),reservedWidth:RAIL_WIDTH}));});
  handle('status',()=>({connected:!!token,...widgetState(),pinned:!!preferences.pinned,reserveSpace:!!preferences.reserveSpace,layoutTrusted,opacity:preferences.opacity}));handle('connect',connect);
  handle('disconnect',async()=>{token=null;timers.forEach(clearTimeout);timers=[];await fs.rm(tokenPath(),{force:true});});
  handle('events',async(start,end)=>{if(!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end)))throw Error('잘못된 날짜입니다.');let result=[],pageToken;do{const q=new URLSearchParams({timeMin:start,timeMax:end,singleEvents:'true',orderBy:'startTime',maxResults:'2500'});if(pageToken)q.set('pageToken',pageToken);const page=await calendar('?'+q);result.push(...(page.items||[]));pageToken=page.nextPageToken;}while(pageToken);return result;});
  handle('update',async(id,patch)=>{if(typeof id!=='string'||!id.length)throw Error('잘못된 일정입니다.');const {eventPatch}=await import('../public/calendar.js');const reminder=patch.reminders?.overrides?.[0]?.minutes;const safe=eventPatch(patch.summary,patch.start?.dateTime,patch.end?.dateTime,reminder==null?'none':String(reminder));if(reminder!=null&&(!Number.isInteger(reminder)||reminder<0||reminder>40320))throw Error('잘못된 알림 시간입니다.');return calendar('/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify(safe)});});
  handle('reserve-space',async value=>{preferences.reserveSpace=!!value;await savePreferences();if(value)startLayout(true);else sendLayout();return{enabled:!!preferences.reserveSpace,trusted:layoutTrusted};});
  handle('rail-background',async value=>{if(typeof value!=='boolean')throw Error('배경 설정을 확인해 주세요.');preferences.railBackground=value;await savePreferences();win.webContents.send('widget-state',widgetState());return value;});
  handle('opacity',async value=>{if(typeof value!=='number'||!Number.isFinite(value)||value<0.35||value>1)throw Error('투명도 범위를 확인해 주세요.');win.setOpacity(value);marker.setOpacity(value);preferences.opacity=value;await savePreferences();return value;});
  handle('position',position);handle('pin',value=>{win.setAlwaysOnTop(!!value);marker.setAlwaysOnTop(!!value);preferences.pinned=!!value;return savePreferences();});handle('open-meeting',external);handle('schedule',schedule);
  handle('editing',value=>{editing=!!value;if(editing){setExpansion(true);activateForInteraction();}else{win.blur();win.setFocusable(false);}});
  handle('notifications',async()=>{if(!Notification.isSupported())throw Error('이 환경은 시스템 알림을 지원하지 않습니다.');alertEnabled=true;preferences.notifications=true;await savePreferences();new Notification({title:'Haru 알림',body:'일정 알림을 켰습니다. 앱을 실행한 상태로 유지해 주세요.'}).show();});
  await win.loadURL(origin);
  preferences.opacity=typeof preferences.opacity==='number'&&Number.isFinite(preferences.opacity)?Math.max(.35,Math.min(1,preferences.opacity)):1;
  marker.setOpacity(preferences.opacity);marker.setAlwaysOnTop(!!preferences.pinned);win.setOpacity(preferences.opacity);win.setAlwaysOnTop(!!preferences.pinned);position(preferences.mode);
  if(preferences.reserveSpace)startLayout(process.argv.includes('--reserve-space'));
  if(process.argv.includes('--google-setup'))win.webContents.send('google-setup');
  screen.on('display-metrics-changed',()=>{position(mode);sendLayout();});
  hoverTimer=setInterval(()=>{if(!['left','right'].includes(mode))return;const p=screen.getCursorScreenPoint(),b=win.getBounds();const inside=p.x>=b.x&&p.x<b.x+b.width&&p.y>=b.y&&p.y<b.y+b.height;setExpansion(inside||editing||Date.now()<toastUntil);},200);
});
app.on('before-quit',()=>{app.quitting=true;layoutHelper?.kill();timers.forEach(clearTimeout);clearInterval(hoverTimer);server?.close();});
app.on('window-all-closed',()=>{});app.on('activate',()=>{if(win)activateForInteraction();});
app.on('second-instance',()=>win?.showInactive());
