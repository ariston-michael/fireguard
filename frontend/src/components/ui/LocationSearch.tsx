import { useState } from "react";

interface LocationSearchProps {
  onLocationChange: (lat: number, lng: number, name: string) => void;
}

export default function LocationSearch({ onLocationChange }: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
      );
      const data = await res.json();
      if (data.length > 0) {
        const { lat, lon, display_name } = data[0];
        onLocationChange(parseFloat(lat), parseFloat(lon), display_name);
      } else {
        alert("Location not found. Try a different search term.");
      }
    } catch {
      alert("Search failed. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  function handleGPS() {
    if (!navigator.geolocation) {
      alert("Geolocation not supported by your browser.");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onLocationChange(
          pos.coords.latitude,
          pos.coords.longitude,
          "Current Location"
        );
        setLoading(false);
      },
      () => {
        alert("Unable to get your location.");
        setLoading(false);
      }
    );
  }

  return (
    <form className="location-search" onSubmit={handleSearch}>
      <button type="button" className="gps-btn" onClick={handleGPS} title="Use GPS">
        📍
      </button>
      <input
        type="text"
        placeholder="Search city or location..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="search-input"
      />
      <button type="submit" className="search-btn" disabled={loading}>
        {loading ? "..." : "🔍"}
      </button>
    </form>
  );
}
