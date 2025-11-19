const cheerio = require("cheerio");
const axios = require("axios");

// Markdown 特殊字符转义 (MarkdownV2)
function escapeMarkdown(text) {
  if (!text) return "";
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

// 截断文本
function truncate(text, maxLength = 200) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

// HTML 转 Telegraph Node
function htmlToTelegraph(html) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const root = $("body");

  const ALLOWED_TAGS = [
    "a",
    "aside",
    "b",
    "blockquote",
    "br",
    "code",
    "em",
    "figcaption",
    "figure",
    "h3",
    "h4",
    "hr",
    "i",
    "iframe",
    "img",
    "li",
    "ol",
    "p",
    "pre",
    "s",
    "strong",
    "u",
    "ul",
    "video",
  ];

  function domToNode(element) {
    if (element.type === "text") {
      return element.data;
    }

    if (element.type === "tag") {
      let tag = element.name.toLowerCase();

      // 转换不支持的标题标签
      if (tag === "h1" || tag === "h2") tag = "h3";

      // 如果标签不支持，解包（只返回子节点）
      if (!ALLOWED_TAGS.includes(tag)) {
        return element.children.map(domToNode).flat();
      }

      const node = { tag: tag };

      if (element.attribs) {
        const attrs = {};
        if (element.attribs.href) attrs.href = element.attribs.href;
        if (element.attribs.src) attrs.src = element.attribs.src;
        if (Object.keys(attrs).length > 0) node.attrs = attrs;
      }

      if (element.children && element.children.length > 0) {
        node.children = element.children
          .map(domToNode)
          .flat()
          .filter((c) => c !== null && c !== undefined && c !== "");
      }

      return node;
    }

    return null;
  }

  return root
    .contents()
    .map((i, el) => domToNode(el))
    .get()
    .filter((n) => n);
}

// 创建 Telegraph 账号
async function createTelegraphAccount(shortName, authorName) {
  try {
    const response = await axios.get(`https://api.telegra.ph/createAccount`, {
      params: {
        short_name: shortName,
        author_name: authorName,
      },
    });
    if (response.data.ok) {
      return response.data.result;
    } else {
      throw new Error(response.data.error);
    }
  } catch (error) {
    console.error("Error creating Telegraph account:", error.message);
    throw error;
  }
}

// 创建 Telegraph 页面
async function createTelegraphPage(
  accessToken,
  title,
  contentNodes,
  authorName,
  authorUrl
) {
  try {
    const response = await axios.post(`https://api.telegra.ph/createPage`, {
      access_token: accessToken,
      title: title,
      content: JSON.stringify(contentNodes),
      author_name: authorName,
      author_url: authorUrl,
      return_content: false,
    });

    if (response.data.ok) {
      return response.data.result.url;
    } else {
      throw new Error(response.data.error);
    }
  } catch (error) {
    console.error("Error creating Telegraph page:", error.message);
    return null;
  }
}

module.exports = {
  escapeMarkdown,
  truncate,
  htmlToTelegraph,
  createTelegraphAccount,
  createTelegraphPage,
};
