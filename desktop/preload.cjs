const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('desktop',{
  onGoogleSetup:callback=>ipcRenderer.on('google-setup',callback),
  onLayout:callback=>ipcRenderer.on('layout-status',(_event,state)=>callback(state)),
  reserveSpace:value=>ipcRenderer.invoke('reserve-space',value),
  onWidget:callback=>ipcRenderer.on('widget-state',(_event,state)=>callback(state)),
  onReminder:callback=>ipcRenderer.on('reminder',(_event,event)=>callback(event)),
  expand:value=>ipcRenderer.invoke('expand',value),
  editing:value=>ipcRenderer.invoke('editing',value),
  status:()=>ipcRenderer.invoke('status'),connect:()=>ipcRenderer.invoke('connect'),disconnect:()=>ipcRenderer.invoke('disconnect'),
  events:(start,end)=>ipcRenderer.invoke('events',start,end),update:(id,patch)=>ipcRenderer.invoke('update',id,patch),
  schedule:events=>ipcRenderer.invoke('schedule',events),notifications:()=>ipcRenderer.invoke('notifications'),
  collapsedTitles:value=>ipcRenderer.invoke('collapsed-titles',value),
  timePointer:y=>ipcRenderer.invoke('time-pointer',y),
  railBackground:value=>ipcRenderer.invoke('rail-background',value),
  opacity:value=>ipcRenderer.invoke('opacity',value),
  position:mode=>ipcRenderer.invoke('position',mode),pin:value=>ipcRenderer.invoke('pin',value),openMeeting:url=>ipcRenderer.invoke('open-meeting',url)
});
