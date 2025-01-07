import { NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { userId, getToken } = getAuth(req);
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get token for downstream authentication
    const token = await getToken({ template: "split-key" });

    // Proxy the request to the Rust backend
    const response = await fetch(`http://localhost:3001/total-stats`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `${token}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[STATS_PROXY] Response:", {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorText,
      });
      throw new Error(
        `Rust backend error: ${response.statusText} - ${errorText}`
      );
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error(`Expected JSON response but got ${contentType}`);
    }

    const data = await response.json();
    return NextResponse.json(data, {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[STATS_PROXY]", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
