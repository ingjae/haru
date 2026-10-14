export function selectedGroups(saved,available,fallback){
  const ids=new Set(available.map(item=>item.id));
  return Array.isArray(saved)?[...new Set(saved.filter(id=>ids.has(id)))]:ids.has(fallback)?[fallback]:available.slice(0,1).map(item=>item.id);
}
export function eventSource(event,fallback){return event.haruCalendarId||fallback;}
export function taskSource(task,fallback){return task.haruTaskListId||fallback;}
export function findLinkedTask(tasks,properties){return tasks.find(t=>t.id===properties?.haruTaskId&&t.haruTaskListId===properties?.haruTaskList);}
export function taskCompleted(task){return task?.status==='completed';}
export const groupPalette=['#007AFF','#34A853','#AF52DE','#FF9500','#E5484D','#008C95','#D1458B','#64748B'];
export function normalizeGroupColors(value={}){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('그룹 색상을 확인해 주세요.');
  const result={};for(const kind of ['calendars','taskLists']){const map=value[kind]??{};if(!map||typeof map!=='object'||Array.isArray(map)||Object.keys(map).length>250)throw Error('그룹 색상을 확인해 주세요.');result[kind]=Object.fromEntries(Object.entries(map).map(([id,color])=>{if(!id||id.length>1024||typeof color!=='string'||!/^#[0-9a-f]{6}$/i.test(color))throw Error('그룹 색상은 #RRGGBB 형식이어야 합니다.');return [id,color.toUpperCase()];}));}return result;
}
export function groupColor(colors,kind,id,fallback){const custom=colors?.[kind];if(custom&&Object.hasOwn(custom,id)&&/^#[0-9a-f]{6}$/i.test(custom[id]))return custom[id];if(/^#[0-9a-f]{6}$/i.test(fallback||''))return fallback;let hash=0;for(const char of kind+':'+id)hash=(hash*31+char.charCodeAt(0))>>>0;return groupPalette[hash%groupPalette.length];}
export function colorInk(color){const components=color.slice(1).match(/../g).map(hex=>{const s=parseInt(hex,16)/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});const luminance=components[0]*.2126+components[1]*.7152+components[2]*.0722;return luminance>.179?'#111111':'#FFFFFF';}
