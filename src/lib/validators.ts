import { z } from "zod";

import { isCollegeLevel, isSeniorHighLevel, levelNeedsProgramme } from "./constants";

/** HTML checkboxes arrive as true/false strings through FormData. */
export const booleanField = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

/** A comma-separated input or an array both coerce to a number list. */
const numberListField = z.union([
  z.array(z.coerce.number().int().min(0).max(60)),
  z.string().transform((value) =>
    value.split(',').map((part) => Number(part.trim())).filter((n) => Number.isFinite(n)),
  ),
]);

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Passwords may not exceed 72 characters")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");

const rccEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid e-mail address")
  .max(160);

export const loginSchema = z.object({
  email: rccEmail,
  password: z.string().min(1, "Enter your password"),
});

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name").max(160),
    email: rccEmail,
    password: passwordSchema,
    confirmPassword: z.string(),
    contactNumber: z
      .string()
      .trim()
      .max(24)
      .optional()
      .or(z.literal(""))
      .refine((v) => !v || /^[+0-9][0-9\s()-]{6,23}$/.test(v), {
        message: "Use a valid mobile or landline number",
      }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const forgotSchema = z.object({ email: rccEmail });

export const resetSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// ---------------------------------------------------------------------------
// Borrower profile / SBTR
// ---------------------------------------------------------------------------
const levelSchema = z.enum([
  "kinder", "grade_1", "grade_2", "grade_3", "grade_4", "grade_5", "grade_6",
  "grade_7", "grade_8", "grade_9", "grade_10", "grade_11", "grade_12",
  "college_1st_year", "college_2nd_year", "college_3rd_year", "college_4th_year", "graduate",
]);
const trackSchema = z.enum(["pba", "ssh", "peat", "phs"]);
const programSchema = z.enum([
  "abel", "bsa", "bsce", "bsit", "bsba", "bshm", "bstm", "beed",
  "bsed_english", "bsed_mathematics", "bsed_filipino", "graduate_school",
]);
const departmentSchema = z.enum(["elementary", "high_school", "college", "graduate_school"]);

export const profileSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name").max(160),
    contactNumber: z.string().trim().max(24).optional().or(z.literal("")),
    borrowerType: z.enum(["student", "faculty"]),
    educationLevel: levelSchema.optional(),
    seniorHighTrack: trackSchema.optional(),
    collegeProgram: programSchema.optional(),
    facultyDepartment: departmentSchema.optional(),
    section: z.string().trim().max(32).optional().or(z.literal("")),
    idNumber: z.string().trim().max(32).optional().or(z.literal("")),
    sbtrNumber: z.string().trim().max(32).optional().or(z.literal("")),
    enrollmentYear: z.coerce
      .number()
      .int()
      .min(1990)
      .max(2100)
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.borrowerType === "student" && !data.educationLevel && !data.collegeProgram) {
      ctx.addIssue({
        code: "custom",
        message: "Select your level or programme",
        path: ["educationLevel"],
      });
    }
    if (data.borrowerType === "faculty" && !data.facultyDepartment) {
      ctx.addIssue({
        code: "custom",
        message: "Select your department",
        path: ["facultyDepartment"],
      });
    }
    if (isSeniorHighLevel(data.educationLevel)) {
      if (!data.seniorHighTrack) {
        ctx.addIssue({
          code: "custom",
          message: "Senior high learners must pick a track",
          path: ["seniorHighTrack"],
        });
      }
    } else if (levelNeedsProgramme(data.educationLevel) && !data.collegeProgram) {
      ctx.addIssue({
        code: "custom",
        message: isCollegeLevel(data.educationLevel)
          ? "Select your course"
          : "Select the graduate programme",
        path: ["collegeProgram"],
      });
    }
  });

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------
export const sectionSchema = z.enum([
  "general", "filipiniana", "home_reading", "fiction", "newly_acquired",
  "reserve", "research_output", "reference", "periodicals",
]);

export const bookSchema = z.object({
  accessionNumber: z.string().trim().min(3, "Accession number is required").max(64),
  callNumber: z.string().trim().min(1, "Call number is required").max(64),
  isbn: z
    .string()
    .trim()
    .max(20)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^(?:\d[\d-]{9,15}[\dXx])$/.test(v.replace(/\s/g, "")), {
      message: "Enter a valid ISBN-10 or ISBN-13",
    }),
  title: z.string().trim().min(1, "Title is required").max(240),
  author: z.string().trim().min(1, "Author is required").max(200),
  subject: z.string().trim().max(200).optional().or(z.literal("")),
  publisher: z.string().trim().max(200).optional().or(z.literal("")),
  publicationYear: z.coerce.number().int().min(1400).max(2200).optional(),
  edition: z.string().trim().max(48).optional().or(z.literal("")),
  language: z.string().trim().max(48).default("English"),
  categoryId: z.coerce.number().int().positive().optional(),
  libraryId: z.coerce.number().int().positive("Select the owning branch"),
  section: sectionSchema,
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  coverImageUrl: z.string().trim().max(500).optional().or(z.literal("")),
  copyCount: z.coerce.number().int().min(0).max(50).default(1),
  acquisitionPrice: z.coerce.number().min(0).max(1_000_000).optional(),
  isPublished: booleanField,
});

export const bookFilterSchema = z.object({
  q: z.string().trim().max(120).optional().or(z.literal("")),
  library: z.coerce.number().int().positive().optional(),
  section: sectionSchema.optional(),
  category: z.coerce.number().int().positive().optional(),
  status: z.enum(["available", "borrowed", "reserved", "damaged", "lost", "processing"]).optional(),
  availableOnly: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(6).max(60).default(12),
});

export const copySchema = z.object({
  bookId: z.string().uuid(),
  count: z.coerce.number().int().min(1).max(50).default(1),
  shelfLocation: z.string().trim().max(120).optional().or(z.literal("")),
  condition: z.string().trim().max(60).default("Good"),
  acquisitionPrice: z.coerce.number().min(0).max(1_000_000).optional(),
});

export const copyUpdateSchema = z.object({
  copyId: z.string().uuid(),
  status: z.enum(["available", "borrowed", "reserved", "damaged", "lost", "maintenance"]),
  condition: z.string().trim().max(60).optional(),
  shelfLocation: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

// ---------------------------------------------------------------------------
// Circulation
// ---------------------------------------------------------------------------
export const borrowSchema = z.object({
  borrowerId: z.string().uuid("Select a borrower"),
  barcode: z.string().trim().min(3, "Scan or type the copy barcode").max(64),
  days: z.coerce.number().int().min(1).max(60).optional(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const returnSchema = z.object({
  transactionId: z.string().uuid(),
  condition: z.enum(["good", "damaged", "lost"]).default("good"),
  remarks: z.string().trim().max(500).optional().or(z.literal("")),
});

export const extendSchema = z.object({
  transactionId: z.string().uuid(),
  days: z.coerce.number().int().min(1).max(60).default(7),
});

export const fineActionSchema = z.object({
  fineId: z.string().uuid(),
  paidVia: z.enum(["cash", "online", "counter", "waiver"]).default("cash"),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export const reservationSchema = z.object({ bookId: z.string().uuid() });

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------
export const userAdminSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["borrower", "librarian", "admin"]),
  isActive: booleanField,
  borrowerType: z.enum(["student", "faculty"]).optional(),
  educationLevel: levelSchema.optional(),
  collegeProgram: programSchema.optional(),
  facultyDepartment: departmentSchema.optional(),
  sbtrNumber: z.string().trim().max(32).optional().or(z.literal("")),
  borrowingLimit: z.coerce.number().int().min(0).max(20).optional(),
});

export const settingsSchema = z.object({
  maxBooks: z.coerce.number().int().min(1).max(20),
  loanDays: z.coerce.number().int().min(1).max(90),
  finePerDay: z.coerce.number().min(0).max(1000),
  reserveFinePerHour: z.coerce.number().min(0).max(1000),
  reserveMinutes: z.coerce.number().int().min(5).max(480),
  reserveTakeHomeHour: z.coerce.number().int().min(0).max(23),
  fineBlockThreshold: z.coerce.number().min(0).max(100000),
  reminderDays: numberListField.refine((v) => v.length >= 1 && v.length <= 6, {
    message: 'Provide between 1 and 6 reminder lead days',
  }),
  referenceLibraryOnly: booleanField,
  periodicalsLibraryOnly: booleanField,
});

export const librarySchema = z.object({
  code: z.string().trim().uppercase().min(2).max(8),
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  contactNumber: z.string().trim().max(32).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  isActive: booleanField,
});

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  parentId: z.coerce.number().int().positive().optional(),
});

/** Flattens a ZodError into the `{ field: [messages] }` shape React Hook Form expects. */
export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    out[key] = [...(out[key] ?? []), issue.message];
  }
  return out;
}
