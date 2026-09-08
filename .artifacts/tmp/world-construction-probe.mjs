import{createServer}from'vite'
import{Scene}from'three'
import{writeFile}from'node:fs/promises'
const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'})
const report={cases:0,failures:[],furthestNearestTarget:0,furthestFirstDeer:0,started:Date.now()}
try{
 const{createWorld}=await vite.ssrLoadModule('/src/game/world/index.ts')
 for(let seed=11;seed<=50;seed++){
  for(const terrain of ['Plains','Forest','RiverValley','Mountains','Desert'])for(const river of[false,true])for(const quality of['low','balanced']){
   try{
    const scene=new Scene(),w=createWorld(scene,{seed,terrain,river,quality})
    const nearest=Math.min(...w.wildlife.map(a=>Math.hypot(a.position.x,a.position.z-20)))
    report.furthestNearestTarget=Math.max(report.furthestNearestTarget,nearest)
    report.furthestFirstDeer=Math.max(report.furthestFirstDeer,Math.hypot(w.wildlife[0].position.x,w.wildlife[0].position.z-20))
    w.dispose()
    if(scene.children.length)throw Error('undisposed scene children')
   }catch(error){report.failures.push({seed,terrain,river,quality,error:String(error)})}
   report.cases++
  }
  if(seed%5===0)console.log(JSON.stringify({seed,cases:report.cases,failures:report.failures.length,elapsedSeconds:(Date.now()-report.started)/1000}))
 }
}finally{await vite.close();report.elapsedSeconds=(Date.now()-report.started)/1000;await writeFile('.artifacts/tmp/world-construction-probe.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(report.failures.length)process.exitCode=1}
