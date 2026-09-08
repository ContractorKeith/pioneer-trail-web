import{createServer}from'vite'
import{Scene,Vector3,InstancedMesh,MeshStandardMaterial}from'three'
import{createHash}from'node:crypto'
import{readFile,writeFile}from'node:fs/promises'
const hash=(value)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'})
const report={cases:0,failures:[],rows:[],lowLayoutPreserved:[],furthestNearestTarget:0,furthestFirstDeer:0,started:Date.now()}
try{
 const{createWorld}=await vite.ssrLoadModule('/src/game/world/index.ts')
 const{MotionWorld,initPhysics}=await vite.ssrLoadModule('/src/game/physics.ts');await initPhysics()
 const baseline=JSON.parse(await readFile('.artifacts/tmp/quality-low-baseline.json','utf8'))
 for(const seed of[11,14,18,50])for(const terrain of['Plains','Forest','RiverValley','Mountains','Desert'])for(const river of[false,true]){
  const recipes=[]
  for(const quality of['low','balanced','high']){
   let world,physics
   try{
    const scene=new Scene();world=createWorld(scene,{seed,terrain,river,quality});physics=new MotionWorld(world)
    const nearest=Math.min(...world.wildlife.map(a=>Math.hypot(a.position.x,a.position.z-20)))
    report.furthestNearestTarget=Math.max(report.furthestNearestTarget,nearest)
    report.furthestFirstDeer=Math.max(report.furthestFirstDeer,Math.hypot(world.wildlife[0].position.x,world.wildlife[0].position.z-20))
    const obstacleHash=hash(world.obstacles)
    if(quality==='low'&&terrain==='RiverValley'&&river&&baseline.some(row=>row.seed===seed)){
     const expected=baseline.find(row=>row.seed===seed)
     report.lowLayoutPreserved.push({seed,count:world.obstacles.length,sha256:obstacleHash,pass:obstacleHash===expected.sha256})
    }
    world.update({dt:1/60,time:151,speed:0,distance:0,cameraPosition:new Vector3(0,2,20),sheltered:false,weather:'clear',daylight:.8})
    const visible=[];scene.traverse(object=>{if(object instanceof InstancedMesh&&object.material instanceof MeshStandardMaterial&&object.material.map)visible.push(Array.from(object.instanceMatrix.array))})
    const recipe={obstacles:obstacleHash,locations:hash(world.locations),river:hash(world.river),visible:hash(visible),wildlife:hash(world.wildlife.map(a=>({id:a.id,animal:a.animal,position:a.position.toArray()}))),ground:hash([[-32,60],[0,20],[10,80],[0,120],[14,180]].map(([x,z])=>world.heightAt(x,z))),savedPointClear:physics.canStand(12.368190390989184,83.18313720519654)}
    recipes.push({quality,count:world.obstacles.length,recipe})
    if(recipes.length>1&&hash(recipe)!==hash(recipes[0].recipe))throw Error('Quality changed the physical recipe')
   }catch(error){report.failures.push({seed,terrain,river,quality,error:String(error)})}
   finally{physics?.dispose();world?.dispose();report.cases++}
  }
  report.rows.push({seed,terrain,river,recipes})
  await writeFile('.artifacts/tmp/quality-recipe-matrix.json',JSON.stringify(report,null,2))
  if(river)console.log(JSON.stringify({seed,terrain,cases:report.cases,failures:report.failures.length,elapsedSeconds:(Date.now()-report.started)/1000}))
 }
}finally{
 await vite.close();report.elapsedSeconds=(Date.now()-report.started)/1000;report.pass=report.cases===120&&!report.failures.length&&report.lowLayoutPreserved.every(row=>row.pass)
 await writeFile('.artifacts/tmp/quality-recipe-matrix.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,rows:undefined}));if(!report.pass)process.exitCode=1
}
