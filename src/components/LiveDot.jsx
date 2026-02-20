import React from "react";

export default function LiveDot({ dataMode }) {
  const isLiveMode = dataMode === "live";

  const cls = isLiveMode
    ? "dot dotLive"
    : "dot dotOffline";

  return (
    <div className="liveWrap" aria-label="Live indicator">
      <span className={cls} />
      <span className="liveText">live</span>
    </div>
  );
}
