import { isBinaryPath } from "@/binary-path";
import type { HouseAttachment } from "@/house";

/** Only completed Runtime references may make an attachment-only note valid. */
export const isCompletedRoomAttachment = (
  value: unknown,
): value is HouseAttachment => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const asset = value as Record<string, unknown>;
  const allowedFields = new Set([
    "path",
    "title",
    "type",
    "size",
    "sha256",
  ]);
  return (
    isBinaryPath(asset.path) &&
    typeof asset.title === "string" &&
    asset.title.trim().length > 0 &&
    typeof asset.type === "string" &&
    asset.type.trim().length > 0 &&
    Object.keys(asset).every((key) => allowedFields.has(key)) &&
    (asset.size === undefined ||
      (typeof asset.size === "number" &&
        Number.isSafeInteger(asset.size) &&
        asset.size >= 0)) &&
    (asset.sha256 === undefined ||
      (typeof asset.sha256 === "string" && /^[a-f0-9]{64}$/.test(asset.sha256)))
  );
};

export const validateNoteOrAttachmentRequired = (
  value: string | null | undefined,
  values?: { attachments?: unknown },
) => {
  const hasText = typeof value === "string" && value.trim().length > 0;
  const hasAttachment =
    Array.isArray(values?.attachments) &&
    values.attachments.some(isCompletedRoomAttachment);
  return hasText || hasAttachment
    ? undefined
    : "A note or a completed attachment is required";
};
