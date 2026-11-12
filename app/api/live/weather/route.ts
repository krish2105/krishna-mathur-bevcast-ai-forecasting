import { fetchWeatherLive } from "@/lib/live/weather";

export const revalidate = 21600; // 6 h ISR

export async function GET() {
  const data = await fetchWeatherLive();
  return Response.json(data, { status: data.ok ? 200 : 502 });
}
