"use client";

import * as React from "react";
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Thermometer, Wind, RefreshCw, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface WeatherWidgetProps {
  location: string;
}

interface WeatherInfo {
  temp: number;
  condition: string;
  emoji: string;
  icon: any;
  tempMin: number;
  tempMax: number;
  windSpeed: number;
  forecast: {
    date: string;
    tempMax: number;
    tempMin: number;
    emoji: string;
    condition: string;
  }[];
}

const WEATHER_MAPPING: Record<number, { condition: string; emoji: string; icon: any; advice: string }> = {
  0: { condition: "Clear Sky", emoji: "☀️", icon: Sun, advice: "Sunshine ahead! Pack light clothes & sunglasses." },
  1: { condition: "Mainly Clear", emoji: "🌤️", icon: Sun, advice: "Great weather for outdoor exploration." },
  2: { condition: "Partly Cloudy", emoji: "⛅", icon: Cloud, advice: "Pleasant temperatures. Ideal sightseeing day." },
  3: { condition: "Overcast", emoji: "☁️", icon: Cloud, advice: "Gray skies today. Good day for museum trips." },
  45: { condition: "Foggy", emoji: "🌫️", icon: Cloud, advice: "Low visibility. Drive slowly and stay safe." },
  48: { condition: "Depositing Rime Fog", emoji: "🌫️", icon: Cloud, advice: "Cold fog. Layer up well." },
  51: { condition: "Light Drizzle", emoji: "🌦️", icon: CloudRain, advice: "Light mist. Carry a light windbreaker." },
  53: { condition: "Moderate Drizzle", emoji: "🌦️", icon: CloudRain, advice: "Drizzle expected. A small umbrella is recommended." },
  55: { condition: "Dense Drizzle", emoji: "🌦️", icon: CloudRain, advice: "Heavy drizzle. Keep raincoats handy." },
  61: { condition: "Slight Rain", emoji: "🌧️", icon: CloudRain, advice: "Slight showers. Carry an umbrella." },
  63: { condition: "Moderate Rain", emoji: "🌧️", icon: CloudRain, advice: "Rainy day! Perfect for indoor planning or cafes." },
  65: { condition: "Heavy Rain", emoji: "🌧️", icon: CloudRain, advice: "Heavy downpours. Stay inside or wear waterproof gear." },
  71: { condition: "Slight Snow", emoji: "❄️", icon: CloudSnow, advice: "Light snowfall! Pack warm thermal layers." },
  73: { condition: "Moderate Snow", emoji: "❄️", icon: CloudSnow, advice: "Snowing steady. Heavy boots & parkas needed." },
  75: { condition: "Heavy Snow", emoji: "❄️", icon: CloudSnow, advice: "Heavy blizzard potential. Keep warm and stay safe." },
  80: { condition: "Showers", emoji: "🌧️", icon: CloudRain, advice: "Intermittent showers. Keep rain gear nearby." },
  95: { condition: "Thunderstorms", emoji: "⛈️", icon: CloudLightning, advice: "Thunderstorms active. Avoid open heights and seek cover." },
};

const getFallbackInfo = (code: number) => {
  if (code >= 95) return WEATHER_MAPPING[95];
  if (code >= 71) return WEATHER_MAPPING[71];
  if (code >= 61) return WEATHER_MAPPING[61];
  if (code >= 51) return WEATHER_MAPPING[51];
  return WEATHER_MAPPING[2]; // fallback partly cloudy
};

export function WeatherWidget({ location }: WeatherWidgetProps) {
  const [data, setData] = React.useState<WeatherInfo | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const fetchWeather = async () => {
    if (!location || !location.trim()) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      // Step 1: Geocoding search
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location.trim())}&count=1&language=en&format=json`;
      const geoRes = await fetch(geoUrl);
      if (!geoRes.ok) throw new Error("Geocoding service unavailable");
      
      const geoData = await geoRes.json();
      if (!geoData.results || geoData.results.length === 0) {
        throw new Error(`Could not find coordinates for "${location}"`);
      }

      const { latitude, longitude, name: cityName } = geoData.results[0];

      // Step 2: Weather search
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`;
      const weatherRes = await fetch(weatherUrl);
      if (!weatherRes.ok) throw new Error("Weather forecast service unavailable");

      const weatherData = await weatherRes.json();
      const current = weatherData.current_weather;
      const daily = weatherData.daily;

      const code = current.weathercode;
      const mapped = WEATHER_MAPPING[code] || getFallbackInfo(code);

      const forecastList = daily.time.slice(1, 4).map((timeStr: string, idx: number) => {
        const dCode = daily.weathercode[idx + 1];
        const dMapped = WEATHER_MAPPING[dCode] || getFallbackInfo(dCode);
        const dayLabel = new Date(timeStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
        return {
          date: dayLabel,
          tempMax: Math.round(daily.temperature_2m_max[idx + 1]),
          tempMin: Math.round(daily.temperature_2m_min[idx + 1]),
          emoji: dMapped.emoji,
          condition: dMapped.condition,
        };
      });

      setData({
        temp: Math.round(current.temperature),
        condition: mapped.condition,
        emoji: mapped.emoji,
        icon: mapped.icon,
        tempMax: Math.round(daily.temperature_2m_max[0]),
        tempMin: Math.round(daily.temperature_2m_min[0]),
        windSpeed: Math.round(current.windspeed),
        forecast: forecastList,
      });
    } catch (err: any) {
      console.error("WeatherWidget fetch error:", err);
      setErrorMsg(err.message || "Failed to load weather details.");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchWeather();
  }, [location]);

  if (!location) return null;

  return (
    <Card className="border border-neutral-100 dark:border-neutral-800 bg-white/40 dark:bg-neutral-900/40 backdrop-blur-md overflow-hidden">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-sm font-semibold tracking-tight text-neutral-800 dark:text-neutral-200">
            Weather Forecast • {location}
          </CardTitle>
          <CardDescription className="text-[10px]">Real-time forecasts and clothing advisories</CardDescription>
        </div>
        <button
          onClick={fetchWeather}
          disabled={loading}
          className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded transition-apple cursor-pointer"
          title="Refresh Forecast"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="py-6 text-center text-xs text-neutral-400 flex items-center justify-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Resolving geocoding & climate data...
          </div>
        ) : errorMsg ? (
          <div className="p-3 bg-neutral-50 dark:bg-neutral-950 rounded-lg text-xs text-neutral-500 flex items-start gap-2 border border-neutral-100 dark:border-neutral-850">
            <AlertCircle className="h-4.5 w-4.5 text-neutral-400 shrink-0 mt-0.5" />
            <span>Weather info is temporary unavailable. Enter a valid city name like "Goa" or "Manali" in trip settings.</span>
          </div>
        ) : data ? (
          <div className="space-y-3.5">
            {/* Current Details Header Grid */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{data.emoji}</span>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold tracking-tight text-neutral-800 dark:text-neutral-200">
                      {data.temp}°C
                    </span>
                    <span className="text-[10px] text-neutral-400 font-semibold">
                      ({data.tempMin}° / {data.tempMax}°)
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-350">{data.condition}</p>
                </div>
              </div>
              <div className="text-right text-[10px] font-semibold text-neutral-400 space-y-0.5">
                <p className="flex items-center gap-1 justify-end">
                  <Wind className="h-3 w-3" />
                  {data.windSpeed} km/h Wind
                </p>
                <p className="flex items-center gap-1 justify-end">
                  <Thermometer className="h-3 w-3" />
                  Feels real
                </p>
              </div>
            </div>

            {/* Smart Advice Row */}
            <div className="p-2.5 bg-neutral-50/50 dark:bg-neutral-950/30 border border-neutral-100/60 dark:border-neutral-850 rounded-lg text-xs text-neutral-600 dark:text-neutral-350 leading-relaxed">
              💡 <strong>Gang Tips:</strong> {WEATHER_MAPPING[data.tempMax] ? WEATHER_MAPPING[data.tempMax].advice : getFallbackInfo(data.tempMax).advice}
            </div>

            {/* 3-day forecast items */}
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-neutral-100/60 dark:border-neutral-800/60">
              {data.forecast.map((f) => (
                <div key={f.date} className="text-center p-2 bg-neutral-50/20 dark:bg-neutral-900/20 rounded-lg border border-neutral-100/40 dark:border-neutral-800/40 space-y-1">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{f.date}</p>
                  <p className="text-lg">{f.emoji}</p>
                  <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    {f.tempMin}°c - {f.tempMax}°c
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-neutral-400 text-center py-4">No forecast data loaded.</p>
        )}
      </CardContent>
    </Card>
  );
}
