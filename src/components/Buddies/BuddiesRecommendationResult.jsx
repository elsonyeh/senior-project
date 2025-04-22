import React from 'react';

export default function BuddiesRecommendationResult({ saved, onRetry }) {
  if (!saved || saved.length === 0) {
    return (
      <div className="recommend-screen">
        <h2>群組沒有選出餐廳 😢</h2>
        <p>大家口味不太一樣？不如再試一次！</p>
        <button className="btn-restart" onClick={onRetry}>
          🔁 再試一次
        </button>
      </div>
    );
  }

  const selected = saved[Math.floor(Math.random() * saved.length)];
  const mapLink = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    selected.address || ""
  )}`;

  return (
    <div className="recommend-screen">
      <h2>🎉 群組命定餐廳是...</h2>

      <div
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url(${selected.photoURL ||
            "https://source.unsplash.com/400x300/?restaurant"})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          borderRadius: "16px",
          padding: "2rem",
          color: "white",
          maxWidth: "480px",
          margin: "2rem auto",
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)"
        }}
      >
        <h3 style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>{selected.name}</h3>
        <p>{selected.address}</p>
        {selected.rating && (
          <p style={{ fontSize: "1.2rem" }}>⭐ {selected.rating.toFixed(1)} 分</p>
        )}
      </div>

      <div style={{ textAlign: "center" }}>
        <a
          href={mapLink}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-start"
          style={{ textDecoration: 'none' }}
        >
          📍 出發去這裡
        </a>
        <br />
        <button className="btn-restart" style={{ marginTop: "1rem" }} onClick={onRetry}>
          🔁 再選一次
        </button>
      </div>
    </div>
  );
}
