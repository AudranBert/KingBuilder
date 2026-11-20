export const key = (x, y) => `${x},${y}`;
export const parseKey = (value) => value.split(",").map(Number);
export const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const isRotation = (rotation) =>
  Number.isInteger(rotation) && rotation >= 0 && rotation < 8;
export function inside(x, y, size) {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    y >= 0 &&
    x < size &&
    y < size
  );
}
// Orientations 0–3 are rotations; 4–7 mirror the local X axis before rotating.
// This keeps the full orientation in saved buildings and multiplayer commands.
export function rotatePoint(x, y, rotation) {
  if (rotation >= 4) x = -x;
  for (let i = 0; i < rotation % 4; i++) [x, y] = [-y, x];
  return { x: x || 0, y: y || 0 };
}
export function bounds(cells) {
  return {
    minX: Math.min(...cells.map((c) => c.x)),
    maxX: Math.max(...cells.map((c) => c.x)),
    minY: Math.min(...cells.map((c) => c.y)),
    maxY: Math.max(...cells.map((c) => c.y)),
  };
}
