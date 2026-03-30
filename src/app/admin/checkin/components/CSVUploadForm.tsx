"use client";
import { useState, useRef } from "react";
import { useTheme } from "@/app/contexts/ThemeContext";
import toast from "react-hot-toast";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CSVUploadFormProps {
  selectedDate: string;
  onUploadComplete: () => void;
}

export default function CSVUploadForm({
  selectedDate,
  onUploadComplete,
}: CSVUploadFormProps) {
  const { isDarkMode } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [eventLabel, setEventLabel] = useState("");
  const [previewEmails, setPreviewEmails] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    created: number;
    skipped: number;
    total: number;
  } | null>(null);

  function parseCSVRow(line: string): string[] {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  }

  function parseCSV(text: string): string[] {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length === 0) return [];

    const headers = parseCSVRow(lines[0]);
    const emailColIndex = headers.findIndex((h) =>
      h.toLowerCase().includes("email")
    );

    if (emailColIndex === -1) {
      const emails: string[] = [];
      for (const line of lines) {
        for (const cell of parseCSVRow(line)) {
          const trimmed = cell.toLowerCase().replace(/^["']|["']$/g, "");
          if (EMAIL_REGEX.test(trimmed)) {
            emails.push(trimmed);
          }
        }
      }
      return [...new Set(emails)];
    }

    const emails: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = parseCSVRow(lines[i]);
      const cell = cells[emailColIndex];
      if (cell) {
        const trimmed = cell.toLowerCase().replace(/^["']|["']$/g, "");
        if (EMAIL_REGEX.test(trimmed)) {
          emails.push(trimmed);
        }
      }
    }
    return [...new Set(emails)];
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const emails = parseCSV(text);
    setPreviewEmails(emails);
    setUploadResult(null);
  }

  async function handleUpload() {
    if (!selectedDate) {
      toast.error("Please select an event date");
      return;
    }
    if (previewEmails.length === 0) {
      toast.error("No valid emails found in the CSV");
      return;
    }

    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("eventDate", selectedDate);
      if (eventLabel.trim()) {
        formData.append("eventLabel", eventLabel.trim());
      }

      const res = await fetch("/api/checkin/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText);
      }

      const result = await res.json();
      setUploadResult(result);
      toast.success(
        `Created ${result.created} registrations (${result.skipped} duplicates skipped)`
      );
      onUploadComplete();
    } catch (error) {
      toast.error(
        `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleSendEmails() {
    if (!selectedDate) return;

    setSendingEmails(true);
    try {
      const res = await fetch("/api/checkin/send-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventDate: selectedDate }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const result = await res.json();
      if (result.sent > 0) {
        toast.success(`Sent ${result.sent} QR code emails`);
      }
      if (result.failed > 0) {
        toast.error(`Failed to send ${result.failed} emails`);
      }
      if (result.sent === 0 && result.failed === 0) {
        toast("No pending emails to send");
      }
      onUploadComplete();
    } catch (error) {
      toast.error(
        `Email sending failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setSendingEmails(false);
    }
  }

  function handleReset() {
    setPreviewEmails([]);
    setUploadResult(null);
    setEventLabel("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <div
      className={`${
        isDarkMode ? "bg-gray-800" : "bg-white"
      } p-6 rounded-lg shadow`}
    >
      <h2
        className={`text-xl font-semibold mb-4 ${
          isDarkMode ? "text-gray-100" : "text-gray-900"
        }`}
      >
        Upload CSV
      </h2>

      <div className="space-y-4">
        <div>
          <label
            className={`block text-sm font-medium mb-1 ${
              isDarkMode ? "text-gray-300" : "text-gray-700"
            }`}
          >
            Event Label (optional)
          </label>
          <input
            type="text"
            value={eventLabel}
            onChange={(e) => setEventLabel(e.target.value)}
            placeholder="e.g. Demo Day March 2026"
            className={`w-full px-3 py-2 rounded-lg border text-sm ${
              isDarkMode
                ? "bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400"
                : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
            } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
          />
        </div>

        <div>
          <label
            className={`block text-sm font-medium mb-1 ${
              isDarkMode ? "text-gray-300" : "text-gray-700"
            }`}
          >
            CSV File (with email addresses)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className={`w-full text-sm ${
              isDarkMode ? "text-gray-300" : "text-gray-700"
            } file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium ${
              isDarkMode
                ? "file:bg-gray-700 file:text-gray-200"
                : "file:bg-gray-100 file:text-gray-700"
            } file:cursor-pointer`}
          />
        </div>

        {previewEmails.length > 0 && (
          <div>
            <p
              className={`text-sm font-medium mb-2 ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}
            >
              Found {previewEmails.length} email(s):
            </p>
            <div
              className={`max-h-40 overflow-y-auto rounded-lg border p-3 text-xs font-mono ${
                isDarkMode
                  ? "bg-gray-900 border-gray-600 text-gray-300"
                  : "bg-gray-50 border-gray-200 text-gray-700"
              }`}
            >
              {previewEmails.map((email, i) => (
                <div key={i}>{email}</div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          {!uploadResult && previewEmails.length > 0 && (
            <button
              onClick={handleUpload}
              disabled={uploading || !selectedDate}
              className={`py-2 px-4 rounded-lg text-sm font-medium text-white transition-colors ${
                uploading || !selectedDate
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {uploading ? "Uploading..." : "Upload Registrations"}
            </button>
          )}

          {uploadResult && (
            <>
              <button
                onClick={handleSendEmails}
                disabled={sendingEmails}
                className={`py-2 px-4 rounded-lg text-sm font-medium text-white transition-colors ${
                  sendingEmails
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {sendingEmails ? "Sending..." : "Send QR Emails"}
              </button>
              <button
                onClick={handleReset}
                className={`py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  isDarkMode
                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                Reset
              </button>
            </>
          )}
        </div>

        {uploadResult && (
          <div
            className={`text-sm p-3 rounded-lg ${
              isDarkMode
                ? "bg-gray-700 text-gray-300"
                : "bg-gray-50 text-gray-700"
            }`}
          >
            <span className="font-medium">Result:</span>{" "}
            {uploadResult.created} created, {uploadResult.skipped} skipped (
            {uploadResult.total} total in CSV)
          </div>
        )}
      </div>
    </div>
  );
}
