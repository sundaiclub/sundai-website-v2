import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pitch | Sundai Club",
  description: "Pitch events: join the queue, see current and upcoming projects.",
};

export default function PitchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}


