import AppNav from "@/components/AppNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-zinc-950">
      <AppNav />
      <main className="flex-1 pb-20 md:pb-0 max-w-3xl mx-auto w-full px-4 py-6">
        {children}
      </main>
    </div>
  );
}
