import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "rap2next",
  description: "A metadata-driven Next.js renderer for SAP RAP OData V4 services."
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-(--background) text-(--foreground)">
        {children}
      </body>
    </html>
  );
}
