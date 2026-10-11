import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FormProvider, useForm } from "react-hook-form";
import {
  RoomAssetImage,
  RoomAssetInput,
  isSafeRaster,
} from "../src/components/atomic-crm/misc/RoomAssets";
const provider = vi.hoisted(() => ({
  uploadAttachment: vi.fn(),
  getAttachment: vi.fn(),
}));
vi.mock("ra-core", () => ({ useDataProvider: () => provider }));
const descriptor = {
  attachment_ref: "at_sample.1",
  title: "mock.png",
  type: "image/png",
  size: 8,
};
const png = () =>
  new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "mock.png", {
    type: "image/png",
  });
let create: ReturnType<typeof vi.fn>;
let revoke: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", undefined);
  vi.clearAllMocks();
  create = vi.fn(() => "blob:room-preview");
  revoke = vi.fn();
  vi.stubGlobal(
    "URL",
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }),
  );
});
afterEach(() => vi.unstubAllGlobals());
function Form({ save = vi.fn() }) {
  const form = useForm({ defaultValues: { attachments: [] } });
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(save)}>
        <RoomAssetInput source="attachments" label="Files" multiple />
        <button type="submit">Save record</button>
        <output data-testid="value">
          {JSON.stringify(form.watch("attachments"))}
        </output>
      </form>
    </FormProvider>
  );
}
describe("Room asset UI", () => {
  it("allows raster signatures but rejects SVG, HTML and mismatched content", async () => {
    expect(await isSafeRaster(png())).toBe(true);
    expect(
      await isSafeRaster(new Blob(["<svg/>"], { type: "image/svg+xml" })),
    ).toBe(false);
    expect(
      await isSafeRaster(
        new Blob(["<img src=https://example.com>"], { type: "image/png" }),
      ),
    ).toBe(false);
  });
  it("resolves only a Room reference to a local object URL and revokes it", async () => {
    provider.getAttachment.mockResolvedValue({
      blob: png(),
      name: "mock.png",
      type: "image/png",
      status: "available",
    });
    const { unmount } = render(
      <RoomAssetImage asset={descriptor} alt="Company logo" />,
    );
    const img = await screen.findByAltText("Company logo");
    expect(provider.getAttachment).toHaveBeenCalledWith("at_sample.1");
    expect(img).toHaveAttribute("src", "blob:room-preview");
    unmount();
    expect(revoke).toHaveBeenCalledWith("blob:room-preview");
  });
  it("refuses non-raster previews and displays the reason without an image", async () => {
    provider.getAttachment.mockResolvedValue({
      blob: new Blob(["<svg/>"], { type: "image/svg+xml" }),
      name: "bad.svg",
      type: "image/svg+xml",
      status: "available",
    });
    render(<RoomAssetImage asset={descriptor} alt="Company logo" />);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "not a supported raster image",
    );
    expect(screen.queryByRole("img")).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
  it("does not treat an unavailable stored file as a preview error", async () => {
    provider.getAttachment.mockResolvedValue({
      blob: null,
      name: "mock.png",
      type: "image/png",
      status: "not_saved",
    });
    render(<RoomAssetImage asset={descriptor} alt="Company logo" />);
    await act(async () => {});
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
  it("blocks malformed external references before dispatch", async () => {
    render(
      <RoomAssetImage
        asset={{ ...descriptor, attachment_ref: "https://example.com/a.png" }}
        alt="Company logo"
      />,
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "not a valid Room",
    );
    expect(provider.getAttachment).not.toHaveBeenCalled();
  });
  it("blocks save and repeated selection until the explicit upload completes", async () => {
    let resolve!: (value: typeof descriptor) => void;
    provider.uploadAttachment.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const save = vi.fn();
    render(<Form save={save} />);
    const input = screen.getByLabelText("Files");
    fireEvent.change(input, { target: { files: [png()] } });
    expect(
      await screen.findByText("Uploading to the Room…"),
    ).toBeInTheDocument();
    fireEvent.change(input, { target: { files: [png()] } });
    fireEvent.click(screen.getByText("Save record"));
    await act(async () => {});
    expect(save).not.toHaveBeenCalled();
    expect(provider.uploadAttachment).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("value")).toHaveTextContent("[]");
    await act(async () => resolve(descriptor));
    await waitFor(() =>
      expect(screen.getByTestId("value")).toHaveTextContent("at_sample.1"),
    );
    fireEvent.click(screen.getByText("Save record"));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/Save the form to link/)).toBeInTheDocument();
  });
  it("shows upload refusals and keeps existing form values", async () => {
    provider.uploadAttachment.mockRejectedValue(
      new Error("attachments/upload rejected: room-read-only"),
    );
    render(<Form />);
    fireEvent.change(screen.getByLabelText("Files"), {
      target: { files: [png()] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "room-read-only",
    );
    expect(screen.getByTestId("value")).toHaveTextContent("[]");
    expect(screen.getByLabelText("Files")).not.toBeDisabled();
  });
});


it("defers the actual Room read until its image is visible", async () => {
 let notify: (entries: { isIntersecting: boolean }[]) => void = () => {};
 const disconnect=vi.fn();
 vi.stubGlobal('IntersectionObserver',class { constructor(fn: typeof notify){notify=fn}observe(){}disconnect=disconnect; });
 provider.getAttachment.mockResolvedValue({blob:png(),name:'mock.png',type:'image/png',status:'available'});
 const {unmount}=render(<RoomAssetImage asset={descriptor} alt="Lazy company logo" />);
 await act(async()=>{});expect(provider.getAttachment).not.toHaveBeenCalled();
 act(()=>notify([{isIntersecting:false}]));expect(provider.getAttachment).not.toHaveBeenCalled();
 act(()=>notify([{isIntersecting:true}]));const img=await screen.findByAltText('Lazy company logo');expect(img).toHaveAttribute('loading','lazy');expect(provider.getAttachment).toHaveBeenCalledOnce();unmount();expect(disconnect).toHaveBeenCalled();
});
