// What the builder's live preview shows for a part of the site that has not been
// written yet (a page the model has imported but not reached). Never ships: a
// published build refuses to compile with a missing file.
export function Pending() {
  return (
    <div
      aria-hidden="true"
      style={{
        margin: "24px auto",
        width: "min(100% - 48px, 1100px)",
        height: 180,
        borderRadius: 18,
        background: "linear-gradient(90deg, rgba(127,127,127,.08), rgba(127,127,127,.16), rgba(127,127,127,.08))",
        backgroundSize: "200% 100%",
        animation: "wron-pending 1.4s ease-in-out infinite",
      }}
    >
      <style>{"@keyframes wron-pending{0%{background-position:100% 0}100%{background-position:-100% 0}}"}</style>
    </div>
  );
}

/** A package the site imported that Wron sites cannot use. */
export function Unavailable({ name }) {
  return (
    <div style={{ padding: 16, margin: 16, border: "1px dashed #c33", borderRadius: 12, fontFamily: "system-ui", fontSize: 13, color: "#c33" }}>
      {`"${name}" isn't available on Wron sites.`}
    </div>
  );
}
