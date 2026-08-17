import { NextResponse } from "next/server";
import { updateTicket } from "../../../../lib/xlsx";

export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  try {
    const body = await request.json();
    const row = await updateTicket(params.row, body);
    return NextResponse.json({ ok: true, row });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
