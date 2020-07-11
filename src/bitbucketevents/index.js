const getPrIdentifier = (body) => {
  const prLink = body["pullrequest"]["links"]["self"]["href"];
  return prLink.split("/").slice(5).join("/");
};

/**
 * Responds to any HTTP request.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */
exports.handler = (req, res) => {
  console.log("headers: ", JSON.stringify(req.headers));
  console.log("body: ", JSON.stringify(req.body));
  const body = req.body;
  const headers = req.headers;

  const eventKey = headers["x-event-key"];
  if (eventKey === "pullrequest:approved") {
    const pr = getPrIdentifier(body);
    console.log("PR " + pr + " was approved");
  }

  if (eventKey === "pullrequest:unapproved") {
    const pr = getPrIdentifier(body);
    console.log("PR " + pr + " was unapproved");
  }

  res.status(200).send({});
};
