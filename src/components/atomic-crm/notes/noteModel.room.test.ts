import { describe, expect, it } from "vitest";
import {
  isCompletedRoomAttachment,
  validateNoteOrAttachmentRequired,
} from "./noteModel";

const completed = {
  path: "files/note-fixture",
  title: "evidence.pdf",
  type: "application/pdf",
};

describe("Room note text-or-attachment validation", () => {
  it("accepts nonempty text without attachments", () => {
    expect(
      validateNoteOrAttachmentRequired(" A call summary "),
    ).toBeUndefined();
  });

  it.each([undefined, null, "", " \n\t"])(
    "requires text or a completed reference for %s",
    (text) => {
      expect(validateNoteOrAttachmentRequired(text, { attachments: [] })).toBe(
        "A note or a completed attachment is required",
      );
    },
  );

  it("accepts an attachment-only note without inventing reference length or encoding rules", () => {
    for (const ref of ["files/a", "files/opaque-ID-version", "images/123456789"]) {
      expect(
        validateNoteOrAttachmentRequired("", {
          attachments: [{ ...completed, path: ref }],
        }),
      ).toBeUndefined();
    }
    expect(
      isCompletedRoomAttachment({
        ...completed,
        size: 0,
        sha256: "a".repeat(64),
      }),
    ).toBe(true);
  });

  it.each([
    null,
    {},
    { title: "pending.pdf", type: "application/pdf" },
    { ...completed, path: "" },
    { ...completed, path: "at_" },
    { ...completed, path: "remote_id" },
    { ...completed, path: "at_has space" },
    { ...completed, path: "files/../path" },
    { ...completed, path: "at_has\\path" },
    { ...completed, path: "https://example.invalid/attachment" },
    { ...completed, path: "blob:pending" },
    { ...completed, path: "data:text/plain,raw" },
    { ...completed, src: "blob:pending" },
    { ...completed, rawFile: {} },
    { ...completed, url: "https://example.invalid/attachment" },
    { ...completed, uploading: true },
    { ...completed, title: " " },
    { ...completed, type: "" },
    { ...completed, size: -1 },
    { ...completed, size: 1.5 },
    { ...completed, sha256: "invalid" },
  ])(
    "rejects incomplete, malformed, or legacy attachment descriptors: %j",
    (asset) => {
      expect(isCompletedRoomAttachment(asset)).toBe(false);
      expect(
        validateNoteOrAttachmentRequired("", { attachments: [asset] }),
      ).toBe("A note or a completed attachment is required");
    },
  );

  it("requires the attachments collection to be an array", () => {
    expect(
      validateNoteOrAttachmentRequired("", { attachments: completed }),
    ).toBe("A note or a completed attachment is required");
  });
});
