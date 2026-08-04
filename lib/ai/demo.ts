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
        title: "Monthly cash flow",
        viz: "line",
        value: "$18.4M",
        caption: "6-month average",
        delta: 12.4,
        deltaLabel: "vs. prior quarter",
        trend: "ok",
        insight:
          "The increase comes from releasing reserves at Hudson Point and collecting open balances from two institutional tenants in full.",
        series: [
          { label: "Feb", value: 13.1 },
          { label: "Mar", value: 12.4 },
          { label: "Apr", value: 14.8 },
          { label: "May", value: 15.2 },
          { label: "Jun", value: 16.9 },
          { label: "Jul", value: 18.4 },
        ],
      },
      {
        id: "budget-variance",
        title: "Budget savings by project",
        viz: "bar",
        value: "12 projects",
        caption: "all under estimate",
        delta: 8.2,
        deltaLabel: "vs. last month",
        trend: "ok",
        insight:
          "Fairmount Yards is running 9.4% under the original estimate, mostly on materials pricing and a shorter schedule.",
        series: [
          { label: "Fairmount Yards · multifamily", value: 9.4 },
          { label: "Hudson Point · office", value: 4.1 },
          { label: "Brightline Commons · industrial", value: 3.3 },
          { label: "Cordova · hospitality", value: 1.8 },
        ],
      },
      {
        id: "portfolio-mix",
        title: "Portfolio mix",
        viz: "donut",
        value: "$1.24B",
        caption: "estimated book value",
        delta: 2.1,
        deltaLabel: "year to date",
        trend: "neutral",
        insight:
          "Stabilized assets gained weight after Hudson Point leased up, and development exposure fell below 30% — the steadiest the portfolio has been since 2024.",
        series: [
          { label: "Stabilized · office", value: 42 },
          { label: "Stabilized · retail", value: 24 },
          { label: "Development", value: 28 },
          { label: "Land", value: 6 },
        ],
      },
    ],
  };
}
