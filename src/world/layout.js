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
