// Pointer-based placement works with mouse, pen and touch.
export function installTileDrag({root, begin, preview, drop, end}) {
 let pending = null, ghost = null, suppressClick = false;
 function finish(event, cancelled = false) {
  if (!pending || (event.pointerId !== undefined && event.pointerId !== pending.id)) return;
  const active = pending.active;
  const cell = !cancelled && Number.isFinite(event.clientX) ? document.elementFromPoint(event.clientX, event.clientY)?.closest("#board [data-x]") : null;
  const reserve = !cancelled && Number.isFinite(event.clientX) && document.elementFromPoint(event.clientX,event.clientY)?.closest("[data-worker-reserve]");
  pending = null;
  ghost?.remove(); ghost = null;
  document.body.classList.remove("placing-tile");
  if (active) {
   suppressClick = true;
   if (!cancelled && cell) drop({x:+cell.dataset.x,y:+cell.dataset.y});
   else if(reserve) drop({workerReserve:true});
   end();
   setTimeout(() => { suppressClick = false; }, 0);
  }
 }
 root.addEventListener("dragstart", e => { if(e.target.closest("[data-tile],[data-building],[data-worker-drag]")) e.preventDefault(); });
 root.addEventListener("pointerdown", event => {
  const card = event.target.closest("[data-tile],[data-building],[data-worker-drag]");
  if (!card || card.disabled || event.button !== 0 || pending) return;
  pending = {id:event.pointerId,x:event.clientX,y:event.clientY,card,active:false};

 });
 document.addEventListener("pointermove", event => {
  if (!pending || event.pointerId !== pending.id) return;
  if (!pending.active) {
   if (Math.hypot(event.clientX-pending.x,event.clientY-pending.y)<6) return;
   pending.active = true;
   root.setPointerCapture(event.pointerId);
   ghost = pending.card.cloneNode(true);
   ghost.removeAttribute("id"); ghost.setAttribute("aria-hidden","true");
   ghost.classList.add("drag-ghost"); ghost.style.width = pending.card.getBoundingClientRect().width+"px";
   document.body.append(ghost);
   begin(pending.card);
   document.body.classList.add("placing-tile");
  }
  event.preventDefault();
  ghost.style.left = event.clientX+16+"px"; ghost.style.top = event.clientY+16+"px";
  const cell = document.elementFromPoint(event.clientX,event.clientY)?.closest("#board [data-x]");
  preview(cell ? {x:+cell.dataset.x,y:+cell.dataset.y}:null);
 },{passive:false});
 document.addEventListener("pointerup", e => finish(e));
 document.addEventListener("pointercancel", e => finish(e,true));
 document.addEventListener("keydown", e => { if(e.key==="Escape" && pending) finish({pointerId:pending.id},true); });
 root.addEventListener("click", event => { if(suppressClick) {event.preventDefault();event.stopImmediatePropagation();} },true);
}
