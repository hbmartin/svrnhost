import type { Metadata } from "next";
import { Cinzel, Raleway } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

import "./globals.css";
import { SessionProvider } from "next-auth/react";

const SITE_URL = "https://svrnhost.vercel.app";
const SITE_TITLE = "SVRN AI Studio";
const SITE_DESCRIPTION =
	"Work with SVRN AI Studio to research, build, and ship artifacts faster.";

export const metadata: Metadata = {
	metadataBase: new URL(SITE_URL),
	title: SITE_TITLE,
	description: SITE_DESCRIPTION,
};

export const viewport = {
	maximumScale: 1, // Disable auto-zoom on mobile Safari
};

const cinzel = Cinzel({
	subsets: ["latin"],
	display: "swap",
	variable: "--font-cinzel",
});

const raleway = Raleway({
	subsets: ["latin"],
	display: "swap",
	variable: "--font-raleway",
});

const LIGHT_THEME_COLOR = "hsl(0 0% 100%)";
const DARK_THEME_COLOR = "hsl(240deg 10% 3.92%)";
const THEME_COLOR_SCRIPT = `\
(function() {
  var html = document.documentElement;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  function updateThemeColor() {
    var isDark = html.classList.contains('dark');
    meta.setAttribute('content', isDark ? '${DARK_THEME_COLOR}' : '${LIGHT_THEME_COLOR}');
  }
  var observer = new MutationObserver(updateThemeColor);
  observer.observe(html, { attributes: true, attributeFilter: ['class'] });
  updateThemeColor();
})();`;

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			className={`${cinzel.variable} ${raleway.variable}`}
			// `next-themes` injects an extra classname to the body element to avoid
			// visual flicker before hydration. Hence the `suppressHydrationWarning`
			// prop is necessary to avoid the React hydration mismatch warning.
			// https://github.com/pacocoursey/next-themes?tab=readme-ov-file#with-app
			lang="en"
			suppressHydrationWarning
		>
			<head>
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: theming
					dangerouslySetInnerHTML={{
						__html: THEME_COLOR_SCRIPT,
					}}
				/>
			</head>
			<body className="antialiased">
				<ThemeProvider
					attribute="class"
					defaultTheme="dark"
					disableTransitionOnChange
					enableSystem={false}
				>
					<Toaster position="top-center" />
					<SessionProvider>{children}</SessionProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
