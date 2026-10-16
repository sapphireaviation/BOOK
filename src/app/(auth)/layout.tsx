import Link from "next/link";
import { Wordmark } from "@/components/site/wordmark";
import { site } from "@/config/site";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="container-page flex h-16 items-center">
        <Wordmark />
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-6 pb-16 pt-8 sm:pt-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>
      <footer className="container-page flex flex-wrap gap-x-5 gap-y-2 border-t border-line py-5 text-xs text-slate">
        <Link href="/terms" className="tap hover:text-ink hover:underline">
          Terms
        </Link>
        <Link href="/privacy" className="tap hover:text-ink hover:underline">
          Privacy
        </Link>
        <Link href="/help" className="tap hover:text-ink hover:underline">
          Help
        </Link>
        <a href={`mailto:${site.supportEmail}`} className="tap hover:text-ink hover:underline">
          {site.supportEmail}
        </a>
      </footer>
    </div>
  );
}
