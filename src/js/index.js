import '../styles/index.css'
import * as THREE from 'three'

import BasicCharacterController from './movements/BasicCharacterController'
import ThirdPersonCamera        from './cameras/ThirdPersonCamera'
import {
  buildRoom, buildDesk, buildLaptop, buildMonitor,
  buildChair, buildShelf, buildLamp, buildWallFrame,
  buildKeyboard, buildMouse, buildCeilingLight, buildFloorPlant,
} from './room/Room'
import { InteractionManager } from './room/InteractionManager'

class OfficeApp {
  constructor() {
    this._initRenderer()
    this._initScene()
    this._initLights()
    this._buildOffice()
    this._initCharacter()
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
    this.renderer.toneMappingExposure = 0.9
    this.container.appendChild(this.renderer.domElement)
  }

  _initScene() {
    this.clock    = new THREE.Clock()
    this.prevTime = 0

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x1a1a2e)
    this.scene.fog = new THREE.Fog(0x1a1a2e, 60, 120)

    this.camera = new THREE.PerspectiveCamera(60, this.W / this.H, 0.5, 500)
    this.camera.position.set(0, 18, 30)
  }

  _initLights() {
    this.scene.add(new THREE.AmbientLight(0xffeedd, 0.4))

    const sun = new THREE.DirectionalLight(0xfff5e0, 1.8)
    sun.position.set(10, 40, 10)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.near = 0.5
    sun.shadow.camera.far  = 200
    sun.shadow.camera.left = sun.shadow.camera.bottom = -50
    sun.shadow.camera.right = sun.shadow.camera.top   =  50
    sun.shadow.bias = -0.001
    this.scene.add(sun)

    const ceilFill = new THREE.PointLight(0xfff8e7, 1.2, 60)
    ceilFill.position.set(0, 26, -10)
    this.scene.add(ceilFill)

    this.lampLight = new THREE.PointLight(0xffd580, 2.5, 28)
    this.lampLight.position.set(10, 24, -20)
    this.lampLight.castShadow = true
    this.scene.add(this.lampLight)

    this.monitorGlow = new THREE.PointLight(0x4488ff, 0.5, 18)
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
    })
  }

  _initInteractions() {
    this.interactions = new InteractionManager({
      camera:    this.camera,
      renderer:  this.renderer,
      scene:     this.scene,
      lampLight: this.lampLight,
      lampGroup: this.lampGroup,
      onCameraFocus: (pos, look) => {
        this._focusPos.copy(pos)
        this._focusLook.copy(look)
        this._focusLookCur.copy(this.camera.position)
        this._focusActive = true
      },
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

    if (this._focusActive) {
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
