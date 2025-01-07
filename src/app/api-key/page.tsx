"use client";

import KeyGenerator from "./key-generator";
import { useAuth } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { useTheme } from "../contexts/ThemeContext";

export default function ApiKeyPage() {
  const { userId } = useAuth();
  const { isDarkMode } = useTheme();

  if (!userId) redirect("/sign-in");

  return (
    <div
      className={`min-h-screen py-12 px-4 sm:px-6 lg:px-8 ${
        isDarkMode
          ? "bg-gradient-to-b from-gray-900 to-black text-gray-100"
          : "bg-gradient-to-b from-[#E5E5E5] to-[#F0F0F0] text-gray-800"
      }`}
    >
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1
            className={`text-3xl font-extrabold ${
              isDarkMode ? "text-gray-100" : "text-gray-900"
            }`}
          >
            API Key Management
          </h1>
          <p
            className={`mt-2 text-lg ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Generate and manage your API keys
          </p>
        </div>

        <div
          className={`shadow-lg rounded-lg overflow-hidden ${
            isDarkMode ? "bg-gray-800/50" : "bg-white"
          }`}
        >
          <div className="p-6 sm:p-8">
            <h2
              className={`text-xl font-semibold mb-4 ${
                isDarkMode ? "text-gray-100" : "text-gray-900"
              }`}
            >
              Generate New API Key
            </h2>
            <p
              className={`mb-8 ${
                isDarkMode ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Generate a new API key to access the Groq API. Each key is
              personal and should be kept secure.
            </p>

            <KeyGenerator />

            <div
              className={`mt-8 border-t ${
                isDarkMode ? "border-gray-700" : "border-gray-200"
              } pt-6`}
            >
              <h3
                className={`font-medium mb-3 ${
                  isDarkMode ? "text-gray-100" : "text-gray-900"
                }`}
              >
                Important Notes:
              </h3>
              <ul
                className={`space-y-2 ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                <li className="flex items-center">
                  <span className="mr-2">•</span>
                  Keep your API key secure and never share it publicly
                </li>
                <li className="flex items-center">
                  <span className="mr-2">•</span>
                  Each key has a usage limit - monitor your usage regularly
                </li>
                <li className="flex items-center">
                  <span className="mr-2">•</span>
                  Keys can be revoked at any time if misused
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
