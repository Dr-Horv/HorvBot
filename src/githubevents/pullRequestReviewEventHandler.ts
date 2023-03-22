import { Response } from "@google-cloud/functions-framework";
import {
  PullRequestReviewEvent,
  PullRequestReviewSubmittedEvent,
} from "@octokit/webhooks-types";
import { getPrDocIfExistsOrElseSendOk, getPrIdentifier } from "./utils";
import {
  APPROVE_REACTION,
  CHANGE_REQUEST_REACTION,
  COMMENT_REACTION,
  sendReaction,
  tryRemoveReaction,
} from "./slackApi";

const handleReviewApproved = async (
  res: Response,
  pr: string,
  event: PullRequestReviewEvent
) => {
  const prData = await getPrDocIfExistsOrElseSendOk(res, pr);
  if (prData === undefined) {
    return;
  }

  const { doc, ref } = prData;

  const approvers = doc.approvers || [];
  const approvalUserId = event.review.user.id.toString();
  if (approvers.includes(approvalUserId)) {
    res.status(200).send({});
    return;
  }

  approvers.push(approvalUserId);
  approvers.sort();
  console.log("Approvers", approvers);
  await ref.update({ approvers });
  if (approvers.length === 1) {
    await sendReaction(doc.channel, doc.messageTimestamp, APPROVE_REACTION);
  }

  res.status(200).send({});
};
const handleReviewChangesRequested = async (
  res: Response,
  pr: string,
  event: PullRequestReviewEvent
) => {
  const prData = await getPrDocIfExistsOrElseSendOk(res, pr);
  if (prData === undefined) {
    return;
  }

  const { doc, ref } = prData;

  const changeRequestCreators = doc.changeRequestCreators || [];
  const changeRequestUserId = event.review.user.id.toString();
  if (changeRequestCreators.includes(changeRequestUserId)) {
    res.status(200).send({});
    return;
  }

  changeRequestCreators.push(changeRequestUserId);
  changeRequestCreators.sort();
  console.log("Change request creators", changeRequestCreators);
  await ref.update({ changeRequestCreators });
  if (changeRequestCreators.length === 1) {
    await sendReaction(
      doc.channel,
      doc.messageTimestamp,
      CHANGE_REQUEST_REACTION
    );
  }

  res.status(200).send({});
};
const handleReviewComments = async (
  res: Response,
  pr: string,
  event: PullRequestReviewEvent
) => {
  const prData = await getPrDocIfExistsOrElseSendOk(res, pr);
  if (prData === undefined) {
    return;
  }

  const { doc, ref } = prData;

  await Promise.all([
    ref.update({ hasComment: true }),
    sendReaction(doc.channel, doc.messageTimestamp, COMMENT_REACTION),
  ]);

  res.status(200).send({});
};
const handleReviewDismissed = async (
  res: Response,
  pr: string,
  event: PullRequestReviewEvent
) => {
  const prData = await getPrDocIfExistsOrElseSendOk(res, pr);
  if (prData === undefined) {
    return;
  }

  const { doc, ref } = prData;
  const userId = event.review.user.id.toString();
  const changeRequestCreators = (doc.changeRequestCreators || []).filter(
    (id) => id !== userId
  );
  const approvers = (doc.approvers || []).filter((id) => id !== userId);

  changeRequestCreators.sort();
  approvers.sort();

  console.log(
    "Change request creators + approvers",
    changeRequestCreators,
    approvers
  );

  await ref.update({ changeRequestCreators, approvers });

  const removalPromises = [];

  if (changeRequestCreators.length === 0) {
    removalPromises.push(
      tryRemoveReaction(
        doc.channel,
        doc.messageTimestamp,
        CHANGE_REQUEST_REACTION
      )
    );
  }

  if (approvers.length === 0) {
    removalPromises.push(
      tryRemoveReaction(doc.channel, doc.messageTimestamp, APPROVE_REACTION)
    );
  }

  await Promise.all(removalPromises);
  res.status(200).send({});
};
export const pullRequestReviewEventHandler = async (
  res: Response,
  event: PullRequestReviewEvent
) => {
  const pr = getPrIdentifier(event.pull_request.html_url);
  if (event.review.state === "approved") {
    console.log(`PR ${pr} was approved`);
    await handleReviewApproved(res, pr, event);
  } else if (event.review.state === "changes_requested") {
    console.log(`PR ${pr} was requested changes`);
    await handleReviewChangesRequested(res, pr, event);
  } else if (event.review.state === "commented") {
    console.log(`PR ${pr} review with comments`);
    await handleReviewComments(res, pr, event);
  } else if (event.review.state === "dismissed") {
    console.log(`PR ${pr} review was dismissed`);
    await handleReviewDismissed(res, pr, event);
  } else {
    res.status(200).send({});
  }
};
