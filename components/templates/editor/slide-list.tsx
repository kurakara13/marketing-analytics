"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Slide } from "@/lib/reports/templates/types";

type Props = {
  slides: Slide[];
  selectedSlideId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
};

export function SlideList({
  slides,
  selectedSlideId,
  onSelect,
  onAdd,
  onDelete,
  onRename,
}: Props) {
  return (
    <div className="bg-muted/30 flex min-h-0 flex-col gap-2 overflow-hidden rounded-md border p-2">
      <div className="text-muted-foreground flex items-center justify-between px-1 text-xs font-medium uppercase tracking-wide">
        <span>Slides ({slides.length})</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onAdd}
          aria-label="Add slide"
        >
          <Plus className="size-4" />
        </Button>
      </div>

      <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {slides.map((slide, idx) => {
          const isActive = slide.id === selectedSlideId;
          return (
            <li
              key={slide.id}
              className={cn(
                "group rounded-md border p-2 text-sm transition-colors",
                isActive
                  ? "border-primary bg-background"
                  : "border-transparent hover:bg-background/60",
              )}
            >
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground mt-1 text-xs font-mono">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <div className="flex-1">
                  <button
                    type="button"
                    className="block w-full text-left"
                    onClick={() => onSelect(slide.id)}
                  >
                    <Input
                      value={slide.name}
                      onChange={(e) => onRename(slide.id, e.target.value)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(slide.id);
                      }}
                      className="h-7 px-1.5 text-xs"
                    />
                    <div className="text-muted-foreground mt-1 px-0.5 text-[10px]">
                      {slide.widgets.length} widget
                      {slide.widgets.length === 1 ? "" : "s"}
                    </div>
                  </button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="opacity-0 group-hover:opacity-100"
                  onClick={() => onDelete(slide.id)}
                  aria-label={`Delete ${slide.name}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
