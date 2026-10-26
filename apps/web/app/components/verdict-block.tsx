import type { Hint } from "~/lib/eligibility/types";
import { basisTag, groupHints, sectionLabel, verdictStamp, verdictTone } from "~/lib/ui/verdict";

interface VerdictBlockProps {
  verdict: string | null;
  evidence: string | null;
  reason: string | null;
  // "hints": weak hints decided it, shown as "· from hints" in the stamp.
  basis?: string | null;
  // Job page only: every verified hint, in two groups below the quote.
  hints?: Hint[] | null;
  // Where the quote was found ("Quoted from the title"), or extra context.
  cite?: React.ReactNode;
  // Optional id for the quote, e.g. to label a section.
  id?: string;
}

const GROUPS = [
  { key: "yes", title: "Points to yes" },
  { key: "no", title: "Points to no" },
] as const;

function HintGroups({ hints }: { hints: Hint[] | null | undefined }) {
  const groups = groupHints(hints);
  if (!groups.yes.length && !groups.no.length) return null;
  return (
    <div className="jr-hints">
      {GROUPS.map(({ key, title }) =>
        groups[key].length ? (
          <div key={key}>
            <h3 className="jr-hints__h">{title}</h3>
            <ul className="jr-hints__list" data-v={key}>
              {groups[key].map((h) => (
                <li key={h.quote}>
                  “{h.quote}” <span className="jr-hints__sec">{sectionLabel(h.section)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null,
      )}
    </div>
  );
}

// The verdict is a stamp plus the highlighted line it rests on (DESIGN §2).
export function VerdictBlock({
  verdict,
  evidence,
  reason,
  basis,
  hints,
  cite,
  id,
}: VerdictBlockProps) {
  const tone = verdictTone(verdict);
  const tag = basisTag(verdict, basis);
  return (
    <div className="jr-verdict" data-v={tone}>
      <span className="jr-stamp" data-v={tone}>
        {verdictStamp(verdict)}
        {tag ? <span className="jr-stamp__basis"> · {tag}</span> : null}
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
      {hints ? <HintGroups hints={hints} /> : null}
    </div>
  );
}
