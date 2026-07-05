import * as THREE from "three";
import {
  CONSTRUCTIBLE_DEFINITIONS,
  RESOURCE_DEFINITIONS,
  formatInventory,
  type ConstructionSite,
  type GenesisAgent,
  type GenesisDistrict,
  type PublicSite,
  type ResourceNode,
  type Stockpile
} from "../world/genesis";
import type { PlotWorld } from "../world/plotWorld";
import type { InspectionInfo } from "../input/PlotInspector";

const SITE_LIFT = 0.045;
const OBJECT_LIFT = 0.08;

const worldX = (world: PlotWorld, x: number) => (x - world.width / 2) * world.blockSize;
const worldZ = (world: PlotWorld, z: number) => (z - world.depth / 2) * world.blockSize;

const siteColors: Record<PublicSite["type"], number> = {
  arrival: 0x8fd6ff,
  maker_yard: 0xffcf70,
  salvage_yard: 0xa4a093,
  resource_commons: 0x7eb36a,
  shared_depot_zone: 0xd4b56c,
  infrastructure: 0x7f8b93,
  boundary: 0x9a8fa8
};

const constructionColors: Record<ConstructionSite["definitionId"], number> = {
  claim_stake: 0xffe08a,
  personal_cache: 0xb98a4d,
  shared_depot: 0xb7a16a,
  shelter_frame: 0x9d7148,
  workbench: 0x8a5a32,
  repair_marker: 0x66e3ff
};

const row = (label: string, value: string | number): [string, string] => [label, String(value)];

const placeObject = (world: PlotWorld, object: THREE.Object3D, x: number, z: number) => {
  object.position.set(worldX(world, x), world.worldHeight() + OBJECT_LIFT, worldZ(world, z));
};

const setInspectable = (object: THREE.Object3D, infoFor: () => InspectionInfo) => {
  object.userData.inspectInfo = infoFor;
  object.traverse((child) => {
    child.userData.inspectInfo = infoFor;
  });
};

const makeBox = (width: number, height: number, depth: number, color: number) =>
  new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshLambertMaterial({ color })
  );

const makeCylinder = (radiusTop: number, radiusBottom: number, height: number, color: number, segments = 8) =>
  new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    new THREE.MeshLambertMaterial({ color })
  );

const createBorder = (width: number, depth: number, color: number) => {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-halfWidth, 0, -halfDepth),
    new THREE.Vector3(halfWidth, 0, -halfDepth),
    new THREE.Vector3(halfWidth, 0, halfDepth),
    new THREE.Vector3(-halfWidth, 0, halfDepth),
    new THREE.Vector3(-halfWidth, 0, -halfDepth)
  ]);
  return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 }));
};

const createPublicSite = (world: PlotWorld, site: PublicSite) => {
  const width = site.width * world.blockSize;
  const depth = site.depth * world.blockSize;
  const color = siteColors[site.type];
  const group = new THREE.Group();
  group.name = `public-site-${site.id}`;

  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({
      color,
      depthWrite: false,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide
    })
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = SITE_LIFT;
  group.add(plane);

  const border = createBorder(width, depth, color);
  border.position.y = SITE_LIFT + 0.01;
  group.add(border);

  group.position.set(
    worldX(world, site.x + site.width / 2),
    world.worldHeight(),
    worldZ(world, site.z + site.depth / 2)
  );

  setInspectable(group, () => ({
    title: site.name,
    rows: [
      row("kind", "public land"),
      row("type", site.type),
      row("condition", site.condition),
      row("claimable", "no"),
      row("size", `${site.width} x ${site.depth}`)
    ]
  }));

  return group;
};

const createResourceNode = (world: PlotWorld, node: ResourceNode) => {
  const group = new THREE.Group();
  group.name = `resource-node-${node.id}`;
  const definition = RESOURCE_DEFINITIONS[node.kind];
  const depletedAlpha = Math.max(0.35, node.quantity / Math.max(1, node.initialQuantity));

  if (node.nodeType === "tree") {
    const trunk = makeCylinder(0.18, 0.24, 1.2, 0x6a4429, 7);
    trunk.position.y = 0.6;
    group.add(trunk);
    const crown = makeCylinder(0.08, 0.75, 1.2, definition.color, 8);
    crown.position.y = 1.45;
    group.add(crown);
  } else if (node.nodeType === "stone_outcrop") {
    for (let index = 0; index < 4; index += 1) {
      const stone = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.34 + index * 0.04, 0),
        new THREE.MeshLambertMaterial({ color: definition.color })
      );
      stone.position.set((index % 2) * 0.46 - 0.2, 0.24, Math.floor(index / 2) * 0.36 - 0.16);
      stone.rotation.set(index * 0.4, index * 0.7, 0);
      group.add(stone);
    }
  } else if (node.nodeType === "water") {
    const basin = makeCylinder(0.64, 0.7, 0.18, 0x5f6668, 16);
    basin.position.y = 0.09;
    group.add(basin);
    const water = makeCylinder(0.58, 0.58, 0.04, definition.color, 16);
    water.position.y = 0.22;
    group.add(water);
  } else if (node.nodeType === "data") {
    const shard = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.42, 0),
      new THREE.MeshLambertMaterial({ color: definition.color, emissive: 0x11485c })
    );
    shard.position.y = 0.58;
    shard.rotation.y = Math.PI / 4;
    group.add(shard);
    const base = makeBox(0.8, 0.16, 0.8, 0x303638);
    base.position.y = 0.08;
    group.add(base);
  } else {
    const itemCount = node.nodeType === "crate" ? 3 : 5;
    for (let index = 0; index < itemCount; index += 1) {
      const box = makeBox(0.46, 0.24 + (index % 2) * 0.16, 0.42, node.nodeType === "crate" ? 0x8d6745 : definition.color);
      box.position.set((index % 3) * 0.38 - 0.38, box.geometry.parameters.height / 2, Math.floor(index / 3) * 0.4 - 0.15);
      box.rotation.y = index * 0.23;
      group.add(box);
    }
  }

  group.scale.setScalar(0.85 + depletedAlpha * 0.25);
  placeObject(world, group, node.x, node.z);

  setInspectable(group, () => ({
    title: node.name,
    rows: [
      row("kind", node.nodeType === "salvage" ? "salvage node" : "resource node"),
      row("resource", node.kind),
      row("quantity", `${node.quantity}/${node.initialQuantity}`),
      row("unit", definition.unitName),
      row("finite", "yes")
    ]
  }));

  return group;
};

const createAgent = (world: PlotWorld, agent: GenesisAgent) => {
  const group = new THREE.Group();
  group.name = `genesis-agent-${agent.id}`;

  const body = makeCylinder(0.24, 0.3, 0.82, 0x6fc7d9, 10);
  body.position.y = 0.48;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 12, 8),
    new THREE.MeshLambertMaterial({ color: 0xf1dfc1 })
  );
  head.position.y = 1.04;
  group.add(head);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0xffe08a, emissive: 0x332200 })
  );
  core.position.set(0, 0.64, -0.25);
  group.add(core);

  placeObject(world, group, agent.x, agent.z);
  group.position.y += 0.02;

  setInspectable(group, () => ({
    title: agent.name,
    rows: [
      row("kind", "genesis agent"),
      row("goal", agent.currentGoal),
      row("activity", agent.activity),
      row("claim", agent.claimPlotId ?? "none"),
      row("inventory", formatInventory(agent.inventory)),
      row("capacity", `${Object.values(agent.inventory).reduce((sum, value) => sum + (value ?? 0), 0)}/${agent.carryCapacity}`),
      row("profile", agent.personality)
    ]
  }));

  return group;
};

const createStockpile = (world: PlotWorld, stockpile: Stockpile) => {
  const group = new THREE.Group();
  group.name = `stockpile-${stockpile.id}`;

  const base = makeBox(1.45, 0.16, 1.12, 0x645a42);
  base.position.y = 0.08;
  group.add(base);

  const materialCount = Math.min(6, Math.max(1, Math.ceil(Object.values(stockpile.inventory).reduce((sum, amount) => sum + (amount ?? 0), 0) / 5)));
  for (let index = 0; index < materialCount; index += 1) {
    const crate = makeBox(0.34, 0.28, 0.34, index % 2 === 0 ? 0xb98a4d : 0x8c9496);
    crate.position.set((index % 3) * 0.42 - 0.42, 0.3 + Math.floor(index / 3) * 0.24, Math.floor(index / 3) * 0.36 - 0.16);
    group.add(crate);
  }

  placeObject(world, group, stockpile.x, stockpile.z);

  setInspectable(group, () => ({
    title: stockpile.name,
    rows: [
      row("kind", "storage object"),
      row("type", stockpile.type),
      row("owner", stockpile.ownerAgentId ?? "shared"),
      row("inventory", formatInventory(stockpile.inventory)),
      row("capacity", stockpile.capacity)
    ]
  }));

  return group;
};

const createClaimStake = () => {
  const group = new THREE.Group();
  const pole = makeCylinder(0.04, 0.05, 1.1, 0x5f3d26, 6);
  pole.position.y = 0.55;
  group.add(pole);
  const marker = makeBox(0.56, 0.28, 0.04, 0xffe08a);
  marker.position.set(0.24, 0.92, 0);
  group.add(marker);
  return group;
};

const createShelterFrame = (complete: boolean) => {
  const group = new THREE.Group();
  const color = complete ? 0x9d7148 : 0x6f6a5f;
  const posts = [
    [-1, 0.48, -0.8],
    [1, 0.48, -0.8],
    [-1, 0.48, 0.8],
    [1, 0.48, 0.8]
  ];
  for (const [x, y, z] of posts) {
    const post = makeBox(0.12, 0.96, 0.12, color);
    post.position.set(x, y, z);
    group.add(post);
  }
  const beams = [
    [0, 0.98, -0.8, 2.2, 0.1, 0.1],
    [0, 0.98, 0.8, 2.2, 0.1, 0.1],
    [-1, 0.98, 0, 0.1, 0.1, 1.72],
    [1, 0.98, 0, 0.1, 0.1, 1.72]
  ];
  for (const [x, y, z, w, h, d] of beams) {
    const beam = makeBox(w, h, d, color);
    beam.position.set(x, y, z);
    group.add(beam);
  }
  if (complete) {
    const tarp = makeBox(2.05, 0.06, 1.62, 0xc7a27a);
    tarp.position.y = 1.08;
    group.add(tarp);
  }
  return group;
};

const createWorkbench = (complete: boolean) => {
  const group = new THREE.Group();
  const top = makeBox(1.2, 0.14, 0.62, complete ? 0x8a5a32 : 0x6f6a5f);
  top.position.y = 0.62;
  group.add(top);
  for (const x of [-0.48, 0.48]) {
    for (const z of [-0.22, 0.22]) {
      const leg = makeBox(0.1, 0.56, 0.1, 0x5f3d26);
      leg.position.set(x, 0.28, z);
      group.add(leg);
    }
  }
  return group;
};

const createGenericConstruction = (site: ConstructionSite) => {
  switch (site.definitionId) {
    case "claim_stake":
      return createClaimStake();
    case "shelter_frame":
      return createShelterFrame(site.status === "complete");
    case "workbench":
      return createWorkbench(site.status === "complete");
    default: {
      const group = new THREE.Group();
      const definition = CONSTRUCTIBLE_DEFINITIONS[site.definitionId];
      const body = makeBox(
        Math.max(0.8, definition.footprint.width * 0.34),
        site.status === "complete" ? 0.72 : 0.36,
        Math.max(0.8, definition.footprint.depth * 0.34),
        constructionColors[site.definitionId]
      );
      body.position.y = body.geometry.parameters.height / 2;
      group.add(body);
      return group;
    }
  }
};

const createConstruction = (world: PlotWorld, site: ConstructionSite) => {
  const group = createGenericConstruction(site);
  group.name = `construction-${site.id}`;
  if (site.status !== "complete") {
    group.add(createBorder(1.8, 1.8, 0xffffff));
  }
  placeObject(world, group, site.x, site.z);

  setInspectable(group, () => ({
    title: site.name,
    rows: [
      row("kind", site.status === "complete" ? "constructed object" : "construction site"),
      row("status", site.status),
      row("owner", site.ownerAgentId ?? "shared"),
      row("materials", formatInventory(site.consumed)),
      row("work", `${site.workDone}/${site.workRequired}`),
      row("recipe", site.definitionId)
    ]
  }));

  return group;
};

export class GenesisRenderer {
  readonly group = new THREE.Group();

  constructor(
    private readonly world: PlotWorld,
    private readonly district: GenesisDistrict
  ) {
    this.group.name = "genesis-district";
  }

  rebuild() {
    this.disposeMeshes();

    for (const site of this.district.publicSites) this.group.add(createPublicSite(this.world, site));
    for (const node of this.district.resourceNodes) this.group.add(createResourceNode(this.world, node));
    for (const stockpile of this.district.stockpiles) this.group.add(createStockpile(this.world, stockpile));
    for (const site of this.district.constructionSites) this.group.add(createConstruction(this.world, site));
    for (const agent of this.district.agents) this.group.add(createAgent(this.world, agent));
  }

  dispose() {
    this.disposeMeshes();
    this.group.removeFromParent();
  }

  private disposeMeshes() {
    this.group.traverse((child) => {
      if (!(child instanceof THREE.Mesh || child instanceof THREE.Line)) return;
      child.geometry.dispose();
      const materials = "material" in child && child.material
        ? Array.isArray(child.material) ? child.material : [child.material]
        : [];
      for (const material of materials) material.dispose();
    });
    this.group.clear();
  }
}
