export function selectedGroups(saved,available,fallback){
  const ids=new Set(available.map(item=>item.id));
  return Array.isArray(saved)?[...new Set(saved.filter(id=>ids.has(id)))]:ids.has(fallback)?[fallback]:available.slice(0,1).map(item=>item.id);
}
export function eventSource(event,fallback){return event.haruCalendarId||fallback;}
export function taskSource(task,fallback){return task.haruTaskListId||fallback;}
export function findLinkedTask(tasks,properties){return tasks.find(t=>t.id===properties?.haruTaskId&&t.haruTaskListId===properties?.haruTaskList);}
export function taskCompleted(task){return task?.status==='completed';}
