"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { saveTemplateAction } from "@/app/(dashboard)/reports/actions";
import {
  createBlankTemplateDefinition,
  type TemplateDefinition,
  type Widget,
} from "@/lib/reports/templates/types";
import { cn } from "@/lib/utils";
import { EditorProvider } from "./editor-context";
import { SaveStatus, type SaveState } from "./save-status";
import { SlideList } from "./slide-list";
import { SlideCanvas } from "./slide-canvas";
import { WidgetSidePanel } from "./widget-side-panel";

type Props = {
  templateId: string;
  initialName: string;
  initialDescription: string | null;
  initialDefinition: TemplateDefinition;
};

const AUTOSAVE_DEBOUNCE_MS = 1500;

export function TemplateEditor({
  templateId,
  initialName,
  initialDescription,
  initialDefinition,
}: Props) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [definition, setDefinition] = useState<TemplateDefinition>(
    initialDefinition.slides.length > 0
      ? initialDefinition
      : createBlankTemplateDefinition(),
  );
  const [selectedSlideId, setSelectedSlideId] = useState<string>(
    () => definition.slides[0]?.id ?? "",
  );
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const selectedSlide = useMemo(
    () => definition.slides.find((s) => s.id === selectedSlideId) ?? null,
    [definition, selectedSlideId],
  );
  const selectedWidget = useMemo<Widget | null>(() => {
    if (!selectedSlide || !selectedWidgetId) return null;
    return selectedSlide.widgets.find((w) => w.id === selectedWidgetId) ?? null;
  }, [selectedSlide, selectedWidgetId]);

  const saveState: SaveState = isSaving
    ? "saving"
    : isDirty
      ? "dirty"
      : "clean";

  // ─── Mutations ────────────────────────────────────────────────────────
  const updateDefinition = useCallback(
    (updater: (d: TemplateDefinition) => TemplateDefinition) => {
      setDefinition((prev) => updater(prev));
      setIsDirty(true);
    },
    [],
  );

  const handleAddSlide = useCallback(() => {
    const newId = crypto.randomUUID();
    updateDefinition((d) => ({
      ...d,
      slides: [
        ...d.slides,
        {
          id: newId,
          name: `Slide ${d.slides.length + 1}`,
          background: "F8FAFC",
          widgets: [],
        },
      ],
    }));
    setSelectedSlideId(newId);
    setSelectedWidgetId(null);
  }, [updateDefinition]);

  const handleDeleteSlide = useCallback(
    (slideId: string) => {
      if (definition.slides.length <= 1) {
        toast.error("Tidak bisa hapus slide terakhir.");
        return;
      }
      updateDefinition((d) => ({
        ...d,
        slides: d.slides.filter((s) => s.id !== slideId),
      }));
      if (selectedSlideId === slideId) {
        const remaining = definition.slides.filter((s) => s.id !== slideId);
        setSelectedSlideId(remaining[0]?.id ?? "");
        setSelectedWidgetId(null);
      }
    },
    [definition, selectedSlideId, updateDefinition],
  );

  const handleRenameSlide = useCallback(
    (slideId: string, newName: string) => {
      updateDefinition((d) => ({
        ...d,
        slides: d.slides.map((s) =>
          s.id === slideId ? { ...s, name: newName } : s,
        ),
      }));
    },
    [updateDefinition],
  );

  const handleReorderSlides = useCallback(
    (fromId: string, toId: string) => {
      updateDefinition((d) => {
        const fromIndex = d.slides.findIndex((s) => s.id === fromId);
        const toIndex = d.slides.findIndex((s) => s.id === toId);
        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
          return d;
        }
        const next = [...d.slides];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return { ...d, slides: next };
      });
    },
    [updateDefinition],
  );

  const handleAddWidget = useCallback(
    (widget: Widget) => {
      if (!selectedSlide) return;
      updateDefinition((d) => ({
        ...d,
        slides: d.slides.map((s) =>
          s.id === selectedSlide.id
            ? { ...s, widgets: [...s.widgets, widget] }
            : s,
        ),
      }));
      setSelectedWidgetId(widget.id);
    },
    [selectedSlide, updateDefinition],
  );

  const handleUpdateWidget = useCallback(
    (widgetId: string, updater: (w: Widget) => Widget) => {
      if (!selectedSlide) return;
      updateDefinition((d) => ({
        ...d,
        slides: d.slides.map((s) =>
          s.id === selectedSlide.id
            ? {
                ...s,
                widgets: s.widgets.map((w) =>
                  w.id === widgetId ? updater(w) : w,
                ),
              }
            : s,
        ),
      }));
    },
    [selectedSlide, updateDefinition],
  );

  const handleDeleteWidget = useCallback(
    (widgetId: string) => {
      if (!selectedSlide) return;
      updateDefinition((d) => ({
        ...d,
        slides: d.slides.map((s) =>
          s.id === selectedSlide.id
            ? { ...s, widgets: s.widgets.filter((w) => w.id !== widgetId) }
            : s,
        ),
      }));
      setSelectedWidgetId(null);
    },
    [selectedSlide, updateDefinition],
  );

  // ─── Save ─────────────────────────────────────────────────────────────
  // Wrap save in a stable ref so the autosave effect can call it without
  // including it in deps (which would re-trigger on every state change).
  const handleSaveRef = useRef<() => void>(() => {});
  const handleSave = useCallback(() => {
    if (isSaving) return;
    startSaving(async () => {
      const result = await saveTemplateAction({
        templateId,
        name: name.trim() || "Untitled report",
        description: description.trim() || null,
        definition,
      });
      if ("error" in result) {
        toast.error(`Save gagal: ${result.error}`);
        return;
      }
      setIsDirty(false);
      setLastSavedAt(new Date());
    });
  }, [isSaving, templateId, name, description, definition]);
  handleSaveRef.current = handleSave;

  // ─── Auto-save ────────────────────────────────────────────────────────
  // Debounced: each edit resets a 1.5s timer; when it fires we flush.
  // The timer is cleared if the component unmounts or the user keeps
  // editing. Manual save (Cmd+S) bypasses the debounce.
  useEffect(() => {
    if (!isDirty) return;
    const id = window.setTimeout(() => {
      handleSaveRef.current();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [isDirty, name, description, definition]);

  // ─── Generate ─────────────────────────────────────────────────────────
  const handleGenerate = useCallback(() => {
    if (isDirty) {
      // Force-flush before generating, so the .pptx reflects the latest
      // edit. Side-effect: handleSave is async so we just kick it and
      // let the user retry. In practice autosave debounce is short
      // enough that this rarely matters.
      handleSave();
      toast.info("Tunggu auto-save selesai sebelum generate.");
      return;
    }
    window.location.href = `/api/reports/${templateId}/generate`;
  }, [isDirty, templateId, handleSave]);

  // ─── Keyboard shortcuts ───────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      // Cmd+S / Ctrl+S — manual save (works even while typing).
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveRef.current();
        return;
      }

      // The rest only when not typing in an input.
      if (isTyping) return;

      // Esc — deselect widget
      if (e.key === "Escape" && selectedWidgetId) {
        setSelectedWidgetId(null);
        return;
      }

      // Delete / Backspace — delete selected widget
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedWidgetId
      ) {
        e.preventDefault();
        handleDeleteWidget(selectedWidgetId);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedWidgetId, handleDeleteWidget]);

  return (
    <EditorProvider templateId={templateId}>
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4">
      {/* Toolbar */}
      <header className="flex items-center gap-3 px-1">
        <Link
          href="/reports"
          className={cn(
            "text-muted-foreground hover:text-foreground hover:bg-accent",
            "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
          )}
        >
          <ArrowLeft className="size-4" />
          Reports
        </Link>

        <div className="bg-border h-5 w-px shrink-0" aria-hidden />

        <div className="flex min-w-0 flex-1 flex-col gap-0">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setIsDirty(true);
            }}
            placeholder="Untitled report"
            aria-label="Report name"
            className={cn(
              "bg-transparent border-none text-base font-semibold outline-none tracking-tight",
              "rounded-md px-1.5 py-0.5 transition-colors",
              "hover:bg-muted/50 focus:bg-muted",
              "placeholder:text-muted-foreground/50",
            )}
          />
          <input
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setIsDirty(true);
            }}
            placeholder="Tambah deskripsi…"
            aria-label="Description"
            className={cn(
              "text-muted-foreground bg-transparent border-none text-xs outline-none",
              "rounded-md px-1.5 py-0.5 transition-colors",
              "hover:bg-muted/50 focus:bg-muted",
              "placeholder:text-muted-foreground/50",
            )}
          />
        </div>

        <SaveStatus state={saveState} lastSavedAt={lastSavedAt} />

        <Button
          type="button"
          variant="default"
          onClick={handleGenerate}
          disabled={isSaving}
          className="rounded-lg shadow-sm"
        >
          <Download className="size-4" />
          Generate .pptx
        </Button>
      </header>

      {/* 3-panel layout — grid-rows-1 (= minmax(0,1fr)) makes the row
          fill the available height while letting children shrink below
          their natural size; without it the row defaults to `auto` and
          tall content overflows the viewport. */}
      <div className="grid min-h-0 flex-1 grid-cols-[240px_1fr_340px] grid-rows-1 gap-4">
        <SlideList
          slides={definition.slides}
          selectedSlideId={selectedSlideId}
          onSelect={(id) => {
            setSelectedSlideId(id);
            setSelectedWidgetId(null);
          }}
          onAdd={handleAddSlide}
          onDelete={handleDeleteSlide}
          onRename={handleRenameSlide}
          onReorder={handleReorderSlides}
        />
        <SlideCanvas
          slide={selectedSlide}
          selectedWidgetId={selectedWidgetId}
          onSelectWidget={setSelectedWidgetId}
          onUpdateWidget={handleUpdateWidget}
        />
        <WidgetSidePanel
          slide={selectedSlide}
          selectedWidget={selectedWidget}
          onAddWidget={handleAddWidget}
          onUpdateWidget={handleUpdateWidget}
          onDeleteWidget={handleDeleteWidget}
          onClearSelection={() => setSelectedWidgetId(null)}
        />
      </div>
    </div>
    </EditorProvider>
  );
}
