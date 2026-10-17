export type MilesMode = 'help' | 'report_coach' | 'alert_advisor';

export interface MilesJob {
  mode: MilesMode;
  incidentId?: string;
  alertId?: string;
}

/** How Miles introduces each job, and questions to start with. */
export const JOB_COPY: Record<MilesMode, { title: string; intro: string; suggestions: string[] }> =
  {
    help: {
      title: 'Help and how-to',
      intro: "Hi, I'm Miles. Ask me anything about using ClientShield.",
      suggestions: [
        'How do customer checks work?',
        'How do I get verified?',
        "What's included in my plan?",
      ],
    },
    report_coach: {
      title: 'Report coach',
      intro:
        "I'll help you make this report clear and factual, so a moderator can verify it. I read your last saved version, so save your changes first.",
      suggestions: [
        'Review my report',
        'What evidence should I add?',
        'Make my wording more neutral',
      ],
    },
    alert_advisor: {
      title: 'Alert advisor',
      intro:
        "I'll explain what this alert's facts mean and how you could protect the job. You decide what to do.",
      suggestions: ['What do these facts mean?', 'How can I protect this job?'],
    },
  };

/** One conversation per job, so switching pages doesn't mix them up. */
export function jobKey(job: MilesJob): string {
  return [job.mode, job.incidentId ?? '', job.alertId ?? ''].join(':');
}
