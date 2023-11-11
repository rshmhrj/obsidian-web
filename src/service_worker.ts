import { getUrlMentions, getLocalSettings, obsidianRequest } from "./utils";
import { BackgroundRequest, ExtensionLocalSettings } from "./types";

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const localSettings: ExtensionLocalSettings = await getLocalSettings(
    chrome.storage.local
  );
  const url = tab.url;

  if (
    !localSettings ||
    !localSettings.host ||
    !localSettings.apiKey ||
    !url ||
    changeInfo.status !== "loading"
  ) {
    return;
  }

  try {
    const mentions = await getUrlMentions(
      localSettings.host,
      localSettings.apiKey,
      localSettings.insecureMode || false,
      url
    );

    if (mentions.direct.length > 0) {
      chrome.action.setBadgeBackgroundColor({
        color: "#A68B36",
        tabId,
      });
      chrome.action.setBadgeText({
        text: `${mentions.direct.length}`,
        tabId,
      });
      chrome.action.setTitle({
        title: `${mentions.direct.length} mentions`,
        tabId,
      });
    } else if (mentions.mentions.length > 0) {
      chrome.action.setBadgeBackgroundColor({
        color: "#3D7D98",
        tabId,
      });
      chrome.action.setBadgeText({
        text: `${mentions.mentions.length}`,
        tabId,
      });
      chrome.action.setTitle({
        title: `${mentions.mentions.length} mentions`,
        tabId,
      });
    } else {
      chrome.action.setBadgeText({
        text: "",
        tabId,
      });
      chrome.action.setTitle({
        title: "",
        tabId,
      });
    }

    for (const mention of mentions.direct) {
      const mentionData = await obsidianRequest(
        localSettings.host,
        localSettings.apiKey,
        `/vault/${mention.filename}`,
        {
          method: "get",
          headers: {
            Accept: "application/vnd.olrapi.note+json",
          },
        },
        localSettings.insecureMode || false
      );
      const result = await mentionData.json();

      if (result.frontmatter["web-badge-color"]) {
        chrome.action.setBadgeBackgroundColor({
          color: result.frontmatter["web-badge-color"],
          tabId,
        });
      }
      if (result.frontmatter["web-badge-message"]) {
        chrome.action.setBadgeText({
          text: result.frontmatter["web-badge-message"],
          tabId,
        });
        chrome.action.setTitle({
          title: result.frontmatter["web-badge-message"],
          tabId,
        });
      }
    }
  } catch (e) {
    chrome.action.setBadgeBackgroundColor({
      color: "#FF0000",
      tabId,
    });
    chrome.action.setBadgeText({
      text: "ERR",
      tabId,
    });
    console.error(e);
  }
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["js/vendor.js", "js/popup.js"],
    });
  } else {
    console.log("No tab ID");
  }
});

chrome.runtime.onMessage.addListener(
  (message: BackgroundRequest, sender, sendResponse) => {
    if (message.type === "check-has-host-permission") {
      chrome.permissions.contains(
        {
          origins: [
            `http://${message.host}:27123/*`,
            `https://${message.host}:27124/*`,
          ],
        },
        (result) => {
          sendResponse(result);
        }
      );
    } else if (message.type === "request-host-permission") {
      chrome.permissions.request(
        {
          origins: [
            `http://${message.host}:27123/*`,
            `https://${message.host}:27124/*`,
          ],
        },
        (result) => {
          sendResponse(result);
        }
      );
    } else if (message.type === "check-keyboard-shortcut") {
      chrome.commands.getAll((commands) => {
        for (const command of commands) {
          if (command.name === "_execute_action") {
            sendResponse(command.shortcut);
          }
        }
      });
    }

    return true;
  }
);
