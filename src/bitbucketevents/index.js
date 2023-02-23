const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

const { WebClient } = require("@slack/web-api");
const token = process.env.SLACK_TOKEN;
const web = new WebClient(token);

/**
 * TODO
 * Add typescript
 * Split into own files
 * Util functions for verifications
 * Handle web.reaction errors better
 *
 */

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
const CHANGE_REQUEST_REACTION = "warning";
const PR_COLLECTION_NAME = "prs";

async function eventChangeRequestCreated(res, body) {
  const pr = getPrIdentifier(body);
  console.log("PR " + pr + " received a change request");

  const prRef = db.collection(PR_COLLECTION_NAME).doc(pr);
  const doc = await prRef.get();
  if (!doc.exists) {
    console.log("No document for " + pr);
    res.status(200).send({});
    return;
  } else {
    const prData = doc.data();
    console.log("Document data:", JSON.stringify(prData));
    if (!prData.tracking) {
      res.status(200).send({});
      return;
    }

    const changeRequestCreators = prData.changeRequestCreators || [];
    const changeRequestUserUuid = body.changes_request.user.uuid;
    if (changeRequestCreators.includes(changeRequestUserUuid)) {
      res.status(200).send({});
      return;
    }

    changeRequestCreators.push(changeRequestUserUuid);
    changeRequestCreators.sort();
    console.log("Change request creators", changeRequestCreators);
    await prRef.update({ changeRequestCreators });
    if (changeRequestCreators.length === 1) {
      await sendReaction(
        prData.channel,
        prData.messageTimestamp,
        CHANGE_REQUEST_REACTION
      );
    }
  }
  res.status(200).send({});
}

async function eventChangeRequestRemoved(res, body) {
  const pr = getPrIdentifier(body);
  console.log("PR " + pr + " had a change request removed");

  const prRef = db.collection(PR_COLLECTION_NAME).doc(pr);
  const doc = await prRef.get();
  if (!doc.exists) {
    console.log("No document for " + pr);
    res.status(200).send({});
    return;
  } else {
    const prData = doc.data();
    console.log("Document data:", JSON.stringify(prData));
    if (!prData.tracking) {
      res.status(200).send({});
      return;
    }

    const changeRequestCreators = (prData.changeRequestCreators || []).filter(
      (a) => a !== body.changes_request.user.uuid
    );
    changeRequestCreators.sort();
    console.log("Change request creators", changeRequestCreators);
    await prRef.update({ changeRequestCreators });
    if (changeRequestCreators.length === 0) {
      try {
        await removeReaction(
          prData.channel,
          prData.messageTimestamp,
          CHANGE_REQUEST_REACTION
        );
      } catch (e) {
        // Ignore if we cannot remove reaction
      }
    }
  }
  res.status(200).send({});
}

async function eventCommentCreated(res, body) {
  const pr = getPrIdentifier(body);
  console.log("PR " + pr + " received a comment");
  const tophattingAccountId = "638e5b97213a315af34b01de";

  // Do not add comment from Tophatting since it's not relevant in Slack
  if (body.actor.account_id === tophattingAccountId) {
    console.log(
      "The commenter is the Tophatting user. Do not track this.",
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
    const prData = doc.data();
    console.log("Document data:", JSON.stringify(prData));
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

async function eventFulfilled(res, body) {
  const pr = getPrIdentifier(body);
  console.log("PR " + pr + " was merged");

  const prRef = db.collection(PR_COLLECTION_NAME).doc(pr);
  const doc = await prRef.get();
  if (!doc.exists) {
    console.log("No document for " + pr);
    res.status(200).send({});
    return;
  } else {
    const prData = doc.data();
    console.log("Document data:", JSON.stringify(prData));
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
}

async function eventUnapproved(res, body) {
  const pr = getPrIdentifier(body);
  console.log("PR " + pr + " was unapproved");
  const prRef = db.collection(PR_COLLECTION_NAME).doc(pr);
  const doc = await prRef.get();
  if (!doc.exists) {
    console.log("No document for " + pr);
    res.status(200).send({});
    return;
  } else {
    const prData = doc.data();
    console.log("Document data:", JSON.stringify(prData));
    if (!prData.tracking) {
      res.status(200).send({});
      return;
    }

    const approvers = (prData.approvers || []).filter(
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
}

async function eventApproved(res, body) {
  const pr = getPrIdentifier(body);
  console.log("PR " + pr + " was approved");

  const prRef = db.collection(PR_COLLECTION_NAME).doc(pr);
  const doc = await prRef.get();
  if (!doc.exists) {
    console.log("No document for " + pr);
    res.status(200).send({});
    return;
  } else {
    const prData = doc.data();
    console.log("Document data:", JSON.stringify(prData));
    if (!prData.tracking) {
      res.status(200).send({});
      return;
    }

    const approvers = prData.approvers || [];
    const approvalUserUuid = body.approval.user.uuid;
    if (approvers.includes(approvalUserUuid)) {
      res.status(200).send({});
      return;
    }

    approvers.push(approvalUserUuid);
    approvers.sort();
    console.log("Approvers", approvers);
    await prRef.update({ approvers });
    if (approvers.length === 1) {
      await sendReaction(
        prData.channel,
        prData.messageTimestamp,
        APPROVE_REACTION
      );
    }
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

  const eventKey = headers["x-event-key"];
  if (eventKey === "pullrequest:approved") {
    await eventApproved(res, body);
    return;
  }

  if (eventKey === "pullrequest:unapproved") {
    await eventUnapproved(res, body);
    return;
  }

  if (eventKey === "pullrequest:fulfilled") {
    await eventFulfilled(res, body);
    return;
  }

  if (eventKey === "pullrequest:comment_created") {
    await eventCommentCreated(res, body);
    return;
  }

  if (eventKey === "pullrequest:changes_request_created") {
    await eventChangeRequestCreated(res, body);
    return;
  }

  if (eventKey === "pullrequest:changes_request_removed") {
    await eventChangeRequestRemoved(res, body);
    return;
  }
  console.log("headers: ", JSON.stringify(req.headers));
  console.log("body: ", JSON.stringify(req.body));
  res.status(200).send({});
};
