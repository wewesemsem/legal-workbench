import { jsonOk } from "@/lib/api";

export async function GET() {
  return jsonOk({
    status: "ok",
    service: "lawyer-workbench",
    phase: "1",
    step: "auth",
  });
}
