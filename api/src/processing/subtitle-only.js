import { createResponse } from "./request.js";
import { extract } from "./url.js";
import { friendlyServiceName } from "./service-alias.js";

// Import all service modules
import bilibili from "./services/bilibili.js";
import reddit from "./services/reddit.js";
import twitter from "./services/twitter.js";
import youtube from "./services/youtube.js";
import vk from "./services/vk.js";
import ok from "./services/ok.js";
import tiktok from "./services/tiktok.js";
import tumblr from "./services/tumblr.js";
import vimeo from "./services/vimeo.js";
import soundcloud from "./services/soundcloud.js";
import instagram from "./services/instagram.js";
import pinterest from "./services/pinterest.js";
import streamable from "./services/streamable.js";
import twitch from "./services/twitch.js";
import rutube from "./services/rutube.js";
import snapchat from "./services/snapchat.js";
import loom from "./services/loom.js";
import facebook from "./services/facebook.js";
import bluesky from "./services/bluesky.js";
import xiaohongshu from "./services/xiaohongshu.js";

// Map of services that support subtitles
const subtitleServices = {
  youtube,
  vimeo,
  vk,
  tiktok,
  twitter,
  rutube,
  loom,
};

export default async function ({ host, patternMatch, params, authType }) {
  const { url } = params;

  // Check if service supports subtitles
  if (!subtitleServices[host]) {
    return createResponse("error", {
      code: "error.api.service.subtitles_not_supported",
      context: {
        service: friendlyServiceName(host),
      },
    });
  }

  // Require subtitleLang parameter
  if (!params.subtitleLang || params.subtitleLang === "none") {
    return createResponse("error", {
      code: "error.api.subtitle_lang_required",
    });
  }

  try {
    let r;
    const subtitleLang = params.subtitleLang;

    // Call the appropriate service with subtitle-only parameters
    switch (host) {
      case "youtube":
        r = await youtube({
          dispatcher: params.dispatcher,
          id: patternMatch.id.slice(0, 11),
          subtitleLang,
          // Minimal parameters to get subtitle info
          quality: "1080",
          codec: "h264",
          container: "mp4",
          isAudioOnly: false,
          isAudioMuted: false,
          dubLang: undefined,
          youtubeHLS: false,
        });
        break;

      case "vimeo":
        r = await vimeo({
          id: patternMatch.id.slice(0, 11),
          password: patternMatch.password,
          quality: "1080",
          isAudioOnly: false,
          subtitleLang,
        });
        break;

      case "vk":
        r = await vk({
          ownerId: patternMatch.ownerId,
          videoId: patternMatch.videoId,
          accessKey: patternMatch.accessKey,
          quality: "1080",
          subtitleLang,
        });
        break;

      case "tiktok":
        r = await tiktok({
          postId: patternMatch.postId,
          shortLink: patternMatch.shortLink,
          fullAudio: false,
          isAudioOnly: false,
          h265: false,
          alwaysProxy: false,
          subtitleLang,
        });
        break;

      case "twitter":
        r = await twitter({
          id: patternMatch.id,
          index: patternMatch.index - 1,
          toGif: false,
          alwaysProxy: false,
          dispatcher: params.dispatcher,
          subtitleLang,
        });
        break;

      case "rutube":
        r = await rutube({
          id: patternMatch.id,
          yappyId: patternMatch.yappyId,
          key: patternMatch.key,
          quality: "1080",
          isAudioOnly: false,
          subtitleLang,
        });
        break;

      case "loom":
        r = await loom({
          id: patternMatch.id,
          subtitleLang,
        });
        break;

      default:
        return createResponse("error", {
          code: "error.api.service.subtitles_not_supported",
          context: {
            service: friendlyServiceName(host),
          },
        });
    }

    // Handle errors
    if (r.error && r.critical) {
      return createResponse("critical", {
        code: `error.api.${r.error}`,
      });
    }

    if (r.error) {
      let context;
      switch (r.error) {
        case "content.too_long":
          context = {
            limit: parseFloat((process.env.DURATION_LIMIT / 60).toFixed(2)),
          };
          break;

        case "fetch.fail":
        case "fetch.rate":
        case "fetch.critical":
        case "link.unsupported":
        case "content.video.unavailable":
          context = {
            service: friendlyServiceName(host),
          };
          break;
      }

      return createResponse("error", {
        code: `error.api.${r.error}`,
        context,
      });
    }

    // Check if subtitles were found
    if (!r.subtitles) {
      return createResponse("error", {
        code: "error.api.subtitles.not_found",
        context: {
          service: friendlyServiceName(host),
          language: subtitleLang,
        },
      });
    }

    // Return subtitle-only response with direct URL
    return createResponse("subtitle", {
      url: r.subtitles,
      language: r.fileMetadata?.sublanguage || subtitleLang,
      service: host,
      filename: `subtitles_${host}_${patternMatch.id || patternMatch.postId || 'unknown'}.vtt`,
      fileMetadata: r.fileMetadata || {},
    });
  } catch (error) {
    return createResponse("error", {
      code: "error.api.fetch.critical",
      context: {
        service: friendlyServiceName(host),
      },
    });
  }
}
