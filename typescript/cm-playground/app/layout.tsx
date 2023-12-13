import Script from "next/script"

import "./globals.css"

export const metadata = {
  title: "CM Playground",
  viewport: {
    width: "device-width",
    initialScale: 1,
  },
  themeColor: "#000000",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <Script>
        {"window.localStorage.setItem('debug', 'mediasoup-client:*');"}
      </Script>
      <body>
        <div>{children}</div>
      </body>
    </html>
  )
}
