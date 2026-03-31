import '../styles/index.css'
import * as THREE from 'three'

import BasicCharacterController from './movements/BasicCharacterController'
import ThirdPersonCamera        from './cameras/ThirdPersonCamera'
import {
  buildRoom, buildDesk, buildLaptop, buildMonitor,
  buildChair, buildShelf, buildLamp, buildWallFrame,
  buildKeyboard, buildMouse, buildCeilingLight, buildFloorPlant, buildSofa, buildTrashBin,
} from './room/Room'
import { InteractionManager } from './room/InteractionManager'

class OfficeApp {
  constructor() {
    this._initRenderer()
    this._initScene()
    this._initLights()
    this._buildOffice()
    this._initCharacter()
    this._initRoomView()
    this._initInteractions()
    this._setupResize()
    this._render()
  }

  _initRenderer() {
    this.container = document.getElementById('webgl-container')
    this.W = this.container.offsetWidth
    this.H = this.container.offsetHeight

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(this.W, this.H)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1
    this.renderer.outputEncoding = THREE.sRGBEncoding
    this.container.appendChild(this.renderer.domElement)
  }

  _initScene() {
    this.clock    = new THREE.Clock()
    this.prevTime = 0

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x101820)
    this.scene.fog = new THREE.Fog(0x101820, 52, 110)

    this.camera = new THREE.PerspectiveCamera(60, this.W / this.H, 0.5, 500)
    this.camera.position.set(0, 16, 14)
  }

  _initLights() {
    const hemi = new THREE.HemisphereLight(0xf5efe6, 0x1a2230, 0.75)
    this.scene.add(hemi)

    this.scene.add(new THREE.AmbientLight(0xfff1dc, 0.2))

    const sun = new THREE.DirectionalLight(0xfff3dc, 1.35)
    sun.position.set(-18, 34, 14)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.near = 0.5
    sun.shadow.camera.far  = 200
    sun.shadow.camera.left = sun.shadow.camera.bottom = -50
    sun.shadow.camera.right = sun.shadow.camera.top   =  50
    sun.shadow.bias = -0.001
    this.scene.add(sun)

    const ceilFill = new THREE.PointLight(0xfff4dd, 1.6, 65)
    ceilFill.position.set(0, 25, -12)
    this.scene.add(ceilFill)

    this.lampLight = new THREE.PointLight(0xffcc78, 2.2, 24)
    this.lampLight.position.set(10, 24, -20)
    this.lampLight.castShadow = true
    this.scene.add(this.lampLight)

    this.monitorGlow = new THREE.PointLight(0x6da8ff, 0.65, 20)
    this.monitorGlow.position.set(1, 18, -20)
    this.scene.add(this.monitorGlow)
  }

  _buildOffice() {
    buildRoom(this.scene)
    buildCeilingLight(this.scene)

    this.deskGroup    = buildDesk(this.scene)
    this.laptopGroup  = buildLaptop(this.scene)
    this.monitorGroup = buildMonitor(this.scene)
    this.chairGroup   = buildChair(this.scene)
    this.shelfGroup   = buildShelf(this.scene)
    this.lampGroup    = buildLamp(this.scene)
    this.frameGroup   = buildWallFrame(this.scene)
    buildKeyboard(this.scene)
    buildMouse(this.scene)
    buildFloorPlant(this.scene)
    buildSofa(this.scene)
    buildTrashBin(this.scene)
  }

  _initCharacter() {
    this.controls = new BasicCharacterController({
      camera: this.camera,
      scene:  this.scene,
      path:   '/models/girl/',
    })

    this.thirdPersonCamera = new ThirdPersonCamera({
      camera: this.camera,
      target: this.controls,
    })

    // Camera focus state
    this._focusActive  = false
    this._focusPos     = new THREE.Vector3()
    this._focusLook    = new THREE.Vector3()
    this._focusLookCur = new THREE.Vector3()

    // Return to third-person on any movement key
    const moveKeys = new Set(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'])
    window.addEventListener('keydown', (e) => {
      if (moveKeys.has(e.key.toLowerCase()) && this._focusActive) {
        this._focusActive = false
      }

      if (moveKeys.has(e.key.toLowerCase()) && this._inspectMode) {
        this._setInspectMode(false)
      }
    })
  }

  _initRoomView() {
    this._inspectMode = false
    this._inspectTarget = new THREE.Vector3(0, 10, -17)
    this._inspectPosition = new THREE.Vector3(24, 20, 22)
    this._inspectRadius = this._inspectPosition.distanceTo(this._inspectTarget)
    this._inspectTheta = Math.atan2(
      this._inspectPosition.x - this._inspectTarget.x,
      this._inspectPosition.z - this._inspectTarget.z
    )
    this._inspectPhi = 0.85
    this._inspectDragging = false
    this._inspectPointerDown = false
    this._inspectStart = new THREE.Vector2()
    this._inspectLast = new THREE.Vector2()
    this._blockSceneClickUntil = 0

    const dom = this.renderer.domElement
    dom.addEventListener('mousedown', this._onInspectPointerDown.bind(this))
    dom.addEventListener('mousemove', this._onInspectPointerMove.bind(this))
    dom.addEventListener('mouseup', this._onInspectPointerUp.bind(this))
    dom.addEventListener('mouseleave', this._onInspectPointerUp.bind(this))
    dom.addEventListener('wheel', this._onInspectWheel.bind(this), { passive: false })
  }

  _setInspectMode(active) {
    this._inspectMode = active
    this._focusActive = false

    if (active) {
      this._applyInspectCamera()
    }

    document.body.style.cursor = active ? 'grab' : 'default'
  }

  _applyInspectCamera() {
    const sinPhiRadius = Math.sin(this._inspectPhi) * this._inspectRadius
    this.camera.position.set(
      this._inspectTarget.x + sinPhiRadius * Math.sin(this._inspectTheta),
      this._inspectTarget.y + Math.cos(this._inspectPhi) * this._inspectRadius,
      this._inspectTarget.z + sinPhiRadius * Math.cos(this._inspectTheta)
    )
    this.camera.lookAt(this._inspectTarget)
  }

  _onInspectPointerDown(e) {
    if (e.button !== 0 || document.querySelector('.panel:not(.hidden)')) return
    this._inspectPointerDown = true
    this._inspectDragging = false
    this._inspectStart.set(e.clientX, e.clientY)
    this._inspectLast.set(e.clientX, e.clientY)
  }

  _onInspectPointerMove(e) {
    if (!this._inspectPointerDown || document.querySelector('.panel:not(.hidden)')) return

    const moveX = e.clientX - this._inspectStart.x
    const moveY = e.clientY - this._inspectStart.y
    const distance = Math.hypot(moveX, moveY)

    if (!this._inspectDragging && distance > 6) {
      this._setInspectMode(true)
      this._inspectDragging = true
      this._blockSceneClickUntil = performance.now() + 220
    }

    if (!this._inspectDragging) return

    const deltaX = e.clientX - this._inspectLast.x
    const deltaY = e.clientY - this._inspectLast.y
    this._inspectLast.set(e.clientX, e.clientY)

    this._inspectTheta -= deltaX * 0.008
    this._inspectPhi = THREE.MathUtils.clamp(this._inspectPhi + deltaY * 0.008, 0.45, 1.35)
    this._applyInspectCamera()
    document.body.style.cursor = 'grabbing'
  }

  _onInspectPointerUp() {
    this._inspectPointerDown = false
    document.body.style.cursor = this._inspectMode ? 'grab' : 'default'
    requestAnimationFrame(() => { this._inspectDragging = false })
  }

  _onInspectWheel(e) {
    if (!this._inspectMode || document.querySelector('.panel:not(.hidden)')) return
    e.preventDefault()
    this._inspectRadius = THREE.MathUtils.clamp(this._inspectRadius + e.deltaY * 0.02, 16, 58)
    this._applyInspectCamera()
  }

  _initInteractions() {
    this.interactions = new InteractionManager({
      camera:    this.camera,
      renderer:  this.renderer,
      scene:     this.scene,
      lampLight: this.lampLight,
      lampGroup: this.lampGroup,
      frameGroups: [this.frameGroup],
      onCameraFocus: (pos, look) => {
        this._setInspectMode(false)
        this._focusPos.copy(pos)
        this._focusLook.copy(look)
        this._focusLookCur.copy(this.camera.position)
        this._focusActive = true
      },
      isInspectMode: () => this._inspectMode,
      shouldBlockClick: () => performance.now() < this._blockSceneClickUntil,
      // camera focus targets updated for new layout
    })

    this.interactions.register(this.lampGroup,    'lamp',    '💡 Click to toggle lamp on/off')
    this.interactions.register(this.laptopGroup,  'laptop',  '💻 Click to open laptop')
    this.interactions.register(this.monitorGroup, 'monitor', '🖥️ Click to view project showcase')
    this.interactions.register(this.chairGroup,   'chair',   '🪑 Click to focus desk view')
    this.interactions.register(this.deskGroup,    'desk',    '🖥 Click to focus desk area')
    this.interactions.register(this.shelfGroup,   'shelf',   '📚 Click to browse bookshelf')
    this.interactions.register(this.frameGroup,   'frame',   '🎨 Click to open Art Studio')
  }

  _setupResize() {
    window.addEventListener('resize', () => {
      this.W = this.container.offsetWidth
      this.H = this.container.offsetHeight
      this.camera.aspect = this.W / this.H
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(this.W, this.H)
    })
  }

  _render() {
    requestAnimationFrame(this._render.bind(this))

    const elapsed   = this.clock.getElapsedTime()
    const deltaTime = elapsed - this.prevTime
    this.prevTime   = elapsed

    // Subtle monitor glow pulse
    this.monitorGlow.intensity = 0.5 + Math.sin(elapsed * 1.2) * 0.15

    this.controls?.update(deltaTime)

    if (this._inspectMode) {
      this.camera.lookAt(this._inspectTarget)
    } else if (this._focusActive) {
      // Smooth camera lerp to focus position
      this.camera.position.lerp(this._focusPos, 0.05)
      this._focusLookCur.lerp(this._focusLook, 0.05)
      this.camera.lookAt(this._focusLookCur)
    } else {
      this.thirdPersonCamera?.update(deltaTime)
    }

    this.interactions?.update()
    this.renderer.render(this.scene, this.camera)
  }
}

window.addEventListener('DOMContentLoaded', () => { new OfficeApp() })
