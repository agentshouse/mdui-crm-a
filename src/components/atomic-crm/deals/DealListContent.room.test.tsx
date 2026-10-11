import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { Deal } from "../types";

const state = vi.hoisted(() => ({
  onDragEnd: undefined as undefined | ((value: any) => Promise<void>),
  getList: vi.fn(),
  moveDeal: vi.fn(),
  refetch: vi.fn(),
  notify: vi.fn(),
  data: [] as Deal[],
}));
vi.mock("ra-core", () => ({
  useDataProvider: () => ({ getList: state.getList, moveDeal: state.moveDeal }),
  useListContext: () => ({
    data: state.data,
    isPending: false,
    refetch: state.refetch,
  }),
  useNotify: () => state.notify,
}));
vi.mock("../root/ConfigurationContext", () => ({
  useConfigurationContext: () => ({
    dealStages: [{ value: "new" }, { value: "won" }],
  }),
}));
vi.mock("@hello-pangea/dnd", () => ({
  DragDropContext: ({
    onDragEnd,
    children,
  }: {
    onDragEnd: typeof state.onDragEnd;
    children: ReactNode;
  }) => {
    state.onDragEnd = onDragEnd;
    return <>{children}</>;
  },
}));
vi.mock("./DealColumn", () => ({
  DealColumn: ({
    stage,
    deals,
    isDragDisabled,
  }: {
    stage: string;
    deals: Deal[];
    isDragDisabled: boolean;
  }) => (
    <section aria-label={stage} data-disabled={isDragDisabled}>
      {deals.map((deal) => deal.name).join(",")}
    </section>
  ),
}));
import { DealListContent } from "./DealListContent";

const deal = (id: string, stage: string, index: number): Deal =>
  ({ id, name: id, stage, index, _house: { version: id } }) as unknown as Deal;
const move = {
  source: { droppableId: "new", index: 0 },
  destination: { droppableId: "won", index: 0 },
};
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  state.data = [deal("A", "new", 0), deal("B", "won", 0)];
  state.getList.mockResolvedValue({ data: [state.data[1]] });
  state.moveDeal.mockResolvedValue(undefined);
  state.refetch.mockResolvedValue(undefined);
});

describe("Room Kanban persistence", () => {
  it("renders without identity and keeps the displayed order until the Room confirms", async () => {
    let resolve!: () => void;
    state.moveDeal.mockImplementation(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    render(<DealListContent />);
    let pending!: Promise<void>;
    await act(async () => {
      pending = state.onDragEnd!(move);
    });
    expect(screen.getByLabelText("new")).toHaveTextContent("A");
    expect(screen.getByLabelText("won")).toHaveTextContent("B");
    expect(screen.getByLabelText("new")).toHaveAttribute(
      "data-disabled",
      "true",
    );
    expect(state.moveDeal).toHaveBeenCalledWith(state.data[0], "won", [
      state.data[0],
      state.data[1],
    ]);
    expect(state.refetch).not.toHaveBeenCalled();
    await act(async () => {
      resolve();
      await pending;
    });
    expect(state.refetch).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("new")).toHaveAttribute(
      "data-disabled",
      "false",
    );
  });

  it("retains the original board after rejection and shows the failure", async () => {
    state.moveDeal.mockRejectedValue(
      new Error("Room changed; reload before saving."),
    );
    render(<DealListContent />);
    await act(async () => {
      await state.onDragEnd!(move);
    });
    expect(screen.getByLabelText("new")).toHaveTextContent("A");
    expect(screen.getByLabelText("won")).toHaveTextContent("B");
    expect(state.notify).toHaveBeenCalledWith(
      "Room changed; reload before saving.",
      { type: "error" },
    );
    expect(state.refetch).toHaveBeenCalledOnce();
  });

  it("does not submit a second move while the first is pending", async () => {
    let resolve!: () => void;
    state.moveDeal.mockImplementation(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    render(<DealListContent />);
    let pending!: Promise<void>;
    await act(async () => {
      pending = state.onDragEnd!(move);
      await state.onDragEnd!(move);
    });
    expect(state.moveDeal).toHaveBeenCalledOnce();
    await act(async () => {
      resolve();
      await pending;
    });
  });

  it("keeps hidden destination deals when moving on a filtered board", async () => {
    const hidden = deal("Hidden", "won", 0);
    state.getList.mockResolvedValue({ data: [hidden, state.data[1]] });
    render(<DealListContent />);
    await act(async () => {
      await state.onDragEnd!(move);
    });
    expect(state.moveDeal).toHaveBeenCalledWith(state.data[0], "won", [
      hidden,
      state.data[0],
      state.data[1],
    ]);
  });
});
