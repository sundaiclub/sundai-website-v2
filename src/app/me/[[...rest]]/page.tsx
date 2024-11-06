"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { SignIn } from "@clerk/nextjs";

export default function MePage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    const redirectToHackerProfile = async () => {
      if (!user) return;

      try {
        const response = await fetch(`/api/hackers?clerkId=${user.id}`);
        if (response.ok) {
          const hacker = await response.json();
          router.push(`/hacker/${hacker.id}`);
        } else {
          console.error("Failed to fetch hacker profile");
        }
      } catch (error) {
        console.error("Error fetching hacker profile:", error);
      }
    };

    if (isLoaded) {
      redirectToHackerProfile();
    }
  }, [user, isLoaded, router]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
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
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
    </div>
  );
}
