import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Events | Sundai",
  description: "Check out upcoming events and activities at Sundai",
};

export default function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 