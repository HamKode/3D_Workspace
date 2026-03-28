import * as THREE from 'three'

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, ...opts })
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d)
const cyl = (rt, rb, h, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s)

function mkMesh(geo, material, castShadow = true, receiveShadow = false) {
  const m = new THREE.Mesh(geo, material)
  m.castShadow = castShadow
  m.receiveShadow = receiveShadow
  return m
}

export function buildRoom(scene) {
  const W = 60, H = 28, D = 50
  const wallMat  = mat(0xd8cfbf, { roughness: 0.98 })
  const floorMat = mat(0x6d5238, { roughness: 0.92, metalness: 0.02 })
  const ceilMat  = mat(0xf5f1e8, { roughness: 1 })

  const floor = mkMesh(box(W, 0.5, D), floorMat, false, true)
  floor.position.set(0, 0, 0)
  scene.add(floor)

  const backWall = mkMesh(box(W, H, 0.5), wallMat, false, true)
  backWall.position.set(0, H / 2, -D / 2)
  scene.add(backWall)

  const leftWall = mkMesh(box(0.5, H, D), wallMat, false, true)
  leftWall.position.set(-W / 2, H / 2, 0)
  scene.add(leftWall)

  const rightWall = mkMesh(box(0.5, H, D), wallMat, false, true)
  rightWall.position.set(W / 2, H / 2, 0)
  scene.add(rightWall)

  const ceil = mkMesh(box(W, 0.5, D), ceilMat, false, false)
  ceil.position.set(0, H, 0)
  scene.add(ceil)

  const accentWall = mkMesh(box(W - 6, H - 6, 0.18), mat(0xc6baa5, { roughness: 1 }), false, true)
  accentWall.position.set(0, H / 2, -D / 2 + 0.36)
  scene.add(accentWall)

  const rug = mkMesh(box(22, 0.12, 15), mat(0x2b3244, { roughness: 1 }), false, true)
  rug.position.set(0, 0.32, -9)
  scene.add(rug)

  const rugInset = mkMesh(box(18, 0.05, 11), mat(0x7c8fa6, { roughness: 1 }), false, true)
  rugInset.position.set(0, 0.41, -9)
  scene.add(rugInset)

  // Skirting boards
  const skirtMat = mat(0x6b5a3e)
  const skirts = [
    { pos: [0, 0.6, -D / 2 + 0.3], ry: 0, w: W },
    { pos: [-W / 2 + 0.3, 0.6, 0], ry: Math.PI / 2, w: D },
    { pos: [W / 2 - 0.3, 0.6, 0],  ry: Math.PI / 2, w: D },
  ]
  skirts.forEach(({ pos, ry, w }) => {
    const s = mkMesh(box(w, 1.2, 0.3), skirtMat)
    s.position.set(...pos)
    s.rotation.y = ry
    scene.add(s)
  })

  const ceilingTrimMat = mat(0xe8dece, { roughness: 0.92 })
  const trims = [
    { pos: [0, H - 0.7, -D / 2 + 0.3], ry: 0, w: W },
    { pos: [-W / 2 + 0.3, H - 0.7, 0], ry: Math.PI / 2, w: D },
    { pos: [W / 2 - 0.3, H - 0.7, 0],  ry: Math.PI / 2, w: D },
  ]
  trims.forEach(({ pos, ry, w }) => {
    const trim = mkMesh(box(w, 0.9, 0.28), ceilingTrimMat, false, false)
    trim.position.set(...pos)
    trim.rotation.y = ry
    scene.add(trim)
  })
}

export function buildDesk(scene) {
  const group = new THREE.Group()
  const woodTone = 0x4A2C27
  const woodMat = mat(woodTone, { roughness: 0.72 })
  const legMat  = mat(0x39221f, { roughness: 0.64 })

  // Tabletop — wide desk against back wall
  const top = mkMesh(box(24, 0.8, 11), woodMat)
  top.position.set(0, 8.4, 0)
  group.add(top)

  // 4 legs
  ;[[-11, 4, -4.5], [11, 4, -4.5], [-11, 4, 4.5], [11, 4, 4.5]].forEach(([x, y, z]) => {
    const leg = mkMesh(box(0.8, 8.4, 0.8), legMat)
    leg.position.set(x, y, z)
    group.add(leg)
  })

  // Drawer pedestal — right side under desk
  const drawer = mkMesh(box(5, 7, 10), mat(woodTone, { roughness: 0.82 }))
  drawer.position.set(9, 4, 0)
  group.add(drawer)
  // Drawer handle
  const handle = mkMesh(box(2, 0.3, 0.3), mat(0xaaaaaa, { metalness: 0.8, roughness: 0.2 }))
  handle.position.set(9, 6.5, 5.2)
  group.add(handle)

  // Desk — centered against back wall (Z = -25 + half desk depth + small gap)
  group.position.set(0, 0.25, -19)
  scene.add(group)
  return group
}

export function buildLaptop(scene) {
  const group = new THREE.Group()
  const bodyMat   = mat(0x2a2a2a, { roughness: 0.3, metalness: 0.7 })
  const screenMat = mat(0x0a1628, { roughness: 0.1, emissive: 0x0a1628 })

  const base = mkMesh(box(7, 0.3, 5), bodyMat)
  group.add(base)

  const screenGroup = new THREE.Group()
  screenGroup.add(mkMesh(box(7, 0.2, 5), bodyMat))
  const display = mkMesh(box(6.4, 0.05, 4.2), screenMat)
  display.position.set(0, 0, -0.1)
  screenGroup.add(display)
  screenGroup.rotation.x = -1.45
  screenGroup.position.set(0, 0.15, -2.2)
  group.add(screenGroup)

  const keyMat = mat(0x1a1a1a)
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 10; c++) {
      const key = mkMesh(box(0.45, 0.08, 0.35), keyMat)
      key.position.set(-2.5 + c * 0.55, 0.19, -0.8 + r * 0.5)
      group.add(key)
    }
  }

  // Left side of desk, slightly angled — natural placement
  group.position.set(-7, 9.08, -21.4)
  group.rotation.y = 0.12
  scene.add(group)
  return group
}

export function buildMonitor(scene) {
  const group = new THREE.Group()
  const frameMat  = mat(0x1c1c1c, { roughness: 0.4, metalness: 0.5 })
  const screenMat = mat(0x050d1a, { roughness: 0.05, emissive: 0x0d2040, emissiveIntensity: 0.4 })

  const panel = mkMesh(box(14, 8, 0.4), frameMat)
  group.add(panel)

  const display = mkMesh(box(13, 7.2, 0.1), screenMat)
  display.position.z = 0.26
  group.add(display)

  const neck = mkMesh(box(0.6, 4, 0.6), frameMat)
  neck.position.set(0, -6, 0)
  group.add(neck)

  const standBase = mkMesh(box(5, 0.3, 3), frameMat)
  standBase.position.set(0, -8, 0)
  group.add(standBase)

  // Centered on desk, pushed toward back wall
  group.position.set(1, 17.8, -22.5)
  scene.add(group)
  return group
}

export function buildChair(scene) {
  const group = new THREE.Group()
  const fabricMat = mat(0x1a1a2e, { roughness: 0.9 })
  const metalMat  = mat(0x555555, { roughness: 0.3, metalness: 0.8 })

  const seat = mkMesh(box(8, 0.8, 8), fabricMat)
  seat.position.set(0, 7, 0)
  group.add(seat)

  const back = mkMesh(box(8, 9, 0.8), fabricMat)
  back.position.set(0, 12, -3.8)
  back.rotation.x = 0.1
  group.add(back)

  const head = mkMesh(box(5, 3, 0.8), fabricMat)
  head.position.set(0, 17.5, -4)
  group.add(head)

  ;[-3.5, 3.5].forEach((x) => {
    const arm = mkMesh(box(0.8, 0.5, 5), fabricMat)
    arm.position.set(x, 9.5, -1)
    group.add(arm)
    const pole = mkMesh(box(0.5, 3, 0.5), metalMat)
    pole.position.set(x, 7.5, -1)
    group.add(pole)
  })

  const gasCyl = mkMesh(cyl(0.5, 0.5, 5), metalMat)
  gasCyl.position.set(0, 3.5, 0)
  group.add(gasCyl)

  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2
    const spoke = mkMesh(box(5, 0.3, 0.5), metalMat)
    spoke.position.set(Math.cos(angle) * 2.5, 1, Math.sin(angle) * 2.5)
    spoke.rotation.y = angle
    group.add(spoke)
    const wheel = mkMesh(cyl(0.5, 0.5, 0.6, 8), mat(0x111111))
    wheel.rotation.z = Math.PI / 2
    wheel.position.set(Math.cos(angle) * 5, 0.8, Math.sin(angle) * 5)
    group.add(wheel)
  }

  // Pulled out from desk, centered, facing the desk (rotated 180°)
  group.position.set(0, 0.25, -10)
  group.rotation.y = Math.PI
  group.scale.set(0.82, 0.84, 0.72)
  scene.add(group)
  return group
}

export function buildShelf(scene) {
  const group = new THREE.Group()
  const woodTone = 0x4A2C27
  const woodMat = mat(woodTone, { roughness: 0.82 })

  // Back panel flush against right wall
  const back = mkMesh(box(20, 18, 0.5), mat(0x3c2421, { roughness: 0.9 }))
  back.position.set(0, 9, 0)
  group.add(back)

  // 3 shelves
  ;[2, 8, 14].forEach((y) => {
    const shelf = mkMesh(box(20, 0.6, 7), woodMat)
    shelf.position.set(0, y, 3.5)
    group.add(shelf)
  })

  // Side panels
  ;[-10, 10].forEach((x) => {
    const side = mkMesh(box(0.5, 18, 7), woodMat)
    side.position.set(x, 9, 3.5)
    group.add(side)
  })

  // Books on bottom shelf
  const bookColors = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c]
  bookColors.forEach((c, i) => {
    const book = mkMesh(box(1.6, 5, 5), mat(c, { roughness: 0.9 }))
    book.position.set(-7.5 + i * 3, 4.8, 3.5)
    group.add(book)
  })

  // Middle shelf — small items: photo frame, small box
  const photoFrame = mkMesh(box(3, 4, 0.3), mat(woodTone, { roughness: 0.75 }))
  photoFrame.position.set(-6, 10.5, 3.5)
  group.add(photoFrame)
  const photoCanvas = mkMesh(box(2.4, 3.2, 0.1), mat(0x87ceeb))
  photoCanvas.position.set(-6, 10.5, 3.7)
  group.add(photoCanvas)

  const smallBox = mkMesh(box(3, 2.5, 3), mat(0x555577, { roughness: 0.8 }))
  smallBox.position.set(5, 9.5, 3.5)
  group.add(smallBox)

  // Top shelf — trophy + plant
  const trophyBase = mkMesh(box(2, 0.5, 2), mat(0xf1c40f))
  trophyBase.position.set(-5, 15.3, 3.5)
  group.add(trophyBase)
  const trophyCup = mkMesh(cyl(1, 0.6, 2.5, 8), mat(0xf1c40f, { metalness: 0.8, roughness: 0.2 }))
  trophyCup.position.set(-5, 17, 3.5)
  group.add(trophyCup)

  const pot = mkMesh(cyl(1.2, 0.9, 2.5, 8), mat(0xc0392b, { roughness: 0.8 }))
  pot.position.set(6, 15.5, 3.5)
  group.add(pot)
  const plant = mkMesh(new THREE.SphereGeometry(2.2, 8, 6), mat(0x27ae60, { roughness: 1 }))
  plant.position.set(6, 18, 3.5)
  group.add(plant)

  // Mounted on right wall — rotated 90° to face inward
  group.rotation.y = -Math.PI / 2
  group.position.set(29.5, 2, -10)
  scene.add(group)
  return group
}

export function buildLamp(scene) {
  const group = new THREE.Group()
  const metalMat = mat(0x888888, { roughness: 0.3, metalness: 0.8 })
  const shadeMat = mat(0xf5e6c8, { roughness: 0.9, side: THREE.DoubleSide })

  const base = mkMesh(cyl(1.5, 2, 1, 16), metalMat)
  base.position.set(0, 0.5, 0)
  group.add(base)

  const pole = mkMesh(cyl(0.2, 0.2, 14, 8), metalMat)
  pole.position.set(0, 8, 0)
  group.add(pole)

  const shade = mkMesh(new THREE.ConeGeometry(3.5, 4, 16, 1, true), shadeMat)
  shade.position.set(0, 16, 0)
  group.add(shade)

  const bulbMat = mat(0xfffde7, { emissive: 0xfffde7, emissiveIntensity: 1 })
  const bulb = mkMesh(new THREE.SphereGeometry(0.6, 8, 8), bulbMat)
  bulb.position.set(0, 14.5, 0)
  group.add(bulb)

  // Right corner of desk
  group.position.set(10, 9.05, -20)
  scene.add(group)
  group.userData.bulb = bulb
  group.userData.bulbMat = bulbMat
  group.userData.shadeMat = shadeMat
  return group
}

export function buildWallFrame(scene) {
  const group = new THREE.Group()
  const frameMat = mat(0x3d2b1f, { roughness: 0.7 })

  const outerFrame = mkMesh(box(14, 10, 0.4), frameMat)
  group.add(outerFrame)

  const canvas = mkMesh(box(12.5, 8.5, 0.1), mat(0xfaf0e6))
  canvas.position.z = 0.2
  group.add(canvas)

  const artColors = [0xe74c3c, 0x3498db, 0xf39c12, 0x2ecc71]
  const artRects = [
    { pos: [-2.5, 1.5, 0.31], size: [4, 4, 0.05] },
    { pos: [2.5, -1, 0.31],   size: [5, 3, 0.05] },
    { pos: [-2, -2, 0.31],    size: [3, 2, 0.05] },
    { pos: [3, 2.5, 0.31],    size: [2.5, 2.5, 0.05] },
  ]
  artRects.forEach(({ pos, size }, i) => {
    const rect = mkMesh(box(...size), mat(artColors[i], { roughness: 0.8 }))
    rect.position.set(...pos)
    group.add(rect)
  })

  // Back wall, left of monitor — art frame
  group.position.set(-14, 20, -24.6)
  scene.add(group)
  return group
}

export function buildKeyboard(scene) {
  const group = new THREE.Group()
  const bodyMat = mat(0x2c2c2c, { roughness: 0.5 })
  const keyMat  = mat(0x1a1a1a, { roughness: 0.6 })

  group.add(mkMesh(box(9, 0.4, 3.5), bodyMat))

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 12; c++) {
      const key = mkMesh(box(0.55, 0.15, 0.5), keyMat)
      key.position.set(-3.5 + c * 0.65, 0.28, -1.2 + r * 0.7)
      group.add(key)
    }
  }

  // Front-center of desk, slight angle
  group.position.set(0, 9.25, -17)
  group.rotation.y = 0
  scene.add(group)
  return group
}

export function buildMouse(scene) {
  const group = new THREE.Group()
  const body = mkMesh(new THREE.SphereGeometry(0.9, 8, 6),
    mat(0x222222, { roughness: 0.4, metalness: 0.3 }))
  body.scale.set(1, 0.55, 1.4)
  group.add(body)
  // Right of keyboard on desk
  group.position.set(6, 9.15, -17)
  scene.add(group)
  return group
}

export function buildFloorPlant(scene) {
  const group = new THREE.Group()
  // Pot
  const pot = mkMesh(cyl(2.5, 2, 5, 12), mat(0x8b4513, { roughness: 0.9 }))
  pot.position.set(0, 2.5, 0)
  group.add(pot)
  // Soil top
  const soil = mkMesh(cyl(2.4, 2.4, 0.3, 12), mat(0x3d2b1f, { roughness: 1 }))
  soil.position.set(0, 5.2, 0)
  group.add(soil)
  // Main bush
  const bush = mkMesh(new THREE.SphereGeometry(4, 10, 8), mat(0x2d8a4e, { roughness: 1 }))
  bush.position.set(0, 10, 0)
  bush.scale.set(1, 1.1, 1)
  group.add(bush)
  // Smaller accent spheres
  ;[[-2.5, 8.5, 1.5], [2, 9, -1.5], [0, 12.5, 1], [-1.5, 11, -2]].forEach(([x, y, z]) => {
    const leaf = mkMesh(new THREE.SphereGeometry(2.2, 8, 6), mat(0x27ae60, { roughness: 1 }))
    leaf.position.set(x, y, z)
    group.add(leaf)
  })
  // Left front corner — pulled away from wall to avoid clipping
  group.position.set(-22, 0.25, 6)
  scene.add(group)
  return group
}

export function buildCeilingLight(scene) {
  const group = new THREE.Group()
  const housing = mkMesh(box(12, 0.8, 6), mat(0xdddddd, { roughness: 0.5 }))
  group.add(housing)
  const panel = mkMesh(box(11, 0.1, 5),
    mat(0xfffde7, { emissive: 0xfffde7, emissiveIntensity: 0.6 }))
  panel.position.y = -0.45
  group.add(panel)
  // Centered above desk area
  group.position.set(0, 27.6, -17)
  scene.add(group)
  return group
}
