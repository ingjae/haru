const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('reminder',{
  onShow:callback=>ipcRenderer.on('reminder-show',(_event,data)=>callback(data)),
  open:()=>ipcRenderer.invoke('reminder-open'),close:()=>ipcRenderer.invoke('reminder-close')
});
