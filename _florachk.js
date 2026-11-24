const fs=require('fs');const path=require('path');const {spawn}=require('child_process');
const LOG=path.join(__dirname,'_fl.log');function log(s){fs.appendFileSync(LOG,s+'\n');}fs.writeFileSync(LOG,'');
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';const PORT=9258;
async function main(){
  const uddir=path.join(__dirname,'_chrome_fl2');
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
  await new Promise(r=>setTimeout(r,4000));
  // 找到 flora 卡并滚到可见
  const r1=await send('Runtime.evaluate',{expression:`(function(){
    var cards=document.querySelectorAll('.cat-head');
    var cw=null;
    for(var c of cards){if(c.textContent.indexOf('从教课件')>=0)cw=c.parentElement;}
    var floraCard=document.querySelector('[data-story="flora"]');
    if(!floraCard)return 'flora card missing';
    var idx=Array.from(document.querySelectorAll('.cards')).findIndex(g=>g.contains(floraCard));
    var pos=Array.from(floraCard.parentElement.children).indexOf(floraCard)+1;
    var img=floraCard.querySelector('img');
    return JSON.stringify({sectionIdx:idx,positionInGrid:pos,imgOk:img.complete&&img.naturalWidth>0,title:floraCard.querySelector('h4').textContent.trim()});
  })()`,returnByValue:true});
  log('卡片: '+(r1.result&&r1.result.value));
  // 打开故事弹窗
  await send('Runtime.evaluate',{expression:'document.querySelector(\'[data-story="flora"]\').click()',returnByValue:true});
  await new Promise(r=>setTimeout(r,1500));
  const r2=await send('Runtime.evaluate',{expression:`(function(){
    var st=document.getElementById('stBody');
    if(!st)return 'no modal';
    var h1=st.querySelector('h1')?st.querySelector('h1').textContent:'';
    var link=st.querySelector('.launch-big a');
    var imgs=st.querySelectorAll('img');
    var bad=[];
    imgs.forEach(function(i){if(i.complete&&i.naturalWidth===0&&i.src)bad.push(i.getAttribute('src'));});
    return JSON.stringify({h1:h1,launch:link?link.getAttribute('href'):'none',imgs:imgs.length,bad:bad});
  })()`,returnByValue:true});
  log('弹窗: '+(r2.result&&r2.result.value));
  log('DONE');ws.close();proc.kill();
  setTimeout(()=>process.exit(0),400);
}
main().catch(e=>{log('FATAL '+e.message);process.exit(1);});
