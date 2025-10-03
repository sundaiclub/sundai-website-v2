"use client";
import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";

export function useAutoLike(projectId: string | null) {
  const { isSignedIn, isLoaded, openSignIn } = useUser() as any;
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (!projectId) return;

    const shouldLike = searchParams?.get("like") === "1";
    if (!shouldLike) return;

    const likeOnceKey = `liked_${projectId}`;
    if (sessionStorage.getItem(likeOnceKey)) return;

    const trigger = async () => {
      if (!isLoaded) return;
      if (!isSignedIn) {
        try {
          if (typeof openSignIn === "function") {
            await openSignIn({
              redirectUrl: `/projects/${projectId}?like=1`,
            });
          }
        } catch {}
        return;
      }

      try {
        const res = await fetch(`/api/projects/${projectId}/like`, { method: "POST" });
        if (res.ok) {
          sessionStorage.setItem(likeOnceKey, "1");
          // Remove like=1 in URL after applying
          const params = new URLSearchParams(Array.from(searchParams?.entries() || []));
          params.delete("like");
          router.replace(`?${params.toString()}`);
        }
      } catch (e) {
        // no-op
      }
    };

    trigger();
  }, [projectId, isSignedIn, isLoaded]);
}


