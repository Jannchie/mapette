// 页面 <head>：标题、描述、Open Graph、canonical、各语言版本互指（hreflang）、结构化数据。
// 返回普通对象（与 Void、Nuxt 等的 head 描述格式一致：title / htmlAttrs / meta / link / script），各站点的 SEO 写法统一。
import type { Locale } from "./style/basemap";
import { localePath, LOCALES } from "./locale";

const OG_LOCALE: Record<Locale, string> = { "zh-Hans": "zh_CN", "zh-Hant": "zh_TW", ja: "ja_JP", en: "en_US" };

export interface SeoOptions {
  /** 站点根地址，如 https://junrei.jannchie.com */
  site: string;
  locale: Locale;
  /** 不带语言前缀的路径，如 "/" 或 "/b/1" */
  path: string;
  title: string;
  description: string;
  siteName: string;
  image?: string;
  jsonLd?: object;
  noindex?: boolean;
  /** 额外的 meta / link（例如 PWA 清单、给 LLM 读的 Markdown 版本） */
  meta?: Record<string, string>[];
  link?: SeoLink[];
}

/** link 必须有 rel 与 href（Void 的 HeadDescriptor 等也是这样要求的） */
export interface SeoLink {
  rel: string;
  href: string;
  [attr: string]: string;
}

export function seoHead(o: SeoOptions) {
  const url = o.site + localePath(o.locale, o.path);
  return {
    title: o.title,
    htmlAttrs: { lang: o.locale },
    meta: [
      { name: "description", content: o.description },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: o.siteName },
      { property: "og:locale", content: OG_LOCALE[o.locale] },
      { property: "og:title", content: o.title },
      { property: "og:description", content: o.description },
      { property: "og:url", content: url },
      ...(o.image ? [{ property: "og:image", content: o.image }, { name: "twitter:card", content: "summary_large_image" }] : []),
      ...(o.noindex ? [{ name: "robots", content: "noindex" }] : []),
      ...(o.meta ?? []),
    ],
    link: [
      { rel: "canonical", href: url },
      // 同一页面的各语言版本互相指向，搜索引擎据此按用户语言展示
      ...LOCALES.map((l) => ({ rel: "alternate", hreflang: l, href: o.site + localePath(l, o.path) })),
      { rel: "alternate", hreflang: "x-default", href: o.site + localePath("zh-Hans", o.path) },
      ...(o.link ?? []),
    ],
    // JSON 里的 "</" 要转义，避免提前结束 script 标签
    script: o.jsonLd ? [{ type: "application/ld+json", innerHTML: JSON.stringify(o.jsonLd).replace(/</g, "\\u003c") }] : [],
  };
}
