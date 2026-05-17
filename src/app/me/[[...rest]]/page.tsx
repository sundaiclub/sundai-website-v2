"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SignIn, useUser } from "@clerk/nextjs";
import { getHackerByClerkId } from "@/lib/api";

const PROFILE_LOOKUP_ATTEMPTS = 10;
const PROFILE_LOOKUP_RETRY_DELAY_MS = process.env.NODE_ENV === "test" ? 0 : 500;

function wait(ms: number) {
  if (ms === 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function MePage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [profileLookupFailed, setProfileLookupFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const redirectToHackerProfile = async () => {
      if (!user) return;

      setProfileLookupFailed(false);

      for (let attempt = 1; attempt <= PROFILE_LOOKUP_ATTEMPTS; attempt += 1) {
        try {
          const hacker = await getHackerByClerkId(user.id);
          if (cancelled) return;

          if (hacker) {
            router.push(`/hacker/${hacker.id}`);
            return;
          }
        } catch (error) {
          if (cancelled) return;

          if (attempt === PROFILE_LOOKUP_ATTEMPTS) {
            console.error("Error fetching hacker profile:", error);
          }
        }

        if (attempt < PROFILE_LOOKUP_ATTEMPTS) {
          await wait(PROFILE_LOOKUP_RETRY_DELAY_MS);
        }
      }

      if (!cancelled) setProfileLookupFailed(true);
    };

    if (isLoaded) {
      redirectToHackerProfile();
    }

    return () => {
      cancelled = true;
    };
  }, [user, isLoaded, router]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600" role="status" aria-live="polite"></div>
      </div>
    );
  }

  if (!user) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
            <h1 className="text-2xl font-bold">Please sign in to view your profile</h1>
            <SignIn routing="hash" />
        </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600" role="status" aria-live="polite"></div>
      {profileLookupFailed && (
        <p className="max-w-md text-sm text-gray-600 font-fira-code">
          Your profile is still being created. Please refresh in a moment.
        </p>
      )}
    </div>
  );
}
