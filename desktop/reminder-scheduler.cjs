function createReminderScheduler({now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout,notify}){
  const timers=new Map(),delivered=new Map();let enabled=false;
  function clear(){for(const timer of timers.values())clearTimer(timer.handle);timers.clear();}
  function update(events,active){enabled=active;if(!enabled){clear();return;}const plans=new Map(),current=now();
    for(const [key,at] of delivered)if(at<current-86400000)delivered.delete(key);
    for(const event of events.slice(0,2500)){
      if(!event||typeof event.id!=='string')continue;
      const start=Date.parse(event.start?.dateTime);if(!Number.isFinite(start)||event.status==='cancelled'||event.extendedProperties?.private?.haruTaskStatus==='completed')continue;
      let reminders=event.reminders?.useDefault?event.haruDefaultReminders:event.reminders?.overrides;if(event.extendedProperties?.private?.haruTaskId&&!reminders?.length)reminders=[{method:'popup',minutes:0}];
      for(const reminder of reminders||[]){const minute=reminder.minutes;if(reminder.method!=='popup'||!Number.isInteger(minute)||minute<0||minute>40320)continue;
        const at=start-minute*60000,key=JSON.stringify([event.haruCalendarId||null,event.id,start,minute]);
        if(at<=current||at-current>2147483647||delivered.has(key))continue;
        plans.set(key,{id:event.id,calendarId:event.haruCalendarId,title:typeof event.summary==='string'?event.summary.slice(0,500):'일정 알림',start:event.start.dateTime,minutes:minute,taskId:event.extendedProperties?.private?.haruTaskId,taskList:event.extendedProperties?.private?.haruTaskList,at});
      }
    }
    for(const [key,timer] of timers)if(!plans.has(key)){clearTimer(timer.handle);timers.delete(key);}
    for(const [key,plan] of plans){if(timers.has(key)){timers.get(key).plan=plan;continue;}const timer={plan};timer.handle=setTimer(()=>{timers.delete(key);if(!enabled)return;delivered.set(key,now());notify(timer.plan);},plan.at-current);timers.set(key,timer);}
  }
  return {update,clear,size:()=>timers.size};
}
function reminderBounds(window,area,side,minutes,range={start:540,end:1260}){
  const width=Math.min(304,area.width),height=Math.min(116,area.height),fraction=Math.max(0,Math.min(1,(minutes-range.start)/(range.end-range.start)));
  const x=side==='left'?window.x+window.width+3:side==='right'?window.x-width-3:window.x+window.width-width;
  const y=['left','right'].includes(side)?window.y+window.height*fraction-height/2:window.y+36;
  return {x:Math.round(Math.max(area.x,Math.min(x,area.x+area.width-width))),y:Math.round(Math.max(area.y,Math.min(y,area.y+area.height-height))),width,height};
}
module.exports={createReminderScheduler,reminderBounds};
