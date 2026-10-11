import { RoomAssetImage } from "../misc/RoomAssets";
import { useRecordContext } from "ra-core";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import type { Company } from "../types";

export const CompanyAvatar = (props: {
  record?: Company;
  width?: 20 | 40;
  height?: 20 | 40;
}) => {
  const { width = 40 } = props;
  const record = useRecordContext<Company>(props);
  if (!record) return null;

  const sizeClass = width !== 40 ? `w-[20px] h-[20px]` : "w-10 h-10";

  return (
    <Avatar className={sizeClass}>
      <AvatarFallback className={width !== 40 ? "text-xs" : "text-sm"}>
        {record.name.charAt(0)}
      </AvatarFallback>
      <RoomAssetImage
        asset={record.logo}
        alt={record.name}
        className="absolute inset-0 h-full w-full object-contain"
      />
    </Avatar>
  );
};
