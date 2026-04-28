"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveTemplateAction } from "@/app/(dashboard)/reports/actions";
import {
  createBlankTemplateDefinition,
  type TemplateDefinition,
  type Widget,
} from "@/lib/reports/templates/types";
import { SlideList } from "./slide-list";
import { SlideCanvas } from "./slide-canvas";
import { WidgetSidePanel } from "./widget-side-panel";

type Props = {
  templateId: string;
  initialName: string;
  initialDescription: string | null;
  initialDefinition: TemplateDefinition;
};

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

  const selectedSlide = useMemo(
    () => definition.slides.find((s) => s.id === selectedSlideId) ?? null,
    [definition, selectedSlideId],
  );
  const selectedWidget = useMemo<Widget | null>(() => {
    if (!selectedSlide || !selectedWidgetId) return null;
    return selectedSlide.widgets.find((w) => w.id === selectedWidgetId) ?? null;
  }, [selectedSlide, selectedWidgetId]);

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

  // ─── Save / Generate ──────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    startSaving(async () => {
      const result = await saveTemplateAction({
        templateId,
        name: name.trim() || "Untitled template",
        description: description.trim() || null,
        definition,
      });
      if ("error" in result) {
        toast.error(`Save gagal: ${result.error}`);
        return;
      }
      toast.success("Template tersimpan.");
      setIsDirty(false);
    });
  }, [templateId, name, description, definition]);

  const handleGenerate = useCallback(() => {
    if (isDirty) {
      toast.warning("Save dulu sebelum generate.");
      return;
    }
    window.location.href = `/api/reports/${templateId}/generate`;
  }, [isDirty, templateId]);

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col gap-3">
      {/* Header / toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b pb-3">
        <Link
          href="/reports"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" />
          Reports
        </Link>
        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setIsDirty(true);
          }}
          placeholder="Nama report"
          className="max-w-xs"
        />
        <Input
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setIsDirty(true);
          }}
          placeholder="Deskripsi (opsional)"
          className="max-w-md"
        />
        <div className="ml-auto flex items-center gap-2">
          {isDirty ? (
            <span className="text-muted-foreground text-xs">
              Ada perubahan belum disimpan
            </span>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={handleGenerate}
            disabled={isSaving || isDirty}
          >
            <Download className="size-4" />
            Generate .pptx
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* 3-panel layout */}
      <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr_320px] gap-3">
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
  );
}
