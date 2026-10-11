import {
  EditBase,
  useNotify,
  useTranslate,
  type Identifier,
} from "ra-core";
import { Form } from "@/house-form";
import { DeleteButton } from "@/components/admin/delete-button";
import { SaveButton } from "@/components/admin/form";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { TaskFormContent } from "./TaskFormContent";

export const TaskEdit = ({
  open,
  close,
  taskId,
}: {
  taskId: Identifier;
  open: boolean;
  close: () => void;
}) => {
  const notify = useNotify();
  const translate = useTranslate();
  return (
    <Dialog open={open} onOpenChange={close}>
      {open && taskId && (
        <EditBase
          mutationMode="pessimistic"
          id={taskId}
          resource="tasks"
          className="mt-0"
          mutationOptions={{
            onSuccess: () => {
              close();
              notify("resources.tasks.updated", {
                type: "info",
                undoable: false,
              });
            },
          }}
          redirect={false}
        >
          <DialogContent className="lg:max-w-xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
            <Form className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>
                  {translate("resources.tasks.action.edit")}
                </DialogTitle>
              </DialogHeader>
              <TaskFormContent />
              <DialogFooter className="w-full sm:justify-between gap-4">
                <DeleteButton
                  mutationMode="pessimistic"
                  mutationOptions={{
                    onSuccess: () => {
                      close();
                      notify("resources.tasks.deleted", {
                        type: "info",
                        undoable: false,
                      });
                    },
                  }}
                  redirect={false}
                />
                <SaveButton label="ra.action.save" />
              </DialogFooter>
            </Form>
          </DialogContent>
        </EditBase>
      )}
    </Dialog>
  );
};
