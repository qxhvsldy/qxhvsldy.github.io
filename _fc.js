/* 渲染验证：FLORA 卡封面 + 弹窗 hero 新图 */
const fs=require('fs');const path=require('path');const {spawn}=require('child_process');
const LOG=path.join(__dirname,'_fc.log');function log(s){fs.appendFileSync(LOG,s+'\n');}fs.writeFileSync(LOG,'');
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';const PORT=9259;
async function main(){
  const uddir=path.join(__dirname,'_chrome_fc');
  if(!fs.existsSync(uddir))fs.mkdirSync(uddir,{recursive:true});
  const proc=spawn(CHROME,['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port='+PORT,'--user-data-dir='+uddir,'--window-size=1440,900','about:blank'],{stdio:'ignore'});
  let target=null;
  for(let i=0;i<50;i++){try{const r=await fetch('http://127.0.0.1:'+PORT+'/json/list');const l=await r.json();const pg=l.find(t=>t.type==='page');if(pg){target=pg;break;}}catch(e){}await new Promise(r=>setTimeout(r,250));}
  const ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  let mid=0;const pending=new Map();
  function send(method,params){return new Promise((res,rej)=>{const id=++mid;pending.set(id,{res,rej});ws.send(JSON.stringify({id,method,params:params||{}}));});}
  ws.onmessage=(ev)=>{const msg=JSON.parse(ev.data);if(msg.id&&pending.has(msg.id)){const p=pending.get(msg.id);pending.delete(msg.id);if(msg.error)p.rej(new Error(msg.error.message));else p.res(msg.result);}};
  await send('Runtime.enable');await send('Page.enable');
  const url='file:///'+encodeURI(path.join(__dirname).replace(/\\/g,'/'))+'/index.html';
  await send('Page.navigate',{url});
  await new Promise(r=>setTimeout(r,3500));
  // 滚到 flora 卡
  await send('Runtime.evaluate',{expression:'document.querySelector(\'[data-story="flora"]\').scrollIntoView({block:"center"})',returnByValue:true});
  await new Promise(r=>setTimeout(r,1200));
  const r1=await send('Runtime.evaluate',{expression:`(function(){
    var img=document.querySelector('[data-story="flora"] img');
    var r=img.getBoundingClientRect();
    return JSON.stringify({loaded:img.complete&&img.naturalWidth>0,nat:img.naturalWidth+'x'+img.naturalHeight,dispW:+r.width.toFixed(0),dispH:+r.height.toFixed(0),ratio:+(r.width/r.height).toFixed(2)});
  })()`,returnByValue:true});
  log('卡片封面: '+(r1.result&&r1.result.value));
  const sc=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(__dirname,'_fc_card.png'),Buffer.from(sc.data,'base64'));
  // 打开弹窗看 hero
  await send('Runtime.evaluate',{expression:'document.querySelector(\'[data-story="flora"]\').click()',returnByValue:true});
  await new Promise(r=>setTimeout(r,1500));
  const r2=await send('Runtime.evaluate',{expression:`(function(){
    var hero=document.querySelector('#stBody .st-hero img');
    return hero?JSON.stringify({heroOk:hero.complete&&hero.naturalWidth>0}):'no hero';
  })()`,returnByValue:true});
  log('弹窗hero: '+(r2.result&&r2.result.value));
  const sc2=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(__dirname,'_fc_modal.png'),Buffer.from(sc2.data,'base64'));
  log('DONE');ws.close();proc.kill();
  setTimeout(()=>process.exit(0),400);
}
main().catch(e=>{log('FATAL '+e.message);process.exit(1);});
