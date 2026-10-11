import { useEffect, useRef, useState } from "react";
import {
  Form,
  useGetList,
  useGetResourceLabel,
  useResourceTranslation,
  useTranslate,
} from "ra-core";
import { FileText, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormToolbar } from "@/components/admin/simple-form";
import type { Sale } from "../types";
import type { ImportableResource } from "./types";
import type { ImportableResourceName } from "./useImportableResources";

export const UNASSIGNED_IMPORT = "__unassigned__";
type DataImportDialogProps = {
  open: boolean;
  resources: ImportableResource[];
  resource: ImportableResource;
  assignment: string;
  isImporting: boolean;
  onAssignmentChange(value: string): void;
  onResourceChange(name: ImportableResourceName): void;
  onStart(file: File): void;
  onClose(): void;
};

export function DataImportDialog({
  open,
  resources,
  resource,
  assignment,
  isImporting,
  onAssignmentChange,
  onResourceChange,
  onStart,
  onClose,
}: DataImportDialogProps) {
  const translate = useTranslate();
  const getResourceLabel = useGetResourceLabel();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const {
    data: sales = [],
    isPending: salesPending,
    error: salesError,
  } = useGetList<Sale>(
    "sales",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "last_name", order: "ASC" },
      filter: { "disabled@neq": true },
    },
    { enabled: open },
  );
  const assignmentValid =
    assignment === UNASSIGNED_IMPORT ||
    sales.some((sale) => String(sale.id) === assignment);

  useEffect(() => {
    setFile(null);
    setFileError("");
    if (fileInput.current) fileInput.current.value = "";
  }, [resource.name, open]);
  const title = useResourceTranslation({
    resourceI18nKey:
      resources.length === 1
        ? `resources.${resource.name}.import.title`
        : undefined,
    baseI18nKey: "crm.data_import.title",
  });
  const acceptFile = (files: File[]) => {
    if (isImporting) return;
    if (files.length !== 1 || !/\.csv$/i.test(files[0]?.name ?? "")) {
      setFile(null);
      setFileError("Choose one local .csv file.");
      return;
    }
    setFile(files[0]);
    setFileError("");
  };
  const downloadSample = () => {
    const url = URL.createObjectURL(
      new Blob([resource.sampleCsv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `crm_${resource.name}_sample.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => !isOpen && !isImporting && onClose()}
    >
      <DialogContent className="max-w-[calc(100%-2rem)] gap-6 p-6 sm:max-w-2xl sm:p-8 max-h-[90dvh] overflow-y-auto">
        <Form key={resource.name} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col space-y-6">
            {resources.length > 1 && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="data-import-resource">
                  {translate("crm.data_import.resource")}
                </Label>
                <Select
                  value={resource.name}
                  disabled={isImporting}
                  onValueChange={(name) => {
                    if (resources.some((item) => item.name === name))
                      onResourceChange(name as ImportableResourceName);
                  }}
                >
                  <SelectTrigger id="data-import-resource" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {resources.map(({ name }) => (
                      <SelectItem key={name} value={name}>
                        {getResourceLabel(name, 2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="data-import-assignment">
                Team label for imported records
              </Label>
              <Select
                value={assignment}
                disabled={isImporting}
                onValueChange={onAssignmentChange}
              >
                <SelectTrigger id="data-import-assignment" className="w-full">
                  <SelectValue placeholder="Choose an assignment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED_IMPORT}>
                    Leave unassigned
                  </SelectItem>
                  {sales.map((sale) => (
                    <SelectItem key={sale.id} value={String(sale.id)}>
                      {`${sale.first_name} ${sale.last_name}`.trim()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose explicitly. Team labels are Room records, not signed-in
                people. This choice stays fixed during the import.
              </p>
              {salesPending && (
                <p className="text-xs text-muted-foreground">
                  Loading Room team labels…
                </p>
              )}
              {salesError && (
                <p role="alert" className="text-sm text-destructive">
                  Room team labels could not be loaded. You can retry later or
                  explicitly leave records unassigned.
                </p>
              )}
              {!!assignment && !assignmentValid && (
                <p role="alert" className="text-sm text-destructive">
                  Choose an available Room team label or leave unassigned.
                </p>
              )}
            </div>
            <Alert>
              <AlertDescription className="flex flex-col gap-4">
                {translate("crm.data_import.sample_hint")}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={downloadSample}
                >
                  {translate("crm.data_import.sample_download")}
                </Button>
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="data-import-file">
                {translate("crm.data_import.csv_file")}
              </Label>
              <div
                className="border-2 border-dashed border-muted rounded-lg p-6 text-center transition-colors hover:border-sidebar-ring focus:outline-none bg-muted text-muted-foreground cursor-pointer"
                onClick={(event) => {
                  if (event.target !== fileInput.current && !isImporting)
                    fileInput.current?.click();
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  acceptFile(Array.from(event.dataTransfer.files));
                }}
              >
                <input
                  ref={fileInput}
                  id="data-import-file"
                  type="file"
                  accept=".csv,text/csv"
                  disabled={isImporting}
                  onChange={(event) =>
                    acceptFile(Array.from(event.target.files ?? []))
                  }
                  className="block w-full text-sm"
                />
                <p className="mt-2 text-sm text-muted-foreground">
                  Drop a CSV file here, or click to select one. Up to 5 MiB and
                  5,000 rows.
                </p>
              </div>
              {file && (
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="size-4" />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove selected CSV"
                    disabled={isImporting}
                    onClick={() => {
                      setFile(null);
                      if (fileInput.current) fileInput.current.value = "";
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              )}
              {fileError && (
                <p role="alert" className="text-sm text-destructive">
                  {fileError}
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              CSV photo or attachment URLs and owner columns are unsupported.
              Add photos and files in the editor; choose assignment above. JSON
              dump import is unavailable.
            </p>
            <p className="text-xs text-muted-foreground">
              The CSV is parsed locally. Records are queued to this House Room;
              queued does not mean synchronized. Missing companies or tags may
              be created. A row needing attention can leave related records
              already queued. The import pauses after the first such row. Review
              errors before starting another import; rows are never retried
              automatically.
            </p>
          </div>
        </Form>
        <div className="flex justify-start">
          <FormToolbar>
            <Button
              type="button"
              onClick={() => {
                if (file && assignmentValid && !isImporting) onStart(file);
              }}
              disabled={!file || !assignmentValid || isImporting}
            >
              {translate("crm.data_import.start")}
            </Button>
          </FormToolbar>
        </div>
      </DialogContent>
    </Dialog>
  );
}
