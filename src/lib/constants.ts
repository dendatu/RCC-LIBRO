import type {
  BorrowerType,
  CirculationSection,
  CollegeProgram,
  CopyStatus,
  EducationLevel,
  FacultyDepartment,
  BookStatus,
  RoleSlug,
  SeniorHighTrack,
} from "./types";

export const APP_NAME = "RCC LIBRO";
export const APP_TAGLINE = "Library Inventory and Book Recording Organizer";
export const INSTITUTION = "Republic Central Colleges — Angeles City Campus";

export const PUBLIC_NAV = [
  { href: "/catalog", label: "Catalog" },
  { href: "/policies", label: "Policies" },
  { href: "/about", label: "About" },
];

export const ROLE_LABEL: Record<RoleSlug, string> = {
  borrower: "Borrower",
  librarian: "Librarian",
  admin: "Administrator",
};

export const LIBRARY_BRANCHES = [
  { code: "EL", name: "Elementary Library" },
  { code: "HS", name: "High School Library" },
  { code: "CGS", name: "College and Graduate School Library" },
] as const;

/** Circulation sections and the rules the UI must surface to staff. */
export const SECTION_META: Record<
  CirculationSection,
  { label: string; group: string; rule: string; borrowable: boolean; hue: string }
> = {
  general: {
    label: "General Collection",
    group: "Circulation",
    rule: "3 books · 7 days · PHP 1.00 per day overdue",
    borrowable: true,
    hue: "bg-brand-100 text-brand-800",
  },
  filipiniana: {
    label: "Filipiniana",
    group: "Circulation",
    rule: "3 books · 7 days · PHP 1.00 per day overdue",
    borrowable: true,
    hue: "bg-gold-soft text-brand-900",
  },
  home_reading: {
    label: "Home Reading Books",
    group: "Circulation",
    rule: "3 books · 7 days · PHP 1.00 per day overdue",
    borrowable: true,
    hue: "bg-brand-50 text-brand-700",
  },
  fiction: {
    label: "Fiction",
    group: "Circulation",
    rule: "3 books · 7 days · PHP 1.00 per day overdue",
    borrowable: true,
    hue: "bg-brand-100 text-brand-800",
  },
  newly_acquired: {
    label: "Newly Acquired Books",
    group: "Circulation",
    rule: "Shown on the new-arrivals shelf first; standard loan rules apply.",
    borrowable: true,
    hue: "bg-gold-soft text-brand-900",
  },
  reserve: {
    label: "Reserve Books",
    group: "Circulation",
    rule: "1 hour in-library · take-home allowed from 4PM, due next school day · PHP 2.00 per hour overdue",
    borrowable: true,
    hue: "bg-warning/15 text-warning",
  },
  research_output: {
    label: "Research Output",
    group: "Circulation",
    rule: "Consultation loan with librarian approval.",
    borrowable: true,
    hue: "bg-info/10 text-info",
  },
  reference: {
    label: "Reference Section",
    group: "Reference",
    rule: "Dictionaries, encyclopedias, atlases — library use only.",
    borrowable: false,
    hue: "bg-brand-200 text-brand-900",
  },
  periodicals: {
    label: "Periodicals",
    group: "Periodicals",
    rule: "Magazines, newspapers, journals, clippings — library use only.",
    borrowable: false,
    hue: "bg-muted text-muted-foreground",
  },
};

export const SECTION_ORDER = Object.keys(SECTION_META) as CirculationSection[];

export const EDUCATION_LEVELS: { value: EducationLevel; label: string; group: string }[] = [
  { value: "kinder", label: "Kinder", group: "Elementary" },
  { value: "grade_1", label: "Grade 1", group: "Elementary" },
  { value: "grade_2", label: "Grade 2", group: "Elementary" },
  { value: "grade_3", label: "Grade 3", group: "Elementary" },
  { value: "grade_4", label: "Grade 4", group: "Elementary" },
  { value: "grade_5", label: "Grade 5", group: "Elementary" },
  { value: "grade_6", label: "Grade 6", group: "Elementary" },
  { value: "grade_7", label: "Grade 7", group: "Junior High" },
  { value: "grade_8", label: "Grade 8", group: "Junior High" },
  { value: "grade_9", label: "Grade 9", group: "Junior High" },
  { value: "grade_10", label: "Grade 10", group: "Junior High" },
  { value: "grade_11", label: "Grade 11", group: "Senior High" },
  { value: "grade_12", label: "Grade 12", group: "Senior High" },
  { value: "college_1st_year", label: "1st Year", group: "College" },
  { value: "college_2nd_year", label: "2nd Year", group: "College" },
  { value: "college_3rd_year", label: "3rd Year", group: "College" },
  { value: "college_4th_year", label: "4th Year", group: "College" },
  { value: "graduate", label: "Graduate School", group: "Graduate" },
];

/** Picker group headings, in the order they appear in EDUCATION_LEVELS. */
export const LEVEL_GROUPS: string[] = Array.from(
  new Set(EDUCATION_LEVELS.map((level) => level.group)),
);

/**
 * Level predicates. Pickers hold a sentinel string ("not chosen") rather than an
 * `EducationLevel`, so these take any string and answer false for the rest.
 */
export function isSeniorHighLevel(level: string | null | undefined): boolean {
  return level === "grade_11" || level === "grade_12";
}

const COLLEGE_YEAR_LEVELS: EducationLevel[] = [
  "college_1st_year",
  "college_2nd_year",
  "college_3rd_year",
  "college_4th_year",
];

export function isCollegeLevel(level: string | null | undefined): boolean {
  return COLLEGE_YEAR_LEVELS.some((value) => value === level);
}

/**
 * Senior high learners carry a track; college and graduate learners carry a
 * programme. A basic-education level stands on its own.
 */
export function levelNeedsProgramme(level: string | null | undefined): boolean {
  return isCollegeLevel(level) || level === "graduate";
}

export const SENIOR_HIGH_TRACKS: { value: SeniorHighTrack; label: string }[] = [
  { value: "pba", label: "PBA — Accountancy and Business" },
  { value: "ssh", label: "SSH — Science, Technology and Society" },
  { value: "peat", label: "PEAT — Engineering, Applied and Technology" },
  { value: "phs", label: "PHS — Health and Service Management" },
];

export const COLLEGE_PROGRAMS: { value: CollegeProgram; label: string }[] = [
  { value: "abel", label: "ABEL — Bachelor of Elementary Education" },
  { value: "bsa", label: "BSA — Bachelor of Science in Accountancy" },
  { value: "bsce", label: "BSCE — Bachelor of Science in Civil Engineering" },
  { value: "bsit", label: "BSIT — Bachelor of Science in Information Technology" },
  { value: "bsba", label: "BSBA — Bachelor of Science in Business Administration" },
  { value: "bshm", label: "BSHM — Bachelor of Science in Hospitality Management" },
  { value: "bstm", label: "BSTM — Bachelor of Science in Tourism Management" },
  { value: "beed", label: "BEED — Bachelor of Elementary Education" },
  { value: "bsed_english", label: "BSED English — Bachelor of Secondary Education" },
  { value: "bsed_mathematics", label: "BSED Mathematics — Bachelor of Secondary Education" },
  { value: "bsed_filipino", label: "BSED Filipino — Bachelor of Secondary Education" },
  { value: "graduate_school", label: "Graduate School" },
];

export const FACULTY_DEPARTMENTS: { value: FacultyDepartment; label: string }[] = [
  { value: "elementary", label: "Elementary" },
  { value: "high_school", label: "High School" },
  { value: "college", label: "College" },
  { value: "graduate_school", label: "Graduate School" },
];

export const BORROWER_TYPES: { value: BorrowerType; label: string }[] = [
  { value: "student", label: "Student" },
  { value: "faculty", label: "Faculty" },
];

export const COPY_STATUS_LABEL: Record<CopyStatus, string> = {
  available: "Available",
  borrowed: "Borrowed",
  reserved: "Reserved",
  damaged: "Damaged",
  lost: "Lost",
  processing: "Processing",
  maintenance: "Under Maintenance",
};

export const BOOK_STATUS_LABEL: Record<BookStatus, string> = {
  available: "Available",
  borrowed: "Borrowed",
  reserved: "Reserved",
  damaged: "Damaged",
  lost: "Lost",
  processing: "Processing",
};

export const STATUS_TONE: Record<string, string> = {
  available: "bg-success/12 text-success",
  borrowed: "bg-info/12 text-info",
  reserved: "bg-gold-soft text-brand-900",
  damaged: "bg-warning/15 text-warning",
  lost: "bg-danger/12 text-danger",
  processing: "bg-muted text-muted-foreground",
  active: "bg-info/12 text-info",
  overdue: "bg-danger/12 text-danger",
  returned: "bg-success/12 text-success",
  cancelled: "bg-muted text-muted-foreground",
  pending: "bg-warning/15 text-warning",
  paid: "bg-success/12 text-success",
  waived: "bg-muted text-muted-foreground",
  waiting: "bg-gold-soft text-brand-900",
  ready: "bg-success/12 text-success",
  fulfilled: "bg-info/12 text-info",
  expired: "bg-muted text-muted-foreground",
  suspended: "bg-danger/12 text-danger",
};

/** Copy of the server-side policy, used only for friendly pre-flight messaging. */
export const POLICY = {
  maxBooks: 3,
  loanDays: 7,
  finePerDay: 1,
  reserveFinePerHour: 2,
  reserveMinutes: 60,
  reserveTakeHomeHour: 16,
  fineBlockThreshold: 100,
  reminderLeadDays: [7, 3, 1],
} as const;

export const POLICY_SUMMARY = [
  {
    title: "Student Book Tracer Record",
    body: "Every student must hold an active SBTR before a loan is released. Faculty borrow against their department ID.",
  },
  {
    title: "Three books, seven days",
    body: "A borrower may hold at most three titles at a time for seven days, including weekends and holidays.",
  },
  {
    title: "PHP 1.00 per day late",
    body: "Overdue fines accrue daily for the general, Filipiniana, home reading and fiction collections.",
  },
  {
    title: "Reserve books: one hour",
    body: "Reserve titles are for one hour of in-library use. Borrowed from 4PM they are due the next school day, at PHP 2.00 per overdue hour.",
  },
  {
    title: "Reference and periodicals stay in",
    body: "Dictionaries, encyclopedias, atlases, magazines, newspapers and journals are for library use only.",
  },
  {
    title: "Unresolved penalties stop borrowing",
    body: "Accounts with overdue loans or unsettled fines are held at the desk until the record is cleared.",
  },
];

export function labelFor<T extends string>(
  list: { value: T; label: string }[],
  value: T | null | undefined,
): string {
  if (!value) return "—";
  return list.find((item) => item.value === value)?.label ?? value;
}

export function classificationLabel(profile: {
  borrower_type?: BorrowerType | null;
  education_level?: EducationLevel | null;
  college_program?: CollegeProgram | null;
  faculty_department?: FacultyDepartment | null;
  senior_high_track?: SeniorHighTrack | null;
  section?: string | null;
}): string {
  if (!profile.borrower_type) return "Unclassified member";
  if (profile.borrower_type === "faculty") {
    return `${labelFor(FACULTY_DEPARTMENTS, profile.faculty_department)} — Faculty`;
  }
  const level = profile.education_level;
  // With no level recorded — or at the graduate school — the programme is the
  // whole classification.
  if (!level || level === "graduate") {
    return labelFor(COLLEGE_PROGRAMS, profile.college_program);
  }
  const qualifier = isSeniorHighLevel(level)
    ? profile.senior_high_track
      ? ` · ${labelFor(SENIOR_HIGH_TRACKS, profile.senior_high_track).split(" — ")[0]}`
      : ""
    : isCollegeLevel(level) && profile.college_program
      ? ` · ${labelFor(COLLEGE_PROGRAMS, profile.college_program).split(" — ")[0]}`
      : "";
  return `${labelFor(EDUCATION_LEVELS, level)}${profile.section ? ` ${profile.section}` : ""}${qualifier}`;
}
