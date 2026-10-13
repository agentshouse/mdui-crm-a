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
  ListContextProvider,
  RecordContextProvider,
  ResourceContextProvider,
  memoryStore,
  testDataProvider,
  useList,
  type DataProvider,
} from "ra-core";
import polyglotI18nProvider from "ra-i18n-polyglot";
import englishMessages from "ra-language-english";
import type { ReactNode } from "react";
import type { HouseAttachment } from "@/house";
import { afterEach, describe, expect, it, vi } from "vitest";
import { englishCrmMessages } from "../providers/commons/englishCrmMessages";
import type { ContactNote } from "../types";
import { Note } from "./Note";
import { NoteCreate } from "./NoteCreate";
import { NoteEditSheet } from "./NoteEditSheet";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const note = {
  id: "note-1",
  contact_id: "contact-1",
  text: "Original note",
  date: "2026-10-01T12:00:00.000Z",
  status: "hot",
  sales_id: "team-1",
  _house: { documentId: "note-document", revision: "revision-1" },
} satisfies ContactNote & { _house: object };

const i18nProvider = polyglotI18nProvider(() => ({
  ...englishMessages,
  ...englishCrmMessages,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function renderRoom(
  children: ReactNode,
  overrides: Record<string, unknown> = {},
) {
  const dataProvider = testDataProvider({
    getMany: async () => ({
      data: [{ id: "team-1", first_name: "North", last_name: "Team" }],
    }),
    getList: async () => ({
      data: [{ id: "team-1", first_name: "North", last_name: "Team" }],
      total: 1,
    }),
    ...overrides,
  } as unknown as Partial<DataProvider>);
  return render(
    <CoreAdminContext
      dataProvider={dataProvider}
      i18nProvider={i18nProvider}
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
      <ResourceContextProvider value="contact_notes">
        {children}
      </ResourceContextProvider>
    </CoreAdminContext>,
  );
}

function CreationContext() {
  const list = useList<ContactNote>({ data: [] });
  return (
    <ListContextProvider value={{ ...list, refetch: vi.fn() }}>
      <RecordContextProvider
        value={{ id: "contact-1", first_name: "Alex", status: "hot" }}
      >
        <NoteCreate reference="contacts" showStatus />
      </RecordContextProvider>
    </ListContextProvider>
  );
}

async function openEditor() {
  fireEvent.click(screen.getByRole("button", { name: "Edit note" }));
  return screen.findByPlaceholderText("Add a note");
}

describe("Room note editing without authentication", () => {
  it("shows a manual team label and exposes editing without an identity provider", async () => {
    renderRoom(<Note note={note} isLast />);
    expect(await screen.findByText("Team: North Team")).toBeInTheDocument();
    expect(screen.queryByText(/You added|Me\b/)).not.toBeInTheDocument();
    expect(await openEditor()).toHaveValue("Original note");
    fireEvent.click(screen.getByRole("button", { name: "Show options" }));
    expect(screen.getByLabelText("Attachments")).toHaveAttribute(
      "type",
      "file",
    );
  });

  it("retains unsaved text after a rejected pessimistic save", async () => {
    const pending = deferred<{ data: ContactNote }>();
    const update = vi.fn(() => pending.promise);
    renderRoom(<Note note={note} isLast />, { update });
    const editor = await openEditor();
    fireEvent.change(editor, { target: { value: "Keep this draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Update note" }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0]).toEqual([
      "contact_notes",
      expect.objectContaining({
        id: note.id,
        data: expect.objectContaining({ text: "Keep this draft" }),
        previousData: note,
      }),
    ]);
    await act(async () => pending.reject(new Error("Room revision conflict")));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Update note" })).toBeEnabled(),
    );
    expect(screen.getByPlaceholderText("Add a note")).toHaveValue(
      "Keep this draft",
    );
  });

  it("does not duplicate a pending save and closes only after persistence succeeds", async () => {
    const pending = deferred<{ data: ContactNote }>();
    const update = vi.fn(() => pending.promise);
    renderRoom(<Note note={note} isLast />, { update });
    const editor = await openEditor();
    fireEvent.change(editor, { target: { value: "Saved once" } });
    const save = screen.getByRole("button", { name: "Update note" });
    fireEvent.click(save);
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(save).toBeDisabled();
    fireEvent.click(save);
    fireEvent.click(save);
    // Submitting the form directly also exercises the synchronous duplicate guard.
    fireEvent.submit(editor.closest("form")!);
    await act(async () => {});
    expect(update).toHaveBeenCalledTimes(1);
    expect(editor).toHaveValue("Saved once");
    await act(async () =>
      pending.resolve({ data: { ...note, text: "Saved once" } }),
    );
    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText("Add a note"),
      ).not.toBeInTheDocument(),
    );
  });

  it("confirms inline deletion and retains the note when persistence fails", async () => {
    const pending = deferred<{ data: ContactNote }>();
    const deleteOne = vi.fn(() => pending.promise);
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
    vi.stubGlobal("confirm", confirm);
    renderRoom(<Note note={note} isLast />, { delete: deleteOne });
    const remove = screen.getByRole("button", { name: "Delete note" });
    fireEvent.click(remove);
    expect(confirm).toHaveBeenCalledWith("Delete this note from the Room?");
    expect(deleteOne).not.toHaveBeenCalled();
    fireEvent.click(remove);
    await waitFor(() => expect(deleteOne).toHaveBeenCalledTimes(1));
    expect(remove).toBeDisabled();
    fireEvent.click(remove);
    expect(deleteOne).toHaveBeenCalledTimes(1);
    expect(deleteOne.mock.calls[0]).toEqual([
      "contact_notes",
      expect.objectContaining({ id: note.id, previousData: note }),
    ]);
    await act(async () =>
      pending.reject(new Error("Note changed in another tab")),
    );
    await waitFor(() => expect(remove).toBeEnabled());
    expect(screen.getByText("Original note")).toBeInTheDocument();
  });

  it("keeps the mobile sheet open, disables deletion while pending, and displays deletion errors", async () => {
    const pending = deferred<{ data: ContactNote }>();
    const deleteOne = vi.fn(() => pending.promise);
    const onOpenChange = vi.fn();
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    renderRoom(
      <NoteEditSheet open onOpenChange={onOpenChange} noteId={note.id} />,
      {
        getOne: async () => ({ data: note }),
        delete: deleteOne,
      },
    );
    await waitFor(() =>
      expect(screen.getByPlaceholderText("Add a note")).toHaveValue(
        "Original note",
      ),
    );
    const more = screen.getByRole("button", { name: /More|Open menu/ });
    fireEvent.pointerDown(more, {
      button: 0,
      ctrlKey: false,
      pointerType: "mouse",
    });
    const remove = await screen.findByRole("menuitem", { name: "Delete" });
    fireEvent.click(remove);
    await waitFor(() => expect(deleteOne).toHaveBeenCalledTimes(1));
    expect(more).toBeDisabled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    await act(async () => pending.reject(new Error("Room revision conflict")));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Room revision conflict",
    );
    expect(more).toBeEnabled();
    expect(screen.getByPlaceholderText("Add a note")).toHaveValue(
      "Original note",
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("creates without identity, preserves a rejected draft, and does not make a secondary contact update", async () => {
    const pending = deferred<{ data: ContactNote }>();
    const create = vi.fn(() => pending.promise);
    const update = vi.fn();
    renderRoom(<CreationContext />, { create, update });
    const editor = await screen.findByPlaceholderText("Add a note");
    fireEvent.change(editor, { target: { value: "New Room note" } });
    const save = screen.getByRole("button", { name: "Add this note" });
    fireEvent.click(save);
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]).toEqual([
      "contact_notes",
      expect.objectContaining({
        data: expect.objectContaining({
          text: "New Room note",
          contact_id: "contact-1",
        }),
      }),
    ]);
    expect(
      (
        create.mock.calls[0] as unknown as [
          string,
          { data: Record<string, unknown> },
        ]
      )[1].data.sales_id,
    ).toBeUndefined();
    await act(async () => pending.reject(new Error("Room is read-only")));
    await waitFor(() => expect(save).toBeEnabled());
    expect(editor).toHaveValue("New Room note");
    create.mockResolvedValueOnce({ data: { ...note, text: "New Room note" } });
    fireEvent.click(save);
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByPlaceholderText("Add a note")).toHaveValue(""));
    expect(editor).not.toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });
  it("accepts a completed Room attachment without text, retains it on rejected save, and resets it after success", async () => {
    const asset: HouseAttachment = {
      path: "files/note-fixture",
      title: "evidence.pdf",
      type: "application/pdf",
    };
    const uploaded = deferred<HouseAttachment>();
    const saved = deferred<{ data: ContactNote }>();
    const uploadAttachment = vi.fn(() => uploaded.promise);
    const create = vi.fn(() => saved.promise);
    renderRoom(<CreationContext />, { uploadAttachment, create });
    const save = screen.getByRole("button", { name: "Add this note" });
    fireEvent.click(save);
    expect(
      await screen.findByText("A note or a completed attachment is required"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show options" }));
    fireEvent.change(screen.getByLabelText("Attachments"), {
      target: {
        files: [new File(["evidence"], asset.title, { type: asset.type })],
      },
    });
    await waitFor(() => expect(uploadAttachment).toHaveBeenCalledTimes(1));
    await act(async () => uploaded.resolve(asset));
    await waitFor(() =>
      expect(
        screen.queryByText("A note or a completed attachment is required"),
      ).not.toBeInTheDocument(),
    );
    expect(create).not.toHaveBeenCalled();
    fireEvent.click(save);
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0]).toEqual([
      "contact_notes",
      expect.objectContaining({
        data: expect.objectContaining({ attachments: [asset] }),
      }),
    ]);
    await act(async () => saved.reject(new Error("Document save failed")));
    await waitFor(() => expect(save).toBeEnabled());
    expect(
      screen.getByRole("button", {
        name: "Remove evidence.pdf from this record",
      }),
    ).toBeInTheDocument();
    create.mockResolvedValueOnce({
      data: { ...note, text: "", attachments: [asset] },
    });
    fireEvent.click(save);
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", {
          name: "Remove evidence.pdf from this record",
        }),
      ).not.toBeInTheDocument(),
    );
  });
});
