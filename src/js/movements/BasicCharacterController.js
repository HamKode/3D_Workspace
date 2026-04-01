import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'

import CharacterFSM from '../fsm/CharacterFSM'

import BasicCharacterControllerInput from './BasicCharacterControllerInput'
import BasicCharacterControllerProxy from './BasicCharacterControllerProxy'

import { hideLoader } from '../../utils/loader'

class BasicCharacterController {
  constructor(params) {
    this.params = params

    this.decceleration = new THREE.Vector3(-0.0005, -0.0001, -5.0)
    this.acceleration = new THREE.Vector3(1.0, 0.25, 50.0)
    this.velocity = new THREE.Vector3(0, 0, 0)
    this._position = new THREE.Vector3()

    this._tmpVecA = new THREE.Vector3()
    this._tmpVecB = new THREE.Vector3()
    this._tmpQuatA = new THREE.Quaternion()
    this._tmpQuatB = new THREE.Quaternion()
    this._tmpEuler = new THREE.Euler()

    this.animations = {}
    this.bones = {}
    this._boneBaseRotations = new Map()
    this._animatedBoneRotations = new Map()
    this._clock = 0

    // Mouse delta for hand-follow feature
    this._mouseDeltaX = 0
    this._mouseDeltaY = 0
    this._mouseSmoothedX = 0
    this._mouseSmoothedY = 0

    // E key edge-detection
    this._prevInteractKey = false

    window.addEventListener('mousemove', (e) => {
      if (this._interaction.mode === 'mouse') {
        this._mouseDeltaX = THREE.MathUtils.clamp(e.movementX * 0.01, -0.6, 0.6)
        this._mouseDeltaY = THREE.MathUtils.clamp(e.movementY * 0.01, -0.4, 0.4)
      }
    })

    // Debug: press P to log arm bones in current pose
    window.addEventListener('keydown', (e) => {
      if (e.key === 'p' || e.key === 'P') this.debugLogArmBones()
    })

    this._interaction = {
      mode: 'free',
      seat: 'chair',
      targetPosition: new THREE.Vector3(0, 0, 0),
      targetQuaternion: new THREE.Quaternion(),
      standPosition: new THREE.Vector3(0, 0, -4.8),
      standQuaternion: new THREE.Quaternion(),
      seatPosition: new THREE.Vector3(0, 0, -10.55),
      seatQuaternion: new THREE.Quaternion(),
      poseWeight: 0,
      deskWeight: 0,
    }
    this._seatTargets = {
      chair: {
        position: new THREE.Vector3(0, 0, -10.55),
        quaternion: new THREE.Quaternion(),
      },
      sofa0: {
        position: new THREE.Vector3(-26.2, 0, 0.3),
        quaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2),
      },
      sofa1: {
        position: new THREE.Vector3(-26.2, 0, 11.3),
        quaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2),
      },
    }

    this.input = new BasicCharacterControllerInput()
    this.stateMachine = new CharacterFSM(
      new BasicCharacterControllerProxy(this.animations)
    )

    this.loadModels()
  }

  loadModels() {
    const loader = new FBXLoader()
    loader.setPath(this.params.path)

    loader.load('eve_j_gonzales.fbx', (fbx) => {
      fbx.scale.setScalar(0.1)
      fbx.traverse((child) => {
        child.castShadow = true
      })

      const modelRoot = new THREE.Group()
      modelRoot.position.set(0, 0, 0)

      fbx.rotation.y = Math.PI
      modelRoot.add(fbx)

      this.target = modelRoot
      this._position.copy(modelRoot.position)
      this._interaction.targetPosition.copy(modelRoot.position)
      this._interaction.targetQuaternion.copy(modelRoot.quaternion)

      this.params.scene.add(modelRoot)

      this.mixer = new THREE.AnimationMixer(fbx)
      this._cacheBones(fbx)

      this.manager = new THREE.LoadingManager()
      this.manager.onLoad = () => {
        this.stateMachine.setState('idle')
      }

      const onLoadAnimation = (name, data) => {
        const clip = data.animations[0]
        const action = this.mixer.clipAction(clip)
        this.animations[name] = { clip, action }
      }

      const loaderWithManager = new FBXLoader(this.manager)
      loaderWithManager.setPath(this.params.path)

      loaderWithManager.load('walk.fbx', (data) => onLoadAnimation('walk', data))
      loaderWithManager.load('idle.fbx', (data) => onLoadAnimation('idle', data))
      loaderWithManager.load('dance.fbx', (data) => onLoadAnimation('dance', data))
      loaderWithManager.load('run.fbx', (data) => {
        onLoadAnimation('run', data)
        hideLoader()
      })
    })
  }

  update(time) {
    if (!this.target) return

    this._clock += time
    console.log('update running, mode:', this._interaction.mode)

    const isInteractive = this._interaction.mode !== 'free'
    if (isInteractive && this.stateMachine.currentState?.name !== 'idle') {
      this.stateMachine.setState('idle')
    }

    // E key: sit/stand toggle
    this._handleInteractKey()

    if (!isInteractive) {
      this.stateMachine.update(time, this.input)
      this._applyFreeMovement(time)
    } else {
      this.velocity.set(0, 0, 0)
    }

    // Smooth mouse delta decay
    this._mouseSmoothedX = THREE.MathUtils.lerp(this._mouseSmoothedX, this._mouseDeltaX, 0.12)
    this._mouseSmoothedY = THREE.MathUtils.lerp(this._mouseSmoothedY, this._mouseDeltaY, 0.12)
    this._mouseDeltaX = THREE.MathUtils.lerp(this._mouseDeltaX, 0, 0.08)
    this._mouseDeltaY = THREE.MathUtils.lerp(this._mouseDeltaY, 0, 0.08)

    this.mixer?.update(time)
    this._updateInteractionState(time)
    this._position.copy(this.target.position)
  }

  _handleInteractKey() {
    const pressed = this.input.keys.interact
    if (pressed && !this._prevInteractKey) {
      if (this._interaction.mode === 'free') {
        this.sitOnSeat('chair')
      } else {
        this.standUp()
      }
    }
    this._prevInteractKey = pressed
  }

  _applyFreeMovement(time) {
    const velocity = this.velocity
    const frameDecceleration = new THREE.Vector3(
      velocity.x * this.decceleration.x,
      velocity.y * this.decceleration.y,
      velocity.z * this.decceleration.z
    )

    frameDecceleration.multiplyScalar(time)
    frameDecceleration.z =
      Math.sign(frameDecceleration.z) *
      Math.min(Math.abs(frameDecceleration.z), Math.abs(velocity.z))

    velocity.add(frameDecceleration)

    const controlObject = this.target
    const Q = new THREE.Quaternion()
    const A = new THREE.Vector3()
    const R = controlObject.quaternion.clone()
    const acc = this.acceleration.clone()

    if (this.input.keys.shift) {
      acc.multiplyScalar(2.0)
    }
    if (this.stateMachine.currentState?.name === 'dance') {
      acc.multiplyScalar(0.0)
    }
    if (this.input.keys.forward) {
      velocity.z += acc.z * time
    }
    if (this.input.keys.backward) {
      velocity.z -= acc.z * time
    }
    if (this.input.keys.left) {
      A.set(0, 1, 0)
      Q.setFromAxisAngle(A, 4.0 * Math.PI * time * this.acceleration.y)
      R.multiply(Q)
    }
    if (this.input.keys.right) {
      A.set(0, 1, 0)
      Q.setFromAxisAngle(A, 4.0 * -Math.PI * time * this.acceleration.y)
      R.multiply(Q)
    }

    controlObject.quaternion.copy(R)

    const forward = new THREE.Vector3(0, 0, -1)
    forward.applyQuaternion(controlObject.quaternion)
    forward.normalize()

    const sideways = new THREE.Vector3(1, 0, 0)
    sideways.applyQuaternion(controlObject.quaternion)
    sideways.normalize()

    sideways.multiplyScalar(velocity.x * time)
    forward.multiplyScalar(velocity.z * time)

    controlObject.position.add(forward)
    controlObject.position.add(sideways)
  }

  _cacheBones(root) {
    const patterns = {
      hips: [/hips?/i, /pelvis/i],
      spine: [/spine$/i, /spine_0/i],
      spine1: [/spine1/i, /spine_1/i, /spine01/i],
      spine2: [/spine2/i, /spine_2/i, /spine02/i, /chest/i],
      neck: [/neck/i],
      head: [/head/i],
      leftShoulder: [/leftshoulder/i, /lshoulder/i, /shoulder_l/i],
      rightShoulder: [/rightshoulder/i, /rshoulder/i, /shoulder_r/i],
      leftArm: [/leftarm$/i, /leftupperarm/i, /upperarm_l/i, /mixamorigleftarm/i],
      rightArm: [/rightarm$/i, /rightupperarm/i, /upperarm_r/i, /mixamorigrightarm/i],
      leftForeArm: [/leftforearm/i, /leftlowerarm/i, /lowerarm_l/i],
      rightForeArm: [/rightforearm/i, /rightlowerarm/i, /lowerarm_r/i],
      leftHand: [/lefthand$/i, /hand_l/i],
      rightHand: [/righthand$/i, /hand_r/i],
      leftUpLeg: [/leftupleg/i, /leftthigh/i, /upleg_l/i],
      rightUpLeg: [/rightupleg/i, /rightthigh/i, /upleg_r/i],
      leftLeg: [/leftleg$/i, /leftcalf/i, /leg_l/i],
      rightLeg: [/rightleg$/i, /rightcalf/i, /leg_r/i],
      leftFoot: [/leftfoot/i, /foot_l/i],
      rightFoot: [/rightfoot/i, /foot_r/i],
    }

    root.traverse((child) => {
      if (!child.isBone) return

      const name = child.name.toLowerCase()
      Object.entries(patterns).forEach(([key, regexes]) => {
        if (!this.bones[key] && regexes.some((regex) => regex.test(name))) {
          this.bones[key] = child
        }
      })
      this._boneBaseRotations.set(child.uuid, child.quaternion.clone())
    })

    // Debug: log all matched bones
    console.log('[Bones matched]', Object.fromEntries(
      Object.entries(this.bones).map(([k, b]) => [k, b.name])
    ))
  }

  debugLogArmBones() {
    const keys = ['leftShoulder','rightShoulder','leftArm','rightArm','leftForeArm','rightForeArm','leftHand','rightHand']
    keys.forEach((k) => {
      const b = this.bones[k]
      if (!b) { console.log(k, 'NOT FOUND'); return }
      const e = new THREE.Euler().setFromQuaternion(b.quaternion.clone(), 'XYZ')
      console.log(k, b.name, `x:${e.x.toFixed(3)} y:${e.y.toFixed(3)} z:${e.z.toFixed(3)}`)
    })
  }

  _updateInteractionState(time) {
    if (!this.target) return

    const poseTarget = this._interaction.mode === 'free' ? 0 : 1
    const deskTarget = (this._interaction.mode === 'keyboard' || this._interaction.mode === 'mouse') ? 1 : 0
    const bodyBlend = 1 - Math.pow(0.0008, time)
    const poseBlend = 1 - Math.pow(0.002, time)

    this._interaction.poseWeight = THREE.MathUtils.lerp(this._interaction.poseWeight, poseTarget, poseBlend)
    this._interaction.deskWeight = THREE.MathUtils.lerp(this._interaction.deskWeight, deskTarget, poseBlend)

    if (this._interaction.mode !== 'free') {
      this.target.position.lerp(this._interaction.targetPosition, bodyBlend)
      this.target.quaternion.slerp(this._interaction.targetQuaternion, bodyBlend)
    }

    this._captureAnimatedPose()

    if (this._interaction.mode === 'free') {
      return
    }

    // One-time debug log when mode changes
    if (this._interaction.mode !== this._lastLoggedMode) {
      this._lastLoggedMode = this._interaction.mode
      console.log('MODE:', this._interaction.mode)
      this.debugLogArmBones()
    }

    this._resetPoseToAnimation()

    if (this._interaction.poseWeight > 0.001) {
      if (this._interaction.seat.startsWith('sofa')) {
        this._applySofaPose(this._interaction.poseWeight)
      } else {
        this._applySeatedPose(this._interaction.poseWeight)
      }

      if (this._interaction.mode === 'keyboard') {
        this._applyKeyboardPose(this._interaction.deskWeight)
      } else if (this._interaction.mode === 'mouse') {
        this._applyMousePose(this._interaction.deskWeight)
      }
    }
  }

  _resetPoseToAnimation() {
    Object.values(this.bones).forEach((bone) => {
      const animatedRotation =
        this._animatedBoneRotations.get(bone.uuid) || this._boneBaseRotations.get(bone.uuid)

      if (animatedRotation) {
        bone.quaternion.copy(animatedRotation)
      }
    })
  }

  _captureAnimatedPose() {
    Object.values(this.bones).forEach((bone) => {
      this._animatedBoneRotations.set(bone.uuid, bone.quaternion.clone())
    })
  }

  _applySeatedPose(weight) {
    const pose = {
      hips: [0.08, 0, 0],
      spine: [0.04, 0, 0],
      spine1: [0.06, 0, 0],
      spine2: [0.09, 0, 0],
      neck: [0.02, 0, 0],
      leftUpLeg: [-1.3, -0.04, 0.02],
      rightUpLeg: [-1.3, 0.04, -0.02],
      leftLeg: [1.52, 0, 0],
      rightLeg: [1.52, 0, 0],
      leftFoot: [-0.18, 0, 0],
      rightFoot: [-0.18, 0, 0],
      leftShoulder:  [0.02,  -0.19, -0.23],
      rightShoulder: [0.03,   0.15,  0.18],
      leftArm:       [-0.01, -0.25, -0.85],
      rightArm:      [ 0.14,  0.28,  0.82],
      leftForeArm:   [-0.80, -0.19, -0.01],
      rightForeArm:  [-0.80,  0.22,  0.02],
    }

    Object.entries(pose).forEach(([boneName, rotation]) => {
      this._applyBoneOffset(boneName, rotation, weight)
    })
  }

  _applySofaPose(weight) {
    const pose = {
      hips: [-0.02, 0, 0],
      spine: [-0.03, 0, 0],
      spine1: [-0.04, 0, 0],
      spine2: [-0.05, 0, 0],
      neck: [0.03, 0, 0],
      leftUpLeg: [-1.0, -0.03, 0.03],
      rightUpLeg: [-1.0, 0.03, -0.03],
      leftLeg: [1.12, 0, 0],
      rightLeg: [1.12, 0, 0],
      leftFoot: [-0.04, 0, 0],
      rightFoot: [-0.04, 0, 0],
    }

    Object.entries(pose).forEach(([boneName, rotation]) => {
      this._applyBoneOffset(boneName, rotation, weight)
    })
  }

  _applyKeyboardPose(weight) {
    const tap = Math.sin(this._clock * 8.5) * 0.025
    const pose = {
      spine1:        [ 0.10,  0,      0    ],
      spine2:        [ 0.13,  0,      0    ],
      neck:          [ 0.08,  0,      0    ],
      leftShoulder:  [ 0.02, -0.19,  -0.23 ],
      rightShoulder: [ 0.03,  0.15,   0.18 ],
      leftArm:       [ 1.40,  0,      0    ],
      rightArm:      [ 1.40,  0,      0    ],
      leftForeArm:   [-1.40,  -1.40,      0    ],
      rightForeArm:  [-1.40,  +1.40,      0    ],
      leftHand:      [-0.37 + tap, 0,  0   ],
      rightHand:     [-0.37 - tap, 0,  0   ],
    }

    Object.entries(pose).forEach(([boneName, rotation]) => {
      this._applyBoneOffset(boneName, rotation, weight)
    })
  }

  _applyMousePose(weight) {
    const mx = this._mouseSmoothedX
    const my = this._mouseSmoothedY
    const pose = {
      spine2:        [ 0.10 + my * 0.12,  0,                0    ],
      neck:          [ 0.06 + my * 0.08,  mx * 0.10,        0    ],
      leftShoulder:  [ 0.02,             -0.19,            -0.23  ],
      rightShoulder: [ 0.03,              0.15,             0.18  ],
      leftArm:       [-0.01,             -0.25,            -0.85  ],
      rightArm:      [ 1.40 + my * 0.15,  mx * 0.20,       0     ],
      leftForeArm:   [-0.80,             -0.19,            -0.01  ],
      rightForeArm:  [-1.40 ,  +1.18,       0     ],
      leftHand:      [-0.37,             -0.27,            -0.04  ],
      rightHand:     [-0.37 + my * 0.10,  mx * 0.12,       0     ],
    }

    Object.entries(pose).forEach(([boneName, rotation]) => {
      this._applyBoneOffset(boneName, rotation, weight)
    })
  }

  _applyBoneOffset(boneName, rotation, weight) {
    const bone = this.bones[boneName]
    if (!bone || weight <= 0) return

    const animatedRotation =
      this._animatedBoneRotations.get(bone.uuid) || this._boneBaseRotations.get(bone.uuid)
    if (!animatedRotation) return

    this._tmpEuler.set(rotation[0], rotation[1], rotation[2], 'XYZ')
    this._tmpQuatB.setFromEuler(this._tmpEuler)
    this._tmpQuatA.copy(this._tmpQuatB)
    bone.quaternion.copy(animatedRotation).slerp(this._tmpQuatA, weight)
  }

  toggleSit(seat = 'chair') {
    if (this._interaction.mode === 'free') {
      this.sitOnSeat(seat)
      return 'sit'
    }

    this.standUp()
    return 'stand'
  }

  sitOnSeat(seat = 'chair') {
    if (!this.target) return null
    const targetSeat = this._seatTargets[seat]
    if (!targetSeat) return null

    this.velocity.set(0, 0, 0)
    this.stateMachine.setState('idle')

    this._interaction.seat = seat
    this._interaction.mode = 'seated'
    this._interaction.seatPosition.copy(targetSeat.position)
    this._interaction.seatQuaternion.copy(targetSeat.quaternion)
    this._interaction.targetPosition.copy(this._interaction.seatPosition)
    this._interaction.targetQuaternion.copy(this._interaction.seatQuaternion)
    this.target.position.copy(this._interaction.seatPosition)
    this.target.quaternion.copy(this._interaction.seatQuaternion)
    this._position.copy(this.target.position)

    // Debug bone rotations when seated
    setTimeout(() => this.debugLogArmBones(), 500)

    return 'sit'
  }

  useDesk(tool = 'keyboard') {
    if (!this.target) return false
    if (tool !== 'keyboard' && tool !== 'mouse') return false

    if (this._interaction.mode === 'free' || this._interaction.seat !== 'chair') {
      const sitResult = this.sitOnSeat('chair')
      if (!sitResult) return false
    }

    this.velocity.set(0, 0, 0)
    this.stateMachine.setState('idle')

    this._interaction.seat = 'chair'
    this._interaction.mode = tool
    this._interaction.targetPosition.copy(this._interaction.seatPosition)
    this._interaction.targetQuaternion.copy(this._interaction.seatQuaternion)
    this.target.position.copy(this._interaction.seatPosition)
    this.target.quaternion.copy(this._interaction.seatQuaternion)
    this._position.copy(this.target.position)

    console.log('useDesk called, tool:', tool)
    setTimeout(() => {
      console.log('=== ARM BONES IN', tool.toUpperCase(), 'MODE ===')
      this.debugLogArmBones()
    }, 2000)

    return true
  }
  standUp() {
    if (!this.target) return null

    this.velocity.set(0, 0, 0)
    this.stateMachine.setState('idle')

    this._interaction.mode = 'free'
    this._interaction.seat = 'chair'
    this._interaction.deskWeight = 0
    this._interaction.targetPosition.copy(this._interaction.standPosition)
    this._interaction.targetQuaternion.copy(this._interaction.standQuaternion)
    this.target.position.copy(this._interaction.standPosition)
    this.target.quaternion.copy(this._interaction.standQuaternion)
    this._position.copy(this.target.position)
    return 'stand'
  }

  isSeated() {
    return this._interaction.mode !== 'free'
  }

  get interactionMode() {
    return this._interaction.mode
  }

  get activeSeat() {
    return this._interaction.mode === 'free' ? null : this._interaction.seat
  }

  get rotation() {
    if (!this.target) return new THREE.Quaternion()
    return this.target.quaternion
  }

  get position() {
    return this._position
  }
}

export default BasicCharacterController
