import { CreateBase, type MutationMode } from "ra-core";
import { Form } from "@/house-form";
import { Card, CardContent } from "@/components/ui/card";

import { ContactInputs } from "./ContactInputs";
import { FormToolbar } from "../layout/FormToolbar";
import {
  cleanupContactForCreate,
  defaultEmailJsonb,
  defaultPhoneJsonb,
} from "./contactModel";

export const ContactCreate = ({
  mutationMode: _mutationMode,
}: {
  mutationMode?: MutationMode;
}) => {
  return (
    <CreateBase
      redirect="show"
      transform={cleanupContactForCreate}
      mutationMode="pessimistic"
    >
      <div className="mt-2 flex lg:mr-72">
        <div className="flex-1">
          <Form
            defaultValues={{
              email_jsonb: defaultEmailJsonb,
              phone_jsonb: defaultPhoneJsonb,
            }}
          >
            <Card>
              <CardContent>
                <ContactInputs />
                <FormToolbar />
              </CardContent>
            </Card>
          </Form>
        </div>
      </div>
    </CreateBase>
  );
};
