const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

const { WebClient } = require("@slack/web-api");
const token = process.env.SLACK_TOKEN;
const web = new WebClient(token);

const getPrIdentifier = (body) => {
  const prLink = body["pullrequest"]["links"]["self"]["href"];
  return prLink.split("/").slice(5).join(":");
};

const sendReaction = async (channel, timestamp, reaction) => {
  return web.reactions.add({ name: reaction, channel, timestamp });
};

const removeReaction = async (channel, timestamp, reaction) => {
  return web.reactions.remove({ name: reaction, channel, timestamp });
};

const APPROVE_REACTION = "white_check_mark";
const MERGE_REACTION = "merge";
const COMMENT_REACTION = "speech_balloon";
const PR_COLLECTION_NAME = "prs";

async function commentCreated(res, body) {
  console.log("eventKey comment");
  const pr = getPrIdentifier(body);
  console.log("PR " + pr + " received a comment");

  // Filter out if the comment is from Tophatting
  if (body.actor.account_id === "638e5b97213a315af34b01de") {
    console.log(
      "The commenter is the Tophatting user. Do not track this. ",
      body.actor.account_id
    );
    res.status(200).send({});
    return;
  }

  const prRef = db.collection(PR_COLLECTION_NAME).doc(pr);
  const doc = await prRef.get();
  if (!doc.exists) {
    console.log("No document for " + pr);
    res.status(200).send({});
    return;
  } else {
    console.log("Document data:", doc.data());
    const prData = doc.data();
    if (!prData.tracking || prData.hasComment) {
      res.status(200).send({});
      return;
    }
    await Promise.all([
      prRef.update({ hasComment: true }),
      sendReaction(prData.channel, prData.messageTimestamp, COMMENT_REACTION),
    ]);
  }
  res.status(200).send({});
}

/**
 * Responds to any HTTP request.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */
exports.handler = async (req, res) => {
  const body = req.body;
  const headers = req.headers;

  if (body.actor) {
    console.log("actor: ", JSON.stringify(body.actor));
  }

  const eventKey = headers["x-event-key"];
  if (eventKey === "pullrequest:approved") {
    const pr = getPrIdentifier(body);
    console.log("PR " + pr + " was approved");

    const prRef = db.collection(PR_COLLECTION_NAME).doc(pr);
    const doc = await prRef.get();
    if (!doc.exists) {
      console.log("No document for " + pr);
      res.status(200).send({});
      return;
    } else {
      console.log("Document data:", doc.data());
      const prData = doc.data();
      if (!prData.tracking) {
        res.status(200).send({});
        return;
      }
      const approvers = [...prData.approvers, body.approval.user.uuid];
      approvers.sort();
      console.log("Approvers", approvers);
      await prRef.update({ approvers });
      if (approvers.length > 0) {
        await sendReaction(
          prData.channel,
          prData.messageTimestamp,
          APPROVE_REACTION
        );
      }
    }
    res.status(200).send({});
    return;
  }

  if (eventKey === "pullrequest:unapproved") {
    const pr = getPrIdentifier(body);
    console.log("PR " + pr + " was unapproved");
    const prRef = db.collection(PR_COLLECTION_NAME).doc(pr);
    const doc = await prRef.get();
    if (!doc.exists) {
      console.log("No document for " + pr);
      res.status(200).send({});
      return;
    } else {
      console.log("Document data:", doc.data());
      const prData = doc.data();
      if (!prData.tracking) {
        res.status(200).send({});
        return;
      }
      const approvers = [...prData.approvers].filter(
        (a) => a !== body.approval.user.uuid
      );
      approvers.sort();
      console.log("Approvers", approvers);
      await prRef.update({ approvers });
      if (approvers.length === 0) {
        try {
          await removeReaction(
            prData.channel,
            prData.messageTimestamp,
            APPROVE_REACTION
          );
        } catch (e) {
          // Ignore if we cannot remove reaction
        }
      }
    }
    res.status(200).send({});
    return;
  }

  if (eventKey === "pullrequest:fulfilled") {
    const pr = getPrIdentifier(body);
    console.log("PR " + pr + " was merged");
    const prRef = db.collection(PR_COLLECTION_NAME).doc(pr);
    const doc = await prRef.get();
    if (!doc.exists) {
      console.log("No document for " + pr);
      res.status(200).send({});
      return;
    } else {
      console.log("Document data:", doc.data());
      const prData = doc.data();
      if (!prData.tracking) {
        res.status(200).send({});
        return;
      }
      await Promise.all([
        prRef.update({ merged: true, tracking: false }),
        sendReaction(prData.channel, prData.messageTimestamp, MERGE_REACTION),
      ]);
    }
    res.status(200).send({});
    return;
  }

  if (eventKey === "pullrequest:comment_created") {
    await commentCreated(res, body);
    return;
  }
  console.log("headers: ", JSON.stringify(req.headers));
  console.log("body: ", JSON.stringify(req.body));
  res.status(200).send({});
};
