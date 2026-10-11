import { describe, expect, it } from "vitest";
import { fixture, room, stamp } from "./fixtures/business-runtime";

function withContacts() {
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
  return f;
}

describe("form draft ownership and lifecycle", () => {
  it.each([false, true])(
    "honors an ordinary update after opening an editor (closed=%s)",
    async (closed) => {
      const f = fixture();
      const row = (await f.provider.getOne("companies", { id: "c1" })).data;
      const editor = await f.provider.openFormDraft("companies", row, row);
      if (closed) editor.close();

      const result = await f.provider.update("companies", {
        id: row.id,
        previousData: row,
        data: { name: "Explicit later action" },
      });

      expect(result.data.name).toBe("Explicit later action");
      expect(f.md.save).toHaveBeenCalledOnce();
      expect(f.md.roomDraft.write.mock.calls.at(-1)?.[3].fields.name).toEqual({
        value: "Explicit later action",
        base: { value: "Opened company" },
      });
      editor.close();
    },
  );

  it.each([false, true])(
    "refuses an ordinary action without consuming an unfinished form (closed=%s)",
    async (closed) => {
      const f = fixture();
      const row = (await f.provider.getOne("companies", { id: "c1" })).data;
      const editor = await f.provider.openFormDraft("companies", row, row);
      await editor.stage("name", "Unsubmitted form text");
      const before = structuredClone(f.drafts.get(editor.path));
      if (closed) editor.close();

      await expect(
        f.provider.update("companies", {
          id: row.id,
          previousData: row,
          data: { city: "Berlin" },
        }),
      ).rejects.toThrow(/unfinished.*draft/i);

      expect(f.md.save).not.toHaveBeenCalled();
      expect(f.md.roomDraft.write).toHaveBeenCalledOnce();
      expect(f.drafts.get(editor.path)).toEqual(before);
      expect(f.md.roomDraft.discard).not.toHaveBeenCalled();
      editor.close();
    },
  );

  it("uses an explicit live form token to save shared draft values", async () => {
    const f = fixture();
    const row = (await f.provider.getOne("companies", { id: "c1" })).data;
    const editor = await f.provider.openFormDraft("companies", row, row);
    await editor.stage("name", "Current shared input");

    const result = await f.provider.update("companies", {
      id: row.id,
      previousData: row,
      data: { name: "Old submitted snapshot" },
      meta: { houseFormDraft: editor.token },
    });

    expect(result.data.name).toBe("Current shared input");
    expect(f.md.save).toHaveBeenCalledOnce();
    expect(f.drafts.size).toBe(0);
    expect(f.md.roomDraft.write.mock.calls.at(-1)?.[3].fields.name).toEqual({
      value: "Current shared input",
      base: { value: "Opened company" },
    });
    editor.close();
  });

  it("keeps both tokens valid for two live forms on the same document", async () => {
    const f = fixture();
    const row = (await f.provider.getOne("companies", { id: "c1" })).data;
    const first = await f.provider.openFormDraft("companies", row, row);
    const second = await f.provider.openFormDraft("companies", row, row);
    expect(first.token).toBeTruthy();
    expect(second.token).toBeTruthy();
    expect(first.token).not.toBe(second.token);
    await first.stage("name", "First form input");
    await second.stage("city", "Second form input");

    const result = await f.provider.update("companies", {
      id: row.id,
      previousData: row,
      data: first.values(),
      meta: { houseFormDraft: first.token },
    });

    expect(result.data).toMatchObject({
      name: "First form input",
      city: "Second form input",
    });
    expect(f.md.save).toHaveBeenCalledOnce();
    expect(f.drafts.size).toBe(0);
    first.close();
    second.close();
  });

  it("rejects a closed form token instead of falling back to a direct update", async () => {
    const f = fixture();
    const row = (await f.provider.getOne("companies", { id: "c1" })).data;
    const editor = await f.provider.openFormDraft("companies", row, row);
    const token = editor.token;
    editor.close();

    await expect(
      f.provider.update("companies", {
        id: row.id,
        previousData: row,
        data: { name: "Must not submit a closed form" },
        meta: { houseFormDraft: token },
      }),
    ).rejects.toThrow();

    expect(f.md.roomDraft.write).not.toHaveBeenCalled();
    expect(f.md.save).not.toHaveBeenCalled();
  });

  it("rejects a form token belonging to another record", async () => {
    const f = fixture();
    const other = structuredClone(f.documents[0]);
    other.path = "crm/companies/c2.md";
    other.fields.id = "c2";
    other.fields.name = "Second company";
    f.documents.push(other);
    f.provider.setObservedSnapshot({ documents: f.documents });
    const row = (await f.provider.getOne("companies", { id: "c1" })).data;
    const otherRow = (await f.provider.getOne("companies", { id: "c2" })).data;
    const editor = await f.provider.openFormDraft("companies", row, row);

    await expect(
      f.provider.update("companies", {
        id: otherRow.id,
        previousData: otherRow,
        data: { name: "Must not edit the other company" },
        meta: { houseFormDraft: editor.token },
      }),
    ).rejects.toThrow();

    expect(f.md.roomDraft.write).not.toHaveBeenCalled();
    expect(f.md.save).not.toHaveBeenCalled();
    editor.close();
  });
});

describe("normalized shared draft submissions", () => {
  it.each(["3", "3.0", "+3", "03"])(
    "saves numeric text %s even when its number equals the opened value",
    async (value) => {
      const f = fixture();
      const row = (await f.provider.getOne("companies", { id: "c1" })).data;
      const editor = await f.provider.openFormDraft("companies", row, row);
      await editor.stage("size", value);
      expect(f.drafts.get(editor.path).parts.fields.size.value).toBe(value);

      const result = await f.provider.update("companies", {
        id: row.id,
        previousData: row,
        data: editor.values(),
        meta: { houseFormDraft: editor.token },
      });

      expect(result.data.size).toBe(3);
      expect(f.md.save).toHaveBeenCalledOnce();
      expect(f.md.roomDraft.write.mock.calls.at(-1)?.[3].fields.size).toEqual({
        value: 3,
        base: { value: 3 },
      });
      expect(f.drafts.size).toBe(0);
      editor.close();
    },
  );

  it("normalizes unchanged numeric parts alongside another changed field", async () => {
    const f = fixture();
    const row = (await f.provider.getOne("companies", { id: "c1" })).data;
    const editor = await f.provider.openFormDraft("companies", row, row);
    await editor.stage("size", "3.00");
    await editor.stage("name", "A changed company");

    await f.provider.update("companies", {
      id: row.id,
      previousData: row,
      data: editor.values(),
      meta: { houseFormDraft: editor.token },
    });

    expect(f.md.roomDraft.write.mock.calls.at(-1)?.[3].fields).toMatchObject({
      size: { value: 3, base: { value: 3 } },
      name: { value: "A changed company", base: { value: "Opened company" } },
    });
    expect(f.md.save).toHaveBeenCalledOnce();
    expect(f.drafts.size).toBe(0);
    editor.close();
  });
});

describe("creation draft record scope", () => {
  it.each(["p2", undefined, null, ""])(
    "does not resume another contact's note when the new contact scope is %s",
    async (contactId) => {
      const f = withContacts();
      const first = await f.provider.openFormDraft("contact_notes", undefined, {
        contact_id: "p1",
        date: stamp,
        text: "",
      });
      await first.stage("text", "Unfinished note for p1");
      const firstDraft = structuredClone(f.drafts.get(first.path));
      first.close();

      const next = await f.provider.openFormDraft("contact_notes", undefined, {
        ...(contactId === undefined ? {} : { contact_id: contactId }),
        text: "",
      });

      expect(next.path).not.toBe(first.path);
      expect(next.id).not.toBe(first.id);
      expect(next.values().text).toBe("");
      expect(f.drafts.get(first.path)).toEqual(firstDraft);
      expect(f.md.save).not.toHaveBeenCalled();
      next.close();
    },
  );

  it("resumes a matching contact draft and keeps another contact's submission separate", async () => {
    const f = withContacts();
    const first = await f.provider.openFormDraft("contact_notes", undefined, {
      contact_id: "p1",
      date: stamp,
      text: "",
    });
    await first.stage("text", "Unfinished note for p1");
    const firstDraft = structuredClone(f.drafts.get(first.path));
    first.close();
    const resumed = await f.provider.openFormDraft("contact_notes", undefined, {
      contact_id: "p1",
      text: "",
    });
    expect(resumed.path).toBe(first.path);
    expect(resumed.values().text).toBe("Unfinished note for p1");
    resumed.close();

    const second = await f.provider.openFormDraft("contact_notes", undefined, {
      contact_id: "p2",
      date: stamp,
      text: "",
    });
    await second.stage("text", "New note for p2");
    const result = await f.provider.create("contact_notes", {
      data: second.values(),
      meta: { houseFormDraft: second.token },
    });

    expect(result.data.contact_id).toBe("p2");
    expect(result.data._house.path).toBe(second.path);
    expect(second.path).not.toBe(first.path);
    expect(f.drafts.get(first.path)).toEqual(firstDraft);
    expect(f.drafts.has(second.path)).toBe(false);
    expect(f.md.save).toHaveBeenCalledOnce();
    second.close();
  });

  it("allocates a fresh note after successful creation and explicit form close", async () => {
    const f = withContacts();
    const first = await f.provider.openFormDraft("contact_notes", undefined, {
      contact_id: "p1",
      date: stamp,
      text: "",
    });
    await first.stage("text", "First saved note");
    const saved = await f.provider.create("contact_notes", {
      data: first.values(),
      meta: { houseFormDraft: first.token },
    });
    f.documents.push({
      room,
      path: saved.data._house.path,
      type: "crm_contact_note",
      fields: structuredClone(saved.data._house.fields),
    });
    f.provider.setObservedSnapshot({ documents: f.documents });
    first.close();

    const second = await f.provider.openFormDraft("contact_notes", undefined, {
      contact_id: "p1",
      date: stamp,
      text: "",
    });
    await second.stage("text", "Second saved note");
    const savedSecond = await f.provider.create("contact_notes", {
      data: second.values(),
      meta: { houseFormDraft: second.token },
    });

    expect(savedSecond.data.id).not.toBe(saved.data.id);
    expect(savedSecond.data._house.path).not.toBe(saved.data._house.path);
    expect(f.md.roomDraft.write.mock.calls.at(-1)?.[3]).toMatchObject({
      creation: { fields: { text: "Second saved note", contact_id: "p1" } },
    });
    expect(f.documents.find((doc) => doc.path === first.path)?.fields.text).toBe(
      "First saved note",
    );
    expect(f.md.save).toHaveBeenCalledTimes(2);
    second.close();
  });
});
