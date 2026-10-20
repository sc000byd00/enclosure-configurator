import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PCB enclosure configurator",
  description: "Configure a 3D-printable enclosure for a circuit board: snap-fit lid, light pipes, connector cutouts, design checks. Download STEP, STL and 3MF.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
