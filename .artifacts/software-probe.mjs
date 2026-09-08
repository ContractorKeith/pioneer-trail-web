import {chromium} from 'playwright'
const browser=await chromium.launch({args:['--enable-unsafe-swiftshader']})
try {
 const page=await browser.newPage({viewport:{width:Number(process.env.WIDTH??640),height:Number(process.env.HEIGHT??360)}})
 page.setDefaultTimeout(60000)
 await page.addInitScript(()=>localStorage.setItem('pioneer-trail:settings:v2',JSON.stringify({quality:'low'})))
 await page.goto('http://localhost:4173/?evidence=1')
 await page.getByRole('button',{name:'Choose provisions'}).click()
 await page.getByRole('button',{name:'Load this plan'}).click()
 await page.getByRole('button',{name:'Take the trail'}).click()
 for(let i=0;i<3;i++) {
  const t=Date.now()
  console.log(await page.evaluate(()=>({renderer:window.__trail.renderer(),fps:window.__trail.snapshot().fps,paused:window.__trail.snapshot().paused,mode:window.__trail.snapshot().mode,drawCalls:window.__trail.snapshot().drawCalls,triangles:window.__trail.snapshot().triangles})),Date.now()-t)
  await page.waitForTimeout(1000)
 }
 await page.keyboard.press('e')
 console.log('dismount',await page.evaluate(()=>window.__trail.snapshot().mode))
} finally {await browser.close()}
