// Single source of truth for where everything sits on the island. Terrain
// flattening, building placement, the path spline, and player spawn all
// read from here so they can never drift out of sync.

export const ISLAND_RADIUS = 95;
export const WATER_LEVEL = 0;
export const WORLD_BOUND_RADIUS = 132;

export const LIGHTHOUSE = {
  x: 0,
  z: -68,
  floorY: 2.6,
  padRadius: 12,
  towerRadius: 5.2,
  wallThickness: 0.55,
  doorAngle: Math.PI / 2, // faces +Z, toward the settlement path
  rotationY: 0,
};

export const COTTAGE = {
  x: -38,
  z: 6,
  floorY: 1.8,
  padRadius: 15,
  width: 13,
  depth: 10,
  rotationY: 0, // door on local +Z wall, facing south toward the path
};

export const BOATHOUSE = {
  x: 34,
  z: 40,
  floorY: 0.7,
  padRadius: 9,
  width: 9,
  depth: 8,
  rotationY: 0, // door on local +Z wall, facing the dock
};

export const DOCK = {
  x: 34,
  landZ: 44, // where the dock meets the shore
  seaZ: 80, // outer end, over water
  width: 3.4,
  surfaceYLand: 0.85,
  surfaceYSea: 0.35,
};

// NPCs (Phase 3). Positions are hand-placed just outside each building's
// door, on the path approach — y is sampled from the terrain at runtime.
export const MARA_POSITION = { x: BOATHOUSE.x - 0.5, z: BOATHOUSE.z + BOATHOUSE.depth / 2 + 4 };
export const THOMAS_POSITION = { x: COTTAGE.x - 3.3, z: COTTAGE.z + COTTAGE.depth / 2 + 3 };

// Chapter 3 ("The Reckoning") relocates both NPCs to the lighthouse for one
// final conversation each, flanking the tower door.
export const MARA_CHAPTER3_POSITION = { x: LIGHTHOUSE.x - 3, z: LIGHTHOUSE.z + LIGHTHOUSE.towerRadius + 3 };
export const THOMAS_CHAPTER3_POSITION = { x: LIGHTHOUSE.x + 3, z: LIGHTHOUSE.z + LIGHTHOUSE.towerRadius + 3 };

// The sea cave (Chapter 2, "Deeper Waters") — a short walk off-path down to
// the shore southwest of the cottage, behind a padlocked grate. Tunnel runs
// along local -X from the mouth into a small chamber; `padRadius` is used
// the same way building pads are, so Terrain.js/Props.js can flatten and
// clear a small landing outside the entrance.
export const CAVE = {
  x: -62,
  z: -34,
  floorY: 0.5,
  padRadius: 7,
  mouthWidth: 3.0,
  mouthHeight: 3.2,
  tunnelLength: 9,
  tunnelWidth: 3.0,
  tunnelHeight: 3.2,
  chamberWidth: 10,
  chamberDepth: 9,
  chamberHeight: 3.6,
};

export const SPAWN = {
  x: 34,
  z: 76, // near the sea end of the dock, having just arrived by boat
  yaw: 0, // face north/inland, up the dock toward the boathouse
};

// Catmull-Rom control points for the dirt/gravel path connecting everything,
// in visiting order: dock -> boathouse -> cottage -> lighthouse.
export const PATH_WAYPOINTS = [
  [34, 64],
  [34, 47],
  [20, 28],
  [-4, 16],
  [-24, 10],
  [-38, 15],
  [-34, -20],
  [-16, -42],
  [-4, -56],
  [0, -60],
];

export const PATH_WIDTH = 3.4;
