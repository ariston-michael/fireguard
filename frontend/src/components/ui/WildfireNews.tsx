import { useState, useEffect } from "react";

interface NewsArticle {
  title: string;
  url: string;
  source: string;
  image: string;
  date: string;
}

const FALLBACK_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='140' fill='%230d1117'%3E%3Crect width='320' height='140'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23334155' font-size='14' font-family='system-ui'%3ENo Image%3C/text%3E%3C/svg%3E";

export default function WildfireNews() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchNews() {
      try {
        const res = await fetch("/api/news");
        if (!res.ok) throw new Error("News fetch failed");
        const data = await res.json();

        if (!cancelled && data.articles) {
          setArticles(data.articles);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchNews();
    // Refresh every 5 minutes
    const id = setInterval(fetchNews, 300_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  function formatDate(dateStr: string) {
    if (!dateStr) return "";
    try {
      // Handle GDELT format "20250714T120000Z" or ISO format
      if (dateStr.length >= 8 && !dateStr.includes("-")) {
        const y = dateStr.slice(0, 4);
        const m = dateStr.slice(4, 6);
        const d = dateStr.slice(6, 8);
        return new Date(`${y}-${m}-${d}`).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "";
    }
  }

  if (loading)
    return (
      <section className="news-section">
        <div className="news-header">
          <h3>Recent Wildfire News</h3>
        </div>
        <p className="news-loading">Loading latest wildfire news…</p>
      </section>
    );

  if (error || articles.length === 0)
    return (
      <section className="news-section">
        <div className="news-header">
          <h3>Recent Wildfire News</h3>
        </div>
        <p className="news-error">Unable to load news at this time.</p>
      </section>
    );

  return (
    <section className="news-section">
      <div className="news-header">
        <h3>Recent Wildfire News</h3>
      </div>
      <div className="news-scroll">
        {articles.map((a, i) => (
          <a
            key={i}
            className="news-card"
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              className="news-card-img"
              src={a.image || FALLBACK_IMG}
              alt=""
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).src = FALLBACK_IMG;
              }}
            />
            <div className="news-card-body">
              <span className="news-card-source">{a.source}</span>
              <span className="news-card-title">{a.title}</span>
              <span className="news-card-date">
                {formatDate(a.date)}
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
