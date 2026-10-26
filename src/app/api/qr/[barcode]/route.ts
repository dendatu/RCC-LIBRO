import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { copyUrl, qrPng } from "@/lib/qr";

type Params = { params: Promise<{ barcode: string }> };

/**
 * PNG QR label for a physical copy: `/api/qr/:barcode.png`.
 * Rendered on demand so labels never need to be stored in object storage.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { barcode } = await params;
  const size = Math.min(1024, Math.max(128, Number(request.nextUrl.searchParams.get("size") ?? 320)));

  const supabase = await createClient();
  const { data: copy } = await supabase
    .from("book_copies")
    .select("barcode, book:books(title, accession_number, call_number)")
    .eq("barcode", barcode)
    .maybeSingle();

  if (!copy) {
    const { data: book } = await supabase
      .from("books")
      .select("accession_number")
      .eq("accession_number", barcode)
      .maybeSingle();
    if (!book) {
      return new NextResponse("Unknown barcode", { status: 404 });
    }
  }

  const png = await qrPng(copyUrl(copy?.barcode ?? barcode), size);
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "Content-Disposition": `inline; filename="rcc-${copy?.barcode ?? barcode}.png"`,
    },
  });
}
