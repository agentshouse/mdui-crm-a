import { useQueryClient } from "@tanstack/react-query";
import {
  CreateBase,
  useListContext,
  useNotify,
  useRecordContext,
  useResourceContext,
  useTranslate,
  type Identifier,
  type RaRecord,
} from "ra-core";
import { Form } from "@/house-form";
import { useState } from "react";
import { SaveButton } from "@/components/admin/form";
import { cn } from "@/lib/utils";

import { NoteInputs } from "./NoteInputs";
import { getCurrentDate } from "./utils";
import { foreignKeyMapping } from "./foreignKeyMapping";

export const NoteCreate = ({
  reference,
  showStatus,
  className,
}: {
  reference: "contacts" | "deals";
  showStatus?: boolean;
  className?: string;
}) => {
  const [creation,setCreation]=useState(0);
  const resource = useResourceContext();
  const record = useRecordContext();

  if (!record) return null;

  const defaultStatus = reference === "contacts" ? record.status : undefined;

  return (
    <CreateBase key={`${record.id}/${creation}`} resource={resource} redirect={false} mutationMode="pessimistic">
      <Form defaultValues={{ [foreignKeyMapping[reference]]: record.id, date: getCurrentDate(), text: "", attachments: [], ...(defaultStatus ? { status: defaultStatus } : {}) }}>
        <div className={cn("space-y-3", className)}>
          <NoteInputs defaultStatus={defaultStatus} showStatus={showStatus} />
          <NoteCreateButton
            record={record}
            reference={reference}
            onCreated={()=>setCreation(value=>value+1)}
          />
        </div>
      </Form>
    </CreateBase>
  );
};

const NoteCreateButton = ({
  reference,
  record,
  onCreated,
}: {
  reference: "contacts" | "deals";
  record: RaRecord<Identifier>;
  onCreated:()=>void;
}) => {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const translate = useTranslate();
  const { refetch } = useListContext();

  if (!record) return null;

  const handleSuccess = () => {
    // The Room provider updates contact status and last_seen with the note.
    // Refresh those reads without issuing a second write.
    void queryClient.invalidateQueries({ queryKey: ["contacts"] });
    onCreated();
    refetch();
    notify("resources.notes.added", {
      messageArgs: {
        _: "Note added",
      },
    });
  };

  return (
    <div className="flex justify-end">
      <SaveButton
        type="button"
        label={translate("resources.notes.action.add_this")}
        transform={(data) => ({
          ...data,
          [foreignKeyMapping[reference]]: record.id,
          date: new Date(data.date || getCurrentDate()).toISOString(),
        })}
        mutationOptions={{
          onSuccess: handleSuccess,
        }}
      />
    </div>
  );
};
