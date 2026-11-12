import { fetchFredLive } from "@/lib/live/fred";

export const revalidate = 21600; // 6 h ISR

export async function GET() {
  const data = await fetchFredLive();
  return Response.json(data, { status: data.ok ? 200 : 502 });
}
