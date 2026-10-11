import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RoomAssetDownload,
  RoomAssetImage,
  isSafeRaster,
} from "../src/components/atomic-crm/misc/RoomAssets";

const provider = vi.hoisted(() => ({
  getAttachment: vi.fn(),
  uploadAttachment: vi.fn(),
}));
vi.mock("ra-core", () => ({ useDataProvider: () => provider }));
const descriptor = {
  attachment_ref: "at_safe.1",
  title: "photo.png",
  type: "image/png",
  size: 8,
};
const png = () =>
  new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], {
    type: "image/png",
  });
const read = (blob: Blob) => ({
  blob,
  name: "stored.png",
  type: blob.type,
  status: "available" as const,
});
let create: ReturnType<typeof vi.fn>;
let revoke: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", undefined);
  vi.clearAllMocks();
  create = vi.fn(() => "blob:controlled-room-file");
  revoke = vi.fn();
  vi.stubGlobal(
    "URL",
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Room asset resource guards", () => {
  it.each([
    "https://outside.example/image.png",
    "data:image/svg+xml,<svg onload=alert(1) />",
    "blob:untrusted-from-document",
  ])(
    "ignores untrusted source URL %s when resolving an opaque reference",
    async (src) => {
      provider.getAttachment.mockResolvedValue(read(png()));
      const asset = { ...descriptor, src, url: src };
      render(<RoomAssetImage asset={asset} alt="Controlled preview" />);
      const image = await screen.findByAltText("Controlled preview");
      expect(provider.getAttachment).toHaveBeenCalledWith("at_safe.1");
      expect(image).toHaveAttribute("src", "blob:controlled-room-file");
      expect(image).not.toHaveAttribute("src", src);
      expect(create).toHaveBeenCalledWith(expect.any(Blob));
    },
  );

  it("does not render URL-only legacy avatars or ask the provider to resolve them", async () => {
    const asset = {
      src: "https://outside.example/avatar.png",
    } as unknown as typeof descriptor;
    render(<RoomAssetImage asset={asset} alt="Legacy avatar" />);
    await act(async () => {});
    expect(provider.getAttachment).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("rejects active MIME types, mismatched raster bytes, and oversized image blobs", async () => {
    for (const blob of [
      new Blob(["<svg><image href='https://outside.example/x'/></svg>"], {
        type: "image/svg+xml",
      }),
      new Blob(["<html><script>alert(1)</script></html>"], {
        type: "text/html",
      }),
      new Blob(["<svg/>"], { type: "image/png" }),
      new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: "image/png" }),
    ])
      expect(await isSafeRaster(blob)).toBe(false);
    expect(await isSafeRaster(png())).toBe(true);
  });

  it("never creates an object URL for a provider response arriving after unmount", async () => {
    let resolve!: (value: ReturnType<typeof read>) => void;
    provider.getAttachment.mockReturnValue(
      new Promise<ReturnType<typeof read>>((done) => {
        resolve = done;
      }),
    );
    const { unmount } = render(
      <RoomAssetImage asset={descriptor} alt="Disposed preview" />,
    );
    unmount();
    await act(async () => {
      resolve(read(png()));
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("ignores stale image results when a newer attachment is selected", async () => {
    let resolve!: (value: ReturnType<typeof read>) => void;
    provider.getAttachment
      .mockReturnValueOnce(
        new Promise<ReturnType<typeof read>>((done) => {
          resolve = done;
        }),
      )
      .mockResolvedValueOnce(read(png()));
    const { rerender } = render(
      <RoomAssetImage asset={descriptor} alt="Current preview" />,
    );
    rerender(
      <RoomAssetImage
        asset={{ ...descriptor, attachment_ref: "at_safe.2" }}
        alt="Current preview"
      />,
    );
    expect(await screen.findByAltText("Current preview")).toHaveAttribute(
      "src",
      "blob:controlled-room-file",
    );
    await act(async () => {
      resolve(read(png()));
    });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("downloads only a locally created Blob URL with a sanitized filename", async () => {
    provider.getAttachment.mockResolvedValue(
      read(
        new Blob(["stored file contents"], {
          type: "application/octet-stream",
        }),
      ),
    );
    let href = "",
      name = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      href = this.href;
      name = this.download;
    });
    const asset = {
      ...descriptor,
      title: "../../file\u0000.txt",
      src: "https://outside.example/malware",
    };
    render(<RoomAssetDownload asset={asset} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(href).toBe("blob:controlled-room-file"));
    expect(name).toBe(".._.._file_.txt");
    expect(provider.getAttachment).toHaveBeenCalledWith("at_safe.1");
    expect(create).toHaveBeenCalledWith(expect.any(Blob));
  });
  it.each([
    "https://outside.example/file.png",
    "data:image/png;base64,eA==",
    "blob:untrusted",
    "at_https://outside.example/file",
    "at_x\u0000",
  ])(
    "rejects a masquerading attachment reference %s before provider dispatch",
    async (attachment_ref) => {
      render(
        <RoomAssetImage
          asset={{ ...descriptor, attachment_ref }}
          alt="Invalid preview"
        />,
      );
      expect(await screen.findByRole("status")).toHaveTextContent(
        "not a valid Room attachment reference",
      );
      expect(provider.getAttachment).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
      expect(screen.queryByRole("img")).toBeNull();
    },
  );

  it("does not fall back to a URL when the documented read result has no Blob", async () => {
    provider.getAttachment.mockResolvedValue({
      blob: null,
      name: "stored.png",
      type: "image/png",
      status: "not_saved",
      url: "https://outside.example/not-a-fallback",
    });
    render(<RoomAssetImage asset={descriptor} alt="No fallback" />);
    await act(async () => {});
    expect(create).not.toHaveBeenCalled();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("revokes a failed image preview immediately and does not revoke twice on unmount", async () => {
    provider.getAttachment.mockResolvedValue(read(png()));
    const { unmount } = render(
      <RoomAssetImage asset={descriptor} alt="Invalid bytes" />,
    );
    fireEvent.error(await screen.findByAltText("Invalid bytes"));
    expect(revoke).toHaveBeenCalledWith("blob:controlled-room-file");
    unmount();
    expect(revoke).toHaveBeenCalledTimes(1);
  });
});
