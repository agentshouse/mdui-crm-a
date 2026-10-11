// Preserve the donor's mature parser without shipping its network/worker APIs.
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
const hash = (path) =>
  createHash("sha256")
    .update(fs.readFileSync(new URL(path, import.meta.url)))
    .digest("hex");
export function verifyLocalCsvCore() {
  const pkg = JSON.parse(
    fs.readFileSync(
      new URL("../node_modules/papaparse/package.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(
    pkg.version,
    "5.5.3",
    "Review a changed Papa Parse version before updating the local core",
  );
  assert.equal(
    hash("../node_modules/papaparse/papaparse.js"),
    "10778b8bb3e20177c52febb99e18ec53fd97ce447f4716ca10e00bae18a98594",
    "Upstream Papa Parse source changed",
  );
  assert.equal(
    hash("../src/vendor/papa-local.js"),
    "d8cad69f039c2b32dada47c7fa22f523145145207cfdc178f320f75d2ed105a7",
    "Review a changed local CSV core before accepting it",
  );
}
verifyLocalCsvCore();
