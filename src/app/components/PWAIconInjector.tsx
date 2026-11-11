import { useEffect } from "react";
import svgPaths from "../../imports/svg-9dqf0kngaq";

/**
 * PWAIconInjector
 *
 * Generates an SVG icon from the Panahon mark paths at runtime and injects:
 *  1. <link rel="apple-touch-icon"> for iOS Safari
 *  2. A dynamic blob-URL manifest with the correct icon URLs
 *  3. A PNG-flavored favicon fallback
 *
 * No figma:asset imports needed — the icon is built from the existing SVG paths.
 */

/** Build a data URL from the Panahon sun-burst SVG at any given size */
function buildSvgDataUrl(bg: string, fg: string): string {
  const paths = [
    svgPaths.p34abd900,
    svgPaths.p5b24000,
    svgPaths.p28e5b280,
    svgPaths.p27c28f00,
    svgPaths.p2765f980,
    svgPaths.p2abcdb00,
    svgPaths.p4af9c00,
    svgPaths.p356e9e80,
    svgPaths.p481e100,
    svgPaths.p3d85c300,
    svgPaths.p9a5c000,
    svgPaths.pfd46b80,
    svgPaths.p115dc800,
    svgPaths.p7673d00,
    svgPaths.p1eda2000,
    svgPaths.p12447c00,
  ];

  const pathElements = paths
    .map((d) => `<path d="${d}" fill="${fg}"/>`)
    .join("");

  // viewBox matches the original 586.393 × 586.393 coordinate space
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 586.393 586.393" width="512" height="512">
  <rect width="586.393" height="586.393" rx="120" fill="${bg}"/>
  ${pathElements}
</svg>`;

  // Use base64 to avoid URI encoding issues with the complex path data
  const b64 = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${b64}`;
}

export function PWAIconInjector() {
  useEffect(() => {
    // Orange background + white mark  →  works on any OS chrome
    const iconUrl = buildSvgDataUrl("#F97316", "#ffffff");

    // ── 1. Apple Touch Icon (iOS) ──────────────────────────────────────────
    let appleLink = document.querySelector(
      'link[rel="apple-touch-icon"]'
    ) as HTMLLinkElement | null;

    if (!appleLink) {
      appleLink = document.createElement("link");
      appleLink.rel = "apple-touch-icon";
      document.head.appendChild(appleLink);
    }
    appleLink.href = iconUrl;
    appleLink.sizes = "180x180";

    // ── 2. Dynamic Web App Manifest ────────────────────────────────────────
    const manifestData = {
      name: "Panahon – Fichaje",
      short_name: "Panahon",
      description: "Sistema de fichaje de Panahon",
      start_url: "/fichaje",
      scope: "/fichaje",
      display: "standalone",
      orientation: "portrait",
      background_color: "#F97316",
      theme_color: "#F97316",
      icons: [
        { src: iconUrl, sizes: "192x192", type: "image/svg+xml", purpose: "any maskable" },
        { src: iconUrl, sizes: "512x512", type: "image/svg+xml", purpose: "any maskable" },
      ],
    };

    const blob = new Blob([JSON.stringify(manifestData)], {
      type: "application/manifest+json",
    });
    const blobUrl = URL.createObjectURL(blob);

    let manifestLink = document.querySelector(
      'link[rel="manifest"]'
    ) as HTMLLinkElement | null;

    if (manifestLink) {
      const prev = (manifestLink as any).__prevBlobUrl as string | undefined;
      if (prev) URL.revokeObjectURL(prev);
      (manifestLink as any).__prevBlobUrl = blobUrl;
      manifestLink.href = blobUrl;
    } else {
      manifestLink = document.createElement("link");
      manifestLink.rel = "manifest";
      manifestLink.href = blobUrl;
      (manifestLink as any).__prevBlobUrl = blobUrl;
      document.head.appendChild(manifestLink);
    }

    // ── 3. SVG favicon fallback ────────────────────────────────────────────
    let faviconSvg = document.querySelector(
      'link[rel="icon"][data-panahon]'
    ) as HTMLLinkElement | null;

    if (!faviconSvg) {
      faviconSvg = document.createElement("link");
      faviconSvg.rel = "icon";
      faviconSvg.type = "image/svg+xml";
      faviconSvg.setAttribute("data-panahon", "1");
      document.head.appendChild(faviconSvg);
    }
    faviconSvg.href = iconUrl;

    return () => {
      URL.revokeObjectURL(blobUrl);
    };
  }, []);

  return null;
}
