"use client";

import { useEffect, useState } from "react";
import AdminAuthGate from "../AdminAuthGate";
import { useTheme } from "../../contexts/ThemeContext";
import { useUserContext } from "../../contexts/UserContext";

type Template = {
  id: string;
  name: string;
  scope: string;
  isActive: boolean;
  fields?: Array<{ id?: string; key?: string; label: string }>;
};

const defaultSiteFields = [
  { id: "name", label: "Name", type: "TEXT", required: true, siteRequired: true },
  { id: "email", label: "Email", type: "EMAIL", required: true, siteRequired: true },
];

function templateList(payload: unknown): Template[] {
  if (Array.isArray(payload)) return payload as Template[];
  if (payload && typeof payload === "object") {
    const value = payload as { templates?: Template[]; items?: Template[] };
    return value.templates ?? value.items ?? [];
  }
  return [];
}

export default function AdminApplicationTemplatesPage() {
  const { isDarkMode } = useTheme();
  const { isAdmin, loading } = useUserContext();
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/application-templates")
      .then((response) => (response.ok ? response.json() : []))
      .then((payload) => setTemplates(templateList(payload)))
      .catch(() => setTemplates([]));
  }, [isAdmin]);

  async function createDefaultSiteTemplate() {
    const response = await fetch("/api/application-templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scope: "SITE",
        name: "Default site application",
        fieldsJson: defaultSiteFields,
      }),
    });
    if (response.ok) {
      const created = await response.json();
      setTemplates((current) => [...current, created]);
    }
  }

  return (
    <main
      className={`${
        isDarkMode ? "bg-gray-900 text-gray-100" : "bg-white text-gray-900"
      } font-space-mono min-h-screen`}
    >
      <div className="max-w-6xl mx-auto px-4 py-20">
        <AdminAuthGate isAdmin={isAdmin} loading={loading}>
          <>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold">Application templates</h1>
              <button
                className="border rounded px-4 py-2 font-semibold"
                onClick={createDefaultSiteTemplate}
                type="button"
              >
                Create site template
              </button>
            </div>
            <div className="divide-y">
              {templates.map((template) => (
                <div key={template.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{template.name}</div>
                    <div className="text-sm opacity-70">
                      {(template.fields ?? []).map((field) => field.label).join(", ")}
                    </div>
                  </div>
                  <span className="text-sm">
                    {template.scope} / {template.isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-6 text-sm font-semibold">Preview merged application</div>
          </>
        </AdminAuthGate>
      </div>
    </main>
  );
}
