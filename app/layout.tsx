import type { Metadata } from "next";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Smart Loan | ระบบจัดการและติดตามหนี้สินเงินกู้อัจฉริยะ",
  description:
    "ระบบจัดการและติดตามหนี้สินเงินกู้อัจฉริยะ รองรับการคำนวณดอกเบี้ยคงที่และลดต้นลดดอก พร้อมระบบแจ้งเตือนอัตโนมัติ",
  keywords: ["loan management", "ระบบกู้ยืม", "ดอกเบี้ย", "สินเชื่อ"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
