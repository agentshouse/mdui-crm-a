import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import {
  CoreAdminContext,
  memoryStore,
  testDataProvider,
  type DataProvider,
} from "ra-core";
import polyglotI18nProvider from "ra-i18n-polyglot";
import englishMessages from "ra-language-english";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { englishCrmMessages } from "../providers/commons/englishCrmMessages";
import type { ImportBatchResult, ImportRow, ImportableResource } from "./types";

const state = vi.hoisted(() => ({
  batch: vi.fn(),
  version: 1,
  assignments: [] as (string | null)[],
  toast: vi.fn(),
  dismiss: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { custom: state.toast, dismiss: state.dismiss },
}));
vi.mock("./useImportableResources", () => ({
  useImportableResources: (assignment: string | null) => {
    state.assignments.push(assignment);
    const version = state.version;
    return ["contacts", "companies", "deals"].map((name) => ({
      name,
      sampleCsv: "first_name,last_name\nAda,Lovelace",
      textColumns: ["phone_work"],
      processBatch: (rows: ImportRow[]) =>
        state.batch(rows, assignment, version, name),
    }));
  },
}));
import { DataImportButton } from "./DataImportButton";
import { DataImportDialog, UNASSIGNED_IMPORT } from "./DataImportDialog";
import { DataImportProvider } from "./DataImportProvider";

const messages = polyglotI18nProvider(() => ({
  ...englishMessages,
  ...englishCrmMessages,
}));
function Wrapper({ children }: { children: ReactNode }) {
  return (
    <CoreAdminContext
      dataProvider={testDataProvider({
        getList: async () => ({
          data: [{ id: "team-north", first_name: "North", last_name: "Team" }],
          total: 1,
        }),
      } as unknown as Partial<DataProvider>)}
      i18nProvider={messages}
      queryClient={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false, gcTime: 0 },
            mutations: { retry: false },
          },
        })
      }
      store={memoryStore()}
    >
      {children}
    </CoreAdminContext>
  );
}
const resource: ImportableResource = {
  name: "contacts",
  sampleCsv: "first_name,last_name\nAda,Lovelace",
  processBatch: async () => ({ created: 1, errors: [] }),
};
const file = (
  text = "first_name,last_name\nAda,Lovelace\nGrace,Hopper",
  name = "contacts.csv",
) => {
  const value = new File([text], name, { type: "text/csv" });
  Object.defineProperty(value, "text", { value: async () => text });
  return value;
};
async function chooseAssignment(name: string) {
  fireEvent.keyDown(screen.getByLabelText("Team label for imported records"), {
    key: "ArrowDown",
  });
  fireEvent.click(await screen.findByRole("option", { name }));
}
async function startRun(assignment = "Leave unassigned") {
  fireEvent.click(screen.getByRole("button", { name: "Import CSV" }));
  await chooseAssignment(assignment);
  fireEvent.change(screen.getByLabelText("CSV File"), {
    target: { files: [file()] },
  });
  fireEvent.click(screen.getByRole("button", { name: "Start import" }));
}
function latestToast() {
  const callback = state.toast.mock.calls.at(-1)?.[0];
  if (!callback) throw new Error("No import toast was emitted");
  return callback();
}
afterEach(() => vi.restoreAllMocks());
beforeEach(() => {
  vi.clearAllMocks();
  state.version = 1;
  state.assignments = [];
  state.batch.mockResolvedValue({ created: 1, errors: [] });
});

describe("Donor-shaped local CSV dialog", () => {
  it("requires an explicit assignment and shows local filename without URL preview", async () => {
    const onStart = vi.fn();
    const onAssignmentChange = vi.fn();
    const view = render(
      <Wrapper>
        <DataImportDialog
          open
          resources={[resource]}
          resource={resource}
          assignment=""
          isImporting={false}
          onAssignmentChange={onAssignmentChange}
          onResourceChange={vi.fn()}
          onStart={onStart}
          onClose={vi.fn()}
        />
      </Wrapper>,
    );
    const csv = file();
    fireEvent.change(screen.getByLabelText("CSV File"), {
      target: { files: [csv] },
    });
    expect(screen.getByRole("button", { name: "Start import" })).toBeDisabled();
    expect(screen.getByText("contacts.csv")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    await chooseAssignment("Leave unassigned");
    expect(onAssignmentChange).toHaveBeenCalledWith(UNASSIGNED_IMPORT);
    view.rerender(
      <Wrapper>
        <DataImportDialog
          open
          resources={[resource]}
          resource={resource}
          assignment={UNASSIGNED_IMPORT}
          isImporting={false}
          onAssignmentChange={onAssignmentChange}
          onResourceChange={vi.fn()}
          onStart={onStart}
          onClose={vi.fn()}
        />
      </Wrapper>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Start import" }));
    expect(onStart).toHaveBeenCalledWith(csv);
    expect(screen.getByText(/parsed locally/)).toHaveTextContent(
      "queued does not mean synchronized",
    );
  });

  it("offers an existing Room label and rejects non-CSV files", async () => {
    const onAssignmentChange = vi.fn();
    render(
      <Wrapper>
        <DataImportDialog
          open
          resources={[resource]}
          resource={resource}
          assignment=""
          isImporting={false}
          onAssignmentChange={onAssignmentChange}
          onResourceChange={vi.fn()}
          onStart={vi.fn()}
          onClose={vi.fn()}
        />
      </Wrapper>,
    );
    await chooseAssignment("North Team");
    expect(onAssignmentChange).toHaveBeenCalledWith("team-north");
    fireEvent.change(screen.getByLabelText("CSV File"), {
      target: { files: [file("not csv", "image.png")] },
    });
    expect(screen.getByText("Choose one local .csv file.")).toHaveAttribute(
      "role",
      "alert",
    );
    expect(screen.getByRole("button", { name: "Start import" })).toBeDisabled();
  });

  it("downloads only the embedded local sample and revokes its temporary URL", async () => {
    const create = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:local-sample");
    const revoke = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    render(
      <Wrapper>
        <DataImportDialog
          open
          resources={[resource]}
          resource={resource}
          assignment=""
          isImporting={false}
          onAssignmentChange={vi.fn()}
          onResourceChange={vi.fn()}
          onStart={vi.fn()}
          onClose={vi.fn()}
        />
      </Wrapper>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Download CSV sample" }),
    );
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(click.mock.instances[0]).toHaveAttribute(
      "download",
      "crm_contacts_sample.csv",
    );
    expect(click.mock.instances[0]).toHaveAttribute(
      "href",
      "blob:local-sample",
    );
    await waitFor(
      () => expect(revoke).toHaveBeenCalledWith("blob:local-sample"),
      { timeout: 1500 },
    );
  });

  it("freezes the controls while a run is active", () => {
    render(
      <Wrapper>
        <DataImportDialog
          open
          resources={[resource]}
          resource={resource}
          assignment={UNASSIGNED_IMPORT}
          isImporting
          onAssignmentChange={vi.fn()}
          onResourceChange={vi.fn()}
          onStart={vi.fn()}
          onClose={vi.fn()}
        />
      </Wrapper>,
    );
    expect(
      screen.getByLabelText("Team label for imported records"),
    ).toBeDisabled();
    expect(screen.getByLabelText("CSV File")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Start import" })).toBeDisabled();
  });
});

describe("Local import run controls", () => {
  it("imports unassigned only after an explicit choice and reports queued counts", async () => {
    render(
      <Wrapper>
        <DataImportProvider>
          <DataImportButton resource="contacts" />
        </DataImportProvider>
      </Wrapper>,
    );
    await startRun();
    await waitFor(() => expect(state.batch).toHaveBeenCalledTimes(2));
    expect(state.batch.mock.calls.every((call) => call[1] === null)).toBe(true);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Import CSV" }),
      ).not.toBeDisabled(),
    );
    render(latestToast());
    expect(screen.getByText("Import finished queuing")).toBeInTheDocument();
    expect(screen.getByText(/2 \/ 2 records queued/)).toBeInTheDocument();
    expect(screen.getByText(/waiting to synchronize/)).toBeInTheDocument();
  });

  it("keeps the selected processor and team label frozen through re-renders", async () => {
    let resolve!: (value: ImportBatchResult) => void;
    state.batch.mockImplementationOnce(
      () =>
        new Promise<ImportBatchResult>((done) => {
          resolve = done;
        }),
    );
    const view = render(
      <Wrapper>
        <DataImportProvider>
          <DataImportButton resource="contacts" />
        </DataImportProvider>
      </Wrapper>,
    );
    await startRun("North Team");
    await waitFor(() => expect(state.batch).toHaveBeenCalledOnce());
    state.version = 2;
    view.rerender(
      <Wrapper>
        <DataImportProvider>
          <DataImportButton resource="contacts" />
        </DataImportProvider>
      </Wrapper>,
    );
    await act(async () => {
      resolve({ created: 1, errors: [] });
    });
    await waitFor(() => expect(state.batch).toHaveBeenCalledTimes(2));
    expect(state.batch.mock.calls.map((call) => [call[1], call[2]])).toEqual([
      ["team-north", 1],
      ["team-north", 1],
    ]);
  });

  it("stop waits for the in-flight row and reports its actual queued result", async () => {
    let resolve!: (value: ImportBatchResult) => void;
    state.batch.mockImplementationOnce(
      () =>
        new Promise<ImportBatchResult>((done) => {
          resolve = done;
        }),
    );
    render(
      <Wrapper>
        <DataImportProvider>
          <DataImportButton resource="contacts" />
        </DataImportProvider>
      </Wrapper>,
    );
    await startRun();
    await waitFor(() => expect(state.batch).toHaveBeenCalledOnce());
    const progress = render(latestToast());
    fireEvent.click(screen.getByRole("button", { name: "Stop import" }));
    expect(screen.getByRole("button", { name: "Import CSV" })).toBeDisabled();
    await act(async () => {
      resolve({ created: 1, errors: [] });
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Import CSV" }),
      ).not.toBeDisabled(),
    );
    expect(state.batch).toHaveBeenCalledOnce();
    progress.rerender(latestToast());
    expect(screen.getByText("Import stopped")).toBeInTheDocument();
    expect(screen.getByText(/1 \/ 2 records queued/)).toBeInTheDocument();
  });

  it("shows partial failure details and never retries the failed row", async () => {
    state.batch
      .mockResolvedValueOnce({ created: 1, errors: [] })
      .mockResolvedValueOnce({
        created: 0,
        errors: ["House has an unfinished draft. Resolve it before retrying."],
      });
    render(
      <Wrapper>
        <DataImportProvider>
          <DataImportButton resource="contacts" />
        </DataImportProvider>
      </Wrapper>,
    );
    await startRun();
    await waitFor(() => expect(state.batch).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Import CSV" }),
      ).not.toBeDisabled(),
    );
    render(latestToast());
    expect(
      screen.getByText(/1 \/ 2 records queued.*1 rows need attention/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Row 3: House has an unfinished draft/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Related companies or tags may already be queued/),
    ).toBeInTheDocument();
    expect(state.batch).toHaveBeenCalledTimes(2);
  });
});
