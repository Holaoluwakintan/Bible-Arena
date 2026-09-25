import { ScrollViewStyleReset } from "expo-router/html";
import type { ReactNode } from "react";

const webOrigin = (process.env.EXPO_PUBLIC_WEB_ORIGIN ?? "http://localhost:8081").replace(/\/$/, "");

export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0C1726" />
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
