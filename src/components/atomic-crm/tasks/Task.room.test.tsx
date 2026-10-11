import type * as RaCore from "ra-core";
import type * as ReactQuery from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Task as TaskRecord } from "../types";

const state = vi.hoisted(() => ({
  update: vi.fn(),
  notify: vi.fn(),
  handleDelete: vi.fn(),
  invalidateQueries: vi.fn(),
}));
vi.mock("ra-core", async (importOriginal) => ({
  ...(await importOriginal<typeof RaCore>()),
  useUpdate: () => [state.update, { isPending: false, isSuccess: false }],
  useDeleteController: () => ({
    handleDelete: state.handleDelete,
    isPending: false,
  }),
  useNotify: () => state.notify,
  useTranslate: () => (value: string) => value,
  useGetRecordRepresentation: () => (value: any) =>
    value?.first_name ?? "Contact",
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactQuery>()),
  useQueryClient: () => ({ invalidateQueries: state.invalidateQueries }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => true }));
vi.mock("../root/ConfigurationContext", () => ({
  useConfigurationContext: () => ({ taskTypes: [] }),
}));
vi.mock("@/components/admin/date-field", () => ({
  DateField: () => <span>Tomorrow</span>,
}));
vi.mock("@/components/admin/reference-field", () => ({
  ReferenceField: () => null,
}));
vi.mock("./TaskEdit", () => ({ TaskEdit: () => null }));
vi.mock("./TaskEditSheet", () => ({ TaskEditSheet: () => null }));
import { Task } from "./Task";

const task = {
  id: "task-1",
  text: "Call supplier",
  due_date: "2026-10-12T10:00:00Z",
  done_date: null,
  type: "none",
  _house: { version: 1 },
} as unknown as TaskRecord;
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe("Room task updates", () => {
  it("does not send duplicate mobile checkbox changes while pending", async () => {
    let resolve!: () => void;
    state.update.mockImplementation(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    render(<Task task={task} />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("checkbox"));
    expect(state.update).toHaveBeenCalledOnce();
    expect(state.update).toHaveBeenCalledWith(
      "tasks",
      expect.objectContaining({ id: task.id, previousData: task }),
      { returnPromise: true },
    );
    expect(screen.getByRole("checkbox")).toHaveAttribute(
      "data-state",
      "unchecked",
    );
    await act(async () => {
      resolve();
    });
  });

  it("shows a rejected write and leaves the original completion state", async () => {
    state.update.mockRejectedValue(new Error("Room changed before saving"));
    render(<Task task={task} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox"));
    });
    expect(state.notify).toHaveBeenCalledWith("Room changed before saving", {
      type: "error",
    });
    expect(screen.getByRole("checkbox")).toHaveAttribute(
      "data-state",
      "unchecked",
    );
    expect(screen.getByText("Call supplier")).toBeInTheDocument();
  });
});
