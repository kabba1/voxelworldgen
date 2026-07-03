import * as THREE from "three";

type KeyMap = Record<string, boolean>;
export type PlayerCameraMode = "walk" | "fly";

export class PlayerCameraController {
  readonly domElement: HTMLCanvasElement;
  readonly camera: THREE.PerspectiveCamera;
  readonly keys: KeyMap = {};

  private yaw = 0;
  private pitch = -0.2;
  private pointerLocked = false;
  private grounded = true;
  private verticalVelocity = 0;
  private readonly horizontalVelocity = new THREE.Vector3();
  private readonly movement = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private mode: PlayerCameraMode = "walk";

  moveSpeed = 7.5;
  sprintMultiplier = 1.85;
  flySpeed = 34;
  flySprintMultiplier = 2.8;
  jumpVelocity = 6.2;
  gravity = 18;
  mouseSensitivity = 0.0022;

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLCanvasElement,
    private readonly groundY: number,
    private readonly eyeHeight = 1.7
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.camera.rotation.order = "YXZ";
    this.camera.position.y = this.playerEyeY();
    this.applyRotation();

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    domElement.addEventListener("click", this.requestPointerLock);
  }

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    this.domElement.removeEventListener("click", this.requestPointerLock);
  }

  update(deltaSeconds: number) {
    if (this.mode === "fly") {
      this.updateFly(deltaSeconds);
      return;
    }

    this.updateWalk(deltaSeconds);
  }

  isPointerLocked() {
    return this.pointerLocked;
  }

  isGrounded() {
    return this.grounded;
  }

  getMode() {
    return this.mode;
  }

  lookAt(target: THREE.Vector3) {
    const direction = target.clone().sub(this.camera.position).normalize();
    this.yaw = Math.atan2(-direction.x, -direction.z);
    this.pitch = Math.asin(direction.y);
    this.pitch = Math.max(-Math.PI / 2 + 0.03, Math.min(Math.PI / 2 - 0.03, this.pitch));
    this.applyRotation();
  }

  private toggleMode() {
    this.mode = this.mode === "walk" ? "fly" : "walk";
    this.horizontalVelocity.set(0, 0, 0);
    this.verticalVelocity = 0;

    if (this.mode === "walk") {
      this.grounded = this.camera.position.y <= this.playerEyeY();
      if (this.grounded) this.camera.position.y = this.playerEyeY();
    }
  }

  private updateWalk(deltaSeconds: number) {
    this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.movement.set(0, 0, 0);

    if (this.keys.KeyW) this.movement.add(this.forward);
    if (this.keys.KeyS) this.movement.sub(this.forward);
    if (this.keys.KeyD) this.movement.add(this.right);
    if (this.keys.KeyA) this.movement.sub(this.right);

    const speed = this.moveSpeed * (this.keys.ShiftLeft || this.keys.ShiftRight ? this.sprintMultiplier : 1);
    if (this.movement.lengthSq() > 0) {
      this.movement.normalize().multiplyScalar(speed);
      this.horizontalVelocity.lerp(this.movement, 1 - Math.exp(-14 * deltaSeconds));
    } else {
      this.horizontalVelocity.multiplyScalar(Math.exp(-12 * deltaSeconds));
    }

    if (this.grounded && this.keys.Space) {
      this.grounded = false;
      this.verticalVelocity = this.jumpVelocity;
    }

    this.verticalVelocity -= this.gravity * deltaSeconds;
    this.camera.position.x += this.horizontalVelocity.x * deltaSeconds;
    this.camera.position.z += this.horizontalVelocity.z * deltaSeconds;
    this.camera.position.y += this.verticalVelocity * deltaSeconds;

    const eyeY = this.playerEyeY();
    if (this.camera.position.y <= eyeY) {
      this.camera.position.y = eyeY;
      this.verticalVelocity = 0;
      this.grounded = true;
    }
  }

  private updateFly(deltaSeconds: number) {
    this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.movement.set(0, 0, 0);

    if (this.keys.KeyW) this.movement.add(this.forward);
    if (this.keys.KeyS) this.movement.sub(this.forward);
    if (this.keys.KeyD) this.movement.add(this.right);
    if (this.keys.KeyA) this.movement.sub(this.right);
    if (this.keys.Space) this.movement.y += 1;
    if (this.keys.KeyC || this.keys.ControlLeft || this.keys.ControlRight) this.movement.y -= 1;

    if (this.movement.lengthSq() === 0) return;

    const speed = this.flySpeed * (this.keys.ShiftLeft || this.keys.ShiftRight ? this.flySprintMultiplier : 1);
    this.movement.normalize().multiplyScalar(speed * deltaSeconds);
    this.camera.position.add(this.movement);
  }

  private playerEyeY() {
    return this.groundY + this.eyeHeight;
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.code === "KeyF" && !event.repeat) {
      event.preventDefault();
      this.toggleMode();
    }
    this.keys[event.code] = true;
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.keys[event.code] = false;
  };

  private onBlur = () => {
    for (const key of Object.keys(this.keys)) this.keys[key] = false;
    this.horizontalVelocity.set(0, 0, 0);
    this.verticalVelocity = 0;
  };

  private requestPointerLock = () => {
    const lockRequest = this.domElement.requestPointerLock();
    if (lockRequest) {
      lockRequest.catch(() => {
        this.pointerLocked = false;
      });
    }
  };

  private onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.domElement;
  };

  private onMouseMove = (event: MouseEvent) => {
    if (!this.pointerLocked) return;
    this.yaw -= event.movementX * this.mouseSensitivity;
    this.pitch -= event.movementY * this.mouseSensitivity;
    this.pitch = Math.max(-Math.PI / 2 + 0.03, Math.min(Math.PI / 2 - 0.03, this.pitch));
    this.applyRotation();
  };

  private applyRotation() {
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }
}
