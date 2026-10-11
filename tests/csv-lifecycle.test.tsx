import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { usePapaParse } from "../src/components/atomic-crm/misc/usePapaParse";
import type { ImportBatchResult } from "../src/components/atomic-crm/dataImport/types";
function file(text = "name\nA\nB") {
  const value = new File([text], "contacts.csv", { type: "text/csv" });
  Object.defineProperty(value, "text", {
    configurable: true,
    value: async () => text,
  });
  return value;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { resolve, promise };
}
it("queues one row at a time, preserves zeros, and reports completion as counts only", async () => {
  const processBatch = vi.fn(async (_rows: Record<string, unknown>[]) => ({
    created: 1,
    errors: [],
  }));
  const { result } = renderHook(() => usePapaParse({ processBatch }));
  await act(() => result.current.parseCsv(file("name,phone\nA,0012\nB,0034")));
  expect(processBatch.mock.calls).toHaveLength(2);
  expect(processBatch.mock.calls[0][0]).toEqual([{ name: "A", phone: "0012" }]);
  expect(result.current.importer).toMatchObject({
    state: "complete",
    importCount: 2,
    errorCount: 0,
    stopped: false,
  });
});
it("drains the current row when stopped, never starts a second row and prevents double starts", async () => {
  const pending = deferred<ImportBatchResult>();
  const processBatch = vi.fn(() => pending.promise);
  const { result } = renderHook(() => usePapaParse({ processBatch }));
  let running!: Promise<void>;
  act(() => {
    running = result.current.parseCsv(file());
  });
  await waitFor(() => expect(processBatch).toHaveBeenCalledTimes(1));
  await act(() => result.current.parseCsv(file()));
  act(() => result.current.stop());
  expect(result.current.importer).toMatchObject({
    state: "running",
    stopping: true,
  });
  await act(async () => {
    pending.resolve({ created: 1, errors: [] });
    await running;
  });
  expect(processBatch).toHaveBeenCalledTimes(1);
  expect(result.current.importer).toMatchObject({
    state: "complete",
    importCount: 1,
    errorCount: 0,
    rowCount: 2,
    stopped: true,
  });
});
it("pauses on the first refused row with exact reason and does not retry", async () => {
  const processBatch = vi.fn(async () => ({
    created: 0,
    errors: ["House write-halted; drafts preserved"],
  }));
  const { result } = renderHook(() => usePapaParse({ processBatch }));
  await act(() => result.current.parseCsv(file()));
  expect(processBatch).toHaveBeenCalledTimes(1);
  expect(result.current.importer).toMatchObject({
    state: "complete",
    importCount: 0,
    errorCount: 1,
    stopped: true,
    rowErrors: ["Row 2: House write-halted; drafts preserved"],
  });
});
it("parsing or file-size errors perform zero creates", async () => {
  const processBatch = vi.fn();
  const { result } = renderHook(() => usePapaParse({ processBatch }));
  await act(() => result.current.parseCsv(file("name,name\nA,B")));
  expect(result.current.importer).toMatchObject({
    state: "error",
    importCount: 0,
  });
  const huge = file();
  Object.defineProperty(huge, "size", { value: 6 * 1024 * 1024 });
  await act(() => result.current.parseCsv(huge));
  expect(result.current.importer).toMatchObject({ state: "error" });
  expect(processBatch).not.toHaveBeenCalled();
});
it("unmount stops future rows without cancelling an already queued row", async () => {
  const pending = deferred<ImportBatchResult>();
  const processBatch = vi.fn(() => pending.promise);
  const { result, unmount } = renderHook(() => usePapaParse({ processBatch }));
  let running!: Promise<void>;
  act(() => {
    running = result.current.parseCsv(file());
  });
  await waitFor(() => expect(processBatch).toHaveBeenCalledTimes(1));
  unmount();
  pending.resolve({ created: 1, errors: [] });
  await running;
  expect(processBatch).toHaveBeenCalledTimes(1);
});
it("stop while reading a local file performs no writes", async () => {
  const text = deferred<string>();
  const local = file();
  Object.defineProperty(local, "text", { value: () => text.promise });
  const processBatch = vi.fn();
  const { result } = renderHook(() => usePapaParse({ processBatch }));
  let running!: Promise<void>;
  act(() => {
    running = result.current.parseCsv(local);
    result.current.stop();
  });
  await act(async () => {
    text.resolve("name\nA");
    await running;
  });
  expect(processBatch).not.toHaveBeenCalled();
  expect(result.current.importer).toMatchObject({
    state: "complete",
    stopped: true,
    importCount: 0,
  });
});
