import KeyGenerator from "./key-generator";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function ApiKeyPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">API Key Management</h1>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-black">
            Generate New API Key
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6 text-center">
            Generate a new API key to access the Groq API. Each key is personal
            and should be kept secure.
          </p>

          <KeyGenerator />

          <div className="mt-6 text-sm text-gray-500">
            <h3 className="font-medium mb-2">Important Notes:</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Keep your API key secure and never share it publicly</li>
              <li>Each key has a usage limit - monitor your usage regularly</li>
              <li>Keys can be revoked at any time if misused</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
