import type { Metadata } from "next";
import { M_PLUS_Rounded_1c } from "next/font/google";
import { AppProvider } from "@/context/AppProvider";
import { AlarmWatcher } from "@/components/AlarmWatcher";
import "./globals.css";

const mPlusRounded = M_PLUS_Rounded_1c({
  weight: ["400", "500", "700", "800"],
  subsets: ["latin"],
  variable: "--font-rounded",
});

export const metadata: Metadata = {
  title: "タスクボード | 家族共有タスク管理",
  description: "家族でたすけあう・みんなの予定",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${mPlusRounded.variable} h-full antialiased`}>
      <body className="min-h-full text-slate-700">
        <AppProvider>
          <AlarmWatcher />
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
