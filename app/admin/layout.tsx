import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "JOYNEXT 数字化销售运营中心",
  description: "JOYNEXT 机器人元器件客户、线索、订单与销售任务管理端。",
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
