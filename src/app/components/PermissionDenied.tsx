import React from 'react';
import { useTheme } from "../contexts/ThemeContext";

export default function PermissionDenied() {
    const { isDarkMode } = useTheme();

    return (
        <div
            className={`flex justify-center items-center min-h-screen ${
            isDarkMode ? "bg-gray-900 text-gray-100" : "bg-white text-gray-900"
            } font-space-mono`}
        >
            <div className="text-center text-red-500">
                You do not have permission to view this page.
            </div>
        </div>
    );
};
