"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { SignIn } from "@clerk/nextjs";
import { getHackerByClerkId } from "@/lib/api";

export default function MePage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    const redirectToHackerProfile = async () => {
      if (!user) return;

      try {
        const hacker = await getHackerByClerkId(user.id);
        if (hacker) {
          router.push(`/hacker/${hacker.id}`);
        } else {
          router.push('/hacker/new');
        }
      } catch (error) {
        router.push('/hacker/new');
      }
    };

    if (isLoaded) {
      redirectToHackerProfile();
    }
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
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600" role="status" aria-live="polite"></div>
    </div>
  );
}
