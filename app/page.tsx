// src/app/page.tsx
"use client";  

import dynamic from "next/dynamic";

// Dynamically import the dashboard and disable server-side rendering
const NetOpsDashboard = dynamic(
  () => import("@/components/netops/dashboard").then((mod) => mod.NetOpsDashboard),
  { ssr: false }
);

export default function Home() {
  return (
    <main>
      <NetOpsDashboard />
    </main>
  );
}