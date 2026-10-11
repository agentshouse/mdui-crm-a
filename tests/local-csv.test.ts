import { describe, expect, it } from "vitest";
import { parseLocalCsv } from "../src/components/atomic-crm/misc/localCsv";
describe("retained local Papa core", () => {
  it("parses BOM, quotes, escaped quotes, multiline values and CRLF without converting identifiers", () => {
    expect(
      parseLocalCsv(
        '\ufeffname,zipcode,note\r\n"Acme, Inc",02134,"A ""quoted""\r\nnote"\r\n',
      ),
    ).toEqual([
      { name: "Acme, Inc", zipcode: "02134", note: 'A "quoted"\r\nnote' },
    ]);
  });
  it.each([";", "\t", "|"])("detects local %s separated files", (separator) => {
    expect(
      parseLocalCsv(`name${separator}phone\nAcme${separator}00123`),
    ).toEqual([{ name: "Acme", phone: "00123" }]);
  });
  it("treats formula-like text as text", () => {
    expect(
      parseLocalCsv('name\n"=HYPERLINK(""https://example.test"",""x"")"')[0]
        .name,
    ).toBe('=HYPERLINK("https://example.test","x")');
  });
  it.each([
    "",
    "name\n",
    "name,name\nA,B",
    "__proto__,name\na,b",
    "name,city\na,b,c",
    'name,city\n"unterminated,b',
  ])("rejects malformed CSV before row writes: %s", (input) => {
    expect(() => parseLocalCsv(input)).toThrow();
  });
  it("rejects excess rows", () => {
    expect(() =>
      parseLocalCsv("name\n" + Array(5001).fill("A").join("\n")),
    ).toThrow("5000");
  });
});
