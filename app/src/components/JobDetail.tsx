import type { Job } from "@engine/types";
import type { MatchReason } from "@engine/engine";
import { JobInfo } from "./JobInfo";

interface Props {
  job: Job;
  explanation: { reasons: MatchReason[]; tradeoffs: MatchReason[] };
  onClose: () => void;
  onOpenRelated: (code: string) => void;
}

export function JobDetail({ job, explanation, onClose, onOpenRelated }: Props) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <button className="sheet-close" onClick={onClose} type="button" aria-label="Close">
          ✕
        </button>
        <JobInfo job={job} explanation={explanation} onOpenRelated={onOpenRelated} />
      </div>
    </div>
  );
}
