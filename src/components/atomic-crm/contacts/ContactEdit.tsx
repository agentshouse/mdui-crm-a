import { Card, CardContent } from "@/components/ui/card";
import { EditBase, useEditContext, type MutationMode } from "ra-core";
import { Form } from "@/house-form";

import type { Contact } from "../types";
import { ContactAside } from "./ContactAside";
import { ContactInputs } from "./ContactInputs";
import { FormToolbar } from "../layout/FormToolbar";
import {
  cleanupContactForEdit,
  defaultEmailJsonb,
  defaultPhoneJsonb,
} from "./contactModel";

export const ContactEdit = ({
  mutationMode: _mutationMode,
}: {
  mutationMode?: MutationMode;
}) => (
  <EditBase
    redirect="show"
    transform={cleanupContactForEdit}
    mutationMode="pessimistic"
  >
    <ContactEditContent />
  </EditBase>
);

const normalizeContactArrayFields = (record: Contact) => ({
  ...record,
  email_jsonb:
    record.email_jsonb && record.email_jsonb.length > 0
      ? record.email_jsonb
      : defaultEmailJsonb,
  phone_jsonb:
    record.phone_jsonb && record.phone_jsonb.length > 0
      ? record.phone_jsonb
      : defaultPhoneJsonb,
});

const ContactEditContent = () => {
  const { isPending, record } = useEditContext<Contact>();
  if (isPending || !record) return null;
  return (
    <div className="mt-2 flex gap-8">
      <Form
        className="flex flex-1 flex-col gap-4"
        record={normalizeContactArrayFields(record)}
      >
        <Card>
          <CardContent>
            <ContactInputs />
            <FormToolbar />
          </CardContent>
        </Card>
      </Form>

      <ContactAside link="show" />
    </div>
  );
};
