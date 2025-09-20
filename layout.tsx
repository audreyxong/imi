import "./globals.css";

export const metadata = {
  title: "IMI Service Report",
  description: "Generate and print service reports",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
