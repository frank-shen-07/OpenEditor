import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";

const LIST_GAP = 8;
const DRAG_THRESHOLD = 6;
const DRAG_BLOCKED_SELECTOR =
  "button, input, textarea, select, a, label, [contenteditable='true'], .json-editor-textarea";

function isDragBlocked(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest(DRAG_BLOCKED_SELECTOR);
}

function getShiftY(
  index: number,
  dragIndex: number | null,
  insertAt: number | null,
  blockHeight: number,
): number {
  if (dragIndex === null || insertAt === null || index === dragIndex) return 0;
  const shift = blockHeight + LIST_GAP;
  if (dragIndex < insertAt && index > dragIndex && index < insertAt) return -shift;
  if (dragIndex > insertAt && index >= insertAt && index < dragIndex) return shift;
  return 0;
}

function computeInsertAt(list: HTMLElement, clientY: number, dragIndex: number): number {
  const wraps = Array.from(list.querySelectorAll<HTMLElement>(".editor-block-wrap"));
  for (let i = 0; i < wraps.length; i++) {
    if (i === dragIndex) continue;
    const rect = wraps[i].getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) return i;
  }
  return wraps.length;
}

export type ReorderableBlockListProps<T> = {
  items: T[];
  getKey: (item: T, index: number) => string;
  onReorder: (from: number, to: number) => void;
  renderHeader: (
    item: T,
    ctx: { isOpen: boolean; toggle: () => void; index: number },
  ) => ReactNode;
  renderBody: (item: T, index: number) => ReactNode;
};

export function ReorderableBlockList<T>({
  items,
  getKey,
  onReorder,
  renderHeader,
  renderBody,
}: ReorderableBlockListProps<T>) {
  const keys = items.map((item, index) => getKey(item, index));
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set());
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [dropLineY, setDropLineY] = useState<number | null>(null);
  const prevKeysRef = useRef(keys);
  const listRef = useRef<HTMLDivElement>(null);
  const dragBlockHeightRef = useRef(0);
  const flipTopsRef = useRef<Map<string, number> | null>(null);
  const dragRafRef = useRef<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const dragStartYRef = useRef(0);
  const dragOffsetYRef = useRef(0);
  const draggedWrapRef = useRef<HTMLElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const pendingDragIndexRef = useRef<number | null>(null);
  const pendingPointerYRef = useRef(0);

  useEffect(() => {
    const prevKeys = prevKeysRef.current;
    setOpenKeys((prev) => {
      const next = new Set(prev);
      for (const key of prevKeys) {
        if (!keys.includes(key)) next.delete(key);
      }
      for (const key of keys) {
        if (!prevKeys.includes(key)) next.add(key);
      }
      return next;
    });
    prevKeysRef.current = keys;
  }, [keys.join("|")]);

  useLayoutEffect(() => {
    const first = flipTopsRef.current;
    if (!first) return;
    flipTopsRef.current = null;

    const list = listRef.current;
    if (!list) return;

    for (const key of keys) {
      const block = list.querySelector<HTMLElement>(`[data-editor-block][data-block-id="${key}"]`);
      const wrap = block?.parentElement as HTMLElement | null;
      if (!wrap) continue;
      const firstTop = first.get(key);
      if (firstTop === undefined) continue;
      const lastTop = wrap.offsetTop;
      const dy = firstTop - lastTop;
      if (Math.abs(dy) < 1) continue;

      wrap.style.transition = "none";
      wrap.style.transform = `translateY(${dy}px)`;
      requestAnimationFrame(() => {
        wrap.style.transition = "transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)";
        wrap.style.transform = "";
        const cleanup = () => {
          wrap.style.transition = "";
          wrap.removeEventListener("transitionend", cleanup);
        };
        wrap.addEventListener("transitionend", cleanup);
      });
    }
  }, [keys.join("|")]);

  const toggleOpen = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const clearDragState = () => {
    if (dragRafRef.current !== null) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
    if (draggedWrapRef.current) {
      draggedWrapRef.current.style.removeProperty("transform");
      draggedWrapRef.current.style.removeProperty("transition");
      draggedWrapRef.current.style.removeProperty("z-index");
    }
    draggedWrapRef.current = null;
    activePointerIdRef.current = null;
    pendingDragIndexRef.current = null;
    dragIndexRef.current = null;
    dragOffsetYRef.current = 0;
    dragStartYRef.current = 0;
    setDragIndex(null);
    setInsertAt(null);
    setDropLineY(null);
  };

  const updateDropLineY = (nextInsert: number) => {
    const list = listRef.current;
    if (!list) return;
    const listTop = list.getBoundingClientRect().top;
    const wraps = Array.from(list.querySelectorAll<HTMLElement>(".editor-block-wrap"));
    if (wraps.length === 0) {
      setDropLineY(0);
      return;
    }
    if (nextInsert <= 0) {
      setDropLineY(wraps[0].getBoundingClientRect().top - listTop - 2);
      return;
    }
    if (nextInsert >= wraps.length) {
      const last = wraps[wraps.length - 1];
      setDropLineY(last.getBoundingClientRect().bottom - listTop + 2);
      return;
    }
    setDropLineY(wraps[nextInsert].getBoundingClientRect().top - listTop - 2);
  };

  const scheduleDragUpdate = (clientY: number) => {
    pendingPointerYRef.current = clientY;
    if (dragRafRef.current !== null) return;
    dragRafRef.current = requestAnimationFrame(() => {
      dragRafRef.current = null;
      const list = listRef.current;
      const dragIdx = dragIndexRef.current;
      if (!list || dragIdx === null) return;

      dragOffsetYRef.current = pendingPointerYRef.current - dragStartYRef.current;
      const wrap = draggedWrapRef.current;
      if (wrap) {
        wrap.style.transform = `translate3d(0, ${dragOffsetYRef.current}px, 0)`;
      }

      const nextInsert = computeInsertAt(list, pendingPointerYRef.current, dragIdx);
      setInsertAt((prev) => (prev === nextInsert ? prev : nextInsert));
      updateDropLineY(nextInsert);
    });
  };

  useLayoutEffect(() => {
    if (insertAt === null || dragIndex === null) return;
    updateDropLineY(insertAt);
  }, [insertAt, dragIndex, keys.join("|")]);

  const captureFlipPositions = () => {
    const list = listRef.current;
    if (!list) return;
    const tops = new Map<string, number>();
    for (const key of keys) {
      const block = list.querySelector<HTMLElement>(`[data-editor-block][data-block-id="${key}"]`);
      const wrap = block?.parentElement as HTMLElement | null;
      if (wrap) tops.set(key, wrap.offsetTop);
    }
    flipTopsRef.current = tops;
  };

  const finishDrag = (from: number, clientY: number) => {
    const list = listRef.current;
    if (!list) {
      clearDragState();
      return;
    }
    const insert = computeInsertAt(list, clientY, from);
    if (insert === from || insert === from + 1) {
      clearDragState();
      return;
    }
    const to = insert > from ? insert - 1 : insert;
    captureFlipPositions();
    onReorder(from, to);
    clearDragState();
  };

  const activateDrag = (index: number) => {
    const wrap = draggedWrapRef.current;
    if (!wrap) return;

    dragIndexRef.current = index;
    dragBlockHeightRef.current = wrap.getBoundingClientRect().height;
    dragOffsetYRef.current = 0;

    wrap.style.zIndex = "4";
    wrap.style.transition = "none";

    setDragIndex(index);
    setInsertAt(index);
    updateDropLineY(index);
  };

  const startBlockDrag = (index: number, e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || isDragBlocked(e.target)) return;

    const block = e.currentTarget;
    const wrap = block.parentElement as HTMLElement | null;
    if (!wrap) return;

    e.preventDefault();
    block.setPointerCapture(e.pointerId);

    draggedWrapRef.current = wrap;
    activePointerIdRef.current = e.pointerId;
    pendingDragIndexRef.current = index;
    dragStartYRef.current = e.clientY;
    dragOffsetYRef.current = 0;
  };

  const moveBlockDrag = (e: PointerEvent<HTMLElement>) => {
    if (activePointerIdRef.current !== e.pointerId || pendingDragIndexRef.current === null) return;

    if (dragIndexRef.current === null) {
      if (Math.abs(e.clientY - dragStartYRef.current) < DRAG_THRESHOLD) return;
      activateDrag(pendingDragIndexRef.current);
    }

    e.preventDefault();
    scheduleDragUpdate(e.clientY);
  };

  const endBlockDrag = (e: PointerEvent<HTMLElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    e.currentTarget.releasePointerCapture(e.pointerId);

    if (dragIndexRef.current !== null) {
      finishDrag(dragIndexRef.current, e.clientY);
      return;
    }
    clearDragState();
  };

  const isDragging = dragIndex !== null;
  const dragBlockHeight = dragBlockHeightRef.current;

  return (
    <div
      ref={listRef}
      className={`editor-block-list${isDragging ? " is-dragging" : ""}`}
      style={
        isDragging && dropLineY !== null
          ? ({ "--editor-drop-line-y": `${dropLineY}px` } as CSSProperties)
          : undefined
      }
    >
      {items.map((item, index) => {
        const key = keys[index];
        const isOpen = openKeys.has(key) && dragIndex !== index;
        const isDraggingBlock = dragIndex === index;
        const shiftY = getShiftY(index, dragIndex, insertAt, dragBlockHeight);

        return (
          <div
            key={key}
            className={`editor-block-wrap${isDragging && !isDraggingBlock ? " is-shifting" : ""}${isDraggingBlock ? " is-dragging-active" : ""}`}
            style={
              isDraggingBlock
                ? undefined
                : shiftY
                  ? { transform: `translate3d(0, ${shiftY}px, 0)` }
                  : undefined
            }
          >
            <div
              data-editor-block
              data-block-id={key}
              className={`editor-block${isOpen ? " is-open" : ""}${isDraggingBlock ? " is-dragging" : ""}`}
              onPointerDown={(e) => startBlockDrag(index, e)}
              onPointerMove={moveBlockDrag}
              onPointerUp={endBlockDrag}
              onPointerCancel={endBlockDrag}
            >
              <div className="editor-block-header">
                <span className="editor-drag-handle" aria-hidden="true">
                  ⋮⋮
                </span>
                {renderHeader(item, {
                  isOpen,
                  toggle: () => toggleOpen(key),
                  index,
                })}
              </div>
              <div className="editor-block-body">{renderBody(item, index)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
