import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import {
  CoreAdminContext,
  ListContextProvider,
  RecordContextProvider,
  ResourceContextProvider,
  memoryStore,
  useList,
} from "ra-core";
import polyglotI18nProvider from "ra-i18n-polyglot";
import englishMessages from "ra-language-english";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { TextInput } from "../src/components/admin/text-input";
import { NoteCreate } from "../src/components/atomic-crm/notes/NoteCreate";
import { NoteCreateSheet } from "../src/components/atomic-crm/notes/NoteCreateSheet";
import { englishCrmMessages } from "../src/components/atomic-crm/providers/commons/englishCrmMessages";
import { HouseDraftProvider } from "../src/house-form";
import { fixture, room, stamp } from "./fixtures/business-runtime";

// Preserve the donor submission lifecycle while isolating unrelated attachment,
// date, and reference controls. Both mock inputs still use react-hook-form.
vi.mock("../src/components/atomic-crm/notes/NoteInputs", () => ({
  NoteInputs: () => <TextInput source="text" label="Note text" />,
}));
vi.mock("../src/components/atomic-crm/notes/NoteInputsMobile", () => ({
  NoteInputsMobile: () => <TextInput source="text" label="Note text" />,
}));

function noteFixture() {
  const f = fixture();
  for (const id of ["p1", "p2"]) {
    f.documents.push({
      room,
      path: `crm/contacts/${id}.md`,
      type: "crm_contact",
      fields: {
        id,
        first_name: id,
        last_name: "Test",
        first_seen: stamp,
        last_seen: stamp,
        email_jsonb: "[]",
        phone_jsonb: "[]",
        tags: "[]",
        has_newsletter: "false",
      },
    });
  }
  f.provider.setObservedSnapshot({ documents: f.documents });

  // Mirror the Runtime's visible queued layer in the existing test fixture, so
  // the first saved note becomes a real observed document before the next Save.
  const originalSave = f.md.save.getMockImplementation()!;
  f.md.save.mockImplementation(async (...args) => {
    const submitted = args[1].map((item) =>
      structuredClone(f.drafts.get(item.path)),
    );
    const result = await originalSave(...args);
    if (result.outcome === "saved") {
      for (const draft of submitted) {
        const creation = draft.parts.creation;
        if (creation) {
          f.documents.push({
            room,
            path: draft.path,
            type: creation.type,
            fields: structuredClone(creation.fields),
          });
        } else {
          const document = f.documents.find((doc) => doc.path === draft.path)!;
          for (const [key, part] of Object.entries(draft.parts.fields ?? {})) {
            document.fields[key] = (part as { value: unknown }).value;
          }
        }
      }
      f.provider.setObservedSnapshot({ documents: f.documents });
    }
    return result;
  });
  return f;
}

function renderNotes(f: ReturnType<typeof noteFixture>, children: ReactNode) {
  const i18nProvider = polyglotI18nProvider(() => ({
    ...englishMessages,
    ...englishCrmMessages,
  }));
  return render(
    <CoreAdminContext
      dataProvider={f.provider}
      i18nProvider={i18nProvider}
      store={memoryStore()}
      queryClient={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false, gcTime: 0 },
            mutations: { retry: false },
          },
        })
      }
    >
      <HouseDraftProvider value={f.provider}>
        <ResourceContextProvider value="contact_notes">
          {children}
        </ResourceContextProvider>
      </HouseDraftProvider>
    </CoreAdminContext>,
  );
}

function PersistentComposer({ contact }: { contact: Record<string, any> }) {
  const list = useList<{ id: string }>({ data: [] });
  return (
    <ListContextProvider value={{ ...list, refetch: vi.fn() }}>
      <RecordContextProvider value={contact}>
        <NoteCreate reference="contacts" />
      </RecordContextProvider>
    </ListContextProvider>
  );
}

describe("donor note creation with durable drafts", () => {
  it("remounts after successful Save and creates two distinct notes", async () => {
    const f = noteFixture();
    const contact = (await f.provider.getOne("contacts", { id: "p1" })).data;
    const create = vi.spyOn(f.provider, "create");
    const opening = vi.spyOn(f.provider, "openFormDraft");
    renderNotes(f, <PersistentComposer contact={contact} />);
    await waitFor(() => expect(opening).toHaveBeenCalledOnce());

    fireEvent.change(screen.getByLabelText("Note text"), {
      target: { value: "First note, keep this unchanged" },
    });
    await waitFor(() =>
      expect(
        [...f.drafts.values()].some(
          (draft) =>
            draft.parts.creation?.fields.text === "First note, keep this unchanged",
        ),
      ).toBe(true),
    );
    expect(f.md.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Add this note" }));
    await waitFor(() => expect(f.md.save).toHaveBeenCalledOnce());
    await waitFor(() => expect(opening).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByLabelText("Note text")).toHaveValue(""));

    const first = structuredClone(
      f.documents.find((document) => document.type === "crm_contact_note")!,
    );
    expect(first.fields.text).toBe("First note, keep this unchanged");
    expect(create.mock.calls[0][1].meta?.houseFormDraft).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Note text"), {
      target: { value: "Second distinct note" },
    });
    await waitFor(() =>
      expect(
        [...f.drafts.values()].some(
          (draft) => draft.parts.creation?.fields.text === "Second distinct note",
        ),
      ).toBe(true),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add this note" }));
    await waitFor(() => expect(f.md.save).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(opening).toHaveBeenCalledTimes(3));

    const notes = f.documents.filter((document) => document.type === "crm_contact_note");
    expect(notes).toHaveLength(2);
    expect(new Set(notes.map((document) => document.path)).size).toBe(2);
    expect(new Set(notes.map((document) => document.fields.id)).size).toBe(2);
    expect(notes.find((document) => document.path === first.path)).toEqual(first);
    expect(notes.find((document) => document.path !== first.path)?.fields).toMatchObject({
      text: "Second distinct note",
      contact_id: "p1",
    });
    expect(create.mock.calls[1][1].meta?.houseFormDraft).not.toBe(
      create.mock.calls[0][1].meta?.houseFormDraft,
    );
    expect(f.drafts.size).toBe(0);
  });

  it("opens the mobile composer with its contact scope and leaves another contact's draft alone", async () => {
    const f = noteFixture();
    const earlier = await f.provider.openFormDraft("contact_notes", undefined, {
      contact_id: "p1",
      text: "",
      date: stamp,
    });
    await earlier.stage("text", "Unfinished note for the first contact");
    const originalDraft = structuredClone(f.drafts.get(earlier.path));
    earlier.close();
    const opening = vi.spyOn(f.provider, "openFormDraft");
    const onOpenChange = vi.fn();
    renderNotes(
      f,
      <NoteCreateSheet open onOpenChange={onOpenChange} contact_id="p2" />,
    );

    await waitFor(() =>
      expect(opening).toHaveBeenCalledWith(
        "contact_notes",
        undefined,
        expect.objectContaining({ contact_id: "p2" }),
      ),
    );
    expect(screen.getByLabelText("Note text")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Note text"), {
      target: { value: "A mobile note for the second contact" },
    });
    await waitFor(() => expect(f.drafts.size).toBe(2));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));

    const note = f.documents.find((document) => document.type === "crm_contact_note")!;
    expect(note.fields).toMatchObject({
      contact_id: "p2",
      text: "A mobile note for the second contact",
    });
    expect(note.path).not.toBe(earlier.path);
    expect(f.drafts.get(earlier.path)).toEqual(originalDraft);
    expect(f.md.save).toHaveBeenCalledOnce();
  });
});
