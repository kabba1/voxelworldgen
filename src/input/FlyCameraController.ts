import * as THREE from "three";

type KeyMap = Record<string, boolean>;

export class FlyCameraController {
  readonly domElement: HTMLCanvasElement;
  readonly camera: THREE.PerspectiveCamera;
  readonly velocity = new THREE.Vector3();
  readonly keys: KeyMap = {};

  private yaw = 0;
  private pitch = -0.55;
  private pointerLocked = false;
  private readonly direction = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);

  moveSpeed = 34;
  sprintMultiplier = 2.8;
  mouseSensitivity = 0.0022;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLCanvasElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.camera.rotation.order = "YXZ";
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
    const speed = this.moveSpeed * (this.keys.ShiftLeft || this.keys.ShiftRight ? this.sprintMultiplier : 1);
    this.direction.set(0, 0, 0);

    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    this.right.crossVectors(forward, this.up).normalize();

    if (this.keys.KeyW) this.direction.add(forward);
    if (this.keys.KeyS) this.direction.sub(forward);
    if (this.keys.KeyD) this.direction.add(this.right);
    if (this.keys.KeyA) this.direction.sub(this.right);
    if (this.keys.Space) this.direction.y += 1;
    if (this.keys.KeyC || this.keys.ControlLeft || this.keys.ControlRight) this.direction.y -= 1;

    if (this.direction.lengthSq() > 0) {
      this.direction.normalize().multiplyScalar(speed * deltaSeconds);
      this.camera.position.add(this.direction);
    }
  }

  isPointerLocked() {
    return this.pointerLocked;
  }

  lookAt(target: THREE.Vector3) {
    const direction = target.clone().sub(this.camera.position).normalize();
    this.yaw = Math.atan2(-direction.x, -direction.z);
    this.pitch = Math.asin(direction.y);
    this.pitch = Math.max(-Math.PI / 2 + 0.03, Math.min(Math.PI / 2 - 0.03, this.pitch));
    this.applyRotation();
  }

  private onKeyDown = (event: KeyboardEvent) => {
    this.keys[event.code] = true;
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.keys[event.code] = false;
  };

  private onBlur = () => {
    for (const key of Object.keys(this.keys)) this.keys[key] = false;
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
