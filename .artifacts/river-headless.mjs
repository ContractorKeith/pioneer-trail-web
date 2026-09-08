import {chromium} from 'playwright'
import {readFile,writeFile} from 'node:fs/promises'
import {fixture,restore,resume,state} from '../tests/world.helpers.ts'
import {TrailEngine} from '../public/wasm/pioneer_trail_web_engine.js'
const original=JSON.parse((await fixture('river')).raw)
const e=new TrailEngine('11'); e.load(original.campaign)
const active=JSON.parse(e.begin_activity(JSON.stringify({kind:'crossing',method:'Caulk'}))).view.activity
original.campaign=e.save()
original.spatial.activity={id:active.id,kind:'crossing',elapsed:0,phase:'active',data:{}}
original.spatial.regionIndex=3
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--ozone-platform=x11','--enable-gpu']})
try {
 const context=await browser.newContext({baseURL:'http://localhost:4173',viewport:{width:1280,height:720},...(process.env.VIDEO?{recordVideo:{dir:'.artifacts/videos',size:{width:1280,height:720}}}:{})})
 const page=await context.newPage()
 await page.addInitScript(()=>localStorage.setItem('pioneer-trail:settings:v2',JSON.stringify({quality:'low',reducedMotion:true,muted:true,lookMode:'drag'})))
 const cdp=await context.newCDPSession(page)
 // Observe unfiltered browser rAF; no sampling profiler.
 const report=[]
 for(const z of [80,120,132]){
  original.spatial.wagon={x:-8,z,yaw:0,speed:0}
  original.spatial.player={x:-11,z,yaw:0,pitch:-.06}
  original.spatial.frontierZ=z
  await restore(page,JSON.stringify(original));await resume(page)
  await page.waitForTimeout(2000)
  await page.bringToFront()
  const frames=await page.evaluate(()=>new Promise(resolve=>{
   const frames=[];const start=performance.now();let last=start;
   function tick(now){const s=window.__trail.snapshot();frames.push({at:now-start,ms:now-last,hidden:document.hidden,focused:document.hasFocus(),paused:s.paused});last=now;if(now-start<20000)requestAnimationFrame(tick);else resolve(frames)}
   requestAnimationFrame(tick)
  }))
  const s=await state(page),r=await page.evaluate(()=>window.__trail.renderer())
  report.push({z,snapshot:s,renderer:r,frames})
  console.log(JSON.stringify({z,fps:s.fps,frameMs:s.frameMs,triangles:s.triangles,drawCalls:s.drawCalls,renderer:r,samples:frames.length,seconds:[0,5,10,15].map(t=>{const f=frames.filter(f=>f.at>=t*1000&&f.at<(t+5)*1000);return {t,fps:f.length/5,maxMs:Math.max(...f.map(x=>x.ms)),hidden:f.filter(x=>x.hidden).length,unfocused:f.filter(x=>!x.focused).length}})}))
 }
 await writeFile(`.artifacts/river-headless${process.env.VIDEO?'-video':''}.json`,JSON.stringify(report,null,2))
 await context.close()
} finally {await browser.close()}
