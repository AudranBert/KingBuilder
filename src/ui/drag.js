// Shared mouse, pen and touch drag lifecycle. A click never starts placement.
const sourceSelector =
  "[data-tile],[data-building],[data-single-terrain],[data-worker-drag],[data-unit-drag]";
export function installDrag({
  root,
  begin,
  preview,
  drop,
  end,
  ghost: content,
  canStart = () => true,
}) {
  let pending = null,
    ghost = null,
    suppressClick = false,
    scrollFrame = null,
    point = null;
  function target(event) {
    if (!Number.isFinite(event.clientX)) return null;
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const cell = hit?.closest("#board [data-x]");
    if (cell) return { x: +cell.dataset.x, y: +cell.dataset.y };
    return hit?.closest("[data-worker-reserve]")
      ? { workerReserve: true }
      : null;
  }
  function refresh() {
    if (ghost && content) ghost.innerHTML = content();
  }
  function scrollWhileDragging() {
    if (!pending?.active || !point) return;
    const edgeSpeed = (position, start, end, margin = 48) =>
      position < start + margin ? -Math.ceil(12 * Math.max(0, 1 - (position - start) / margin))
      : position > end - margin ? Math.ceil(12 * Math.max(0, 1 - (end - position) / margin)) : 0;
    const frame = document.querySelector?.('#map-scroll');
    const bounds = frame?.getBoundingClientRect();
    if (bounds && point.clientX >= bounds.left && point.clientX <= bounds.right && point.clientY >= bounds.top && point.clientY <= bounds.bottom) {
      frame.scrollBy(edgeSpeed(point.clientX, bounds.left, bounds.right, 28), edgeSpeed(point.clientY, bounds.top, bounds.bottom, 28));
    }
    window.scrollBy?.(0, edgeSpeed(point.clientY, 0, window.innerHeight));
    const destination = target(point);
    preview(destination?.workerReserve ? null : destination);
    scrollFrame = requestAnimationFrame(scrollWhileDragging);
  }
  function finish(event = {}, cancelled = true) {
    if (
      !pending ||
      (event.pointerId !== undefined && event.pointerId !== pending.id)
    )
      return;
    const active = pending.active,
      destination = cancelled ? null : target(event),
      pointerId = pending.id;
    pending = null;
    if (root.hasPointerCapture?.(pointerId)) root.releasePointerCapture(pointerId);
    point = null;
    if (scrollFrame !== null) globalThis.cancelAnimationFrame?.(scrollFrame);
    scrollFrame = null;
    ghost?.remove();
    ghost = null;
    root.classList.remove("placing-tile");
    if (active) {
      suppressClick = true;
      try {
        if (destination) drop(destination);
      } finally {
        end();
      }
      setTimeout(() => {
        suppressClick = false;
      }, 0);
    }
  }
  root.addEventListener("dragstart", (event) => {
    if (event.target.closest(sourceSelector)) event.preventDefault();
  });
  root.addEventListener("pointerdown", (event) => {
    const card = event.target.closest(sourceSelector);
    if (!card || card.disabled || event.button !== 0 || pending || !canStart(card)) return;
    // Cards use tap-to-place on touchscreens so a vertical swipe can scroll.
    if (event.pointerType === "touch" && card.matches("[data-tile],[data-building],[data-single-terrain]") && !event.target.closest('[data-card-drag]')) return;
    pending = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      card,
      active: false,
    };
  });
  document.addEventListener(
    "pointermove",
    (event) => {
      if (!pending || event.pointerId !== pending.id) return;
      point = { clientX: event.clientX, clientY: event.clientY };
      if (!pending.active) {
        if (
          Math.hypot(event.clientX - pending.x, event.clientY - pending.y) < 6
        )
          return;
        pending.active = true;
        root.setPointerCapture(event.pointerId);
        ghost = pending.card.cloneNode(true);
        ghost.removeAttribute("id");
        ghost.setAttribute("aria-hidden", "true");
        ghost.classList.add("drag-ghost");
        ghost.style.width =
          Math.min(110, pending.card.getBoundingClientRect().width) + "px";
        document.body.append(ghost);
        begin(pending.card);
        refresh();
        root.classList.add("placing-tile");
        if (typeof requestAnimationFrame === 'function') scrollFrame = requestAnimationFrame(scrollWhileDragging);
      }
      event.preventDefault();
      ghost.style.left = event.clientX + (event.pointerType === 'touch' ? -40 : 16) + "px";
      ghost.style.top = event.clientY + (event.pointerType === 'touch' ? -85 : 16) + "px";
      const destination = target(event);
      preview(destination?.workerReserve ? null : destination);
    },
    { passive: false },
  );
  document.addEventListener("pointerup", (event) => finish(event, false));
  document.addEventListener("pointercancel", (event) => finish(event));
  root.addEventListener(
    "click",
    (event) => {
      if (suppressClick) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
  window.addEventListener("blur", () => finish());
  return { refresh, cancel: () => finish() };
}
