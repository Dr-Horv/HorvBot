// Duplication of `../slackevents/PrDoc.ts` due to difficulty
// deploying shared code in Google Cloud Build
export interface PrDoc {
  channel: string;
  messageTimestamp: string;
  tracking: boolean;
  identifier: string;
  approvers: string[];
  changeRequestCreators?: string[];
  merged: boolean;
  hasComment?: boolean;
}
