import { web } from "./globalState";
type ReactionFn = (
  channel: string,
  timestamp: string,
  reaction: string
) => Promise<any>;

export const APPROVE_REACTION = "white_check_mark";
export const MERGE_REACTION = "merge";
export const COMMENT_REACTION = "speech_balloon";
export const CHANGE_REQUEST_REACTION = "warning";

export const sendReaction: ReactionFn = async (
  channel,
  timestamp,
  reaction
) => {
  return web.reactions.add({ name: reaction, channel, timestamp });
};
const removeReaction: ReactionFn = async (channel, timestamp, reaction) => {
  return web.reactions.remove({ name: reaction, channel, timestamp });
};
export const tryRemoveReaction: ReactionFn = async (
  channel,
  timestamp,
  reaction
) => {
  try {
    return removeReaction(channel, timestamp, reaction);
  } catch (e) {
    // Ignore if we fail to remove reaction
  }
};
