import type { Job } from "@engine/types";

interface Props {
  job: Job;
  onPick: () => void;
}

export function JobCard({ job, onPick }: Props) {
  return (
    <button className="job-card" onClick={onPick} type="button">
      <span className="job-title">{job.title}</span>
      <span className="job-desc">{job.desc}</span>
    </button>
  );
}
