import { useQueryClient } from "@tanstack/react-query";
import {
  type Identifier,
  useGetOne,
  useGetRecordRepresentation,
  useNotify,
  useRedirect,
  useTranslate,
} from "ra-core";
import { CreateSheet } from "../misc/CreateSheet";
import { foreignKeyMapping } from "./foreignKeyMapping";
import { NoteInputsMobile } from "./NoteInputsMobile";
import { getCurrentDate } from "./utils";

export interface NoteCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact_id?: Identifier;
}

export const NoteCreateSheet = ({
  open,
  onOpenChange,
  contact_id,
}: NoteCreateSheetProps) => {
  const selectContact = contact_id == null;
  const { data: contact } = useGetOne(
    "contacts",
    { id: contact_id! },
    { enabled: !selectContact },
  );
  const queryClient = useQueryClient();
  const notify = useNotify();
  const redirect = useRedirect();
  const translate = useTranslate();
  const getContactRepresentation = useGetRecordRepresentation("contacts");
  const defaultStatus = selectContact ? undefined : contact?.status;

  const handleSuccess = (data: any) => {
    // The Room provider updates contact status and last_seen with the note.
    // Refresh those reads without issuing a second write.
    void queryClient.invalidateQueries({ queryKey: ["contacts"] });
    const referenceRecordId = data[foreignKeyMapping["contacts"]];
    if (referenceRecordId == null) return;
    notify("resources.notes.added", {
      messageArgs: {
        _: "Note added",
      },
    });
    redirect("show", "contacts", referenceRecordId);
    onOpenChange(false);
  };

  return (
    <CreateSheet
      key={String(contact_id ?? "choose-contact")}
      defaultValues={{contact_id:contact_id??null,text:"",date:getCurrentDate(),attachments:[],...(defaultStatus?{status:defaultStatus}:{})}}
      resource="contact_notes"
      mutationMode="pessimistic"
      title={
        <span className="text-xl font-semibold truncate">
          {!selectContact
            ? translate("resources.notes.sheet.create_for", {
                name: contact ? getContactRepresentation(contact) : "",
              })
            : translate("resources.notes.sheet.create")}
        </span>
      }
      redirect={false}
      transform={(data: any) => ({
        ...data,
        [foreignKeyMapping["contacts"]]:
          contact_id ?? data[foreignKeyMapping["contacts"]],
        date: new Date(data.date || getCurrentDate()).toISOString(),
        status: defaultStatus,
      })}
      mutationOptions={{ onSuccess: handleSuccess }}
      open={open}
      onOpenChange={onOpenChange}
    >
      <NoteInputsMobile selectContact={selectContact} />
    </CreateSheet>
  );
};
