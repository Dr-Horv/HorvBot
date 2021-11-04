const crypto = require("crypto");

const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

const PR_COLLECTION_NAME = "prs";

/**
 * Responds to any HTTP request.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */
exports.handler = async (req, res) => {
  const body = req.rawBody.toString();
  const timestamp = req.headers["x-slack-request-timestamp"];
  const sig_basestring = "v0:" + timestamp + ":" + body;
  const my_signature =
    "v0=" +
    crypto
      .createHmac("sha256", process.env.slack_signing_secret)
      .update(sig_basestring)
      .digest("hex");
  const slack_signature = req.headers["x-slack-signature"];

  if (!(my_signature === slack_signature)) {
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
    return;
  }

  if (req.body.type === "url_verification") {
    console.log("Responding 200 to challenge");
    res.status(200).send({ challenge: req.body.challenge });
    return;
  }

  if (req.body.type === "event_callback") {
    console.log('event body', JSON.stringify(req.body))
    if (req.body.event.type === "link_shared") {
      const links = req.body.event.links;
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
        .filter((item) => item !== undefined);
      console.log("Identified following links: ", prIdentifiers);

      await Promise.all(
        prIdentifiers.map(async (pr) => {
          const docRef = db.collection(PR_COLLECTION_NAME).doc(pr);
          const doc = await docRef.get();
          if (!doc.exists) {
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
            console.log("Starting to track: ", pr, data);
            return docRef.set(data);
          }
        })
      );
      res.status(200).send({});
      return;
    }
  }

  console.log("Unhandled: " + JSON.stringify(req.body));
  res.status(200).send({});
};
