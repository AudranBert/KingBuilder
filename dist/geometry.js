export const key = (x, y) => `${x},${y}`;
export const parseKey = (value) => value.split(",").map(Number);
export const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const isRotation = (rotation) =>
  Number.isInteger(rotation) && rotation >= 0 && rotation < 4;
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
export function rotatePoint(x, y, rotation) {
  for (let i = 0; i < rotation; i++) [x, y] = [-y, x];
  return { x, y };
}
export function bounds(cells) {
  return {
    minX: Math.min(...cells.map((c) => c.x)),
    maxX: Math.max(...cells.map((c) => c.x)),
    minY: Math.min(...cells.map((c) => c.y)),
    maxY: Math.max(...cells.map((c) => c.y)),
  };
}
