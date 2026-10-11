import { Paperclip } from "lucide-react";
import { RoomAssetDownload, RoomAssetImage } from "../misc/RoomAssets";
import type { ContactNote, DealNote } from "../types";
import { isCompletedRoomAttachment } from "./noteModel";

/** Persisted references are resolved only through the selected Room Runtime. */
export const NoteAttachments = ({ note }: { note: ContactNote | DealNote }) => {
  const attachments = note.attachments?.filter(isCompletedRoomAttachment) ?? [];
  if (!attachments.length) return null;
  const images = attachments.filter((asset) => asset.type.startsWith("image/"));
  const documents = attachments.filter(
    (asset) => !asset.type.startsWith("image/"),
  );

  return (
    <div className="mt-2 flex flex-col gap-2">
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {images.map((asset) => (
            <div key={asset.attachment_ref}>
              <RoomAssetImage
                asset={asset}
                alt={asset.title}
                className="w-[200px] h-[100px] object-cover object-left border border-border"
              />
              <RoomAssetDownload asset={asset} />
            </div>
          ))}
        </div>
      )}
      {documents.map((asset) => (
        <div key={asset.attachment_ref} className="flex items-center gap-2">
          <Paperclip className="w-4 h-4" />
          <RoomAssetDownload asset={asset} />
        </div>
      ))}
    </div>
  );
};
