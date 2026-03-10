import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { writeFileSync } from "fs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_KEY = process.env.OPENAI_API_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_KEY });
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

// 70 test cases across all topic areas
const TEST_CASES = [
  // Installation & Migration (1-10)
  { id: 1, q: "Wie ziehe ich EasyFirma auf einen neuen PC um?", expectedTopic: "neuer-pc" },
  { id: 2, q: "Wie richte ich EasyFirma im Netzwerk ein?", expectedTopic: "netzwerk-betrieb" },
  { id: 3, q: "Wie verbinde ich EasyFirma mit dem SQL-Server?", expectedTopic: "sql-server" },
  { id: 4, q: "Was ist nGen und wie verbessere ich die Performance?", expectedTopic: "ngen-performance" },
  { id: 5, q: "Ich will von EasyFirma 1 auf EasyFirma 2 umsteigen", expectedTopic: "easyfirma1-auf-2" },
  { id: 6, q: "Wie upgrade ich von EasyFirma 2 auf 3?", expectedTopic: "easyfirma2-auf-3" },
  { id: 7, q: "Kann ich von der Online-Version auf Desktop wechseln?", expectedTopic: "online-auf-desktop" },
  { id: 8, q: "Wie nehme ich die RKSV Registrierkasse in Betrieb?", expectedTopic: "rksv" },
  { id: 9, q: "Gibt es ein Tutorial oder Einführungsvideo?", expectedTopic: "tutorial" },
  { id: 10, q: "Ich habe einen neuen Computer, wie migriere ich meine Daten?", expectedTopic: "neuer-pc" },

  // Einstellungen (11-25)
  { id: 11, q: "Wie verwende ich die Aufmaßberechnung?", expectedTopic: "aufmassberechnung" },
  { id: 12, q: "Wie lösche ich die Demo-Daten?", expectedTopic: "demo-daten" },
  { id: 13, q: "Kann ich das Design der Benutzeroberfläche ändern?", expectedTopic: "design" },
  { id: 14, q: "Wie stelle ich 3 Kommastellen bei der Menge ein?", expectedTopic: "drei-kommastellen" },
  { id: 15, q: "Was sind freie Felder und wie nutze ich sie?", expectedTopic: "freie-felder" },
  { id: 16, q: "Wie arbeite ich mit Grids und Tabellen?", expectedTopic: "grid-tabellen" },
  { id: 17, q: "Wo trage ich IBAN und BIC ein?", expectedTopic: "iban-bic" },
  { id: 18, q: "Wie erhöhe ich die Kommastellen bei Beträgen?", expectedTopic: "kommastellen-betraege" },
  { id: 19, q: "Wie lade ich einen Kontenplan wie SKR03 oder SKR04?", expectedTopic: "kontenplan" },
  { id: 20, q: "Wie aktiviere ich das Lager in EasyFirma?", expectedTopic: "lager" },
  { id: 21, q: "Wie verwalte ich mehrere Mandanten?", expectedTopic: "mandanten" },
  { id: 22, q: "Wie erstelle ich ein Backup meiner Daten?", expectedTopic: "sicherungen" },
  { id: 23, q: "Wie richte ich die WooCommerce Schnittstelle ein?", expectedTopic: "woocommerce" },
  { id: 24, q: "Wie stelle ich Zahlungsziele ein?", expectedTopic: "zahlungsziele" },
  { id: 25, q: "Ich möchte meine Datenbank leeren, wie geht das?", expectedTopic: "demo-daten" },

  // MwSt. & Steuern (26-32)
  { id: 26, q: "Wie stelle ich EasyFirma auf Kleinunternehmerregelung um?", expectedTopic: "kleinunternehmer" },
  { id: 27, q: "Wie stelle ich 7% oder 10,7% MwSt für Landwirtschaft ein?", expectedTopic: "mwst-landwirtschaft" },
  { id: 28, q: "Was ist die OSS-Regelung und wie nutze ich sie?", expectedTopic: "oss-regelung" },
  { id: 29, q: "Wie funktioniert die Rappenrundung für die Schweiz?", expectedTopic: "rappenrundung" },
  { id: 30, q: "Wie erstelle ich Rechnungen ins Ausland mit Reverse Charge?", expectedTopic: "reverse-charge" },
  { id: 31, q: "Brauche ich als Kleinunternehmer MwSt auf der Rechnung?", expectedTopic: "kleinunternehmer" },
  { id: 32, q: "Wie funktioniert innergemeinschaftliche Lieferung?", expectedTopic: "reverse-charge" },

  // Rechnungen & Dokumente (33-46)
  { id: 33, q: "Wie kopiere ich ein Dokument oder wandle ein Angebot in eine Rechnung um?", expectedTopic: "dokument-kopieren" },
  { id: 34, q: "Kann ich Rechnungen auf Englisch erstellen?", expectedTopic: "invoice-english" },
  { id: 35, q: "Wie drucke ich einen Kassenbon?", expectedTopic: "kassenbon" },
  { id: 36, q: "Wie zeige ich die Lieferschein-Nummer auf der Rechnung an?", expectedTopic: "lieferschein-nummer" },
  { id: 37, q: "Wie weise ich Lohnkosten separat aus?", expectedTopic: "lohnkosten" },
  { id: 38, q: "Wie nutze ich die Mehrfachauswahl in der Umsatzübersicht?", expectedTopic: "mehrfachauswahl" },
  { id: 39, q: "Was ist eine Proforma-Rechnung und wie erstelle ich sie?", expectedTopic: "proforma" },
  { id: 40, q: "Wie erstelle ich eine Rechnung mit Skonto?", expectedTopic: "skonto" },
  { id: 41, q: "Wie erstelle ich eine Sammelrechnung?", expectedTopic: "sammelrechnung" },
  { id: 42, q: "Wie funktioniert eine Schlussrechnung?", expectedTopic: "schlussrechnung" },
  { id: 43, q: "Wie buche ich eine Teilzahlung oder Akonto?", expectedTopic: "teilzahlung" },
  { id: 44, q: "Kann ich wiederkehrende Rechnungen erstellen?", expectedTopic: "vertraege" },
  { id: 45, q: "Wie drucke ich Zahlscheine?", expectedTopic: "zahlscheine" },
  { id: 46, q: "Wie wandle ich ein Angebot in eine Rechnung um?", expectedTopic: "dokument-kopieren" },

  // Vorlagen & Texte (47-52)
  { id: 47, q: "Was ist der Alternativtext bei Angeboten?", expectedTopic: "alternativtext" },
  { id: 48, q: "Wie erweitere ich die Anreden in EasyFirma?", expectedTopic: "anreden" },
  { id: 49, q: "Wie nutze ich automatische Textersetzungen?", expectedTopic: "textersetzungen" },
  { id: 50, q: "Kann ich Dokumente farblich kategorisieren?", expectedTopic: "kategorisieren" },
  { id: 51, q: "Wie richte ich persönliche Anreden ein?", expectedTopic: "persoenliche-anreden" },
  { id: 52, q: "Welche Einheiten brauche ich für ZUGFeRD E-Rechnungen?", expectedTopic: "zugferd" },

  // Kunden & Produkte (53-58)
  { id: 53, q: "Wie lösche ich alle Produkte auf einmal?", expectedTopic: "alle-produkte-loeschen" },
  { id: 54, q: "Wie exportiere ich Kunden oder Artikel nach Excel?", expectedTopic: "export-excel" },
  { id: 55, q: "Was ist ein Debitorenkonto?", expectedTopic: "debitorenkonto" },
  { id: 56, q: "Wie ändere ich die Kundennummer?", expectedTopic: "kundennummer" },
  { id: 57, q: "Wie passe ich Preise an?", expectedTopic: "preise-anpassen" },
  { id: 58, q: "Was ist das Remarketing-Tool?", expectedTopic: "remarketing" },

  // Vorlagendesigner (59-64)
  { id: 59, q: "Wie ändere ich eine Vorlage?", expectedTopic: "vorlage-aendern" },
  { id: 60, q: "Wie zeige ich das Logo nur auf der ersten Seite?", expectedTopic: "logo-erste-seite" },
  { id: 61, q: "Wie füge ich einen Seitenzähler hinzu?", expectedTopic: "seitenzaehler" },
  { id: 62, q: "Wie füge ich ein Wasserzeichen ein?", expectedTopic: "wasserzeichen" },
  { id: 63, q: "Wie erstelle ich eine Rechnungskopie?", expectedTopic: "rechnungskopie" },
  { id: 64, q: "Wie importiere ich eine Vorlage?", expectedTopic: "vorlage-importieren" },

  // Problembehandlung (65-70)
  { id: 65, q: "EasyFirma startet nicht, was soll ich tun?", expectedTopic: "funktioniert-nicht" },
  { id: 66, q: "Fehler: Das Konfigurationssystem konnte nicht initialisiert werden", expectedTopic: "konfigurationssystem" },
  { id: 67, q: "Der E-Mail Versand funktioniert nicht", expectedTopic: "email-versand" },
  { id: 68, q: "Meine Oberfläche ist verschoben, was tun?", expectedTopic: "oberflaeche-verschoben" },
  { id: 69, q: "Nach einem Update sind meine Daten weg", expectedTopic: "daten-weg" },
  { id: 70, q: "Wie erstelle ich eine E-Rechnung in EasyFirma?", expectedTopic: "zugferd" },
];

interface TestResult {
  id: number;
  question: string;
  expectedTopic: string;
  answer: string;
  sources: { title: string; url: string | null; similarity: number }[];
  topSimilarity: number;
  answerLength: number;
  hasContent: boolean;
  latencyMs: number;
}

async function embedText(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return res.data[0].embedding;
}

async function runTestCase(tc: { id: number; q: string; expectedTopic: string }): Promise<TestResult> {
  const start = Date.now();

  // 1. Embed query
  const embedding = await embedText(tc.q);

  // 2. Vector search
  const { data: chunks } = await supabase.rpc("match_chunks", {
    query_embedding: embedding,
    match_threshold: 0.5,
    match_count: 5,
  });

  const sources = (chunks || []).map((c: any) => ({
    title: c.title,
    url: c.url || c.file_path,
    similarity: c.similarity,
  }));

  // 3. Build context
  const contextParts = (chunks || []).slice(0, 3).map(
    (c: any, i: number) => `[Quelle ${i + 1}: ${c.title}]\n${c.content}`
  );
  const context = contextParts.join("\n\n---\n\n");

  const systemPrompt = `Du bist der offizielle Support-Assistent für EasyFirma, ein Rechnungsprogramm für kleine Unternehmen in Deutschland, Österreich und der Schweiz.

Regeln:
- Antworte auf Deutsch in der Sie-Form
- Nutze den bereitgestellten Kontext um die Frage bestmöglich zu beantworten
- Wenn der Kontext die Frage nicht vollständig beantwortet, gib die verfügbaren Informationen und erwähne kurz, dass für weiterführende Details der EasyFirma-Support kontaktiert werden kann
- Nenne KEINE E-Mail-Adressen oder Telefonnummern in deiner Antwort
- Zitiere KEINE Quellen im Antworttext
- Halte Antworten präzise mit Schritt-für-Schritt-Anleitungen wenn passend
- Formatiere Antworten gut lesbar mit Markdown

=== KONTEXT ===
${context || "Kein relevanter Kontext gefunden."}
=== ENDE KONTEXT ===`;

  // 4. Get Claude response
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: tc.q }],
  });

  const answer = response.content[0].type === "text" ? response.content[0].text : "";
  const latencyMs = Date.now() - start;

  return {
    id: tc.id,
    question: tc.q,
    expectedTopic: tc.expectedTopic,
    answer,
    sources,
    topSimilarity: sources.length > 0 ? sources[0].similarity : 0,
    answerLength: answer.length,
    hasContent: answer.length > 50 && !answer.includes("keine Informationen"),
    latencyMs,
  };
}

async function main() {
  console.log("Starting RAG test suite: 70 cases\n");
  console.log("=".repeat(60));

  const results: TestResult[] = [];
  const batchSize = 5; // 5 concurrent requests

  for (let i = 0; i < TEST_CASES.length; i += batchSize) {
    const batch = TEST_CASES.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(runTestCase));
    results.push(...batchResults);

    for (const r of batchResults) {
      const status = r.hasContent ? "OK" : "FAIL";
      const sim = (r.topSimilarity * 100).toFixed(0);
      console.log(
        `[${status}] #${r.id} (${sim}% sim, ${r.latencyMs}ms) ${r.question.slice(0, 50)}`
      );
    }
  }

  // Summary stats
  const passed = results.filter((r) => r.hasContent).length;
  const failed = results.filter((r) => !r.hasContent).length;
  const avgSim = results.reduce((s, r) => s + r.topSimilarity, 0) / results.length;
  const avgLatency = results.reduce((s, r) => s + r.latencyMs, 0) / results.length;
  const lowSim = results.filter((r) => r.topSimilarity < 0.6);

  console.log("\n" + "=".repeat(60));
  console.log(`RESULTS: ${passed}/70 passed, ${failed}/70 failed`);
  console.log(`Avg similarity: ${(avgSim * 100).toFixed(1)}%`);
  console.log(`Avg latency: ${avgLatency.toFixed(0)}ms`);
  console.log(`Low similarity (<60%): ${lowSim.length} cases`);

  if (lowSim.length > 0) {
    console.log("\nLow similarity cases:");
    for (const r of lowSim) {
      console.log(`  #${r.id} (${(r.topSimilarity * 100).toFixed(0)}%) ${r.question}`);
      console.log(`    Sources: ${r.sources.map(s => s.title).join(", ") || "NONE"}`);
    }
  }

  if (failed > 0) {
    console.log("\nFailed cases:");
    for (const r of results.filter((r) => !r.hasContent)) {
      console.log(`  #${r.id} ${r.question}`);
      console.log(`    Answer preview: ${r.answer.slice(0, 100)}...`);
    }
  }

  // Write full results to JSON
  writeFileSync(
    "/Users/achisumma/easyfirma-rag/test-results.json",
    JSON.stringify(results, null, 2)
  );
  console.log("\nFull results written to test-results.json");
}

main().catch(console.error);
