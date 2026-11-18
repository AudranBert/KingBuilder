// Wooden playing pieces, independent of platform symbol fonts.
export function piece(kind = "worker") {
 const shapes = {
 king: '<path d="M8 28 5 10l8 6 7-11 7 11 8-6-3 18Z"/><path d="M10 30h20v5H10Z"/>',
 worker: '<circle cx="20" cy="9" r="6"/><path d="M13 17h14l7 13-7 3-2-7 2 11H13l2-11-2 7-7-3Z"/>',
 cavalry: '<path d="m9 34 3-13 10-9 1-8 6 5 7 12-5 5-8-4-4 8 9 4v3H9Z"/><circle cx="28" cy="16" r="1.3" fill="#fff4d8"/>'
 };
 return `<svg class="wood-piece" viewBox="0 0 40 40" aria-hidden="true">${shapes[kind] || shapes.worker}</svg>`;
}
