export const metadata = {
  title: "Weekly News – Sundai",
  description: "Weekly community highlights: top projects and builders.",
  alternates: { canonical: "https://sundai.club/news" },
  openGraph: {
    title: "Weekly News – Sundai",
    description: "Weekly community highlights: top projects and builders.",
    url: "https://sundai.club/news",
    images: [
      { url: "/images/default_project_thumbnail_light.svg", width: 1200, height: 630, alt: "Sundai Weekly" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Weekly News – Sundai",
    description: "Weekly community highlights: top projects and builders.",
  },
  robots: { index: true, follow: true },
};

import dynamic from "next/dynamic";
const NewsClient = dynamic(() => import("./NewsClient"), { ssr: false });

export default function NewsPage() {
  return <NewsClient />;
}


