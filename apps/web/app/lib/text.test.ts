import { describe, expect, it } from "vitest";
import { decodeEntities, htmlToText } from "./text";

describe("decodeEntities", () => {
  it("decodes named, decimal and hex entities", () => {
    expect(decodeEntities("a &amp; b &#39;c&#39; https:&#x2F;&#x2F;x.io")).toBe(
      "a & b 'c' https://x.io",
    );
  });

  it("leaves unknown entities alone", () => {
    expect(decodeEntities("&notanentity; &amp")).toBe("&notanentity; &amp");
  });
});

describe("htmlToText", () => {
  it("keeps paragraphs and list items on their own lines", () => {
    const html =
      "<h2>Location</h2><p>We hire anywhere in <b>UTC-3 to UTC+6</b>.</p><ul><li>Remote</li><li>Async</li></ul>";
    expect(htmlToText(html)).toBe(
      "Location\nWe hire anywhere in UTC-3 to UTC+6.\n\n- Remote\n- Async",
    );
  });

  it("drops script and style blocks", () => {
    expect(htmlToText("<style>p{}</style><p>Hi</p><script>x()</script>")).toBe("Hi");
  });
});
