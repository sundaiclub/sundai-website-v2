'use client';

import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '../contexts/ThemeContext';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider>
            <Toaster position="bottom-right" />
            {children}
        </ThemeProvider>
    );
}
