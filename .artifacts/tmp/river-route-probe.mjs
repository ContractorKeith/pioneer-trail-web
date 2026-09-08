import {createServer} from 'vite'
import {Scene,Vector3,Box3,Matrix4} from 'three'
import {readFile} from 'node:fs/promises'
const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'})
try{
const {createWorld}=await vite.ssrLoadModule('/src/game/world/index.ts')
const {MotionWorld,initPhysics}=await vite.ssrLoadModule('/src/game/physics.ts')
await initPhysics()
const world=createWorld(new Scene(),{terrain:'RiverValley',river:true,seed:14,quality:'low'})
const initial={x:0,z:80,yaw:0,speed:0}
const idle={forward:0,turn:0,strafe:0,brake:false,sprint:false}
function run(route,start=initial,cycle=11){
 const physics=new MotionWorld(world)
 let pose={...start},tick=0
 const contacts=new Set(),steps=[]
 function step(input,n){for(let i=0;i<n;i++){
  pose=physics.drive(pose,{...idle,...input},1/60,1,pose.z>104&&pose.z<136?.8:0)
  if(physics.lastObstacle)contacts.add(physics.lastObstacle)
  tick++
 }}
 for(const [x,z]of route){
  if(x==='forward'){
   for(let i=0;i<30*60&&pose.z<z;i++)step({forward:1},1)
  }else if(x==='reverse'){
   for(let i=0;i<30*60&&pose.z>z;i++)step({forward:-1},1)
   step({brake:true},45)
  }else{
   let reached=false
   for(let i=0;i<140;i++){
    if(Math.hypot(pose.x-x,pose.z-z)<2.5){reached=true;break}
    const wanted=Math.atan2(x-pose.x,z-pose.z)
    const delta=Math.atan2(Math.sin(wanted-pose.yaw),Math.cos(wanted-pose.yaw))
    step({forward:1,turn:Math.abs(delta)>.045?Math.sign(delta):0},cycle)
   }
   if(!reached){steps.push({target:[x,z],failed:true,pose});break}
  }
  steps.push({target:[x,z],pose})
 }
 const result={route,cycle,seconds:tick/60,pose,contacts:[...contacts],collisions:physics.collisions,steps}
 physics.dispose()
 return result
}
const routes=[
 [[-9,102],[-9,140],[-9,156]],
 [[7,102],[7,140],[7,156]],
 [[6,100],[7,118],[7,140],[7,156]],
 [[6,100],[6,116],[7,128],[7,140],[7,156]],
 [[5,98],[6.5,112],[6.5,128],[7,140],[7,156]],
 [[0,98],[-8,107],[-9,140],[-9,156]],
 [['reverse',60],[-7,87],[-9,102],[-9,140],[-9,156]],
 [['reverse',65],[-6,85],[-8,102],[-9,140],[-9,156]],
 [['reverse',68],[-6.5,85],[-8,102],[-9,140],[-9,156]],
]
if(process.argv.includes('--variations')){
 const route=[[0,98],[-8,107],[-9,140],['forward',156]]
 const failures=[],results=[]
 for(const cycle of [10,11,12])for(const x of [-.3,0,.3])for(const z of [79,80,81.5])for(const yaw of [-.07,0,.07]){
  const start={x,z,yaw,speed:0},r=run(route,start,cycle)
  const row={start,cycle,pose:r.pose,contacts:r.contacts,seconds:r.seconds}
  if(r.contacts.length||r.pose.z<156)failures.push(row)
  results.push(row)
 }
 console.log(JSON.stringify({route,cases:results.length,failures,first:results[0],last:results.at(-1)}))
}else for(const route of routes)console.log(JSON.stringify(run(route)))
world.dispose()
}finally{await vite.close()}
