import { useRedirect } from "ra-core";
import { Form } from "@/house-form";
import { Create } from "@/components/admin/create";
import { SaveButton } from "@/components/admin/form";
import { FormToolbar } from "@/components/admin/simple-form";
import { Dialog, DialogContent } from "@/components/ui/dialog";

import { DealInputs } from "./DealInputs";

export const DealCreate = ({ open }: { open: boolean }) => {
  const redirect = useRedirect();

  const handleClose = () => {
    redirect("/deals");
  };

  const onSuccess = () => redirect("/deals");

  return (
    <Dialog open={open} onOpenChange={() => handleClose()}>
      <DialogContent className="lg:max-w-4xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
        <Create
          mutationMode="pessimistic"
          resource="deals"
          mutationOptions={{ onSuccess }}
        >
          <Form
            defaultValues={{
              contact_ids: [],
              index: 0,
            }}
          >
            <DealInputs />
            <FormToolbar>
              <SaveButton />
            </FormToolbar>
          </Form>
        </Create>
      </DialogContent>
    </Dialog>
  );
};
