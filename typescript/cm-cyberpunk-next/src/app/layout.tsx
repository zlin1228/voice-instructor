import { UserProvider } from "@auth0/nextjs-auth0/client"
import localFont from "next/font/local"
import Script from 'next/script'

import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Quantum Engine - Cyberpunk",
  description: "Quantum Engine - Cyberpunk",
}

const CarbonRegular = localFont({
  src: "../CarbonRegular W00 Regular.ttf",
  display: "swap",
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <UserProvider>
      <html lang="en" className={CarbonRegular.className}>
        <body>
          <div>
          <Script src="https://www.googletagmanager.com/gtag/js?id=G-3RLKTPP0P2" />
          <Script id="google-analytics">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
    
              gtag('config', 'G-3RLKTPP0P2');
            `}
          </Script>
          {children}
          </div>
        </body>
      </html>
    </UserProvider>
  )
}
