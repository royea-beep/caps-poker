import { useState } from "react";

const designs = [
  {
    id: 1,
    name: "Classic Replica",
    nameHe: "העתק קלאסי",
    desc: "Faithful miniature of the real Feature TABLE. Clean lines, standard proportions.",
    descHe: "העתק נאמן של השולחן האמיתי. קווים נקיים, פרופורציות סטנדרטיות.",
    tags: ["classic", "balanced"],
    globe: "standard",
    poleStyle: "single",
    chairStyle: "standard",
    baseShape: "oval",
    cameraCount: 4,
    globeSize: 26,
    tableHeight: 35,
  },
  {
    id: 2,
    name: "Crystal Globe",
    nameHe: "גלובוס קריסטל",
    desc: "Transparent/faceted disco ball like a diamond. Catches light beautifully.",
    descHe: "כדור דיסקו שקוף/מפוצל כמו יהלום. תופס אור בצורה מדהימה.",
    tags: ["premium", "shiny"],
    globe: "crystal",
    poleStyle: "single",
    chairStyle: "standard",
    baseShape: "oval",
    cameraCount: 4,
    globeSize: 30,
    tableHeight: 35,
  },
  {
    id: 3,
    name: "Compact Low",
    nameHe: "קומפקטי נמוך",
    desc: "Shorter pole, bigger globe. Sits lower, easier to grab. More stable.",
    descHe: "עמוד קצר, כדור גדול. יושב נמוך, קל לתפוס. יציב יותר.",
    tags: ["compact", "stable"],
    globe: "large",
    poleStyle: "short",
    chairStyle: "standard",
    baseShape: "oval",
    cameraCount: 4,
    globeSize: 34,
    tableHeight: 25,
  },
  {
    id: 4,
    name: "Tower Edition",
    nameHe: "מהדורת מגדל",
    desc: "Tall & impressive. Long pole with the globe high up. Statement piece.",
    descHe: "גבוה ומרשים. עמוד ארוך עם הכדור למעלה. פריט סטייטמנט.",
    tags: ["tall", "impressive"],
    globe: "standard",
    poleStyle: "tall",
    chairStyle: "standard",
    baseShape: "oval",
    cameraCount: 4,
    globeSize: 24,
    tableHeight: 50,
  },
  {
    id: 5,
    name: "Spade Crown",
    nameHe: "כתר ספייד",
    desc: "Instead of a disco ball — a giant ♠ spade symbol on top. Iconic poker look.",
    descHe: "במקום כדור דיסקו — סמל ♠ ענק למעלה. מראה פוקר אייקוני.",
    tags: ["iconic", "poker"],
    globe: "spade",
    poleStyle: "single",
    chairStyle: "standard",
    baseShape: "oval",
    cameraCount: 4,
    globeSize: 28,
    tableHeight: 35,
  },
  {
    id: 6,
    name: "Double Ring",
    nameHe: "טבעת כפולה",
    desc: "Two branding rings on the globe — top ring for Feature TABLE, bottom for YouTube channel.",
    descHe: "שתי טבעות מיתוג על הכדור — עליונה ל-Feature TABLE, תחתונה לערוץ יוטיוב.",
    tags: ["branding", "detailed"],
    globe: "double-ring",
    poleStyle: "single",
    chairStyle: "standard",
    baseShape: "oval",
    cameraCount: 4,
    globeSize: 28,
    tableHeight: 35,
  },
  {
    id: 7,
    name: "VIP Gold",
    nameHe: "VIP זהב",
    desc: "Gold accents everywhere — gold rail trim, gold chairs, gold globe ring. Luxury feel.",
    descHe: "הדגשות זהב בכל מקום — עיטור רייל זהב, כסאות זהב, טבעת כדור זהב. תחושת יוקרה.",
    tags: ["luxury", "gold"],
    globe: "gold",
    poleStyle: "single",
    chairStyle: "gold",
    baseShape: "oval",
    cameraCount: 4,
    globeSize: 26,
    tableHeight: 35,
  },
  {
    id: 8,
    name: "Quad Truss",
    nameHe: "4 עמודים",
    desc: "4 corner poles instead of 1 center pole. More realistic camera rig like the real setup.",
    descHe: "4 עמודים בפינות במקום עמוד מרכזי אחד. מערך מצלמות יותר ריאליסטי כמו הסטאפ האמיתי.",
    tags: ["realistic", "production"],
    globe: "standard",
    poleStyle: "quad",
    chairStyle: "standard",
    baseShape: "oval",
    cameraCount: 4,
    globeSize: 26,
    tableHeight: 35,
  },
  {
    id: 9,
    name: "LED Ring Base",
    nameHe: "בסיס עם טבעת LED",
    desc: "Glowing LED ring around the base edge. Lights up when placed on cards. Extra wow factor.",
    descHe: "טבעת LED זוהרת סביב שפת הבסיס. נדלקת כששמים על קלפים. פקטור וואו נוסף.",
    tags: ["LED", "tech"],
    globe: "standard",
    poleStyle: "single",
    chairStyle: "standard",
    baseShape: "led-ring",
    cameraCount: 4,
    globeSize: 26,
    tableHeight: 35,
  },
  {
    id: 10,
    name: "Chip Stack Base",
    nameHe: "בסיס ערימת צ'יפים",
    desc: "Base shaped like stacked poker chips instead of flat platform. Very poker-themed.",
    descHe: "בסיס בצורת ערימת צ'יפים של פוקר במקום משטח שטוח. תמטי מאוד.",
    tags: ["thematic", "creative"],
    globe: "standard",
    poleStyle: "single",
    chairStyle: "standard",
    baseShape: "chips",
    cameraCount: 4,
    globeSize: 26,
    tableHeight: 35,
  },
];

function MiniPreview({ d, size = 200 }) {
  const w = size;
  const h = size * 1.3;
  const cx = w / 2;
  const poleH = d.poleStyle === "tall" ? 60 : d.poleStyle === "short" ? 25 : 40;
  const gs = d.globeSize * (size / 200);
  const tableY = h * 0.62;
  const globeY = tableY - poleH - gs * 0.6 - 10;
  const baseY = h * 0.82;

  const baseColor = d.baseShape === "led-ring" ? "#1565C0" : "#2A2A2A";
  const chairColor = d.chairStyle === "gold" ? "#C9A837" : "#222";
  const ringColor = d.globe === "gold" ? "#C9A837" : "#C62828";
  const ring2 = d.globe === "double-ring";

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ display: "block" }}>
      {/* Base */}
      {d.baseShape === "chips" ? (
        <>
          <ellipse cx={cx} cy={baseY + 8} rx={w * 0.28} ry={10} fill="#C62828" stroke="#E53935" strokeWidth="0.5" />
          <ellipse cx={cx} cy={baseY + 3} rx={w * 0.28} ry={10} fill="#1B5E20" stroke="#2E7D32" strokeWidth="0.5" />
          <ellipse cx={cx} cy={baseY - 2} rx={w * 0.28} ry={10} fill="#111" stroke="#333" strokeWidth="0.5" />
        </>
      ) : (
        <>
          <ellipse cx={cx} cy={baseY} rx={w * 0.32} ry={12} fill={baseColor} stroke={d.baseShape === "led-ring" ? "#42A5F5" : "#333"} strokeWidth={d.baseShape === "led-ring" ? 2 : 0.5} />
          {d.baseShape === "led-ring" && <ellipse cx={cx} cy={baseY} rx={w * 0.34} ry={14} fill="none" stroke="#42A5F5" strokeWidth="1" opacity="0.4" />}
        </>
      )}

      {/* Legs */}
      <line x1={cx - 28} y1={tableY + 8} x2={cx - 24} y2={baseY - 8} stroke="#111" strokeWidth="2" />
      <line x1={cx + 28} y1={tableY + 8} x2={cx + 24} y2={baseY - 8} stroke="#111" strokeWidth="2" />
      <line x1={cx - 18} y1={tableY + 12} x2={cx - 18} y2={baseY - 6} stroke="#0D0D0D" strokeWidth="2" />
      <line x1={cx + 18} y1={tableY + 12} x2={cx + 18} y2={baseY - 6} stroke="#0D0D0D" strokeWidth="2" />

      {/* Table */}
      <ellipse cx={cx} cy={tableY} rx={w * 0.38} ry={16} fill="#111" stroke="#2A2A2A" strokeWidth="1" />
      <ellipse cx={cx} cy={tableY} rx={w * 0.3} ry={11} fill="#333" />
      <ellipse cx={cx} cy={tableY} rx={w * 0.24} ry={8} fill="#1565C0" />
      <ellipse cx={cx} cy={tableY - 1} rx={w * 0.2} ry={6} fill="#1976D2" opacity="0.3" />

      {/* Chairs around table */}
      {[...Array(9)].map((_, i) => {
        const angle = (Math.PI / 8) * (i - 0) + Math.PI * 0.06;
        const rx = w * 0.42;
        const ry = 22;
        const px = cx + Math.cos(angle + Math.PI) * rx;
        const py = tableY + Math.sin(angle + Math.PI) * ry;
        if (py > baseY - 5) return null;
        return (
          <g key={i}>
            <rect x={px - 4} y={py - 5} width={8} height={8} rx={1} fill={chairColor} stroke={d.chairStyle === "gold" ? "#DAA520" : "#333"} strokeWidth="0.3" />
            <rect x={px - 3} y={py - 10} width={6} height={6} rx={1} fill={chairColor} opacity="0.8" stroke={d.chairStyle === "gold" ? "#DAA520" : "#2A2A2A"} strokeWidth="0.3" />
          </g>
        );
      })}

      {/* Dealer chair */}
      <rect x={cx - 5} y={tableY + 18} width={10} height={8} rx={1.5} fill={chairColor} stroke="#444" strokeWidth="0.3" />
      <text x={cx} y={tableY + 24} textAnchor="middle" fill="#888" fontSize="5" fontWeight="500">D</text>

      {/* Pole(s) */}
      {d.poleStyle === "quad" ? (
        <>
          <line x1={cx - 35} y1={globeY + gs * 0.4} x2={cx - 35} y2={tableY - 14} stroke="#444" strokeWidth="1" />
          <line x1={cx + 35} y1={globeY + gs * 0.4} x2={cx + 35} y2={tableY - 14} stroke="#444" strokeWidth="1" />
          <line x1={cx - 25} y1={globeY + gs * 0.5} x2={cx - 25} y2={tableY - 10} stroke="#3A3A3A" strokeWidth="1" />
          <line x1={cx + 25} y1={globeY + gs * 0.5} x2={cx + 25} y2={tableY - 10} stroke="#3A3A3A" strokeWidth="1" />
          <line x1={cx - 35} y1={globeY + gs * 0.4} x2={cx + 35} y2={globeY + gs * 0.4} stroke="#444" strokeWidth="0.8" />
          <line x1={cx - 25} y1={globeY + gs * 0.5} x2={cx + 25} y2={globeY + gs * 0.5} stroke="#3A3A3A" strokeWidth="0.8" />
        </>
      ) : (
        <line x1={cx} y1={globeY + gs * 0.5} x2={cx} y2={tableY - 12} stroke="#444" strokeWidth="2.5" />
      )}

      {/* Globe / Top piece */}
      {d.globe === "spade" ? (
        <g>
          <text x={cx} y={globeY + 8} textAnchor="middle" fontSize={gs * 1.5} fill="#1A1A1A" stroke="#333" strokeWidth="0.5">♠</text>
          <rect x={cx - 22} y={globeY - 2} width={44} height={8} rx={2} fill={ringColor} />
          <text x={cx} y={globeY + 5} textAnchor="middle" fill="#FFF" fontSize="4.5" fontWeight="500" letterSpacing="0.5">FEATURE TABLE</text>
        </g>
      ) : (
        <g>
          <circle cx={cx} cy={globeY} r={gs} fill="#1A1A1A" stroke="#333" strokeWidth="0.8" />
          {/* Facets */}
          {d.globe === "crystal" ? (
            <>
              {[...Array(6)].map((_, i) => {
                const a = (Math.PI * 2 / 6) * i;
                return <line key={i} x1={cx + Math.cos(a) * gs * 0.3} y1={globeY + Math.sin(a) * gs * 0.3} x2={cx + Math.cos(a) * gs * 0.95} y2={globeY + Math.sin(a) * gs * 0.95} stroke="#666" strokeWidth="0.3" />;
              })}
              {[...Array(8)].map((_, i) => {
                const a = (Math.PI * 2 / 8) * i + 0.2;
                const r = gs * 0.6;
                return <rect key={`f${i}`} x={cx + Math.cos(a) * r - 3} y={globeY + Math.sin(a) * r - 2} width={6} height={4} rx={0.5} fill="#555" opacity="0.2" transform={`rotate(${(a * 180) / Math.PI}, ${cx + Math.cos(a) * r}, ${globeY + Math.sin(a) * r})`} />;
              })}
            </>
          ) : (
            <>
              <ellipse cx={cx} cy={globeY - gs * 0.4} rx={gs * 0.7} ry={gs * 0.15} fill="none" stroke="#444" strokeWidth="0.3" />
              <ellipse cx={cx} cy={globeY + gs * 0.4} rx={gs * 0.7} ry={gs * 0.15} fill="none" stroke="#444" strokeWidth="0.3" />
              <line x1={cx - gs * 0.3} y1={globeY - gs} x2={cx - gs * 0.3} y2={globeY + gs} stroke="#444" strokeWidth="0.2" />
              <line x1={cx + gs * 0.3} y1={globeY - gs} x2={cx + gs * 0.3} y2={globeY + gs} stroke="#444" strokeWidth="0.2" />
              {[0, 1, 2, 3].map(i => (
                <rect key={i} x={cx - gs * 0.5 + i * gs * 0.3} y={globeY - gs * 0.2 + (i % 2) * gs * 0.15} width={gs * 0.25} height={gs * 0.18} rx={0.5} fill="#555" opacity="0.12" />
              ))}
            </>
          )}

          {/* Main ring */}
          <ellipse cx={cx} cy={globeY} rx={gs + 2} ry={gs * 0.22} fill={ringColor} stroke={d.globe === "gold" ? "#DAA520" : "#E53935"} strokeWidth="0.4" />
          <text x={cx} y={globeY + 1} textAnchor="middle" fill="#FFF" fontSize="4.5" fontWeight="500" letterSpacing="0.5">FEATURE TABLE</text>
          {ring2 && (
            <>
              <ellipse cx={cx} cy={globeY + gs * 0.35} rx={gs * 0.85} ry={gs * 0.18} fill="#1565C0" stroke="#42A5F5" strokeWidth="0.3" />
              <text x={cx} y={globeY + gs * 0.37} textAnchor="middle" fill="#FFF" fontSize="3.5" letterSpacing="0.3">YOUTUBE</text>
            </>
          )}
        </g>
      )}

      {/* Cameras */}
      {[
        [cx - gs - 4, globeY - 2],
        [cx + gs + 0, globeY - 2],
        [cx - 4, globeY + gs + 0],
        [cx - 4, globeY - gs - 6],
      ].map(([x, y], i) => (
        <g key={`cam${i}`}>
          <rect x={x} y={y} width={8} height={6} rx={1} fill="#222" stroke="#444" strokeWidth="0.3" />
          <circle cx={x + 4} cy={y + 3} r={1.8} fill="#111" stroke="#333" strokeWidth="0.2" />
          <circle cx={x + 4} cy={y + 3} r={1} fill="#1565C0" opacity="0.6" />
          <circle cx={x + 6.5} cy={y + 1.2} r={0.8} fill="#FF1744" opacity="0.8" />
        </g>
      ))}

      {/* Top grip */}
      {d.globe !== "spade" && (
        <>
          <circle cx={cx} cy={globeY - gs - 3} r={4} fill="#222" stroke="#444" strokeWidth="0.4" />
          <circle cx={cx - 0.5} cy={globeY - gs - 4} r={1} fill="#666" opacity="0.3" />
        </>
      )}
    </svg>
  );
}

export default function App() {
  const [selected, setSelected] = useState(null);
  const [favorites, setFavorites] = useState(new Set());
  const [notes, setNotes] = useState({});
  const [view, setView] = useState("grid");

  const toggleFav = (id) => {
    setFavorites((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const sel = selected ? designs.find((d) => d.id === selected) : null;

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif", minHeight: "100vh", background: "#0A0A0F", color: "#E8E6DF" }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding: "32px 24px 20px", borderBottom: "1px solid #1A1A25" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 28, lineHeight: 1 }}>♠</span>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, letterSpacing: "-0.5px" }}>Feature TABLE — Card Protector</h1>
        </div>
        <p style={{ fontSize: 14, color: "#777", margin: 0 }}>בחר עיצוב מועדף — לחץ על כרטיס לפרטים, על ♥ לסימון</p>

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          {["grid", "compare"].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: "6px 16px",
                borderRadius: 20,
                border: "1px solid",
                borderColor: view === v ? "#C62828" : "#333",
                background: view === v ? "#C62828" : "transparent",
                color: view === v ? "#FFF" : "#888",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {v === "grid" ? "כל העיצובים" : `מועדפים (${favorites.size})`}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ padding: "20px 16px" }}>
        {view === "grid" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 12 }}>
            {designs.map((d) => (
              <div
                key={d.id}
                onClick={() => setSelected(d.id)}
                style={{
                  background: selected === d.id ? "#1A1520" : "#111116",
                  border: "1px solid",
                  borderColor: selected === d.id ? "#C62828" : favorites.has(d.id) ? "#C6282855" : "#1E1E28",
                  borderRadius: 14,
                  padding: 12,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  position: "relative",
                }}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFav(d.id); }}
                  style={{
                    position: "absolute", top: 8, right: 8, background: "none", border: "none",
                    fontSize: 18, cursor: "pointer", color: favorites.has(d.id) ? "#C62828" : "#333",
                    zIndex: 2, lineHeight: 1, padding: 0,
                  }}
                >
                  {favorites.has(d.id) ? "♥" : "♡"}
                </button>

                <div style={{ background: "#0D0D14", borderRadius: 10, padding: "8px 4px 4px", marginBottom: 10 }}>
                  <MiniPreview d={d} size={160} />
                </div>

                <div style={{ fontSize: 11, color: "#C62828", fontWeight: 600, marginBottom: 2, letterSpacing: "0.5px" }}>
                  #{d.id}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{d.name}</div>
                <div style={{ fontSize: 12, color: "#888", direction: "rtl", lineHeight: 1.4 }}>{d.descHe}</div>

                <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                  {d.tags.map((t) => (
                    <span key={t} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: "#1A1A25", color: "#666", fontWeight: 500 }}>{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {favorites.size === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: "#444" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>♡</div>
                <div style={{ fontSize: 15 }}>עוד לא סימנת מועדפים</div>
                <div style={{ fontSize: 13, color: "#333", marginTop: 4 }}>לחץ על ♡ בכרטיס כדי להוסיף</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                {designs.filter((d) => favorites.has(d.id)).map((d) => (
                  <div
                    key={d.id}
                    style={{
                      background: "#111116",
                      border: "1px solid #C6282844",
                      borderRadius: 16,
                      padding: 16,
                      display: "flex",
                      gap: 16,
                    }}
                  >
                    <div style={{ width: 140, flexShrink: 0, background: "#0D0D14", borderRadius: 10, padding: 6 }}>
                      <MiniPreview d={d} size={140} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>#{d.id} {d.name}</div>
                      <div style={{ fontSize: 13, color: "#888", direction: "rtl", lineHeight: 1.5, marginBottom: 10 }}>{d.descHe}</div>
                      <textarea
                        placeholder="הערות / שינויים..."
                        value={notes[d.id] || ""}
                        onChange={(e) => setNotes((p) => ({ ...p, [d.id]: e.target.value }))}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: "100%",
                          minHeight: 50,
                          background: "#0A0A0F",
                          border: "1px solid #222",
                          borderRadius: 8,
                          padding: 8,
                          color: "#CCC",
                          fontSize: 12,
                          fontFamily: "inherit",
                          resize: "vertical",
                          direction: "rtl",
                          boxSizing: "border-box",
                        }}
                      />
                      <button
                        onClick={() => {
                          const msg = `I choose design #${d.id} "${d.name}" for the Feature TABLE card protector.${notes[d.id] ? ` Notes: ${notes[d.id]}` : ""} Please proceed with a detailed 3D model based on the full spec.`;
                          if (typeof sendPrompt === "function") sendPrompt(msg);
                        }}
                        style={{
                          marginTop: 8,
                          padding: "8px 20px",
                          background: "#C62828",
                          color: "#FFF",
                          border: "none",
                          borderRadius: 10,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          width: "100%",
                        }}
                      >
                        בחרתי את זה! →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {sel && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: "#111116",
            borderTop: "1px solid #C62828",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            zIndex: 10,
          }}
        >
          <div style={{ width: 80, flexShrink: 0, background: "#0A0A0F", borderRadius: 8, padding: 4 }}>
            <MiniPreview d={sel} size={80} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>#{sel.id} {sel.name} — {sel.nameHe}</div>
            <div style={{ fontSize: 12, color: "#777", marginTop: 2, direction: "rtl" }}>{sel.descHe}</div>
            <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 11, color: "#555" }}>
              <span>Globe: {sel.globeSize}mm</span>
              <span>Pole: {sel.poleStyle}</span>
              <span>Base: {sel.baseShape}</span>
              <span>Cams: {sel.cameraCount}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => toggleFav(sel.id)}
              style={{
                padding: "8px 16px",
                borderRadius: 10,
                border: "1px solid #C62828",
                background: favorites.has(sel.id) ? "#C62828" : "transparent",
                color: favorites.has(sel.id) ? "#FFF" : "#C62828",
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: 500,
              }}
            >
              {favorites.has(sel.id) ? "♥ מועדף" : "♡ הוסף"}
            </button>
            <button
              onClick={() => setSelected(null)}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #333",
                background: "transparent",
                color: "#666",
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
