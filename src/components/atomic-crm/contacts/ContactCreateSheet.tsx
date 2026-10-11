import { useTranslate } from "ra-core";
import { CreateSheet } from "../misc/CreateSheet";
import { ContactInputs } from "./ContactInputs";
import {
  cleanupContactForCreate,
  defaultEmailJsonb,
  defaultPhoneJsonb,
} from "./contactModel";

export interface ContactCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ContactCreateSheet = ({
  open,
  onOpenChange,
}: ContactCreateSheetProps) => {
  const translate = useTranslate();
  return (
    <CreateSheet
      mutationMode="pessimistic"
      resource="contacts"
      title={translate("resources.contacts.action.new")}
      defaultValues={{
        email_jsonb: defaultEmailJsonb,
        phone_jsonb: defaultPhoneJsonb,
      }}
      transform={cleanupContactForCreate}
      open={open}
      onOpenChange={onOpenChange}
    >
      <ContactInputs />
    </CreateSheet>
  );
};
