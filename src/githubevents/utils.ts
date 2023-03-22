import { Response } from "@google-cloud/functions-framework";
import { PrDoc } from "./PrDoc";
import { db } from "./globalState";

export const getPrIdentifier = (url: string) => {
  // https://github.com/octocat/Hello-World/pull/1347 -> octocat:Hello-World:pull:1347
  return url.split("/").slice(3).join(":");
};
export const PR_COLLECTION_NAME = "prs";
export const getPrDocIfExistsOrElseSendOk = async (
  res: Response,
  pr: string
): Promise<
  | {
      doc: PrDoc;
      ref: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>;
    }
  | undefined
> => {
  const prRef = db.collection(PR_COLLECTION_NAME).doc(pr);
  const doc = await prRef.get();
  if (!doc.exists) {
    console.log("No document for " + pr);
    res.status(200).send({});
    return;
  } else {
    const prData = doc.data() as PrDoc;
    console.log("Document data:", JSON.stringify(prData));
    if (!prData.tracking) {
      res.status(200).send({});
      return;
    }

    return { doc: prData, ref: prRef };
  }
};
