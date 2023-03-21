import { WebClient } from "@slack/web-api";
import admin from "firebase-admin";

admin.initializeApp();
export const db = admin.firestore();
const token = process.env.SLACK_TOKEN;
export const web = new WebClient(token);
