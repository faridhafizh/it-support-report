import "./globals.css";

export const metadata = {
  title: "IT Support — Log Keluhan Client",
  description: "WebUI untuk mencatat & menangani keluhan client, terhubung langsung ke file Excel.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
