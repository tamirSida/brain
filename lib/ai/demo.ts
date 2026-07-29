import type { Brief } from "./schemas";


/**
 * Deterministic sample brief, used only when ANTHROPIC_API_KEY is absent so the
 * mock is clickable out of the box. With a key set, the model generates this.
 */
export function demoBrief(): Brief {
  return {
    metrics: [
      {
        id: "cash-flow",
        title: "תזרים מזומנים חודשי",
        viz: "line",
        value: "₪18.4M",
        caption: "ממוצע 6 חודשים",
        delta: 12.4,
        deltaLabel: "מול הרבעון הקודם",
        trend: "ok",
        insight:
          "העלייה נובעת משחרור בטוחות בפרויקט הרצליה ומגבייה מלאה של יתרות פתוחות משני שוכרים מוסדיים.",
        series: [
          { label: "פבר", value: 13.1 },
          { label: "מרץ", value: 12.4 },
          { label: "אפר", value: 14.8 },
          { label: "מאי", value: 15.2 },
          { label: "יוני", value: 16.9 },
          { label: "יולי", value: 18.4 },
        ],
      },
      {
        id: "budget-variance",
        title: "חיסכון תקציבי לפי פרויקט",
        viz: "bar",
        value: "12 פרויקטים",
        caption: "כולם מתחת לאומדן",
        delta: 8.2,
        deltaLabel: "מול החודש שעבר",
        trend: "ok",
        insight:
          "רמת גן חוסכת 9.4% מול האומדן המקורי, בעיקר מהוזלת חומרי גלם ומקיצור לוח הזמנים.",
        series: [
          { label: "רמת גן · מגורים", value: 9.4 },
          { label: "הרצליה · משרדים", value: 4.1 },
          { label: "פתח תקווה · לוגיסטי", value: 3.3 },
          { label: "ראשל״צ · מסחר", value: 1.8 },
        ],
      },
      {
        id: "portfolio-mix",
        title: "תמהיל תיק הנכסים",
        viz: "donut",
        value: "₪1.24B",
        caption: "שווי מאזני מוערך",
        delta: 2.1,
        deltaLabel: "מתחילת השנה",
        trend: "neutral",
        insight:
          "משקל הנכסים המניבים עלה לאחר אכלוס הרצליה, וחשיפת הייזום ירדה מתחת ל-30% — התיק היציב ביותר מאז 2024.",
        series: [
          { label: "מניב · משרדים", value: 42 },
          { label: "מניב · מסחר", value: 24 },
          { label: "ייזום", value: 28 },
          { label: "קרקע", value: 6 },
        ],
      },
    ],
  };
}
