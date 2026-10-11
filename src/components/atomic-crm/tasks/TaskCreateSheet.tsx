import {
  type Identifier,
  useGetOne,
  useGetRecordRepresentation,
  useNotify,
  useTranslate,
} from "ra-core";
import { CreateSheet } from "../misc/CreateSheet";
import { TaskFormContent } from "./TaskFormContent";

export interface TaskCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact_id?: Identifier;
}

export const TaskCreateSheet = ({
  open,
  onOpenChange,
  contact_id,
}: TaskCreateSheetProps) => {
  const translate = useTranslate();
  const getContactRepresentation = useGetRecordRepresentation("contacts");

  const selectContact = contact_id == null;
  const { data: contact } = useGetOne(
    "contacts",
    { id: contact_id! },
    { enabled: !selectContact },
  );
  const notify = useNotify();

  const handleSuccess = () => {
    notify("resources.tasks.added");
    onOpenChange(false);
  };

  return (
    <CreateSheet
      mutationMode="pessimistic"
      resource="tasks"
      title={
        <span className="text-xl font-semibold truncate pr-10">
          {!selectContact
            ? translate("resources.tasks.dialog.create_for", {
                name: getContactRepresentation(contact!),
              })
            : translate("resources.tasks.dialog.create")}
        </span>
      }
      redirect={false}
      record={{
        type: "none",
        contact_id,
        due_date: new Date().toISOString(),
      }}
      mutationOptions={{
        onSuccess: handleSuccess,
      }}
      open={open}
      onOpenChange={onOpenChange}
    >
      <TaskFormContent selectContact={selectContact} />
    </CreateSheet>
  );
};
