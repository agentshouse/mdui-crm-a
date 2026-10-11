import { EllipsisVertical, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import {
  type Identifier,
  useCreatePath,
  useDeleteController,
  useGetRecordRepresentation,
  useRecordContext,
  useNotify,
  useTranslate,
} from "ra-core";
import { ReferenceField } from "@/components/admin";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { EditSheet } from "../misc/EditSheet";
import { foreignKeyMapping } from "./foreignKeyMapping";
import { NoteInputsMobile } from "./NoteInputsMobile";

export interface NoteEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: Identifier;
}

export const NoteEditSheet = ({
  open,
  onOpenChange,
  noteId,
}: NoteEditSheetProps) => {
  const createPath = useCreatePath();
  const translate = useTranslate();
  const getRedirectTo = (record: any) => {
    return createPath({
      resource: "contacts",
      type: "show",
      id: record ? record[foreignKeyMapping["contacts"]] : undefined,
    });
  };
  const getContactRepresentation = useGetRecordRepresentation("contacts");

  return (
    <EditSheet
      resource="contact_notes"
      id={noteId}
      mutationMode="pessimistic"
      title={
        <ReferenceField
          source={foreignKeyMapping["contacts"]}
          reference="contacts"
          render={({ referenceRecord }) => (
            <span className="text-xl font-semibold truncate">
              {referenceRecord
                ? translate("resources.notes.sheet.edit_for", {
                    name: getContactRepresentation(referenceRecord),
                  })
                : translate("resources.notes.sheet.edit")}
            </span>
          )}
        />
      }
      redirect={(_resource, _id, record) => getRedirectTo(record)}
      open={open}
      onOpenChange={onOpenChange}
      headerActions={
        <NoteEditMenuButton
          onOpenChange={onOpenChange}
          getRedirectTo={getRedirectTo}
        />
      }
    >
      <NoteInputsMobile />
    </EditSheet>
  );
};

const NoteEditMenuButton = ({
  onOpenChange,
  getRedirectTo,
}: {
  onOpenChange: (open: boolean) => void;
  getRedirectTo: (record: any) => string;
}) => {
  const translate = useTranslate();
  const record = useRecordContext();
  const notify = useNotify();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deletePendingRef = useRef(false);
  const { handleDelete, isPending } = useDeleteController({
    record,
    resource: "contact_notes",
    redirect: getRedirectTo(record),
    mutationMode: "pessimistic",
    mutationOptions: {
      onError: (error: Error) => {
        setDeleteError(error.message);
        notify(error.message, { type: "error" });
      },
      onSettled: (_data, error) => {
        deletePendingRef.current = false;
        if (!error) onOpenChange(false);
      },
    },
  });

  const onDelete = () => {
    if (!record || deletePendingRef.current) return;
    if (!window.confirm("Delete this note from the Room?")) return;
    deletePendingRef.current = true;
    setDeleteError(null);
    handleDelete();
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={isPending}
            className="opacity-70 transition-opacity hover:opacity-100 rounded-xs"
          >
            <EllipsisVertical className="size-6" />
            <span className="sr-only">
              {translate("ra.action.open_menu", { _: "More" })}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            className="h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
            onSelect={onDelete}
            disabled={isPending || !record}
          >
            <Trash2 />
            {translate("ra.action.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {deleteError && (
        <p role="alert" className="max-w-64 text-sm text-destructive">
          {deleteError}
        </p>
      )}
    </div>
  );
};
