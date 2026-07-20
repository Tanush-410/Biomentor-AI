import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="theme-color" content="#d9c25c" />
        <meta name="description" content="VYDRA CORE - role-aware exam preparation with offline study, AI tutoring, educator analytics, and Bloom-guided assessment tools." />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="VYDRA CORE" />

        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </Head>
      <body>
        <Main />
        <NextScript />
        <script>{`
          // Prevent FOUC
          document.documentElement.style.visibility = 'visible';
        `}</script>
      </body>
    </Html>
  )
}
