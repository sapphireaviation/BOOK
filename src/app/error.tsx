"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Wordmark } from "@/components/site/wordmark";
import { Button } from "@/components/ui";
import { site } from "@/config/site";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;

  return (
    <>
      <header className="border-b border-line">
        <div className="container-page flex h-16 items-center">
          <Wordmark />
        </div>
      </header>
      <main id="main" className="flex-1">
        <div className="container-page max-w-2xl py-20">
          <h1 className="text-3xl">This page did not load</h1>
          <p className="mt-4 text-lg text-slate">
            Something failed on our side. Try again, and if it keeps happening, write to{" "}
            <a className="link" href={`mailto:${site.supportEmail}`}>
              {site.supportEmail}
            </a>
            {digest ? ` and quote the code ${digest}` : ""}.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button onClick={() => retry()}>Try again</Button>
            <Link href="/" className="link">
              Go to the home page
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
