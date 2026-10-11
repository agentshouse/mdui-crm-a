import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Company, Contact } from "../types";

const images = vi.hoisted(() => ({ render: vi.fn() }));
vi.mock("../misc/RoomAssets", () => ({
  RoomAssetImage: (props: {
    asset?: unknown;
    alt: string;
    className?: string;
  }) => {
    images.render(props);
    return null;
  },
}));
import { Avatar } from "./Avatar";
import { CompanyAvatar } from "../companies/CompanyAvatar";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Room-backed CRM avatars", () => {
  it("keeps contact initials visible while passing only the stored asset to the safe image helper", () => {
    const avatar = {
      attachment_ref: "at_contact1",
      title: "photo.png",
      type: "image/png",
    };
    const contact = {
      id: "contact-1",
      first_name: "Ada",
      last_name: "Lovelace",
      avatar,
    } as unknown as Contact;
    render(<Avatar record={contact} />);
    expect(screen.getByText("AL")).toBeInTheDocument();
    expect(images.render).toHaveBeenCalledWith(
      expect.objectContaining({
        asset: avatar,
        alt: "Ada Lovelace",
        className: expect.stringContaining("absolute"),
      }),
    );
    expect(document.querySelector("img")).toBeNull();
  });

  it("keeps company initials visible when the image helper cannot load a logo", () => {
    const logo = {
      attachment_ref: "at_company1",
      title: "logo.png",
      type: "image/png",
    };
    const company = {
      id: "company-1",
      name: "Analytical Engines",
      logo,
    } as unknown as Company;
    render(<CompanyAvatar record={company} />);
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(images.render).toHaveBeenCalledWith(
      expect.objectContaining({
        asset: logo,
        alt: "Analytical Engines",
        className: expect.stringContaining("absolute"),
      }),
    );
  });

  it("supports records with no uploaded image", () => {
    render(
      <Avatar
        record={
          {
            id: "contact-2",
            first_name: "Grace",
            last_name: "Hopper",
          } as Contact
        }
      />,
    );
    expect(screen.getByText("GH")).toBeInTheDocument();
    expect(images.render).toHaveBeenCalledWith(
      expect.objectContaining({ asset: undefined }),
    );
  });
});
