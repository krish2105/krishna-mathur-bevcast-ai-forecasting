import type { LucideIcon } from "lucide-react";
import {
  BookOpenCheck,
  Bot,
  ClipboardList,
  Database,
  FileDown,
  FlaskConical,
  Gauge,
  Info,
  Lightbulb,
  LineChart,
  Radio,
  Sigma,
  Trophy,
} from "lucide-react";

export interface NavItem {
  href: string;
  title: string;
  short: string;
  description: string;
  icon: LucideIcon;
  group: "Overview" | "Part 1" | "Part 2" | "AI & live" | "Reference";
}

export const NAV: NavItem[] = [
  { href: "/", title: "Overview", short: "Overview", description: "Headline results, forecast and AI executive summary", icon: Gauge, group: "Overview" },
  { href: "/assignment", title: "Brief & Compliance", short: "Brief", description: "Transcribed slides and the requirement-by-requirement compliance matrix", icon: ClipboardList, group: "Overview" },
  { href: "/lab-air-coolers", title: "Part 1 · Air-Cooler Lab", short: "Air coolers", description: "Naïve vs Random Forest vs weather-adjusted regression, MAPE and WAPE", icon: FlaskConical, group: "Part 1" },
  { href: "/data", title: "Data Workspace", short: "Data", description: "Reference dataset, data-quality report and CSV upload", icon: Database, group: "Part 2" },
  { href: "/analysis", title: "Sales Analysis", short: "Analysis", description: "Trend, decomposition, seasonal index and year-on-year growth", icon: LineChart, group: "Part 2" },
  { href: "/forecasting", title: "Forecasting Lab", short: "Forecasting", description: "Train, evaluate and forecast the next 3 months", icon: Sigma, group: "Part 2" },
  { href: "/models", title: "Model Comparison", short: "Models", description: "Leaderboard, backtest, residuals and seasonal-shape capture", icon: Trophy, group: "Part 2" },
  { href: "/insights", title: "Insights & Planning", short: "Insights", description: "Task 7 answers, first-year scenario and production plan", icon: Lightbulb, group: "Part 2" },
  { href: "/copilot", title: "BevCast AI Copilot", short: "Copilot", description: "Tool-calling LLM grounded on the app's data", icon: Bot, group: "AI & live" },
  { href: "/live", title: "Real-Time Signals", short: "Live", description: "Live FRED release and Open-Meteo 16-day outlook", icon: Radio, group: "AI & live" },
  { href: "/reports", title: "Reports", short: "Reports", description: "CSV downloads and a printable report", icon: FileDown, group: "Reference" },
  { href: "/methodology", title: "Methodology & Sources", short: "Methodology", description: "Formulas, validation design, models, sources and limitations", icon: BookOpenCheck, group: "Reference" },
  { href: "/about", title: "About", short: "About", description: "Student, course, project and tech stack", icon: Info, group: "Reference" },
];

export const NAV_GROUPS = ["Overview", "Part 1", "Part 2", "AI & live", "Reference"] as const;

export function navFor(pathname: string): NavItem | undefined {
  return NAV.find((n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)));
}

export const STUDENT = {
  name: "Krishna Mathur",
  roll: "AS25DXB018",
  programme: "MAIB",
  batch: "September 2025",
  institution: "SP Jain School of Global Management",
  subject: "AI in Operations",
  assignment: "Problems and Exercises: Session II Lab Activity and Exercise",
  instructor: "Dr. Sandip Kumar Roy",
} as const;

export const FOOTER_LINE = `${STUDENT.name} · ${STUDENT.roll} · ${STUDENT.programme} ${STUDENT.batch} · AI in Operations: Problems and Exercises`;

export const LINKS = {
  colab: "https://colab.research.google.com/drive/12kKbww0iyfHnJuMq4U2py4VnVYjP-Gcy",
  github: "https://github.com/krish2105/krishna-mathur-bevcast-ai-forecasting",
  notebookDownload: "/downloads/Krishna_Mathur_AS25DXB018_AI_in_Operations_Problems_and_Exercises.ipynb",
} as const;

