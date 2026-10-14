"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/food", label: "Food", icon: "🍎" },
  { href: "/workout", label: "Workout", icon: "🏋️" },
  { href: "/progress", label: "Progress", icon: "📈" },
  { href: "/feed", label: "Feed", icon: "📣" },
  { href: "/profile", label: "Profile", icon: "👤" },
];

export default function AppNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop / tablet: left sidebar */}
      <nav className="hidden md:flex md:flex-col md:w-56 md:shrink-0 border-r border-zinc-800 p-4 gap-1 min-h-screen">
        <p className="font-extrabold text-lg px-2 mb-4">
          Gym<span className="text-acc">Arc</span>
        </p>
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm ${
                active ? "bg-zinc-900 text-white font-semibold" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile: bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur border-t border-zinc-800 flex justify-around py-2 z-50"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 8px)" }}
      >
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center text-[9px] px-1 py-1 ${
                active ? "text-white" : "text-zinc-500"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
