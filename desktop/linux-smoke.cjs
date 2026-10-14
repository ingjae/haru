// CI-only opt-in, callable only from demo mode. Never reads a real Google session.
const fs=require('node:fs/promises');
async function run(win){
  const result=await win.webContents.executeJavaScript(`(async()=>{
    const wait=async(check,label)=>{for(let i=0;i<100;i++){if(check())return;await new Promise(r=>setTimeout(r,50));}throw Error('Linux UI smoke timeout: '+label+' '+JSON.stringify({events:document.querySelectorAll('.event').length,count:document.getElementById('count').textContent,collapsed:document.body.classList.contains('widget-collapsed'),detail:document.getElementById('detail').open,error:document.getElementById('dialog-error').textContent,message:document.getElementById('message').textContent,version:document.getElementById('app-version').textContent}));};
    await wait(()=>document.querySelectorAll('.event').length===4&&!document.body.classList.contains('widget-collapsed'),'initial events');
    document.getElementById('new-item').click();
    await wait(()=>document.getElementById('detail').open,'open editor');
    document.getElementById('title').value='Linux sample event';document.getElementById('edit').requestSubmit();
    await wait(()=>!document.getElementById('detail').open&&document.getElementById('count').textContent==='5','save event');
    document.getElementById('new-item').click();await wait(()=>document.getElementById('detail').open,'open editor');
    const kind=document.getElementById('item-kind');kind.value='task';kind.dispatchEvent(new Event('change'));
    document.getElementById('title').value='Linux sample task';document.getElementById('edit').requestSubmit();
    await wait(()=>document.querySelectorAll('.task-row').length===1,'save task');
    document.querySelector('.task-row input').click();await wait(()=>document.querySelector('.task-row.completed'),'complete task');
    document.getElementById('settings-open').click();
    await wait(()=>document.getElementById('app-version').textContent==='v'+${JSON.stringify(require('../package.json').version)},'settings version');
    return {version:document.getElementById('app-version').textContent,events:document.getElementById('count').textContent,completedToday:document.querySelectorAll('.task-row.completed').length};
  })()`);
  console.info('LINUX_SMOKE_OK',JSON.stringify(result));
  if(process.env.HARU_SMOKE_SCREENSHOT)await fs.writeFile(process.env.HARU_SMOKE_SCREENSHOT,(await win.webContents.capturePage()).toPNG());
}
module.exports={run};
