"use client";

import { useRef, useState, useTransition } from "react";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { uploadImageAction } from "@/app/(dashboard)/reports/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEditorContext } from "./editor-context";

type Props = {
  imagePath: string | null;
  onChange: (path: string | null) => void;
};

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

// Image upload + preview field used by the Image widget config form.
// Picks a file via a hidden input, uploads via uploadImageAction, and
// stores the returned relative path on the widget config. The actual
// file lives under `./uploads/` and is served via `/api/uploads/...`.
export function ImageUploadField({ imagePath, onChange }: Props) {
  const { templateId } = useEditorContext();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, startUpload] = useTransition();
  const [hover, setHover] = useState(false);

  function pickFile() {
    inputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;

    const fd = new FormData();
    fd.append("templateId", templateId);
    fd.append("file", file);

    startUpload(async () => {
      const result = await uploadImageAction(fd);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      onChange(result.imagePath);
      toast.success("Image ter-upload");
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleFileChange}
        className="hidden"
      />

      {imagePath ? (
        <div
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          className={cn(
            "border-input bg-muted/40 group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border",
            "transition-colors",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/uploads/${imagePath}`}
            alt=""
            className="h-full w-full object-contain"
          />
          {hover ? (
            <div className="bg-background/85 absolute inset-0 flex items-center justify-center gap-2 backdrop-blur-sm">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={pickFile}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(null)}
                disabled={isUploading}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={pickFile}
          disabled={isUploading}
          className={cn(
            "border-input hover:bg-muted/60 hover:border-primary/40 flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-sm transition-colors",
            isUploading && "opacity-50",
          )}
        >
          {isUploading ? (
            <>
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground text-xs">
                Mengupload…
              </span>
            </>
          ) : (
            <>
              <ImageIcon className="text-muted-foreground size-5" />
              <span className="text-muted-foreground text-xs">
                Klik untuk upload
              </span>
              <span className="text-muted-foreground/70 text-[10px]">
                JPG, PNG, WEBP, GIF · max 8 MB
              </span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
