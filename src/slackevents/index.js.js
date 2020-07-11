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
  console.log("sig_basestring", sig_basestring);
  const my_signature =
    "v0=" + crypto.createHmac("sha256", process.env.slack_signing_secret).update(sig_basestring).digest("hex");

  const slack_signature = req.headers["x-slack-signature"];

  if (!(my_signature === slack_signature)) {
    console.log("invalid signature");
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

  if (body.type === "url_verification") {
    res.status(200).send({ challenge: req.body.challenge });
    return;
  }
  console.log("Got: " + req.body);

  res.status(200).send({});
};
