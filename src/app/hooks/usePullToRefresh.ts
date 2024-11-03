import { useEffect } from "react";

export function usePullToRefresh() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      let startY = 0;
      let currentY = 0;
      const threshold = 150;
      let isPWA = window.matchMedia("(display-mode: standalone)").matches;

      const touchStart = (e: TouchEvent) => {
        startY = e.touches[0].pageY;
        // Reset transforms
        if (isPWA) {
          document
            .querySelector("#__next")
            ?.setAttribute("style", "transform: none");
        } else {
          document.documentElement.style.transform = "";
        }
      };

      const touchMove = (e: TouchEvent) => {
        currentY = e.touches[0].pageY;
        const pullDistance = currentY - startY;

        if (window.scrollY === 0 && pullDistance > 0) {
          e.preventDefault();
          const translateY = Math.min(pullDistance / 2, threshold);

          if (isPWA) {
            // In PWA mode, transform the Next.js root element
            const nextRoot = document.querySelector("#__next");
            if (nextRoot) {
              nextRoot.setAttribute(
                "style",
                `
                transform: translateY(${translateY}px);
                transition: none;
              `
              );
            }
          } else {
            // In browser mode, transform the html element
            document.documentElement.style.transform = `translateY(${translateY}px)`;
            document.documentElement.style.transition = "none";
          }
        }
      };

      const touchEnd = () => {
        const pullDistance = currentY - startY;

        if (isPWA) {
          const nextRoot = document.querySelector("#__next");
          if (nextRoot) {
            nextRoot.setAttribute(
              "style",
              `
              transform: translateY(0);
              transition: transform 0.3s ease-out;
            `
            );
          }
        } else {
          document.documentElement.style.transition = "transform 0.3s ease-out";
          document.documentElement.style.transform = "";
        }

        setTimeout(() => {
          if (isPWA) {
            document.querySelector("#__next")?.setAttribute("style", "");
          } else {
            document.documentElement.style.transition = "";
          }
        }, 300);

        if (pullDistance > threshold && window.scrollY === 0) {
          // Force browser refresh
          window.location.reload();
        }
      };

      document.addEventListener("touchstart", touchStart, { passive: false });
      document.addEventListener("touchmove", touchMove, { passive: false });
      document.addEventListener("touchend", touchEnd);

      return () => {
        document.removeEventListener("touchstart", touchStart);
        document.removeEventListener("touchmove", touchMove);
        document.removeEventListener("touchend", touchEnd);
      };
    }
  }, []);
}
