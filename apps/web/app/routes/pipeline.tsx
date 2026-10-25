import { Link } from "react-router";

export function meta() {
  return [{ title: "Saved · jobradar" }];
}

export default function PipelinePage() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <h1 className="jr-h1">Saved</h1>
      <p className="jr-sub">Jobs you save and the outreach you approve will collect here.</p>
      <div className="jr-panel jr-empty" style={{ marginTop: 16 }}>
        <p>Nothing saved yet. Saving arrives with outreach drafts.</p>
        <p style={{ marginTop: 12 }}>
          <Link className="jr-btn" to="/">
            Back to the feed
          </Link>
        </p>
      </div>
    </div>
  );
}
