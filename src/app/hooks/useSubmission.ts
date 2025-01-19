import { useState, useEffect } from "react";
import type { Submission } from "../components/Submission";

export function useSubmission(submissionId: string) {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetchSubmission();
  }, [submissionId]);

  const fetchSubmission = async () => {
    try {
      const response = await fetch(`/api/submissions/${submissionId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch submission");
      }
      const data = await response.json();
      setSubmission(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = async (submissionId: string) => {
    try {
      const response = await fetch(`/api/submissions/${submissionId}/like`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to like submission");
      }
      await fetchSubmission();
    } catch (err) {
      console.error("Error liking submission:", err);
    }
  };

  return { submission, isLoading, error, handleLike };
}
