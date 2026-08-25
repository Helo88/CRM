"use client";

import { useEffect, useState } from "react";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface HealthResponse {
  status: string;
  db: string;
  timestamp: string;
}

// Placeholder landing page — just proves the frontend can reach the backend's
// health endpoint end to end. Replace with the real sign-up/login/portal screens
// as auth (Stories 1-2) and customer-portal (Stories 35-38) are implemented.
export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get<HealthResponse>(`${API_URL}/api/v1/health`)
      .then((res) => setHealth(res.data))
      .catch(() => setError("Could not reach the backend. Is it running on " + API_URL + "?"));
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold">AzmSquad Customer Service</h1>
        <p className="text-gray-600">Frontend scaffold — backend connectivity check.</p>
        {health && (
          <pre className="text-left bg-gray-100 p-4 rounded text-sm">
            {JSON.stringify(health, null, 2)}
          </pre>
        )}
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </div>
    </main>
  );
}
