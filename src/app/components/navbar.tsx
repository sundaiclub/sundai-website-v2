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
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
        isScrolled ? "bg-[#E5E5E5] shadow-md opacity-90" : "bg-[#E5E5E5]"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="text-lg font-montserrat text-indigo-800 font-semibold">
            <Link
              href="/"
              className={`text-center group flex items-center ${
                isPWA ? "p-2" : "" // Extra padding for PWA
              }`}
            >
              <Image
                src="/images/logo.svg"
                alt="Sundai Club Logo"
                width={80}
                height={80}
                className="transition-transform duration-300 transform group-hover:scale-110 mr-2"
              />
            </Link>
          </div>
          <div className="flex items-center">
            <Link
              href="/projects"
              className={`${
                isPWA ? "px-4 py-3" : "px-3 py-2"
              } mx-2 rounded-lg active:bg-indigo-100`}
            >
              <span className="text-sm text-black hover:text-indigo-700 dark:hover:text-indigo-500 transition duration-300">
                Join a Project
              </span>
            </Link>

            {isSignedIn && (
              <>
                <Link
                  href="/projects/new"
                  className={`${
                    isPWA ? "px-4 py-3" : "px-3 py-2"
                  } mx-2 rounded-lg active:bg-indigo-100`}
                >
                  <span className="text-sm text-black hover:text-indigo-700 dark:hover:text-indigo-500 transition duration-300">
                    New Project
                  </span>
                </Link>

                <Link
                  href={`/hacker/${user?.id}`}
                  className={`${
                    isPWA ? "px-4 py-3" : "px-3 py-2"
                  } mx-2 rounded-lg active:bg-indigo-100`}
                >
                  <span className="text-sm text-black hover:text-indigo-700 dark:hover:text-indigo-500 transition duration-300">
                    My Profile
                  </span>
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
                  <span
                    className={`
                    text-sm bg-indigo-600 text-white rounded-full hover:bg-indigo-700 
                    transition duration-300 cursor-pointer
                    ${isPWA ? "px-6 py-3" : "px-4 py-2"}
                  `}
                  >
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
