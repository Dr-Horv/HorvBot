import { HttpFunction } from "@google-cloud/functions-framework";
import { WebhookEvent } from "@octokit/webhooks-types";
import { pullRequestReviewEventHandler } from "./pullRequestReviewEventHandler";
import { pullRequestClosedEventHandler } from "./pullRequestMergedHandler";

/**
 * Responds to any HTTP request.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */
export const handler: HttpFunction = async (req, res) => {
  const event = req.body as WebhookEvent;

  if ("review" in event) {
    await pullRequestReviewEventHandler(res, event);
    return;
  }

  if ("pull_request" in event && event.action === "closed") {
    await pullRequestClosedEventHandler(res, event);
    return;
  }

  console.log("headers: ", JSON.stringify(req.headers));
  console.log("body: ", JSON.stringify(req.body));
  res.status(200).send({});
};
