const crypto = require("crypto");

/**
 * Responds to any HTTP request.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */
exports.handler = (req, res) => {
  console.log("start");
  const body = req.rawBody.toString();
  const timestamp = req.headers["x-slack-request-timestamp"];
  const sig_basestring = "v0:" + timestamp + ":" + body;
  const my_signature =
    "v0=" + crypto.createHmac("sha256", process.env.slack_signing_secret).update(sig_basestring).digest("hex");
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
    if (req.body.event.type === "link_shared") {
      const links = req.body.event.links;
      const prIdentifiers = links.map((linkObject) => {
        const url = linkObject.url;
        return url.split("/").slice(3).join("/");
      });
      console.log("Identified following links: ", prIdentifiers);
      res.status(200).send({});
    }
  }

  console.log("Unhandled: " + JSON.stringify(req.body));
  res.status(200).send({});
};
