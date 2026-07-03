import * as THREE from "three";

const SKY_SIZE = 3000;
const SKY_CYCLE_SECONDS = 180;
const INITIAL_TIME_OF_DAY = 0.44;
const TAU = Math.PI * 2;

const SKY_TEXTURES = {
  day: "/textures/sky/goodvibes/daybox.png",
  clouds: "/textures/sky/goodvibes/cloudbox.png",
  night: "/textures/sky/goodvibes/nightbox2.png",
  sun: "/textures/sky/goodvibes/sun.png"
} as const;

export type SkyPhase = "dawn" | "day" | "dusk" | "night";

export type SkyCycleState = {
  timeOfDay: number;
  clockLabel: string;
  phase: SkyPhase;
  dayAlpha: number;
  nightAlpha: number;
  cloudAlpha: number;
  sunAlpha: number;
  sunIntensity: number;
  hemisphereIntensity: number;
  sunDirection: THREE.Vector3;
  sunColor: THREE.Color;
  skyColor: THREE.Color;
  fogColor: THREE.Color;
  groundColor: THREE.Color;
};

type AtlasCell = {
  col: number;
  row: number;
};

type AxisRotation = {
  axis: "x" | "y" | "z";
  degrees: number;
};

type SkyPart = {
  cell: AtlasCell;
  rotations: AxisRotation[];
};

type SkyLayer = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  material: THREE.MeshBasicMaterial;
  texture: THREE.Texture;
  rotationSpeed: number;
};

const SKY_PARTS: SkyPart[] = [
  { cell: { col: 0, row: 0 }, rotations: [{ axis: "y", degrees: 90 }] },
  { cell: { col: 1, row: 0 }, rotations: [{ axis: "x", degrees: 180 }, { axis: "y", degrees: -90 }] },
  { cell: { col: 2, row: 0 }, rotations: [{ axis: "x", degrees: 90 }, { axis: "z", degrees: 90 }] },
  { cell: { col: 0, row: 1 }, rotations: [{ axis: "x", degrees: 90 }, { axis: "z", degrees: 180 }] },
  { cell: { col: 1, row: 1 }, rotations: [{ axis: "x", degrees: 90 }, { axis: "z", degrees: -90 }] },
  { cell: { col: 2, row: 1 }, rotations: [{ axis: "x", degrees: 90 }] }
];

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const x = clamp01((value - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
};

const pulseAround = (timeOfDay: number, center: number, radius: number) => {
  const wrappedDistance = Math.min(Math.abs(timeOfDay - center), 1 - Math.abs(timeOfDay - center));
  return clamp01(1 - wrappedDistance / radius);
};

const makeClockLabel = (timeOfDay: number) => {
  const totalMinutes = Math.floor(timeOfDay * 24 * 60);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
};

const phaseFor = (timeOfDay: number): SkyPhase => {
  if (timeOfDay >= 0.2 && timeOfDay < 0.32) return "dawn";
  if (timeOfDay >= 0.32 && timeOfDay < 0.68) return "day";
  if (timeOfDay >= 0.68 && timeOfDay < 0.8) return "dusk";
  return "night";
};

const tintColor = (night: THREE.Color, day: THREE.Color, warm: THREE.Color, dayAlpha: number, warmAlpha: number) => {
  return night.clone().lerp(day, dayAlpha).lerp(warm, warmAlpha);
};

const loadSkyTexture = (path: string) => {
  const texture = new THREE.TextureLoader().load(path);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.flipY = false;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  return texture;
};

const atlasUvs = (cell: AtlasCell) => {
  const minU = cell.col / 3;
  const maxU = (cell.col + 1) / 3;
  const minV = cell.row / 2;
  const maxV = (cell.row + 1) / 2;
  return [
    minU, minV,
    minU, maxV,
    maxU, maxV,
    maxU, minV
  ];
};

const rotationMatrixFor = (rotations: AxisRotation[]) => {
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Matrix4();
  for (const { axis, degrees } of rotations) {
    const radians = THREE.MathUtils.degToRad(degrees);
    if (axis === "x") rotation.makeRotationX(radians);
    if (axis === "y") rotation.makeRotationY(radians);
    if (axis === "z") rotation.makeRotationZ(radians);
    matrix.multiply(rotation);
  }
  return matrix;
};

const appendAtlasPart = (
  positions: number[],
  uvs: number[],
  indices: number[],
  baseCorners: THREE.Vector3[],
  part: SkyPart
) => {
  const vertexIndex = positions.length / 3;
  const matrix = rotationMatrixFor(part.rotations);
  for (const corner of baseCorners) {
    const transformed = corner.clone().applyMatrix4(matrix);
    positions.push(transformed.x, transformed.y, transformed.z);
  }
  uvs.push(...atlasUvs(part.cell));
  indices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2, vertexIndex, vertexIndex + 2, vertexIndex + 3);
};

const buildOptifineAtlasCubeGeometry = () => {
  const s = SKY_SIZE / 2;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const baseCorners = [
    new THREE.Vector3(-s, -s, -s),
    new THREE.Vector3(-s, -s, s),
    new THREE.Vector3(s, -s, s),
    new THREE.Vector3(s, -s, -s)
  ];

  for (const part of SKY_PARTS) appendAtlasPart(positions, uvs, indices, baseCorners, part);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
};

const makeSkyLayer = (texturePath: string, renderOrder: number, rotationSpeed: number) => {
  const texture = loadSkyTexture(texturePath);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    depthTest: true,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
    transparent: true
  });
  const mesh = new THREE.Mesh(buildOptifineAtlasCubeGeometry(), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = renderOrder;
  return { mesh, material, texture, rotationSpeed };
};

export class GoodVibesSky {
  readonly group = new THREE.Group();

  private readonly dayLayer: SkyLayer;
  private readonly cloudLayer: SkyLayer;
  private readonly nightLayer: SkyLayer;
  private readonly sunTexture: THREE.Texture;
  private readonly sunMaterial: THREE.SpriteMaterial;
  private readonly sunSprite: THREE.Sprite;
  private readonly state: SkyCycleState;
  private elapsedSeconds = INITIAL_TIME_OF_DAY * SKY_CYCLE_SECONDS;

  constructor() {
    this.group.name = "goodvibes-sky";

    this.dayLayer = makeSkyLayer(SKY_TEXTURES.day, -30, 0.004);
    this.cloudLayer = makeSkyLayer(SKY_TEXTURES.clouds, -29, 0.008);
    this.nightLayer = makeSkyLayer(SKY_TEXTURES.night, -28, 0.003);

    this.sunTexture = loadSkyTexture(SKY_TEXTURES.sun);
    this.sunMaterial = new THREE.SpriteMaterial({
      map: this.sunTexture,
      blending: THREE.AdditiveBlending,
      color: 0xffffff,
      depthTest: true,
      depthWrite: false,
      fog: false,
      transparent: true
    });
    this.sunSprite = new THREE.Sprite(this.sunMaterial);
    this.sunSprite.name = "goodvibes-sun";
    this.sunSprite.renderOrder = -27;
    this.sunSprite.scale.setScalar(170);

    this.group.add(this.dayLayer.mesh, this.cloudLayer.mesh, this.nightLayer.mesh, this.sunSprite);

    this.state = {
      timeOfDay: INITIAL_TIME_OF_DAY,
      clockLabel: makeClockLabel(INITIAL_TIME_OF_DAY),
      phase: phaseFor(INITIAL_TIME_OF_DAY),
      dayAlpha: 1,
      nightAlpha: 0,
      cloudAlpha: 0.72,
      sunAlpha: 1,
      sunIntensity: 2.4,
      hemisphereIntensity: 1.85,
      sunDirection: new THREE.Vector3(0, 1, 0),
      sunColor: new THREE.Color(0xffffff),
      skyColor: new THREE.Color(0x93cdea),
      fogColor: new THREE.Color(0x93cdea),
      groundColor: new THREE.Color(0x6d5a46)
    };
  }

  update(camera: THREE.PerspectiveCamera, deltaSeconds: number) {
    this.elapsedSeconds = (this.elapsedSeconds + deltaSeconds) % SKY_CYCLE_SECONDS;
    const timeOfDay = this.elapsedSeconds / SKY_CYCLE_SECONDS;

    const sunrise = smoothstep(0.21, 0.32, timeOfDay);
    const sunset = 1 - smoothstep(0.68, 0.79, timeOfDay);
    const dayAlpha = clamp01(sunrise * sunset);
    const nightAlpha = clamp01(1 - dayAlpha);
    const dawnDuskAlpha = Math.max(pulseAround(timeOfDay, 0.265, 0.09), pulseAround(timeOfDay, 0.735, 0.09));
    const cloudAlpha = 0.22 + dayAlpha * 0.52 + dawnDuskAlpha * 0.12;
    const sunAlpha = clamp01(dayAlpha + dawnDuskAlpha * 0.5);

    const sunAngle = timeOfDay * TAU - Math.PI / 2;
    const sunDirection = this.state.sunDirection.set(
      Math.cos(sunAngle) * 0.62,
      Math.sin(sunAngle),
      -0.42
    ).normalize();

    this.group.position.copy(camera.position);
    this.dayLayer.mesh.rotation.y += deltaSeconds * this.dayLayer.rotationSpeed;
    this.cloudLayer.mesh.rotation.y += deltaSeconds * this.cloudLayer.rotationSpeed;
    this.nightLayer.mesh.rotation.y -= deltaSeconds * this.nightLayer.rotationSpeed;

    this.dayLayer.material.opacity = 1;
    this.cloudLayer.material.opacity = cloudAlpha;
    this.nightLayer.material.opacity = nightAlpha * 0.96;
    this.sunMaterial.opacity = sunAlpha;
    this.sunSprite.visible = sunAlpha > 0.03;
    this.sunSprite.position.copy(sunDirection).multiplyScalar(SKY_SIZE * 0.36);

    const warmSky = new THREE.Color(0xd99a78);
    const daySky = new THREE.Color(0x93d8f0);
    const nightSky = new THREE.Color(0x090b1f);
    const dayFog = new THREE.Color(0x98cfe6);
    const nightFog = new THREE.Color(0x111628);
    const warmFog = new THREE.Color(0xc9957b);

    this.state.timeOfDay = timeOfDay;
    this.state.clockLabel = makeClockLabel(timeOfDay);
    this.state.phase = phaseFor(timeOfDay);
    this.state.dayAlpha = dayAlpha;
    this.state.nightAlpha = nightAlpha;
    this.state.cloudAlpha = cloudAlpha;
    this.state.sunAlpha = sunAlpha;
    this.state.sunIntensity = 0.15 + dayAlpha * 2.25 + dawnDuskAlpha * 0.45;
    this.state.hemisphereIntensity = 0.42 + dayAlpha * 1.35 + dawnDuskAlpha * 0.22;
    this.state.sunColor.set(0xffffff).lerp(new THREE.Color(0xffb27a), dawnDuskAlpha * 0.55).lerp(new THREE.Color(0x6d79ba), nightAlpha * 0.2);
    this.state.skyColor.copy(tintColor(nightSky, daySky, warmSky, dayAlpha, dawnDuskAlpha * 0.2));
    this.state.fogColor.copy(tintColor(nightFog, dayFog, warmFog, dayAlpha, dawnDuskAlpha * 0.25));
    this.state.groundColor.set(0x261b31).lerp(new THREE.Color(0x6d5a46), dayAlpha).lerp(new THREE.Color(0x8a604c), dawnDuskAlpha * 0.25);

    return this.state;
  }

  getState() {
    return this.state;
  }

  dispose() {
    for (const layer of [this.dayLayer, this.cloudLayer, this.nightLayer]) {
      layer.mesh.geometry.dispose();
      layer.material.dispose();
      layer.texture.dispose();
    }
    this.sunMaterial.dispose();
    this.sunTexture.dispose();
  }
}
