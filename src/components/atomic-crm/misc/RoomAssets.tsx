import { isBinaryPath as validReference } from "@/binary-path";
/* eslint-disable react-refresh/only-export-components -- Raster validation is shared with the focused safety tests. */
import { useEffect, useId, useRef, useState } from "react";
import { useDataProvider } from "ra-core";
import { useController, useFormContext } from "react-hook-form";
import { Download, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CrmDataProvider, HouseAttachment } from "@/house";

const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
const imageTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
]);
const MAX_PREVIEW = 10 * 1024 * 1024;
/** Only explicit raster signatures can be inserted in image elements. SVG/HTML never preview. */
export async function isSafeRaster(blob: Blob): Promise<boolean> {
  if (!imageTypes.has(blob.type.toLowerCase()) || blob.size > MAX_PREVIEW)
    return false;
  const b = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const text = new TextDecoder().decode(b);
  return blob.type === "image/png"
    ? b.length >= 8 &&
        [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => b[i] === v)
    : blob.type === "image/jpeg"
      ? b[0] === 255 && b[1] === 216 && b[2] === 255
      : blob.type === "image/gif"
        ? text.startsWith("GIF87a") || text.startsWith("GIF89a")
        : blob.type === "image/webp"
          ? text.startsWith("RIFF") && text.slice(8, 12) === "WEBP"
          : blob.type === "image/avif"
            ? text.slice(4, 8) === "ftyp" &&
              ["avif", "avis"].includes(text.slice(8, 12))
            : false;
}

/** Resolves an opaque Room reference; no user-supplied URL is ever loaded. */
export function RoomAssetImage({
  asset,
  alt,
  className,
}: {
  asset?: HouseAttachment | null;
  alt: string;
  className?: string;
}) {
  const provider = useDataProvider<CrmDataProvider>();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const previewUrl = useRef("");
  const marker = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (visible || !marker.current) return;
    if (typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { rootMargin: "0px" });
    observer.observe(marker.current);
    return () => observer.disconnect();
  }, [visible]);
  const ref = asset?.path;
  useEffect(() => {
    let disposed = false;
    let objectUrl = "";
    setUrl("");
    setError("");
    if (!ref) return;
    if (!validReference(ref)) {
      setError("This is not a valid Room attachment reference.");
      return;
    }
    if (!visible) return;
    provider
      .getAttachment(ref)
      .then(async (result) => {
        const blob = result.blob;
        if (!blob) return;
        if (!(await isSafeRaster(blob)))
          throw new Error("This Room file is not a supported raster image.");
        if (disposed) return;
        objectUrl = URL.createObjectURL(blob);
        previewUrl.current = objectUrl;
        setUrl(objectUrl);
      })
      .catch((error) => {
        if (!disposed) setError(message(error));
      });
    return () => {
      disposed = true;
      if (objectUrl && previewUrl.current === objectUrl) {
        URL.revokeObjectURL(objectUrl);
        previewUrl.current = "";
      }
    };
  }, [provider, ref, visible]);
  if (error)
    return (
      <span className="sr-only" role="status">
        {alt}: {error}
      </span>
    );
  return <span ref={marker} style={url ? { display: "contents" } : { display: "inline-block", width: 1, height: 1 }}><>{url ? (
    <img
      src={url}
      loading="lazy"
      decoding="async"
      alt={alt}
      className={className}
      onError={() => {
        if (previewUrl.current) {
          URL.revokeObjectURL(previewUrl.current);
          previewUrl.current = "";
        }
        setError("Image preview could not be decoded.");
        setUrl("");
      }}
    />
  ) : null}</></span>;
}

export function RoomAssetDownload({ asset }: { asset: HouseAttachment }) {
  const provider = useDataProvider<CrmDataProvider>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(false);
  async function download() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    let url = "";
    try {
      if (!validReference(asset.path))
        throw new Error("This is not a valid Room attachment reference.");
      const result = await provider.getAttachment(asset.path);
      const blob = result.blob;
      if (!blob) {
        setNotice(result.name);
        return;
      }
      url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        Array.from(asset.title, (char) => char.charCodeAt(0) < 32 || char === "/" || char === "\\" ? "_" : char).join("") || "attachment";
      anchor.click();
    } catch (error) {
      setError(message(error));
    } finally {
      if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="link"
        className="h-auto justify-start p-0"
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation();
          void download();
        }}
      >
        <Download className="size-4" />
        {busy ? "Loading Room file…" : asset.title}
      </Button>
      {notice && (
        <span role="status" className="text-xs text-muted-foreground">
          {notice}
        </span>
      )}
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}

/** Upload is an explicit user file choice. An ordinary document save links its reference. */
export function RoomAssetInput({
  source,
  label,
  multiple = false,
  imagesOnly = false,
}: {
  source: string;
  label: string;
  multiple?: boolean;
  imagesOnly?: boolean;
}) {
  const provider = useDataProvider<CrmDataProvider>();
  const form = useFormContext();
  const pending = useRef(false);
  const { field } = useController({
    name: source,
    control: form.control,
    rules: {
      validate: () =>
        pending.current ? "Wait for the Room upload to finish." : true,
    },
  });
  const inputId = useId();
  const alive = useRef(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const values: HouseAttachment[] = multiple
    ? Array.isArray(field.value)
      ? field.value
      : []
    : field.value
      ? [field.value]
      : [];
  async function upload(files: File[]) {
    if (pending.current || !files.length) return;
    pending.current = true;
    form.setError(source, {
      type: "upload-pending",
      message: "Wait for the Room upload to finish.",
    });
    setBusy(true);
    setError("");
    const accepted = [...values];
    try {
      for (const file of files) {
        if (imagesOnly && !(await isSafeRaster(file)))
          throw new Error(
            "Choose a PNG, JPEG, GIF, WebP or AVIF image up to 10 MiB.",
          );
        const asset = await provider.uploadAttachment(file);
        if (!alive.current) return;
        if (multiple) accepted.push(asset);
        else {
          accepted.splice(0, accepted.length, asset);
        }
        field.onChange(multiple ? [...accepted] : asset);
      }
    } catch (error) {
      if (alive.current) setError(message(error));
    } finally {
      pending.current = false;
      if (alive.current) {
        form.clearErrors(source);
        void form.trigger(source);
        setBusy(false);
      }
    }
  }
  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className="text-sm font-medium flex items-center gap-2"
      >
        <Paperclip className="size-4" />
        {label}
      </label>
      <input
        id={inputId}
        type="file"
        multiple={multiple}
        accept={
          imagesOnly
            ? "image/png,image/jpeg,image/gif,image/webp,image/avif"
            : undefined
        }
        disabled={busy || form.formState.isSubmitting}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void upload(files);
        }}
        className="block w-full rounded-md border border-dashed border-border p-4 text-sm"
      />
      {busy && (
        <p role="status" className="text-sm text-muted-foreground">
          Uploading to the Room…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {values.map((asset, index) => (
        <div
          key={`${asset.path}-${index}`}
          className="flex items-center gap-2 rounded-md border p-2"
        >
          <div className="min-w-0">
            {imagesOnly && (
              <RoomAssetImage
                asset={asset}
                alt={asset.title}
                className="h-16 w-16 object-cover rounded mb-2"
              />
            )}
            <RoomAssetDownload asset={asset} />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto"
            aria-label={`Remove ${asset.title} from this record`}
            disabled={busy || form.formState.isSubmitting}
            onClick={() =>
              field.onChange(
                multiple ? values.filter((_, i) => i !== index) : null,
              )
            }
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Save the form to link uploaded files. Removing a file here only removes
        its link; the file stays in the Room.
      </p>
    </div>
  );
}
