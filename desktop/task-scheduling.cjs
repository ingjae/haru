const crypto=require('node:crypto');
const key=(list,id)=>crypto.createHash('sha256').update(list+'\0'+id).digest('hex');
function createTaskScheduling(api){
  async function body(list,task,schedule){
    const {eventPayload}=await import('../public/calendar.js');
    return {...eventPayload({title:((task.status==='completed'?'✓ ':'☐ ')+task.title).slice(0,500),start:schedule.start,end:schedule.end,description:task.notes||''}),extendedProperties:{private:{haruTaskKey:key(list,task.id),haruTaskList:list,haruTaskId:task.id,haruTaskStatus:task.status||'needsAction'}}};
  }
  async function block(calendarId,list,id){const items=await api.taskBlocks(calendarId,'haruTaskKey',key(list,id));if(items.length>1)throw Error('중복된 할일 시간 블록이 있습니다. Google 캘린더에서 확인해 주세요.');return items[0];}
  async function validate(input){const {taskPayload,taskSchedule}=await import('../public/calendar.js');const schedule=taskSchedule(input.schedule);return {task:taskPayload({...input,due:schedule?schedule.start.slice(0,10):input.due}),schedule};}
  async function create(list,input){
    const safe=await validate(input),task=await api.createTask(list,safe.task);
    if(!safe.schedule)return task;
    const id='haru'+key(list,task.id);
    try{const event=await api.create(safe.schedule.calendarId,{id,...await body(list,task,safe.schedule)});return {...task,schedule:{...safe.schedule,eventId:event.id}};}
    catch(error){try{await api.remove(safe.schedule.calendarId,id);}catch{}try{await api.removeTask(list,task.id);}catch{throw Error('할일이 생성됐지만 시간 블록 저장에 실패했습니다. 새로고침 후 기존 할일을 수정해 주세요.');}throw error;}
  }
  async function update(list,id,input){
    const safe=await validate(input),calendarId=input.previousCalendarId||safe.schedule?.calendarId;
    if(calendarId&&safe.schedule&&calendarId!==safe.schedule.calendarId)throw Error('시간 블록의 캘린더 이동은 아직 지원하지 않습니다. 기존 캘린더에서 수정해 주세요.');
    const oldTask=await api.getTask(list,id),oldBlock=calendarId?await block(calendarId,list,id):null;
    const task=await api.updateTask(list,id,safe.task);
    try{
      if(safe.schedule){const eventBody=await body(list,task,safe.schedule);const event=oldBlock?await api.update(calendarId,oldBlock.id,eventBody):await api.create(calendarId,{id:'haru'+key(list,id),...eventBody});return {...task,schedule:{...safe.schedule,eventId:event.id}};}
      if(oldBlock)await api.remove(calendarId,oldBlock.id);
      return task;
    }catch(error){try{await api.updateTask(list,id,{title:oldTask.title,notes:oldTask.notes||'',due:oldTask.due||null,status:oldTask.status,completed:oldTask.completed||null});}catch{throw Error('할일 변경은 저장됐지만 시간 블록 동기화에 실패했습니다. 새로고침 후 다시 수정해 주세요.');}throw error;}
  }
  async function remove(list,id,calendarId){
    const old=calendarId?await block(calendarId,list,id):null;
    if(old)await api.remove(calendarId,old.id);
    try{return await api.removeTask(list,id);}catch(error){if(old){try{await api.create(calendarId,{id:old.id,summary:old.summary,start:old.start,end:old.end,description:old.description||'',reminders:old.reminders,extendedProperties:old.extendedProperties});}catch{throw Error('시간 블록은 삭제됐지만 할일 삭제에 실패했습니다. 새로고침 후 확인해 주세요.');}}throw error;}
  }
  async function list(listId){
    const [tasks,calendars]=await Promise.all([api.tasks(listId),api.calendars()]);
    const slots=new Map();
    // Sequential calendar reads avoid a burst of API requests on multi-calendar accounts.
    for(const calendar of calendars.filter(c=>['owner','writer'].includes(c.accessRole))){for(const event of await api.taskBlocks(calendar.id,'haruTaskList',listId)){const id=event.extendedProperties?.private?.haruTaskId;if(id&&event.start?.dateTime&&event.end?.dateTime)slots.set(id,{start:event.start.dateTime,end:event.end.dateTime,calendarId:calendar.id,eventId:event.id});}}
    return tasks.map(task=>({...task,schedule:slots.get(task.id)||null}));
  }
  return {create,update,remove,list};
}
module.exports={createTaskScheduling};
