import { verdictStamp, verdictTone } from "~/lib/ui/verdict";

interface VerdictBlockProps {
  verdict: string | null;
  evidence: string | null;
  reason: string | null;
  // Where the quote was found ("Quoted from the title"), or extra context.
  cite?: React.ReactNode;
  // Optional id for the quote, e.g. to label a section.
  id?: string;
}

// The verdict is a stamp plus the highlighted line it rests on (DESIGN §2).
export function VerdictBlock({ verdict, evidence, reason, cite, id }: VerdictBlockProps) {
  const tone = verdictTone(verdict);
  return (
    <div className="jr-verdict" data-v={tone}>
      <span className="jr-stamp" data-v={tone}>
        {verdictStamp(verdict)}
      </span>
      {evidence ? (
        <p className="jr-quote" id={id}>
          “<mark className="jr-mark">{evidence}</mark>”
        </p>
      ) : (
        <p className="jr-quote" id={id}>
          {reason ?? "This posting has not been checked yet."}
        </p>
      )}
      {evidence && reason ? <span className="jr-cite">{reason}</span> : null}
      {cite ? <span className="jr-cite">{cite}</span> : null}
    </div>
  );
}
