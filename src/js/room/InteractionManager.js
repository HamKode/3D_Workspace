import * as THREE from 'three'

export class InteractionManager {
  constructor({
    camera,
    renderer,
    scene,
    lampLight,
    lampGroup,
    frameGroups = [],
    onCameraFocus,
    onCameraReset,
    onChairInteract,
    onSofaInteract,
    onDeskToolInteract,
    getActiveSeat = () => null,
    isInspectMode = () => false,
    shouldBlockClick = () => false,
  }) {
    this.camera = camera
    this.renderer = renderer
    this.scene = scene
    this.lampLight = lampLight
    this.lampGroup = lampGroup
    this.frameGroups = frameGroups
    this.onCameraFocus = onCameraFocus
    this.onCameraReset = onCameraReset
    this.onChairInteract = onChairInteract
    this.onSofaInteract = onSofaInteract
    this.onDeskToolInteract = onDeskToolInteract
    this.getActiveSeat = getActiveSeat
    this.isInspectMode = isInspectMode
    this.shouldBlockClick = shouldBlockClick

    this.raycaster = new THREE.Raycaster()
    this.mouse = new THREE.Vector2(-9999, -9999)
    this._mouseX = 0
    this._mouseY = 0
    this.interactables = []
    this.lampOn = true

    this._tooltip = document.getElementById('tooltip')
    this._badge = document.getElementById('lamp-badge')
    this._badgeLabel = document.getElementById('lamp-label')
    this._toast = document.getElementById('toast')
    this._toastTimer = null

    document.querySelectorAll('.panel-close').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target
        document.getElementById(target)?.classList.add('hidden')
      })
    })

    this._artMode = 'flow'
    document.querySelectorAll('.art-mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.art-mode-btn').forEach((button) => button.classList.remove('active'))
        btn.classList.add('active')
        this._artMode = btn.dataset.mode
        this._drawArt()
      })
    })

    document.getElementById('regenerate-art')?.addEventListener('click', () => this._drawArt())

    renderer.domElement.addEventListener('mousemove', this._onMouseMove.bind(this))
    renderer.domElement.addEventListener('click', this._onClick.bind(this))
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this._closeAllPanels()
    })

    requestAnimationFrame(() => this._drawArt())
  }

  register(meshOrGroup, id, label) {
    const meshes = []
    if (meshOrGroup.isMesh) {
      meshes.push(meshOrGroup)
    } else {
      meshOrGroup.traverse((child) => {
        if (child.isMesh) meshes.push(child)
      })
    }

    meshes.forEach((mesh) => {
      mesh.userData.interactableId = id
      mesh.userData.interactableLabel = label
      this.interactables.push(mesh)
    })
  }

  _onMouseMove(e) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    this._mouseX = e.clientX
    this._mouseY = e.clientY
  }

  _onClick() {
    if (this.isInspectMode() || this.shouldBlockClick()) return
    if (document.querySelector('.panel:not(.hidden)')) return

    const hit = this._raycast()
    if (!hit) return

    const handlers = {
      lamp: () => this._toggleLamp(),
      laptop: () => this._openLaptop(),
      monitor: () => this._openMonitor(),
      chair: () => this._toggleChairInteraction(),
      'sofa-0': () => this._toggleSofaInteraction(0),
      'sofa-1': () => this._toggleSofaInteraction(1),
      desk: () => this._focusCamera('desk'),
      keyboard: () => this._useDeskTool('keyboard'),
      mouse: () => this._useDeskTool('mouse'),
      shelf: () => this._openShelf(),
      frame: () => this._openFrame(),
    }

    handlers[hit.userData.interactableId]?.()
  }

  _raycast() {
    this.raycaster.setFromCamera(this.mouse, this.camera)
    const hits = this.raycaster.intersectObjects(this.interactables)
    if (hits.length === 0) return null

    const activeSeat = this.getActiveSeat?.()
    if (activeSeat === 'chair') {
      const priority = ['keyboard', 'mouse', 'desk', 'chair']
      for (const id of priority) {
        const preferredHit = hits.find((hit) => hit.object.userData.interactableId === id)
        if (preferredHit) return preferredHit.object
      }
    }

    return hits[0].object
  }

  _toggleLamp() {
    this.lampOn = !this.lampOn

    if (this.lampLight) {
      this.lampLight.intensity = this.lampOn ? 2.5 : 0
      this.lampLight.color.set(this.lampOn ? 0xffd580 : 0x000000)
    }

    if (this.lampGroup?.userData.bulbMat) {
      const bulbMat = this.lampGroup.userData.bulbMat
      bulbMat.emissiveIntensity = this.lampOn ? 1 : 0
      bulbMat.color.set(this.lampOn ? 0xfffde7 : 0x333333)
    }

    if (this.lampGroup?.userData.shadeMat) {
      this.lampGroup.userData.shadeMat.color.set(this.lampOn ? 0xf5e6c8 : 0x2a2a2a)
    }

    this._badge.className = this.lampOn ? 'lamp-on' : 'lamp-off'
    this._badgeLabel.textContent = this.lampOn ? 'Lamp ON' : 'Lamp OFF'
    this._showToast(this.lampOn ? 'Lamp turned ON' : 'Lamp turned OFF')
  }

  _openLaptop() {
    this._closeAllPanels()
    document.getElementById('laptop-overlay').classList.remove('hidden')
  }

  _openMonitor() {
    this._closeAllPanels()
    document.getElementById('monitor-overlay').classList.remove('hidden')
  }

  _focusCamera(target) {
    const targets = {
      chair: {
        pos: new THREE.Vector3(18.5, 15.6, -7.8),
        look: new THREE.Vector3(0.4, 10.7, -20.9),
        fov: 34,
        positionLerp: 0.07,
        lookLerp: 0.09,
      },
      desk: {
        pos: new THREE.Vector3(0.8, 27.2, -20.6),
        look: new THREE.Vector3(0.8, 9.2, -20.6),
        fov: 36,
        positionLerp: 0.08,
        lookLerp: 0.1,
      },
      sofa: {
        pos: new THREE.Vector3(-6.8, 14.2, 20.4),
        look: new THREE.Vector3(-26.7, 6.4, 5.8),
        fov: 40,
        positionLerp: 0.08,
        lookLerp: 0.1,
      },
    }

    const focus = targets[target]
    if (!focus) return

    this.onCameraFocus?.(focus)

    const messages = {
      chair: 'Desk and monitor view active - press any move key to return',
      desk: 'Monitor close-up active - press any move key to return',
      sofa: 'Sofa view active - press any move key to return',
    }
    this._showToast(messages[target] || 'View active - press any move key to return')
  }

  _toggleChairInteraction() {
    const action = this.onChairInteract?.()
    if (action === 'sit') {
      this._focusCamera('chair')
      this._showToast('Chair mode active - click the keyboard or mouse to start working, or click the chair again to stand')
      return
    }

    if (action === 'stand') {
      this.onCameraReset?.()
      this._showToast('Character stood up from the chair')
      return
    }

    this._focusCamera('chair')
  }

  _toggleSofaInteraction(seatIndex) {
    const action = this.onSofaInteract?.(seatIndex)
    if (action === 'sit') {
      this._focusCamera('sofa')
      this._showToast('Sofa mode active - click the sofa again or press a move key to stand')
      return
    }

    if (action === 'stand') {
      this.onCameraReset?.()
      this._showToast('Character stood up from the sofa')
      return
    }

    this._focusCamera('sofa')
  }

  _useDeskTool(tool) {
    const used = this.onDeskToolInteract?.(tool)
    if (!used) {
      this._showToast('Seat the character on the chair first, then use the desk controls')
      return
    }

    this._focusCamera('desk')
    this._showToast(
      tool === 'keyboard'
        ? 'Keyboard interaction active - hands are aligned for typing'
        : 'Mouse interaction active - right hand moved onto the mouse'
    )
  }

  _openShelf() {
    this._closeAllPanels()
    document.getElementById('shelf-overlay').classList.remove('hidden')
  }

  _openFrame() {
    this._closeAllPanels()
    document.getElementById('frame-overlay').classList.remove('hidden')
    requestAnimationFrame(() => this._drawArt())
  }

  _drawArt() {
    const canvas = document.getElementById('art-canvas')
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    const seed = Math.random() * 9999 | 0
    const rng = (s) => {
      const x = Math.sin(s) * 43758.5453
      return x - Math.floor(x)
    }

    const palettes = [
      ['#e74c3c', '#e67e22', '#f1c40f', '#e91e63'],
      ['#3498db', '#1abc9c', '#7eb8f7', '#00bcd4'],
      ['#9b59b6', '#3498db', '#e74c3c', '#f39c12'],
      ['#2ecc71', '#1abc9c', '#7eb8f7', '#f1c40f'],
    ]
    const paletteNames = ['Ember', 'Ocean', 'Cosmic', 'Forest']
    const palette = palettes[seed % palettes.length]

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#04040c'
    ctx.fillRect(0, 0, W, H)

    if (this._artMode === 'flow') {
      const cols = 40
      const rows = 20
      const cellW = W / cols
      const cellH = H / rows
      for (let i = 0; i < 180; i++) {
        let x = rng(seed + i * 3.1) * W
        let y = rng(seed + i * 7.3) * H
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.strokeStyle = palette[i % palette.length]
        ctx.globalAlpha = 0.55
        ctx.lineWidth = 1.2

        for (let step = 0; step < 60; step++) {
          const col = Math.floor(x / cellW)
          const row = Math.floor(y / cellH)
          const angle = rng(seed + col * 13 + row * 7) * Math.PI * 4
          x += Math.cos(angle) * 3.5
          y += Math.sin(angle) * 3.5
          if (x < 0 || x > W || y < 0 || y > H) break
          ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      ctx.globalAlpha = 0.9
      for (let i = 0; i < 40; i++) {
        ctx.beginPath()
        ctx.arc(rng(seed + i * 2.1) * W, rng(seed + i * 5.7) * H, 1.5, 0, Math.PI * 2)
        ctx.fillStyle = '#ffffff'
        ctx.fill()
      }

      document.getElementById('art-algo-label').textContent = 'Flow Field · Vector Noise'
      document.getElementById('art-particles').textContent = '180'
    } else if (this._artMode === 'geo') {
      const cx = W / 2
      const cy = H / 2
      const drawPoly = (x, y, r, sides, rot, color, alpha) => {
        ctx.beginPath()
        for (let i = 0; i <= sides; i++) {
          const a = (i / sides) * Math.PI * 2 + rot
          if (i === 0) {
            ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
          } else {
            ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
          }
        }
        ctx.strokeStyle = color
        ctx.globalAlpha = alpha
        ctx.lineWidth = 1
        ctx.stroke()
      }

      for (let r = 10; r < 130; r += 14) {
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.strokeStyle = palette[Math.floor(r / 14) % palette.length]
        ctx.globalAlpha = 0.22
        ctx.lineWidth = 0.8
        ctx.stroke()
      }

      ;[3, 4, 5, 6, 7, 8].forEach((sides, i) => {
        drawPoly(cx, cy, 20 + i * 18, sides, rng(seed + i) * Math.PI, palette[i % palette.length], 0.7)
      })

      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        ctx.beginPath()
        ctx.arc(cx + Math.cos(a) * 90, cy + Math.sin(a) * 90, 6, 0, Math.PI * 2)
        ctx.strokeStyle = palette[i % palette.length]
        ctx.globalAlpha = 0.5
        ctx.lineWidth = 0.8
        ctx.stroke()
      }

      ctx.globalAlpha = 0.1
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 0.5
      for (let i = 0; i < 12; i++) {
        const a1 = (i / 12) * Math.PI * 2
        const a2 = ((i + 5) / 12) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a1) * 90, cy + Math.sin(a1) * 90)
        ctx.lineTo(cx + Math.cos(a2) * 90, cy + Math.sin(a2) * 90)
        ctx.stroke()
      }

      document.getElementById('art-algo-label').textContent = 'Sacred Geometry · Recursive'
      document.getElementById('art-particles').textContent = '18'
    } else if (this._artMode === 'wave') {
      const layers = 12
      for (let l = 0; l < layers; l++) {
        const freq = 1.5 + rng(seed + l * 2.1) * 4
        const amp = 20 + rng(seed + l * 3.7) * 50
        const phase = rng(seed + l * 5.3) * Math.PI * 2
        const yBase = (H / (layers + 1)) * (l + 1)
        ctx.beginPath()
        ctx.moveTo(0, yBase)

        for (let x = 0; x <= W; x += 2) {
          const y = yBase
            + Math.sin((x / W) * Math.PI * 2 * freq + phase) * amp
            + Math.sin((x / W) * Math.PI * 2 * freq * 0.5 + phase * 1.3) * (amp * 0.4)
          ctx.lineTo(x, y)
        }

        ctx.strokeStyle = palette[l % palette.length]
        ctx.globalAlpha = 0.5
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.lineTo(W, H)
        ctx.lineTo(0, H)
        ctx.closePath()
        ctx.fillStyle = palette[l % palette.length]
        ctx.globalAlpha = 0.04
        ctx.fill()
      }

      ctx.globalAlpha = 0.8
      for (let i = 0; i < 30; i++) {
        ctx.beginPath()
        ctx.arc(rng(seed + i * 4.1) * W, rng(seed + i * 6.3) * H, 1.2, 0, Math.PI * 2)
        ctx.fillStyle = '#ffffff'
        ctx.fill()
      }

      document.getElementById('art-algo-label').textContent = 'Wave Interference · Sine'
      document.getElementById('art-particles').textContent = String(layers)
    }

    ctx.globalAlpha = 1
    document.getElementById('art-seed').textContent = `#${seed.toString(16).toUpperCase().padStart(4, '0')}`
    document.getElementById('art-palette').textContent = paletteNames[seed % paletteNames.length]

    const texture = new THREE.CanvasTexture(canvas)
    this.frameGroups.forEach((group) => {
      group.children.forEach((child) => {
        if (child.material && child.material.color && child.material.color.getHex() === 0xfaf0e6) {
          child.material.map = texture
          child.material.needsUpdate = true
        }
      })
    })
  }

  _closeAllPanels() {
    document.querySelectorAll('.panel').forEach((panel) => panel.classList.add('hidden'))
  }

  _showToast(msg) {
    this._toast.textContent = msg
    this._toast.classList.remove('hidden')
    clearTimeout(this._toastTimer)
    this._toastTimer = setTimeout(() => this._toast.classList.add('hidden'), 2800)
  }

  update() {
    if (this.isInspectMode()) {
      this._tooltip.classList.add('hidden')
      document.body.style.cursor = 'grab'
      return
    }

    if (document.querySelector('.panel:not(.hidden)')) {
      this._tooltip.classList.add('hidden')
      document.body.style.cursor = 'default'
      return
    }

    const hit = this._raycast()
    if (hit?.userData.interactableLabel) {
      this._tooltip.textContent = hit.userData.interactableLabel
      this._tooltip.style.left = `${this._mouseX + 16}px`
      this._tooltip.style.top = `${this._mouseY - 12}px`
      this._tooltip.classList.remove('hidden')
      document.body.style.cursor = 'pointer'
      return
    }

    this._tooltip.classList.add('hidden')
    document.body.style.cursor = 'default'
  }
}
