import { lazy, Suspense, useState } from "react";
import Scanner from "./components/Scanner";
import Review from "./components/Review";
import { AnalyzedItem } from "./types";

const Dashboard = lazy(() => import("./components/Dashboard"));

export default function App() {
  const [tab, setTab] = useState<"scan" | "dashboard">("scan");
  const [review, setReview] = useState<AnalyzedItem[] | null>(null);

  return (
    <div className="app">
      <header className="topbar">
        <h1>🍽️ Food Scanner</h1>
        <nav>
          <button
            className={tab === "scan" ? "active" : ""}
            onClick={() => setTab("scan")}
          >
            Scan
          </button>
          <button
            className={tab === "dashboard" ? "active" : ""}
            onClick={() => setTab("dashboard")}
          >
            Dashboard
          </button>
        </nav>
      </header>

      <main className="content">
        {review ? (
          <Review
            items={review}
            onDone={() => {
              setReview(null);
              setTab("dashboard");
            }}
            onCancel={() => setReview(null)}
          />
        ) : tab === "scan" ? (
          <Scanner onAnalyzed={(items) => setReview(items)} />
        ) : (
          <Suspense fallback={<p className="hint">Loading dashboard...</p>}>
            <Dashboard />
          </Suspense>
        )}
      </main>
    </div>
  );
}
