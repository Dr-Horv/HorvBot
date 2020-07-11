/**
 * Responds to any HTTP request.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */
exports.handler = (req, res) => {
  console.log("headers: ", req.headers);
  console.log("body: ", req.body);

  res.status(200).send({});
};