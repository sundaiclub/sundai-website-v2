"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { UserButton, SignInButton, useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import Image from "next/image";

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const { isSignedIn, user } = useUser();
  const pathname = usePathname();
  const isPWA =
    typeof window !== "undefined" &&
    window.matchMedia("(display-mode: standalone)").matches;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`navbar ${isScrolled ? "navbar-scrolled" : ""}`}>
      <div className="section-container">
        <div className="flex justify-between items-center py-4">
          <div className="text-lg font-montserrat text-indigo-800 font-semibold">
            <Link
              href="/"
              className={`group flex items-center ${isPWA ? "pwa-padding-large" : ""}`}
            >
              <Image
                src="/images/logo.svg"
                alt="Sundai Club Logo"
                width={80}
                height={80}
                className="mr-2 hover-scale"
              />
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              href="/projects"
              className={`navbar-button ${isPWA ? "pwa-padding-large" : "pwa-padding"}`}
            >
              Join a Project
            </Link>

            {isSignedIn && (
              <>
                <Link
                  href="/projects/new"
                  className={`navbar-button ${isPWA ? "pwa-padding-large" : "pwa-padding"}`}
                >
                  New Project
                </Link>

                <Link
                  href={`/hacker/${user?.id}`}
                  className={`navbar-button ${isPWA ? "pwa-padding-large" : "pwa-padding"}`}
                >
                  My Profile
                </Link>
              </>
            )}

            <div className={`${isPWA ? "ml-2 p-1" : "ml-1"}`}>
              {isSignedIn ? (
                <UserButton
                  afterSignOutUrl={pathname}
                  appearance={{
                    elements: {
                      avatarBox: isPWA ? "w-10 h-10" : "w-8 h-8",
                    },
                  }}
                />
              ) : (
                <SignInButton mode="modal">
                  <span className={`navbar-button ${isPWA ? "pwa-padding-large" : "pwa-padding"}`}>
                    Log In
                  </span>
                </SignInButton>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;