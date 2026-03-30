"use client";
import { useEffect } from "react";

type ResultStatus = "success" | "already_checked_in" | "not_found" | null;

interface CheckInResultProps {
  status: ResultStatus;
  email?: string;
  checkedInAt?: string;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export default function CheckInResult({
  status,
  email,
  checkedInAt,
  onDismiss,
  autoDismissMs = 3000,
}: CheckInResultProps) {
  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(timer);
  }, [status, onDismiss, autoDismissMs]);

  if (!status) return null;

  const config = {
    success: {
      bg: "bg-green-100 dark:bg-green-900",
      text: "text-green-800 dark:text-green-100",
      border: "border-green-300 dark:border-green-700",
      title: "Checked In",
    },
    already_checked_in: {
      bg: "bg-yellow-100 dark:bg-yellow-900",
      text: "text-yellow-800 dark:text-yellow-100",
      border: "border-yellow-300 dark:border-yellow-700",
      title: "Already Checked In",
    },
    not_found: {
      bg: "bg-red-100 dark:bg-red-900",
      text: "text-red-800 dark:text-red-100",
      border: "border-red-300 dark:border-red-700",
      title: "Not Found",
    },
  };

  const c = config[status];

  return (
    <div
      className={`${c.bg} ${c.text} border ${c.border} rounded-lg p-6 text-center`}
    >
      <h3 className="text-2xl font-bold mb-2">{c.title}</h3>
      {email && <p className="text-lg font-mono">{email}</p>}
      {status === "already_checked_in" && checkedInAt && (
        <p className="text-sm mt-1 opacity-75">
          at {new Date(checkedInAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
