import Script from "next/script"

import { ClerkProvider } from "@clerk/nextjs/app-beta"

import "../os2/index.css"

export const metadata = {
  title: "rabbit",
  description: "rabbit",
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
    <ClerkProvider>
      <html lang="en">
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-3HXSJ4CW1G"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){window.dataLayer.push(arguments);}
              gtag('js', new Date());

              gtag('config', 'G-3HXSJ4CW1G');
            `}
        </Script>
        <body>
          <div id="root">{children}</div>
        </body>
      </html>
    </ClerkProvider>
  )
}
