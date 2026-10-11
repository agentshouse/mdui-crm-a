import { describe, expect, it } from "vitest";
import {
  isCompletedRoomAttachment,
  validateNoteOrAttachmentRequired,
} from "./noteModel";

const completed = {
  attachment_ref: "at_note-fixture",
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
    for (const ref of ["at_a", "at_opaque-ID:version", "at_123456789"]) {
      expect(
        validateNoteOrAttachmentRequired("", {
          attachments: [{ ...completed, attachment_ref: ref }],
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
    { ...completed, attachment_ref: "" },
    { ...completed, attachment_ref: "at_" },
    { ...completed, attachment_ref: "remote_id" },
    { ...completed, attachment_ref: "at_has space" },
    { ...completed, attachment_ref: "at_has/path" },
    { ...completed, attachment_ref: "at_has\\path" },
    { ...completed, attachment_ref: "https://example.invalid/attachment" },
    { ...completed, attachment_ref: "blob:pending" },
    { ...completed, attachment_ref: "data:text/plain,raw" },
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
