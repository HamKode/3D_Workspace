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

      // Keep a stable motion root while the visual mesh faces the room correctly.
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

    const isInteractive = this._interaction.mode !== 'free'
    if (isInteractive && this.stateMachine.currentState?.name !== 'idle') {
      this.stateMachine.setState('idle')
    }

    if (!isInteractive) {
      this.stateMachine.update(time, this.input)
      this._applyFreeMovement(time)
    } else {
      this.velocity.set(0, 0, 0)
    }

    this.mixer?.update(time)
    this._updateInteractionState(time)
    this._position.copy(this.target.position)
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
      leftShoulder: [0.03, 0.08, 0.03],
      rightShoulder: [0.03, -0.08, -0.03],
      leftArm: [0.2, 0.15, -0.08],
      rightArm: [0.2, -0.15, 0.08],
      leftForeArm: [-0.35, 0.03, -0.04],
      rightForeArm: [-0.35, -0.03, 0.04],
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
      leftShoulder: [0.08, 0.14, 0.05],
      rightShoulder: [0.08, -0.14, -0.05],
      leftArm: [0.28, 0.2, -0.08],
      rightArm: [0.28, -0.2, 0.08],
      leftForeArm: [-0.55, 0.08, -0.05],
      rightForeArm: [-0.55, -0.08, 0.05],
    }

    Object.entries(pose).forEach(([boneName, rotation]) => {
      this._applyBoneOffset(boneName, rotation, weight)
    })
  }

  _applyKeyboardPose(weight) {
    const tap = Math.sin(this._clock * 8.5) * 0.03
    const pose = {
      spine1: [0.1, 0, 0],
      spine2: [0.12, 0, 0],
      neck: [0.06, 0, 0],
      leftShoulder: [0.08, 0.18, 0.04],
      rightShoulder: [0.08, -0.18, -0.04],
      leftArm: [0.48, 0.35, -0.12],
      rightArm: [0.48, -0.35, 0.12],
      leftForeArm: [-0.92, 0.08, -0.08],
      rightForeArm: [-0.92, -0.08, 0.08],
      leftHand: [0.12 + tap, 0.06, 0.08],
      rightHand: [0.12 - tap, -0.06, -0.08],
    }

    Object.entries(pose).forEach(([boneName, rotation]) => {
      this._applyBoneOffset(boneName, rotation, weight)
    })
  }

  _applyMousePose(weight) {
    const mouseMotion = Math.sin(this._clock * 5.5) * 0.04
    const pose = {
      spine2: [0.1, -0.03, 0],
      neck: [0.05, -0.02, 0],
      leftShoulder: [0.05, 0.12, 0.03],
      rightShoulder: [0.09, -0.24, -0.04],
      leftArm: [0.32, 0.2, -0.1],
      rightArm: [0.56, -0.44, 0.12],
      leftForeArm: [-0.62, 0.08, -0.05],
      rightForeArm: [-1.0, -0.08, 0.18],
      leftHand: [0.08, 0.05, 0.05],
      rightHand: [0.15 + mouseMotion, -0.06, -0.12],
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

    this._tmpQuatA.copy(animatedRotation)
    this._tmpEuler.set(rotation[0], rotation[1], rotation[2], 'XYZ')
    this._tmpQuatB.setFromEuler(this._tmpEuler)
    this._tmpQuatA.multiply(this._tmpQuatB)
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
    return 'sit'
  }

  useDesk(tool = 'keyboard') {
    if (!this.target) return false
    if (this._interaction.mode === 'free') return false
    if (this._interaction.seat !== 'chair') return false
    if (tool !== 'keyboard' && tool !== 'mouse') return false

    this.velocity.set(0, 0, 0)
    this.stateMachine.setState('idle')

    this._interaction.mode = tool
    this._interaction.targetPosition.copy(this._interaction.seatPosition)
    this._interaction.targetQuaternion.copy(this._interaction.seatQuaternion)
    this.target.position.copy(this._interaction.seatPosition)
    this.target.quaternion.copy(this._interaction.seatQuaternion)
    this._position.copy(this.target.position)
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

  get rotation() {
    if (!this.target) return new THREE.Quaternion()
    return this.target.quaternion
  }

  get position() {
    return this._position
  }
}

export default BasicCharacterController
