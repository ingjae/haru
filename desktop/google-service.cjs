// Fixed Google API origins; identifiers are encoded, never interpreted as URLs.
function identifier(value){if(typeof value!=='string'||!value||value.length>1024)throw Error('잘못된 항목입니다.');return encodeURIComponent(value);}
function createGoogleService(access,fetcher=fetch){
  async function request(service,route,options={}){
    const root=service==='tasks'?'https://tasks.googleapis.com/tasks/v1':'https://www.googleapis.com/calendar/v3';
    const response=await fetcher(root+route,{...options,headers:{Authorization:`Bearer ${await access()}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(20000)});
    if(!response.ok){if(response.status===401)throw Error('Google 인증이 만료되었습니다. 다시 연결해 주세요.');if(response.status===403)throw Error(service==='tasks'?'Google Tasks 접근이 거부되었습니다. Tasks API 활성화 후 설정에서 추가 권한을 연결해 주세요.':'캘린더 접근이 거부되었습니다. API 활성화·추가 권한·캘린더 쓰기 권한을 확인해 주세요.');if(response.status===404)throw Error('항목을 찾을 수 없습니다. 새로고침해 주세요.');throw Error(`Google 요청 실패 (${response.status}). 다시 시도해 주세요.`);}
    return response.status===204?null:response.json();
  }
  async function list(service,route,params={}){let result=[],pageToken;do{const q=new URLSearchParams(params);if(pageToken)q.set('pageToken',pageToken);const page=await request(service,route+'?'+q);result.push(...(page.items||[]));pageToken=page.nextPageToken;}while(pageToken);return result;}
  const eventPath=c=>'/calendars/'+identifier(c)+'/events';
  const taskPath=l=>'/lists/'+identifier(l)+'/tasks';
  return {
    calendars:()=>list('calendar','/users/me/calendarList',{maxResults:'250'}),
    events:(c,start,end)=>list('calendar',eventPath(c),{timeMin:start,timeMax:end,singleEvents:'true',orderBy:'startTime',maxResults:'2500'}),
    taskBlocks:(c,property,value)=>list('calendar',eventPath(c),{privateExtendedProperty:property+'='+value,maxResults:'2500'}),
    create:(c,body)=>request('calendar',eventPath(c),{method:'POST',body:JSON.stringify(body)}),
    update:(c,id,body)=>request('calendar',eventPath(c)+'/'+identifier(id),{method:'PATCH',body:JSON.stringify(body)}),
    remove:(c,id)=>request('calendar',eventPath(c)+'/'+identifier(id),{method:'DELETE'}),
    taskLists:()=>list('tasks','/users/@me/lists',{maxResults:'100'}),
    getTask:(l,id)=>request('tasks',taskPath(l)+'/'+identifier(id)),
    tasks:l=>list('tasks',taskPath(l),{maxResults:'100',showCompleted:'true',showHidden:'true',showDeleted:'false'}),
    createTask:(l,body)=>request('tasks',taskPath(l),{method:'POST',body:JSON.stringify(body)}),
    updateTask:(l,id,body)=>request('tasks',taskPath(l)+'/'+identifier(id),{method:'PATCH',body:JSON.stringify(body)}),
    removeTask:(l,id)=>request('tasks',taskPath(l)+'/'+identifier(id),{method:'DELETE'})
  };
}
module.exports={createGoogleService};
