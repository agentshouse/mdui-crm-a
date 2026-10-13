export const isBinaryPath = (value: unknown): value is string =>
  typeof value === "string" && value.includes("/") && !value.includes("\0") && !/[\\:?#]/.test(value) && value.split("/").every(part => part !== "" && part !== "." && part !== "..");
