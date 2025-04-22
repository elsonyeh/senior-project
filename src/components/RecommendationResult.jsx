import React from "react";

export default function RecommendationResult({ saved = [], onRetry }) {
  const selected =
    saved.length > 0
      ? saved[Math.floor(Math.random() * saved.length)]
      : null;

  const goToGoogleMaps = (place) => {
    const query = encodeURIComponent(place);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
  };

  if (!selected || typeof selected !== "object") {
    return (
      <div className="recommend-screen">
        <h2>😅 沒有選到餐廳</h2>
        <p>可能你今天太挑了，不如放寬一下條件再試試？</p>
        <button className="btn-restart" onClick={onRetry}>
          🔄 再試一次
        </button>
      </div>
    );
  }

  const otherSaved = saved.filter((r) => r && r.id !== selected.id);

  return (
    <div className="recommend-screen">
      <h2>🎉 命定餐廳就是它！</h2>
      <div
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url(${selected.photoURL || "https://source.unsplash.com/400x300/?restaurant"})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          color: "white",
          borderRadius: "16px",
          padding: "2rem",
          textAlign: "center",
          margin: "1rem 0",
        }}
      >
        <h3>{selected.name || "未命名餐廳"}</h3>
        <p>{selected.address || "地址未知"}</p>
        {typeof selected.rating === "number" && <p>⭐ {selected.rating.toFixed(1)} 分</p>}
        <button
          className="btn-start"
          style={{ textDecoration: "none", marginTop: "1rem" }}
          onClick={() => goToGoogleMaps(selected.address || selected.name)}
        >
          🚶 出發去這裡
        </button>
      </div>

      {otherSaved.length > 0 && (
        <>
          <h3>👀 其他備選餐廳</h3>
          <ul style={{ padding: 0 }}>
            {otherSaved.map((r) => (
              <li
                key={r.id}
                style={{
                  listStyle: "none",
                  marginBottom: "1rem",
                  border: "1px solid #ccc",
                  borderRadius: "12px",
                  padding: "1rem",
                  background: "#fafafa",
                }}
              >
                <strong>{r.name || "未命名"}</strong>
                <p style={{ margin: "4px 0" }}>{r.address || "地址未知"}</p>
                {typeof r.rating === "number" && <p>⭐ {r.rating.toFixed(1)} 分</p>}
                <button
                  className="btn-start"
                  style={{ textDecoration: "none", marginTop: "0.5rem" }}
                  onClick={() => goToGoogleMaps(r.address || r.name)}
                >
                  出發
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <button className="btn-restart" onClick={onRetry}>
        🔁 再試一次
      </button>
    </div>
  );
}
