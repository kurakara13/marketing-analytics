"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Slide } from "@/lib/reports/templates/types";

type Props = {
  slides: Slide[];
  selectedSlideId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onReorder: (fromId: string, toId: string) => void;
};

const SPRING = { type: "spring", stiffness: 380, damping: 32 } as const;

export function SlideList({
  slides,
  selectedSlideId,
  onSelect,
  onAdd,
  onDelete,
  onRename,
  onReorder,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // 5px movement before drag starts → click-to-select still works.
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id));
    }
  }

  return (
    <div className="bg-card flex min-h-0 flex-col overflow-hidden rounded-xl border border-border/60 shadow-sm">
      <div className="bg-muted/30 flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Slides
          </span>
        </div>
        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums">
          {slides.length}
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={slides.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-3">
            <AnimatePresence initial={false}>
              {slides.map((slide, idx) => (
                <SortableSlideItem
                  key={slide.id}
                  slide={slide}
                  index={idx}
                  isSelected={slide.id === selectedSlideId}
                  canDelete={slides.length > 1}
                  onSelect={() => onSelect(slide.id)}
                  onDelete={() => onDelete(slide.id)}
                  onRename={(name) => onRename(slide.id, name)}
                />
              ))}
            </AnimatePresence>
          </ul>
        </SortableContext>
      </DndContext>

      <div className="bg-muted/30 border-t border-border/60 p-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAdd}
          className="w-full"
        >
          <Plus className="size-4" />
          Slide baru
        </Button>
      </div>
    </div>
  );
}

// ─── Single slide row ───────────────────────────────────────────────────
function SortableSlideItem({
  slide,
  index,
  isSelected,
  canDelete,
  onSelect,
  onDelete,
  onRename,
}: {
  slide: Slide;
  index: number;
  isSelected: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id });

  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(slide.name);

  // Combine dnd-kit's CSS transform with our own enter/exit animation
  // via motion. dnd-kit handles drag state; motion handles add/remove.
  const dndStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function commitRename() {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== slide.name) {
      onRename(trimmed);
    } else {
      setDraftName(slide.name);
    }
    setIsRenaming(false);
  }

  return (
    <motion.li
      ref={setNodeRef}
      style={dndStyle}
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: isDragging ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={cn(
        "group relative flex items-stretch gap-1 rounded-lg border text-sm",
        "transition-[background-color,border-color,box-shadow] duration-150",
        isSelected
          ? "border-primary/40 bg-accent shadow-sm ring-1 ring-primary/15"
          : "border-transparent hover:bg-accent/60",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className={cn(
          "text-muted-foreground/40 hover:text-muted-foreground flex w-5 cursor-grab items-center justify-center rounded-l-lg transition-opacity active:cursor-grabbing",
          "opacity-0 group-hover:opacity-100",
          isSelected && "opacity-100",
        )}
      >
        <GripVertical className="size-3.5" />
      </button>

      <button
        type="button"
        onClick={onSelect}
        onDoubleClick={() => setIsRenaming(true)}
        className="flex flex-1 items-center gap-2.5 rounded-r-lg py-2 pr-2 text-left"
      >
        <span
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold tabular-nums transition-colors",
            isSelected
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground/80",
          )}
        >
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") {
                  setDraftName(slide.name);
                  setIsRenaming(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-md bg-background px-1.5 py-0.5 text-xs font-medium outline-none ring-2 ring-primary"
            />
          ) : (
            <div className="truncate text-xs font-medium leading-snug">
              {slide.name}
            </div>
          )}
          <div className="text-muted-foreground text-[10px] leading-tight">
            {slide.widgets.length} widget
            {slide.widgets.length === 1 ? "" : "s"}
          </div>
        </div>
      </button>

      {canDelete ? (
        <motion.button
          type="button"
          onClick={onDelete}
          aria-label={`Hapus ${slide.name}`}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.92 }}
          transition={SPRING}
          className={cn(
            "text-muted-foreground/60 hover:text-destructive flex w-7 items-center justify-center rounded-r-lg transition-[color,opacity]",
            "opacity-0 group-hover:opacity-100",
          )}
        >
          <Trash2 className="size-3.5" />
        </motion.button>
      ) : null}
    </motion.li>
  );
}
