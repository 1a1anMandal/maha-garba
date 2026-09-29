import type { Metadata } from "next";
import { Rozha_One, Open_Sans } from "next/font/google";
import "./globals.css";

const rozhaOne = Rozha_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-rozha",
});

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Maha Garba Entry System",
  description: "Event entry management for Maha Garba",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${rozhaOne.variable} ${openSans.variable} font-sans antialiased bg-texture min-h-screen flex flex-col`}
      >
        {children}
      </body>
    </html>
  );
}
