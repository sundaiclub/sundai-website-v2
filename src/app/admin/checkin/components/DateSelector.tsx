"use client";
import { useTheme } from "@/app/contexts/ThemeContext";

interface DateSelectorProps {
  value: string;
  onChange: (date: string) => void;
}

export default function DateSelector({ value, onChange }: DateSelectorProps) {
  const { isDarkMode } = useTheme();

  return (
    <div className="flex items-center gap-3">
      <label
        htmlFor="event-date"
        className={`text-sm font-medium ${
          isDarkMode ? "text-gray-300" : "text-gray-700"
        }`}
      >
        Event Date
      </label>
      <input
        id="event-date"
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`px-3 py-2 rounded-lg border text-sm ${
          isDarkMode
            ? "bg-gray-700 border-gray-600 text-gray-100"
            : "bg-white border-gray-300 text-gray-900"
        } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
      />
    </div>
  );
}
