import * as THREE from 'three'

class ThirdPersonCamera {
  constructor(params) {
    this.target = params.target
    this.camera = params.camera

    this.roomBounds = {
      minX: -22,
      maxX: 22,
      minY: 9,
      maxY: 24,
      minZ: -4,
      maxZ: 16,
    }

    this.currentPosition = this.camera.position.clone()
    this.currentLookat = new THREE.Vector3(0, 9, -18)
  }

  calculateIdealOffset(x, y, z) {
    const idealOffset = new THREE.Vector3(x, y, z)
    idealOffset.applyQuaternion(this.target.rotation)
    idealOffset.add(this.target.position)
    return idealOffset
  }

  calculateIdealLookat(x, y, z) {
    const idealLookat = new THREE.Vector3(x, y, z)
    idealLookat.applyQuaternion(this.target.rotation)
    idealLookat.add(this.target.position)
    return idealLookat
  }

  clampToRoom(vector) {
    vector.x = THREE.MathUtils.clamp(vector.x, this.roomBounds.minX, this.roomBounds.maxX)
    vector.y = THREE.MathUtils.clamp(vector.y, this.roomBounds.minY, this.roomBounds.maxY)
    vector.z = THREE.MathUtils.clamp(vector.z, this.roomBounds.minZ, this.roomBounds.maxZ)
    return vector
  }

  /**
   * Update camera position
   *
   * @param {Float} time - in second
   */
  update(time, freeCamera = false) {
    if (freeCamera) {
      this.camera.lookAt(this.target.position)
    } else {
      const idealOffset = this.clampToRoom(this.calculateIdealOffset(0, 16, 15))
      const idealLookat = this.calculateIdealLookat(0, 8, -20)

      const a = 1.0 - Math.pow(0.0001, time)

      this.currentPosition.lerp(idealOffset, a)
      this.currentLookat.lerp(idealLookat, a)

      this.camera.position.copy(this.currentPosition)
      this.camera.lookAt(this.currentLookat)
    }
  }
}

export default ThirdPersonCamera
