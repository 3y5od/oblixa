"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { GripVertical } from "lucide-react";

interface SortableSectionProps {
  /** Stable identifier persisted in localStorage. */
  sectionId: string;
  /** Storage namespace. Default groups all dashboard sections under one key. */
  storageKey?: string;
  children: ReactNode;
}

const DEFAULT_KEY = "oblixa.dashboard.section-order";

/**
 * Wraps a dashboard section with a drag handle so users can reorder its
 * position relative to peer SortableSection components sharing the same
 * storageKey. Order persists in localStorage as an array of section IDs.
 *
 * Implementation notes:
 *  - SSR renders sections in source order. After hydration, each section
 *    reads the stored order and applies CSS `order` to its wrapper.
 *  - The grip handle is only visible on hover (and during a drag-in-progress)
 *    so it doesn't add visual noise to a static page.
 */
export function SortableSection({
  sectionId,
  storageKey = DEFAULT_KEY,
  children,
}: SortableSectionProps) {
  const [order, setOrder] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [dragOverActive, setDragOverActive] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const readOrder = useCallback((): string[] => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((v): v is string => typeof v === "string");
    } catch {
      return [];
    }
  }, [storageKey]);

  const writeOrder = useCallback(
    (next: string[]): void => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [storageKey]
  );

  useEffect(() => {
    const id = window.setTimeout(() => setOrder(readOrder()), 0);
    function onStorage(e: StorageEvent): void {
      if (e.key === storageKey) setOrder(readOrder());
    }
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("storage", onStorage);
    };
  }, [storageKey, readOrder]);

  const idx = order.indexOf(sectionId);
  // Unknown IDs sort after known ones, preserving source order via large index.
  const cssOrder = idx === -1 ? 1000 : idx;

  function onDragStart(e: DragEvent<HTMLSpanElement>): void {
    e.dataTransfer.setData("text/x-oblixa-section", sectionId);
    e.dataTransfer.effectAllowed = "move";
    setDragging(true);
  }

  function onDragEnd(): void {
    setDragging(false);
  }

  function onDragOver(e: DragEvent<HTMLDivElement>): void {
    const data = e.dataTransfer.types.includes("text/x-oblixa-section");
    if (!data) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverActive(true);
  }

  function onDragLeave(): void {
    setDragOverActive(false);
  }

  function onDrop(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData("text/x-oblixa-section");
    setDragOverActive(false);
    if (!sourceId || sourceId === sectionId) return;
    const cur = readOrder();
    const next = cur.filter((id) => id !== sourceId);
    const insertAt = next.indexOf(sectionId);
    if (insertAt === -1) {
      // Target hasn't been ordered yet — establish a baseline using DOM order
      // of all known sibling sortable sections.
      const parent = rootRef.current?.parentElement;
      if (!parent) return;
      const siblingIds = Array.from(parent.querySelectorAll("[data-sortable-id]"))
        .map((el) => (el as HTMLElement).dataset.sortableId)
        .filter((v): v is string => !!v);
      const baseline = siblingIds.filter((id) => id !== sourceId);
      const targetIdx = baseline.indexOf(sectionId);
      const reordered = [...baseline];
      if (targetIdx === -1) reordered.push(sourceId);
      else reordered.splice(targetIdx, 0, sourceId);
      writeOrder(reordered);
      setOrder(reordered);
      return;
    }
    next.splice(insertAt, 0, sourceId);
    writeOrder(next);
    setOrder(next);
  }

  return (
    <div
      ref={rootRef}
      data-sortable-id={sectionId}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{ order: cssOrder }}
      className={`group/sortable relative ${dragging ? "opacity-60" : ""} ${
        dragOverActive ? "ring-2 ring-[color:color-mix(in_oklab,var(--accent)_45%,transparent)] ring-offset-2 rounded-2xl" : ""
      }`.trim()}
    >
      <span
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        title="Drag to reorder"
        aria-hidden
        className="absolute -left-7 top-1 hidden h-6 w-6 cursor-grab items-center justify-center rounded-md text-[var(--text-tertiary)] opacity-0 transition-opacity group-hover/sortable:opacity-100 hover:bg-[var(--surface-tint-soft)] hover:text-[var(--text-primary)] active:cursor-grabbing xl:inline-flex"
      >
        <GripVertical className="h-3.5 w-3.5" strokeWidth={1.85} />
      </span>
      {children}
    </div>
  );
}

/**
 * Companion wrapper that establishes a flex column so the `order` style on
 * SortableSection children takes effect. Wrap a group of sortable sections.
 */
export function SortableStack({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-6">{children}</div>;
}
