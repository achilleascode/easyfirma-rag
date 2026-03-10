import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EasyFirma Support Chatbot",
  description: "RAG-basierter Support-Chatbot für EasyFirma",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased">{children}</body>
    </html>
  );
}
