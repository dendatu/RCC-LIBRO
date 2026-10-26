import type { RoleSlug } from "./types";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  description: string;
  roles: RoleSlug[];
  /** Highlighted as the primary action for the role. */
  primary?: boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

const STAFF: RoleSlug[] = ["librarian", "admin"];
const ALL: RoleSlug[] = ["borrower", "librarian", "admin"];

/**
 * Single source of truth for the sidebar, the mobile drawer, the command
 * palette and the dashboard shortcuts. Route names here must match pages
 * under src/app/dashboard/.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "My library",
    items: [
      { href: "/dashboard", label: "Overview", icon: "LayoutDashboard", description: "Loans, due dates and reminders", roles: ALL, primary: true },
      { href: "/dashboard/borrowings", label: "My borrowings", icon: "BookOpenCheck", description: "Active loans and due dates", roles: ALL },
      { href: "/dashboard/sbtr", label: "My SBTR", icon: "ScrollText", description: "Digital Student Book Tracer Record", roles: ALL },
      { href: "/dashboard/history", label: "Transaction history", icon: "History", description: "Everything borrowed, exportable to PDF", roles: ALL },
      { href: "/dashboard/penalties", label: "Fines & penalties", icon: "CircleDollarSign", description: "Assessed fines and settlement status", roles: ALL },
      { href: "/dashboard/reservations", label: "Reservations", icon: "BookMarked", description: "Titles held or queued for you", roles: ALL },
      { href: "/dashboard/card", label: "Library card", icon: "IdCard", description: "QR-coded borrower card", roles: ALL },
      { href: "/dashboard/profile", label: "My profile", icon: "UserRound", description: "Classification, SBTR and contact details", roles: ALL },
      { href: "/dashboard/notifications", label: "Notifications", icon: "Bell", description: "Reminders and account messages", roles: ALL },
    ],
  },
  {
    title: "Find a book",
    items: [
      { href: "/dashboard/catalog", label: "Catalogue", icon: "Library", description: "Every title across the three branches", roles: ALL, primary: true },
      { href: "/opac", label: "Public catalogue (OPAC)", icon: "Search", description: "Open public access catalogue search", roles: ALL },
      { href: "/dashboard/new-arrivals", label: "New arrivals", icon: "Sparkles", description: "Recently acquired titles", roles: ALL },
      { href: "/dashboard/recommendations", label: "Recommendations", icon: "WandSparkles", description: "Picked from your borrowing history", roles: ALL },
    ],
  },
  {
    title: "Circulation desk",
    items: [
      { href: "/dashboard/circulation", label: "Issue books", icon: "ScanBarcode", description: "Record a borrow transaction by barcode", roles: STAFF, primary: true },
      { href: "/dashboard/returns", label: "Return desk", icon: "Undo2", description: "Check in books and assess fines", roles: STAFF },
      { href: "/dashboard/members", label: "Borrower records", icon: "Users", description: "SBTR, standing and eligibility", roles: STAFF },
      { href: "/dashboard/fines", label: "Fine management", icon: "Calculator", description: "Settle, waive and audit penalties", roles: STAFF },
      { href: "/dashboard/requests", label: "Reservation queue", icon: "Hourglass", description: "Hold shelf and queue positions", roles: STAFF },
    ],
  },
  {
    title: "Collection management",
    items: [
      { href: "/dashboard/catalog/new", label: "Add a title", icon: "Plus", description: "Catalogue a book and print its QR card", roles: STAFF },
      { href: "/dashboard/inventory", label: "Inventory & copies", icon: "Boxes", description: "Physical copies, shelf location, condition", roles: STAFF },
      { href: "/dashboard/qr", label: "QR code studio", icon: "QrCode", description: "Generate, print and batch QR labels", roles: STAFF },
      { href: "/dashboard/reports", label: "Reports", icon: "FileSpreadsheet", description: "Circulation and holdings exports", roles: STAFF },
      { href: "/dashboard/analytics", label: "Analytics", icon: "LineChart", description: "Borrowing trends, popular titles and branch usage", roles: STAFF },
    ],
  },
  {
    title: "Administration",
    items: [
      { href: "/dashboard/admin", label: "Admin console", icon: "ShieldCheck", description: "System overview for administrators", roles: ["admin"], primary: true },
      { href: "/dashboard/admin/users", label: "Users & roles", icon: "UserCog", description: "Assign librarian or administrator roles", roles: ["admin"] },
      { href: "/dashboard/admin/settings", label: "Policy settings", icon: "Settings", description: "Loan limits, due rules and fine rates", roles: ["admin"] },
      { href: "/dashboard/admin/email", label: "E-mail centre", icon: "MailWarning", description: "Reminder queue and delivery journal", roles: ["admin"] },
      { href: "/dashboard/admin/logs", label: "Audit trail", icon: "ScrollText", description: "Every privileged action, newest first", roles: ["admin"] },
      { href: "/dashboard/admin/branches", label: "Branches & categories", icon: "Building2", description: "Library branches and subject categories", roles: ["admin"] },
    ],
  },
];

export function navForMember(roles: RoleSlug[]): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.some((role) => roles.includes(role))),
  })).filter((group) => group.items.length > 0);
}

export function primaryHref(role: RoleSlug) {
  if (role === "admin") return "/dashboard/admin";
  if (role === "librarian") return "/dashboard/circulation";
  return "/dashboard";
}
