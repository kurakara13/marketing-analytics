"use client";

import { useState } from "react";
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
    <div className="bg-muted/30 flex min-h-0 flex-col overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between border-b bg-background/40 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Slides
        </span>
        <span className="text-muted-foreground text-xs tabular-nums">
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
          <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
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
          </ul>
        </SortableContext>
      </DndContext>

      <div className="border-t bg-background/40 p-2">
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

  const style = {
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
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex items-stretch gap-1 rounded-md border text-sm transition-all",
        isSelected
          ? "border-primary bg-background shadow-sm"
          : "border-transparent hover:bg-background/70",
        isDragging && "opacity-50",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className={cn(
          "text-muted-foreground/50 hover:text-muted-foreground flex w-5 cursor-grab items-center justify-center rounded-l-md transition-colors active:cursor-grabbing",
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
        className="flex flex-1 items-center gap-2.5 rounded-r-md py-2 pr-2 text-left"
      >
        <span
          className={cn(
            "text-muted-foreground/70 inline-flex size-6 shrink-0 items-center justify-center rounded text-[10px] font-medium tabular-nums",
            isSelected && "bg-primary/10 text-primary",
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
              className="w-full rounded bg-background px-1 py-0.5 text-xs outline-none ring-1 ring-primary"
            />
          ) : (
            <div className="truncate text-xs font-medium">{slide.name}</div>
          )}
          <div className="text-muted-foreground text-[10px]">
            {slide.widgets.length} widget
            {slide.widgets.length === 1 ? "" : "s"}
          </div>
        </div>
      </button>

      {canDelete ? (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Hapus ${slide.name}`}
          className={cn(
            "text-muted-foreground hover:text-destructive flex w-7 items-center justify-center rounded-r-md transition-colors",
            "opacity-0 group-hover:opacity-100",
          )}
        >
          <Trash2 className="size-3.5" />
        </button>
      ) : null}
    </li>
  );
}
