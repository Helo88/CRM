"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { pickLocalized, type LocalizedText } from "@/lib/localized";
import type { Locale } from "@/lib/locale";

interface FaqItem {
  id: string;
  question: LocalizedText;
  answer: LocalizedText;
}

// Plain serializable data only, resolved server-side and passed down — same
// rule HeaderSearch documents: nothing but primitives crosses the Server/
// Client boundary.
export function KbFaqAccordion({ faqs, locale }: { faqs: FaqItem[]; locale: Locale }) {
  return (
    <Accordion type="multiple">
      {faqs.map((faq) => {
        const question = pickLocalized(faq.question, locale);
        const answer = pickLocalized(faq.answer, locale);
        return (
          <AccordionItem key={faq.id} value={faq.id} id={`faq-${faq.id}`}>
            <AccordionTrigger>
              <h3
                className="text-start text-sm font-semibold"
                lang={question.language}
                dir={question.language === "ar" ? "rtl" : "ltr"}
              >
                {question.value}
              </h3>
            </AccordionTrigger>
            <AccordionContent>
              {/* FAQ answers are plain text, not Markdown — do not run them
                  through ArticleBody, that would create a second content
                  format with different escaping rules. */}
              <p
                className="whitespace-pre-line text-muted-foreground"
                lang={answer.language}
                dir={answer.language === "ar" ? "rtl" : "ltr"}
              >
                {answer.value}
              </p>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
