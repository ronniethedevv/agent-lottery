import { Sidebar } from "@/components/Sidebar";
import { AuroraBackground } from "@/components/AuroraBackground";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen">
      <AuroraBackground subtle />
      <Sidebar />
      <main className="ml-64 min-h-screen px-8 py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
