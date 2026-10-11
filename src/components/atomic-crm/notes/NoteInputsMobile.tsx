import { useEffect, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { required, useInput, useTranslate, ValidationError } from "ra-core";
import { AutocompleteInput, ReferenceInput } from "@/components/admin";

import { contactOptionText } from "../misc/ContactOption";
import { foreignKeyMapping } from "./foreignKeyMapping";
import { validateNoteOrAttachmentRequired } from "./noteModel";
import { TeamLabelInput } from "./TeamLabelInput";
import { RoomAssetInput } from "../misc/RoomAssets";

export const NoteInputsMobile = ({
  selectContact,
}: {
  selectContact?: boolean;
}) => {
  const translate = useTranslate();
  const { control, trigger, formState } = useFormContext();
  const attachments = useWatch({ control, name: "attachments" });
  const hasTextError = Boolean(formState.errors.text);
  useEffect(() => {
    if (hasTextError) void trigger("text");
  }, [attachments, hasTextError, trigger]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { field, fieldState } = useInput({
    source: "text",
    validate: validateNoteOrAttachmentRequired,
  });

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    requestAnimationFrame(() => {
      node.focus();
      // move cursor to end of text
      node.setSelectionRange(node.value.length, node.value.length);
    });
  }, []);

  return (
    <div className="flex flex-col flex-1 -m-4">
      <div className="flex-1 flex flex-col">
        <textarea
          {...field}
          ref={(node) => {
            field.ref(node);
            textareaRef.current = node;
          }}
          placeholder={translate("resources.notes.inputs.add_note")}
          className="flex-1 min-h-0 resize-none bg-background p-4 outline-none text-base"
        />
        {fieldState.error && (
          <p className="px-4 text-sm text-destructive">
            <ValidationError error={fieldState.error.message ?? ""} />
          </p>
        )}
      </div>
      {selectContact && (
        <div className="px-4 py-4">
          <ReferenceInput
            source={foreignKeyMapping["contacts"]}
            reference="contacts"
          >
            <AutocompleteInput
              label="resources.notes.fields.contact_id"
              optionText={contactOptionText}
              helperText={false}
              validate={required()}
              modal
            />
          </ReferenceInput>
        </div>
      )}
      <div className="px-4 space-y-3 pb-4">
        <RoomAssetInput
          source="attachments"
          label={translate("resources.notes.fields.attachments", {
            _: "Attachments",
          })}
          multiple
        />
        <TeamLabelInput />
      </div>
    </div>
  );
};
