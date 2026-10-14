// CI-only opt-in, callable only from demo mode. Never reads a real Google session.
const fs=require('node:fs/promises');
async function run(win){
  const result=await win.webContents.executeJavaScript(`(async()=>{
    const wait=async(check)=>{for(let i=0;i<100;i++){if(check())return;await new Promise(r=>setTimeout(r,50));}throw Error('Linux UI smoke timeout');};
    await wait(()=>document.querySelectorAll('.event').length===4&&!document.body.classList.contains('widget-collapsed'));
    document.getElementById('new-item').click();
    await wait(()=>document.getElementById('detail').open);
    document.getElementById('title').value='Linux sample event';document.getElementById('edit').requestSubmit();
    await wait(()=>!document.getElementById('detail').open&&document.getElementById('count').textContent==='5');
    document.getElementById('new-item').click();await wait(()=>document.getElementById('detail').open);
    const kind=document.getElementById('item-kind');kind.value='task';kind.dispatchEvent(new Event('change'));
    document.getElementById('title').value='Linux sample task';document.getElementById('edit').requestSubmit();
    await wait(()=>document.querySelectorAll('.task-row').length===1);
    document.querySelector('.task-row input').click();await wait(()=>document.querySelector('.task-row.completed'));
    document.getElementById('settings-open').click();
    await wait(()=>document.getElementById('app-version').textContent==='v0.0.3');
    return {version:document.getElementById('app-version').textContent,events:document.getElementById('count').textContent,completedToday:document.querySelectorAll('.task-row.completed').length};
  })()`);
  console.info('LINUX_SMOKE_OK',JSON.stringify(result));
  if(process.env.HARU_SMOKE_SCREENSHOT)await fs.writeFile(process.env.HARU_SMOKE_SCREENSHOT,(await win.webContents.capturePage()).toPNG());
}
module.exports={run};
