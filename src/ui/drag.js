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
}) {
  let pending = null,
    ghost = null,
    suppressClick = false;
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
  function finish(event = {}, cancelled = true) {
    if (
      !pending ||
      (event.pointerId !== undefined && event.pointerId !== pending.id)
    )
      return;
    const active = pending.active,
      destination = cancelled ? null : target(event);
    pending = null;
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
    if (!card || card.disabled || event.button !== 0 || pending) return;
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
      }
      event.preventDefault();
      ghost.style.left = event.clientX + 16 + "px";
      ghost.style.top = event.clientY + 16 + "px";
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
