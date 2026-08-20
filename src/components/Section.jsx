import React from "react";

/**
 * Collapsible card section with header, optional right-side content, and body.
 */
export default function Section({ title, open, onToggle, right, children }) {
  return (
    <section className="card">
      <header className="cardHeader">
        <div className="cardHeaderLeft">
          <button className="btn" type="button" onClick={onToggle}>
            {open ? "Hide" : "Show"}
          </button>
          <h2 className="cardTitle">{title}</h2>
        </div>
        {right ? <div className="cardHeaderRight">{right}</div> : null}
      </header>
      {open ? <div className="cardBody">{children}</div> : null}
    </section>
  );
}