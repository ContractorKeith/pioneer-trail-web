import * as THREE from 'three'

/** Original period rifle and fishing tackle, locally authored from measured-scale geometry. */
export function createActivityProps(camera: THREE.PerspectiveCamera) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x553323, roughness: 0.56 })
  const steel = new THREE.MeshStandardMaterial({ color: 0x565950, metalness: 0.82, roughness: 0.3 })
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0xb5b2a0,
    transparent: true,
    opacity: 0.8,
  })
  const rifle = new THREE.Group(),
    rod = new THREE.Group(),
    tackle = new THREE.Group()
  const stockOutline = new THREE.Shape()
  stockOutline.moveTo(-0.09, 0)
  stockOutline.lineTo(-0.1, 0.28)
  stockOutline.quadraticCurveTo(-0.05, 0.34, 0.005, 0.26)
  stockOutline.lineTo(0.04, -0.48)
  stockOutline.lineTo(0.015, -0.65)
  stockOutline.lineTo(-0.035, -0.61)
  stockOutline.lineTo(-0.06, -0.08)
  stockOutline.closePath()
  const stock = new THREE.Mesh(
    new THREE.ExtrudeGeometry(stockOutline, {
      depth: 0.055,
      bevelEnabled: true,
      bevelSize: 0.018,
      bevelThickness: 0.016,
      bevelSegments: 3,
      steps: 1,
    }),
    wood,
  )
  stock.rotation.x = -Math.PI / 2
  rifle.add(stock)
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.019, 1.04, 12), steel)
  barrel.rotation.x = Math.PI / 2
  barrel.position.set(-0.025, 0.06, -0.33)
  rifle.add(barrel)
  for (const z of [-0.65, -0.35]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 6, 12), steel)
    band.position.set(-0.025, 0.06, z)
    rifle.add(band)
  }
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.025, 0.025), steel)
  sight.position.set(-0.025, 0.08, -0.81)
  rifle.add(sight)
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.043, 0.006, 6, 18), steel)
  guard.rotation.y = Math.PI / 2
  guard.position.set(-0.025, -0.035, 0.05)
  rifle.add(guard)
  rifle.position.set(0.25, -0.29, -0.35)
  rifle.rotation.y = -0.035
  camera.add(rifle)
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.016, 1.8, 10), wood)
  shaft.rotation.x = -Math.PI * 0.38
  rod.add(shaft)
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 18), steel)
  reel.rotation.z = Math.PI / 2
  reel.position.set(0, -0.55, 0.52)
  rod.add(reel)
  rod.position.set(0.34, -0.34, -0.8)
  camera.add(rod)
  const bobber = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xe27a48, roughness: 0.5 }),
  )
  tackle.add(bobber)
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    lineMaterial,
  )
  tackle.add(line)
  const lineTip = new THREE.Vector3()
  return {
    rifle,
    rod,
    tackle,
    bobber,
    update(kind: string | null, time: number, phase: string, waterPosition: THREE.Vector3) {
      rifle.visible = kind === 'hunt'
      rod.visible = kind === 'fish'
      tackle.visible = kind === 'fish' && phase !== 'ready'
      rifle.rotation.x = phase === 'reloading' ? 0.38 : 0
      bobber.position.copy(waterPosition)
      bobber.position.y +=
        Math.sin(time * 3) * 0.035 + (phase === 'bite' ? Math.sin(time * 16) * 0.13 : 0)
      const points = line.geometry.getAttribute('position') as THREE.BufferAttribute
      rod.updateWorldMatrix(true, true)
      shaft.localToWorld(lineTip.set(0, 0.9, 0))
      points.setXYZ(0, lineTip.x, lineTip.y, lineTip.z)
      points.setXYZ(1, bobber.position.x, bobber.position.y, bobber.position.z)
      points.needsUpdate = true
      line.geometry.computeBoundingSphere()
    },
    dispose() {
      for (const object of [rifle, rod, tackle]) {
        object.removeFromParent()
        object.traverse((child) => {
          if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
            child.geometry.dispose()
            const mats = Array.isArray(child.material) ? child.material : [child.material]
            mats.forEach((m) => m.dispose())
          }
        })
      }
    },
  }
}
