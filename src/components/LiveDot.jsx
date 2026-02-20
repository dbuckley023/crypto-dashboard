import React from "react";

export default function LiveDot({ status }) {
  const cls =
    status === "connected" ? "dot dotLive" : status === "connecting" ? "dot dotConnecting" : "dot";
  return (
    <div className="liveWrap" aria-label={`Connection status ${status}`}>
      <span className={cls} />
      <span className="liveText">{status}</span>
    </div>
  );
}
