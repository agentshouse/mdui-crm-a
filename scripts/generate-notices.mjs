/* eslint-disable no-console -- This command reports its verification result to stdout. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const donorCommit = "8b5d47ba32190c68801a427ef7682d7a6afc14e0";
const donorLicenseHash =
  "1774c14a7b97aa0ce5e866f895ddb421db6dfb4769dee9ab40416681d0390316";
const vendoredNotices = [
  {
    name: "shadcn/ui",
    file: "licenses/shadcn-ui-MIT.txt",
    source: "https://raw.githubusercontent.com/shadcn-ui/ui/c2a67849be260701852b0977ba15eb5f3a0ce2a4/LICENSE.md",
    sha256: "1564074e13439397221ffd522e2e504d56561994a23d371aa5e3ad43e4f5423f",
  },
  {
    name: "Shadcn Admin Kit",
    file: "licenses/shadcn-admin-kit-MIT.txt",
    source:
      "https://raw.githubusercontent.com/marmelab/shadcn-admin-kit/78e32b93174937f0871877b3ddaf2ddd4d71ea16/LICENSE",
    sha256: "f88e2ebf4173f785478bba1a32c4d097e192acf2cbb9ba3fcf15aa2986b9a482",
  },
];
const separator = "\n" + "=".repeat(80) + "\n";
const supplementalLicenses = [
  {
    names: ["@cfworker/json-schema"],
    version: "4.1.1",
    file: "licenses/cfworker-json-schema-MIT.txt",
    source:
      "https://github.com/cfworker/cfworker/blob/5409fdc2bd144f68e8b28c61c71fcb16600000a6/LICENSE.md",
    sha256: "376944252ab78ca6b41aee44ddea8894927ee67891e77e61eb9d59af63e35094",
    provenance:
      "Original upstream license from the package publication commit.",
  },
  {
    names: ["@streamparser/json", "@streamparser/json-whatwg"],
    version: "0.0.22",
    file: "licenses/streamparser-json-MIT.txt",
    source:
      "https://github.com/juanjoDiaz/streamparser-json/blob/09195922f2e43280a5c45e557d4e21bdbe110616/LICENSE",
    sha256: "b0022ea53a62be6b1f54f89f80d9271e395df2d12a63b4f8f0bf1a916a4e8094",
    provenance:
      "Original upstream monorepo license from the package publication commit.",
  },
  {
    names: ["react-remove-scroll-bar"],
    version: "2.3.8",
    file: "licenses/react-remove-scroll-bar-MIT.txt",
    source:
      "https://github.com/theKashey/react-remove-scroll-bar/blob/8ca9ba5ea52de03308fe8ced94f7b159a44d28ff/LICENSE",
    sha256: "a79aae0c0f21990d9d963bb3c5a79cdcea9a46f8523ba55c58d7fe776b6ebc84",
    provenance:
      "Package declares MIT but omits license text. Original upstream project license retrieved 2026-10-11; the npm publication gitHead was unavailable from GitHub.",
  },
];

// Keep published license identifiers and full distributed notices intact. Do not
// infer a license grant from the application's or another package's MIT license.
export function collectNotices() {
  const lock = JSON.parse(
    fs.readFileSync(path.join(root, "package-lock.json"), "utf8"),
  );
  const donorLicense = fs.readFileSync(path.join(root, "LICENSE.md"), "utf8");
  assert.equal(
    createHash("sha256").update(donorLicense).digest("hex"),
    donorLicenseHash,
    "Pinned donor MIT notice changed",
  );
  const parts = [
    "THIRD-PARTY NOTICES\n\nCRM includes modified software and local assets from marmelab/atomic-crm,\n" +
      `pinned at commit ${donorCommit}. The donor MIT notice\n` +
      "covers the retained donor source, CSS, and icons. Inter font files are\n" +
      "distributed locally under their separate SIL Open Font License below.\n\n" +
      "The dependency notices below cover the installed production dependency\n" +
      "closure in package-lock.json, a superset of packages actually bundled.\n" +
      "Tailwind CSS notices are also included for emitted preflight/theme CSS.\nOther development-only build and test dependencies are not distributed. Published\n" +
      "license identifiers are reported without inventing missing permission.\n\n" +
      "Each package's published license grant is retained below.\n",
    separator +
      "Donor: marmelab/atomic-crm\n" +
      `Source: https://github.com/marmelab/atomic-crm/tree/${donorCommit}\n` +
      `Commit: ${donorCommit}\nLicense identifier: MIT\n\n` +
      donorLicense,
  ];
  const packages = [];
  const missingLicenseFiles = [];
  const licenseGaps = [];
  const errors = [];
  const supplements = {};
  for (const notice of vendoredNotices) {
    const contents = fs.readFileSync(
      path.join(root, "public", notice.file),
      "utf8",
    );
    assert.equal(
      createHash("sha256").update(contents).digest("hex"),
      notice.sha256,
      `Vendored component notice changed: ${notice.name}`,
    );
    supplements[notice.file] = contents;
    parts.push(
      separator +
        `Vendored components: ${notice.name}\nSource: ${notice.source}\nRetrieved: 2026-10-11\nLicense identifier: MIT\n\n${contents}`,
    );
  }
  let interLicense;
  for (const [relative, entry] of Object.entries(lock.packages).sort(
    ([a], [b]) => a.localeCompare(b),
  )) {
    // Tailwind's preflight/theme CSS is emitted into the application even
    // though its compiler package is correctly a development dependency.
    if (!relative || (entry.dev && relative !== "node_modules/tailwindcss"))
      continue;
    const directory = path.join(root, relative);
    const manifest = path.join(directory, "package.json");
    if (!fs.existsSync(manifest)) {
      if (!entry.optional)
        errors.push(
          `Required production package is not installed: ${relative}`,
        );
      continue;
    }
    const pkg = JSON.parse(fs.readFileSync(manifest, "utf8"));
    assert.equal(
      pkg.version,
      entry.version,
      `Installed version differs from lockfile: ${relative}`,
    );
    const identifier =
      typeof pkg.license === "string"
        ? pkg.license
        : JSON.stringify(pkg.license ?? pkg.licenses ?? "Not declared");
    const licenseFiles = fs
      .readdirSync(directory)
      .filter(
        (file) =>
          /^(licen[cs]e|copying|copyright|notice|ofl)(?:[.\-_]|$)/i.test(
            file,
          ) && fs.statSync(path.join(directory, file)).isFile(),
      )
      .sort();
    const item = { name: pkg.name, version: pkg.version, license: identifier };
    packages.push(item);
    parts.push(
      separator +
        `${pkg.name} ${pkg.version}\nLicense identifier: ${identifier}\nInstalled path: ${relative}\n`,
    );
    if (!licenseFiles.length) {
      parts.push(
        "\nNo license or notice file was distributed at the package root.\n",
      );
      const supplementalLicense = supplementalLicenses.find(
        (item) => item.names.includes(pkg.name) && item.version === pkg.version,
      );
      if (supplementalLicense) {
        const contents = fs.readFileSync(
          path.join(root, "public", supplementalLicense.file),
          "utf8",
        );
        assert.equal(
          createHash("sha256").update(contents).digest("hex"),
          supplementalLicense.sha256,
          "Supplemental upstream license text changed",
        );
        supplements[supplementalLicense.file] = contents;
        parts.push(
          `\n${supplementalLicense.provenance}\nSource: ${supplementalLicense.source}\n\n${contents}`,
        );
      } else {
        missingLicenseFiles.push(item);
        errors.push(
          `Missing distributed license text: ${pkg.name} ${pkg.version}`,
        );
      }
    }
    if (/^(UNLICENSED|Not declared)$/i.test(identifier)) {
      licenseGaps.push(item);
      errors.push(`Unresolved license grant: ${pkg.name} ${pkg.version}`);
    }
    for (const file of licenseFiles) {
      const contents = fs.readFileSync(path.join(directory, file), "utf8");
      parts.push(`\n--- ${file} ---\n\n${contents}\n`);
      if (
        pkg.name === "@fontsource-variable/inter" &&
        /SIL OPEN FONT LICENSE/i.test(contents)
      )
        interLicense = contents;
    }
  }
  assert(
    interLicense,
    "Installed Inter SIL Open Font License text was not found",
  );
  assert.equal(errors.length, 0, errors.join("\n"));
  return {
    files: {
      "LICENSE.txt": donorLicense,
      "THIRD_PARTY_NOTICES.txt": parts.join(""),
      "licenses/Inter-OFL.txt": interLicense,
      "licenses/PROVENANCE.txt": fs.readFileSync(
        path.join(root, "public/licenses/PROVENANCE.txt"),
        "utf8",
      ),
      ...supplements,
    },
    packages,
    missingLicenseFiles,
    licenseGaps,
  };
}

export function generateNotices({ check = false } = {}) {
  const result = collectNotices();
  for (const [relative, contents] of Object.entries(result.files)) {
    const destination = path.join(root, "public", relative);
    if (check)
      assert.equal(
        fs.readFileSync(destination, "utf8"),
        contents,
        `Stale or incomplete notice: ${relative}`,
      );
    else {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, contents);
    }
  }
  return {
    packages: result.packages.length,
    missingLicenseFiles: result.missingLicenseFiles,
    licenseGaps: result.licenseGaps,
    redistributionStatus: result.licenseGaps.length
      ? "Unresolved license/attribution gaps; technical checks do not establish redistribution permission."
      : "No declared license gaps detected; not a legal opinion.",
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  console.log(
    JSON.stringify(
      generateNotices({ check: process.argv.includes("--check") }),
      null,
      2,
    ),
  );
}
