import { ScrollViewStyleReset } from "expo-router/html";
import type { ReactNode } from "react";

const webOrigin = (process.env.EXPO_PUBLIC_WEB_ORIGIN ?? "http://localhost:8081").replace(/\/$/, "");

export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0A1020" />
        <meta name="color-scheme" content="dark" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: "html,body,#root{background:#0A1020;} body{-webkit-tap-highlight-color:transparent;overscroll-behavior-y:none;} *:focus-visible{outline:2px solid #F5B942;outline-offset:2px;} @media (prefers-reduced-motion: reduce){*{animation-duration:0.01ms!important;transition-duration:0.01ms!important;}}" }} />
        <meta name="description" content="Bible Arena is a Scripture knowledge game for learning, practice, and friendly competition." />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Bible Arena — Know the Word. Challenge the World." />
        <meta property="og:description" content="Play a quick Bible knowledge round, learn from every answer, and compete with friends." />
        <meta property="og:url" content={`${webOrigin}/`} />
        <meta property="og:image" content={`${webOrigin}/assets/images/icon.png`} />
        <meta name="twitter:card" content="summary" />
        <link rel="canonical" href={`${webOrigin}/`} />
        <link rel="sitemap" type="application/xml" href="/sitemap.xml" />
        <title>Bible Arena — Know the Word. Challenge the World.</title>
      </head>
      <body>
        <ScrollViewStyleReset />
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
