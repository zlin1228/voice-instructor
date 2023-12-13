import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Quantum Engine - Community",
  description: "Quantum Engine - Community",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ color: "#fafafa" }}>
        {children}
      </body>
    </html>
  )
}
