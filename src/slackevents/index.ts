import * as crypto from "crypto";
import admin from "firebase-admin";
import {
  HttpFunction,
  Request,
  Response,
} from "@google-cloud/functions-framework";
import { LinkSharedEvent } from "./slackEvents";

admin.initializeApp();

const db = admin.firestore();

const PR_COLLECTION_NAME = "prs";

const SLACK_SIGNING_SECRET = process.env.slack_signing_secret;

if (SLACK_SIGNING_SECRET === undefined) {
  console.log("Missing 'slack_signing_secret' env variable");
  process.exit(1);
}

export const notEmpty = <TValue>(
  value: TValue | null | undefined
): value is TValue => value !== null && value !== undefined;

const calculateMySignature = (req: Request, body?: string) => {
  const timestamp = req.headers["x-slack-request-timestamp"];
  const sig_basestring = "v0:" + timestamp + ":" + body;
  const my_signature =
    "v0=" +
    crypto
      .createHmac("sha256", SLACK_SIGNING_SECRET)
      .update(sig_basestring)
      .digest("hex");
  return { sig_basestring, my_signature };
};

const handleMismatchingSignature = (
  sig_basestring: string,
  res: Response,
  slack_signature: string | string[] | undefined,
  my_signature: string,
  req: Request
) => {
  console.log("invalid signature for ", sig_basestring);
  res
    .status(403)
    .send(
      "Invalid signature: " +
        sig_basestring +
        " Slack: " +
        slack_signature +
        " Mine: " +
        my_signature +
        " headers " +
        req.headers
    );
};

async function handleLinkSharedEvent(
  event: LinkSharedEvent,
  req: Request,
  res: Response
) {
  // Support links like: https://github.com/RDIT-DPS/unify-tech-docs/pull/1
  const links = event.links;
  const prIdentifiers = links
    .map((linkObject) => {
      const url = linkObject.url;
      try {
        return url
          .split("/")
          .slice(3, 7)
          .join(":")
          .replace("pull-requests", "pullrequests");
      } catch (e) {
        return undefined;
      }
    })
    .filter(notEmpty);
  console.log("Identified following links: ", prIdentifiers);

  await Promise.all(
    prIdentifiers.map(async (pr: string) => {
      const docRef = db.collection(PR_COLLECTION_NAME).doc(pr);
      const doc = await docRef.get();
      const channel = req.body.event.channel;
      const messageTimestamp = req.body.event.message_ts;
      const data = {
        channel,
        messageTimestamp,
        tracking: true,
        identifier: pr,
        approvers: [],
        merged: false,
      };

      if (!doc.exists) {
        console.log("Starting to track: ", pr, data);
        return docRef.set(data);
      } else {
        console.log("PR already tracked: ", pr, data);
      }
    })
  );
  res.status(200).send({});
  return;
}

/**
 * Responds to any HTTP request.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */
export const handler: HttpFunction = async (req, res) => {
  const body = req.rawBody?.toString();
  const { sig_basestring, my_signature } = calculateMySignature(req, body);
  const slack_signature = req.headers["x-slack-signature"];

  if (my_signature !== slack_signature) {
    handleMismatchingSignature(
      sig_basestring,
      res,
      slack_signature,
      my_signature,
      req
    );
    return;
  }

  if (req.body.type === "url_verification") {
    console.log("Responding 200 to challenge");
    res.status(200).send({ challenge: req.body.challenge });
    return;
  }

  if (req.body.type === "event_callback") {
    if (req.body.event.type === "link_shared") {
      if (req.body.event.channel === "COMPOSER") {
        // Ignore links sent from composer
        res.status(200).send({});
        return;
      }

      const event: LinkSharedEvent = req.body.event;
      await handleLinkSharedEvent(event, req, res);
    }
  }

  console.log("Unhandled: " + JSON.stringify(req.body));
  res.status(200).send({});
};
