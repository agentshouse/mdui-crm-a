import { Plus } from "lucide-react";
import {
  CreateBase,
  useGetRecordRepresentation,
  useNotify,
  useRecordContext,
  useTranslate,
} from "ra-core";
import { Form } from "@/house-form";
import { useState } from "react";
import { SaveButton } from "@/components/admin/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { TaskFormContent } from "./TaskFormContent";

export const AddTask = ({
  selectContact,
  display = "chip",
}: {
  selectContact?: boolean;
  display?: "chip" | "icon";
}) => {
  const notify = useNotify();
  const translate = useTranslate();
  const contact = useRecordContext();
  const [open, setOpen] = useState(false);
  const handleOpen = () => {
    setOpen(true);
  };
  const getContactRepresentation = useGetRecordRepresentation("contacts");

  const handleSuccess = () => {
    setOpen(false);
    notify("resources.tasks.added");
  };

  return (
    <>
      {display === "icon" ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="p-2 cursor-pointer"
                onClick={handleOpen}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {translate("resources.tasks.action.create")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <div className="my-2">
          <Button
            variant="outline"
            className="h-6 cursor-pointer"
            onClick={handleOpen}
            size="sm"
          >
            <Plus className="w-4 h-4" />
            {translate("resources.tasks.action.add")}
          </Button>
        </div>
      )}

      <CreateBase
        mutationMode="pessimistic"
        resource="tasks"
        record={{
          type: "none",
          contact_id: contact?.id,
          due_date: new Date().toISOString(),
        }}
        mutationOptions={{ onSuccess: handleSuccess }}
      >
        <Dialog open={open} onOpenChange={() => setOpen(false)}>
          <DialogContent className="lg:max-w-xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
            <Form className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>
                  {!selectContact
                    ? translate("resources.tasks.dialog.create_for", {
                        name: getContactRepresentation(contact!),
                      })
                    : translate("resources.tasks.dialog.create")}
                </DialogTitle>
              </DialogHeader>
              <TaskFormContent selectContact={selectContact} />
              <DialogFooter className="w-full justify-end">
                <SaveButton />
              </DialogFooter>
            </Form>
          </DialogContent>
        </Dialog>
      </CreateBase>
    </>
  );
};
