import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocMind — AI Document Assistant",
  description: "Upload a PDF and chat with it using AWS Bedrock RAG",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
