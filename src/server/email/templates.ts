import { formatPeso } from "@/lib/utils";
import { APP_NAME, INSTITUTION } from "@/lib/constants";

export type EmailTemplate =
  | "borrow_confirmed"
  | "return_confirmed"
  | "due_reminder"
  | "overdue_notice"
  | "reservation_ready"
  | "fine_assessed"
  | "welcome";

export interface ReminderPayload {
  borrowerName: string;
  bookTitle: string;
  accessionNumber: string;
  dueDate: string;
  referenceNo: string;
  daysRemaining?: number;
  fine?: number;
  libraryName?: string;
}

const SHELL = (content: string) => `
<div style="background:#F5F0E6;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;color:#2D2D2D">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #E8DFCD;border-radius:14px;overflow:hidden">
    <div style="background:#6F4E37;padding:22px 28px;color:#F5F0E6">
      <p style="margin:0;font-size:20px;letter-spacing:.02em">${APP_NAME}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#D4A373">${INSTITUTION}</p>
    </div>
    <div style="padding:26px 28px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6">
      ${content}
    </div>
    <div style="padding:16px 28px;background:#FBF8F2;border-top:1px solid #E8DFCD;font-size:12px;color:#7A726A">
      Questions? Visit any RCC branch library or write to library@rcc.edu.ph.
      This message was sent automatically by ${APP_NAME}.
    </div>
  </div>
</div>`;

const FINE_NOTE = `Fines accrue PHP 1.00 per day including weekends and holidays. Reserve books are
charged PHP 2.00 per hour overdue.`;

export function renderTemplate(template: EmailTemplate, p: Record<string, string | number | undefined>) {
  const get = <K extends string>(key: K) => (p[key] as string | undefined) ?? "";
  const num = (key: string) => Number(p[key] ?? 0);

  switch (template) {
    case "borrow_confirmed": {
      const row = (label: string, value: string) =>
        `<tr><td style="padding:8px;border:1px solid #E8DFCD;background:#FBF8F2">${label}</td><td style="padding:8px;border:1px solid #E8DFCD">${value}</td></tr>`;
      return {
        subject: `Borrowed: ${get("bookTitle")} — due ${get("dueDate")}`,
        html: SHELL(`
          <p>Dear <strong>${get("borrowerName")}</strong>,</p>
          <p>The following title is now checked out to your library account.</p>
          <table role="presentation" style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px">
            ${row("Book title", `<strong>${get("bookTitle")}</strong>`)}
            ${row("Accession number", get("accessionNumber"))}
            ${get("barcode") ? row("Barcode", get("barcode")) : ""}
            ${row("Transaction", get("referenceNo"))}
            ${row("Date borrowed", get("borrowedDate"))}
            ${row("Due date", `<strong>${get("dueDate")}</strong>`)}
            ${row("Return to", get("libraryName") || "the issuing branch")}
          </table>
          <p>Renew it at the desk before the due date if you still need it. ${FINE_NOTE}</p>
          <p style="margin-top:20px">— The RCC LIBRO team</p>`),
      };
    }
    case "return_confirmed": {
      const row = (label: string, value: string) =>
        `<tr><td style="padding:8px;border:1px solid #E8DFCD;background:#FBF8F2">${label}</td><td style="padding:8px;border:1px solid #E8DFCD">${value}</td></tr>`;
      const condition = get("condition") || "good";
      const conditionLabel =
        condition === "lost" ? "Lost" : condition === "damaged" ? "Damaged" : "Good condition";
      const fine = num("fine");
      const late = num("overdueDays");
      // `return_book()` only reports the overdue fine in its payload — the lost or
      // damaged penalty is posted as a separate `fines` row, so quote no amount for it.
      const penalty =
        condition === "lost"
          ? `<p style="color:#A83A34"><strong>The copy was recorded as lost.</strong> A replacement
             penalty was raised against your account; you can see the amount under
             <strong>Penalties</strong> on your dashboard and settle it in cash at any branch desk.</p>`
          : condition === "damaged"
            ? `<p style="color:#A83A34"><strong>The copy was recorded as damaged.</strong> A repair
               penalty was raised against your account; the amount is listed under
               <strong>Penalties</strong> on your dashboard.</p>`
            : "";
      const overdue =
        fine > 0
          ? `<p style="color:#A83A34"><strong>Overdue fine: ${formatPeso(fine)}</strong> —
             ${late} day${late === 1 ? "" : "s"} past the due date. Borrowing stays paused until the
             balance on your account is settled at the desk.</p>`
          : "";
      const clean =
        fine === 0 && condition === "good"
          ? `<p>The copy came back on time and no fine was incurred. Your borrowing privileges are
             fully open again.</p>`
          : "";
      return {
        subject:
          condition !== "good"
            ? `Returned: ${get("bookTitle")} — recorded ${condition}`
            : fine > 0
              ? `Returned: ${get("bookTitle")} — ${formatPeso(fine)} to settle`
              : `Returned: ${get("bookTitle")} — all settled`,
        html: SHELL(`
          <p>Dear <strong>${get("borrowerName")}</strong>,</p>
          <p>The circulation desk has checked this title back in and closed the loan.</p>
          <table role="presentation" style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px">
            ${row("Book title", `<strong>${get("bookTitle")}</strong>`)}
            ${row("Accession number", get("accessionNumber"))}
            ${row("Transaction", get("referenceNo"))}
            ${row("Date borrowed", get("borrowedDate"))}
            ${row("Due date", get("dueDate"))}
            ${row("Date returned", `<strong>${get("returnedDate")}</strong>`)}
            ${row("Condition on return", conditionLabel)}
            ${row("Checked in at", get("libraryName") || "the branch library")}
          </table>
          ${penalty}${overdue}${clean}
          <p style="margin-top:20px">— The RCC LIBRO team</p>`),
      };
    }
    case "due_reminder": {
      const days = num("daysRemaining");
      return {
        subject: `${days === 0 ? "Due today" : `Due in ${days} day${days === 1 ? "" : "s"}`}: ${get("bookTitle")}`,
        html: SHELL(`
          <p>Dear <strong>${get("borrowerName")}</strong>,</p>
          <p>This is a reminder that the following borrowed title is due soon.</p>
          <table role="presentation" style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px">
            <tr><td style="padding:8px;border:1px solid #E8DFCD;background:#FBF8F2">Book title</td><td style="padding:8px;border:1px solid #E8DFCD"><strong>${get("bookTitle")}</strong></td></tr>
            <tr><td style="padding:8px;border:1px solid #E8DFCD;background:#FBF8F2">Accession number</td><td style="padding:8px;border:1px solid #E8DFCD">${get("accessionNumber")}</td></tr>
            <tr><td style="padding:8px;border:1px solid #E8DFCD;background:#FBF8F2">Transaction</td><td style="padding:8px;border:1px solid #E8DFCD">${get("referenceNo")}</td></tr>
            <tr><td style="padding:8px;border:1px solid #E8DFCD;background:#FBF8F2">Due date</td><td style="padding:8px;border:1px solid #E8DFCD"><strong>${get("dueDate")}</strong></td></tr>
          </table>
          <p>Return the copy to the ${get("libraryName") || "branch"} circulation desk on or before the due date. ${FINE_NOTE}</p>
          ${num("fine") > 0 ? `<p style="color:#A83A34"><strong>Current fine:</strong> ${formatPeso(num("fine"))}</p>` : ""}
          <p style="margin-top:20px">— The RCC LIBRO team</p>`),
      };
    }
    case "overdue_notice":
      return {
        subject: `Overdue: ${get("bookTitle")} — fine accruing`,
        html: SHELL(`
          <p>Dear <strong>${get("borrowerName")}</strong>,</p>
          <p>Our records show <strong>${get("bookTitle")}</strong> (accession ${get("accessionNumber")},
          transaction ${get("referenceNo")}) was due on <strong>${get("dueDate")}</strong> and has not been returned.</p>
          <p style="color:#A83A34"><strong>Accrued fine: ${formatPeso(num("fine"))}.</strong> ${FINE_NOTE}</p>
          <p>Until the item is back, borrowing privileges are held at the desk so we can close the
          record. If the book is lost or damaged, report it at the circulation desk so we can open the
          appropriate workflow instead of adding more days of fines.</p>
          <p style="margin-top:20px">— The RCC LIBRO team</p>`),
      };
    case "reservation_ready":
      return {
        subject: `Your reserved book is ready: ${get("bookTitle")}`,
        html: SHELL(`
          <p>Dear <strong>${get("borrowerName")}</strong>,</p>
          <p><strong>${get("bookTitle")}</strong> is set aside for you at the
          ${get("libraryName") || "circulation"} desk. Present your library card or SBTR
          within <strong>${get("heldUntil")}</strong> or the hold moves to the next borrower.</p>
          <p>Reference ${get("referenceNo")}.</p>`),
      };
    case "fine_assessed":
      return {
        subject: `Penalty recorded on your account: ${formatPeso(num("fine"))}`,
        html: SHELL(`
          <p>Dear <strong>${get("borrowerName")}</strong>,</p>
          <p>A penalty of <strong>${formatPeso(num("fine"))}</strong> was recorded against
          <strong>${get("bookTitle")}</strong> (${get("reason")}).</p>
          <p>Settle in cash at any branch desk. An administrator may waive the penalty with a
          documented reason.</p>`),
      };
    case "welcome":
      return {
        subject: `Welcome to ${APP_NAME}`,
        html: SHELL(`
          <p>Dear <strong>${get("borrowerName")}</strong>,</p>
          <p>Your RCC library account is active. Complete your borrower profile with your
          level or department${get("needsSbtr") ? " and your SBTR number" : ""}, then start
          searching the catalogue of the Elementary, High School and College &amp; Graduate School
          libraries.</p>`),
      };
  }
}
