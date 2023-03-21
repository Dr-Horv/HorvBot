import { Response } from "@google-cloud/functions-framework";
import { PullRequestClosedEvent } from "@octokit/webhooks-types";
import { getPrDocIfExistsOrElseSendOk, getPrIdentifier } from "./utils";
import { MERGE_REACTION, sendReaction } from "./slackApi";

const handlePullRequestMerged = async (
  res: Response,
  pr: string,
  event: PullRequestClosedEvent
) => {
  const prData = await getPrDocIfExistsOrElseSendOk(res, pr);
  if (prData === undefined) {
    return;
  }

  const { doc, ref } = prData;

  await Promise.all([
    ref.update({ merged: true, tracking: false }),
    sendReaction(doc.channel, doc.messageTimestamp, MERGE_REACTION),
  ]);
  res.status(200).send({});
};
export const pullRequestClosedEventHandler = async (
  res: Response,
  event: PullRequestClosedEvent
) => {
  const pr = getPrIdentifier(event.pull_request.html_url);
  if (event.pull_request.merged) {
    console.log(`PR ${pr} was merged`);
    await handlePullRequestMerged(res, pr, event);
  } else {
    res.status(200).send({});
  }
};
