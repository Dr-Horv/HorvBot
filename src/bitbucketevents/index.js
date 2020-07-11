const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

const getPrIdentifier = (body) => {
  const prLink = body["pullrequest"]["links"]["self"]["href"];
  return prLink.split("/").slice(5).join(":");
};

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
    const pr = getPrIdentifier(body);
    console.log("PR " + pr + " was approved");
    res.status(200).send({});
    const prRef = db.collection("prs").doc(pr);
    const doc = await prRef.get();
    if (!doc.exists) {
      console.log("No document for " + pr);
      return;
    } else {
      console.log("Document data:", doc.data());
      const prData = doc.data();
      const approvers = [...prData.approvers, body.approval.user.uuid];
      approvers.sort();
      console.log("Approvers", approvers);
      await prRef.update({ approvers });
    }
    return;
  }

  if (eventKey === "pullrequest:unapproved") {
    const pr = getPrIdentifier(body);
    console.log("PR " + pr + " was unapproved");
    res.status(200).send({});
    const prRef = db.collection("prs").doc(pr);
    const doc = await prRef.get();
    if (!doc.exists) {
      console.log("No document for " + pr);
      return;
    } else {
      console.log("Document data:", doc.data());
      const prData = doc.data();
      const approvers = [...prData.approvers].filter(
        (a) => a !== body.approval.user.uuid
      );
      approvers.sort();
      await prRef.update({ approvers });
    }
    return;
  }

  console.log("headers: ", JSON.stringify(req.headers));
  console.log("body: ", JSON.stringify(req.body));
  res.status(200).send({});
};
