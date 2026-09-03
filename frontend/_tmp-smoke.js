const { chromium } = require("playwright");
const TOKEN = process.env.KB_TEST_TOKEN;

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  await context.addCookies([
    { name: "session_token", value: TOKEN, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Lax" },
  ]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()); });

  // ---------- FAQ ----------
  console.log("=== Create FAQ ===");
  await page.goto("http://localhost:3000/admin/kb/faqs", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /New FAQ/i }).click();
  await page.waitForTimeout(400);
  await page.locator("button[role=combobox]").first().click();
  await page.waitForTimeout(300);
  await page.getByRole("option").first().click();
  await page.locator("#faq-question-en").fill("Do smoke-test FAQs work?");
  await page.locator("#faq-question-ar").fill("هل تعمل الأسئلة التجريبية؟");
  await page.locator("#faq-answer-en").fill("Yes, if this text shows up on the public help page.");
  await page.locator("#faq-answer-ar").fill("نعم، إذا ظهر هذا النص في صفحة المساعدة العامة.");
  await page.screenshot({ path: "_tmp-smoke-faq-filled.png" });
  await page.getByRole("button", { name: /^Save$/i }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "_tmp-smoke-faq-after-save.png" });
  const faqListText = await page.locator("body").innerText();
  console.log("FAQ list contains new question:", faqListText.includes("Do smoke-test FAQs work?"));

  // ---------- Article ----------
  console.log("=== Create Article ===");
  await page.goto("http://localhost:3000/admin/kb/articles", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /New article/i }).click();
  await page.waitForTimeout(400);
  await page.locator("button[role=combobox]").first().click();
  await page.waitForTimeout(300);
  await page.getByRole("option").first().click();
  await page.locator("#article-title-en").fill("Smoke Test Guide");
  await page.locator("#article-title-ar").fill("دليل اختبار تجريبي");
  await page.locator("#article-summary-en").fill("A short guide created to smoke-test the article flow.");
  await page.locator("#article-summary-ar").fill("دليل قصير لاختبار مسار المقالات.");
  // Body EN write textarea (first "Write" tab is already active)
  const bodyTextareas = page.locator("textarea");
  const count = await bodyTextareas.count();
  console.log("textarea count:", count);
  // Fill body EN (first body textarea) and body AR (second body textarea)
  await bodyTextareas.nth(count - 2).fill("## Overview\n\n1. First step\n2. Second step\n\nThis is a smoke test.");
  await bodyTextareas.nth(count - 1).fill("## نظرة عامة\n\n1. الخطوة الأولى\n2. الخطوة الثانية\n\nهذا اختبار تجريبي.");
  await page.screenshot({ path: "_tmp-smoke-article-filled.png" });
  await page.getByRole("button", { name: /^Save$/i }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "_tmp-smoke-article-after-save.png" });
  const articleListText = await page.locator("body").innerText();
  console.log("Article list contains new title:", articleListText.includes("Smoke Test Guide"));

  // ---------- Public /help ----------
  console.log("=== Check public /help ===");
  const publicPage = await context.newPage();
  await publicPage.goto("http://localhost:3000/help", { waitUntil: "networkidle" });
  const helpFaqText = await publicPage.locator("body").innerText();
  console.log("/help (FAQs tab) contains new question:", helpFaqText.includes("Do smoke-test FAQs work?"));
  await publicPage.screenshot({ path: "_tmp-smoke-help-faqs.png" });

  await publicPage.goto("http://localhost:3000/help?tab=articles", { waitUntil: "networkidle" });
  const helpArticlesText = await publicPage.locator("body").innerText();
  console.log("/help (Guides tab) contains new title:", helpArticlesText.includes("Smoke Test Guide"));
  await publicPage.screenshot({ path: "_tmp-smoke-help-articles.png" });

  if (helpArticlesText.includes("Smoke Test Guide")) {
    await publicPage.getByText("Smoke Test Guide").click();
    await publicPage.waitForLoadState("networkidle");
    const detailText = await publicPage.locator("body").innerText();
    console.log("Article detail page renders body heading 'Overview':", detailText.includes("Overview"));
    console.log("Article detail URL:", publicPage.url());
    await publicPage.screenshot({ path: "_tmp-smoke-article-detail.png" });
  }

  console.log("ERRORS:", JSON.stringify(errors, null, 2));
  await browser.close();
})().catch((e) => {
  console.error("SCRIPT_ERROR:", e);
  process.exit(1);
});
