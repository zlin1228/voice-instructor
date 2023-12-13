import {
  cancelTokenToAbortSignal,
  checkAndGetCancelToken,
  Scope,
} from "base-core/lib/scope.js"
import {
  arrayType,
  doubleType,
  int32Type,
  objectType,
  stringType,
  timestampType,
} from "base-core/lib/types.js"
import {
  buildHttpServiceClient,
  defaultBuildHttpServiceClientOptions,
} from "base-node/lib/service.js"
import { WeatherQueryRequest, WeatherQueryResponse } from "cm-quantum-peripheral-common/lib/schema/weather.js"

const weatherApiKey = "3cdd6619328dfd0f2d922ddc6b3ec171"

// https://openweathermap.org/api/one-call-3

const weatherApiRequestType = objectType([
  { name: "lat", type: doubleType },
  { name: "lon", type: doubleType },
  { name: "appid", type: stringType },
] as const)

const weatherApiWeatherConditionType = objectType([
  { name: "id", type: int32Type },
  { name: "main", type: stringType },
  { name: "description", type: stringType },
] as const)

const weatherApiCurrentType = objectType([
  { name: "dt", type: doubleType },
  { name: "sunrise", type: doubleType },
  { name: "sunset", type: doubleType },
  { name: "temp", type: doubleType },
  { name: "feels_like", type: doubleType },
  { name: "pressure", type: doubleType },
  { name: "humidity", type: doubleType },
  { name: "clouds", type: doubleType },
  { name: "uvi", type: doubleType },
  { name: "visibility", type: doubleType },
  { name: "wind_speed", type: doubleType },
  { name: "weather", type: arrayType(weatherApiWeatherConditionType) },
] as const)

const weatherApiHourlyType = objectType([
  { name: "dt", type: doubleType },
  { name: "temp", type: doubleType },
  { name: "feels_like", type: doubleType },
  { name: "pressure", type: doubleType },
  { name: "humidity", type: doubleType },
  { name: "clouds", type: doubleType },
  { name: "uvi", type: doubleType },
  { name: "visibility", type: doubleType },
  { name: "wind_speed", type: doubleType },
  { name: "weather", type: arrayType(weatherApiWeatherConditionType) },
] as const)

const weatherApiDailyType = objectType([
  { name: "dt", type: doubleType },
  { name: "sunrise", type: doubleType },
  { name: "sunset", type: doubleType },
  {
    name: "temp",
    type: objectType([
      { name: "morn", type: doubleType },
      { name: "day", type: doubleType },
      { name: "eve", type: doubleType },
      { name: "night", type: doubleType },
      { name: "min", type: doubleType },
      { name: "max", type: doubleType },
    ] as const),
  },
  {
    name: "feels_like",
    type: objectType([
      { name: "morn", type: doubleType },
      { name: "day", type: doubleType },
      { name: "eve", type: doubleType },
      { name: "night", type: doubleType },
    ] as const),
  },
  { name: "pressure", type: doubleType },
  { name: "humidity", type: doubleType },
  { name: "clouds", type: doubleType },
  { name: "uvi", type: doubleType },
  { name: "wind_speed", type: doubleType },
  { name: "weather", type: arrayType(weatherApiWeatherConditionType) },
] as const)

const weatherApiResponseType = objectType([
  { name: "current", type: weatherApiCurrentType },
  { name: "hourly", type: arrayType(weatherApiHourlyType) },
  { name: "daily", type: arrayType(weatherApiDailyType) },
] as const)

const openweathermapQueryHttpServiceSchema = [
  {
    kind: "get",
    value: {
      name: "onecall",
      query: weatherApiRequestType,
      response: {
        kind: "json",
        value: weatherApiResponseType,
      },
    },
  },
] as const

export async function weatherQuery(
  scope: Scope,
  request: WeatherQueryRequest
): Promise<WeatherQueryResponse> {
  const client = buildHttpServiceClient(openweathermapQueryHttpServiceSchema, {
    ...defaultBuildHttpServiceClientOptions(
      "https://api.openweathermap.org/data/3.0"
    ),
  })
  const cancelToken = checkAndGetCancelToken(scope)
  const signal = cancelTokenToAbortSignal(cancelToken)
  const response = await client.get_onecall.fetch(
    {
      appid: weatherApiKey,
      lat: request.geoLocation.latitude,
      lon: request.geoLocation.longitude,
    },
    signal
  )
  const { current } = response
  return {
    current: {
      time: new Date(current.dt * 1000),
      sunriseTime: new Date(current.sunrise * 1000),
      sunsetTime: new Date(current.sunset * 1000),
      temperature: current.temp,
      feelsLikeTemperature: current.feels_like,
      pressure: current.pressure,
      humidity: current.humidity,
      clouds: current.clouds,
      uvi: current.uvi,
      visibility: current.visibility,
      windSpeed: current.wind_speed,
      weatherConditions: current.weather,
    },
    hourlyForecasts: response.hourly.map((hourly) => ({
      time: new Date(hourly.dt * 1000),
      temperature: hourly.temp,
      feelsLikeTemperature: hourly.feels_like,
      pressure: hourly.pressure,
      humidity: hourly.humidity,
      clouds: hourly.clouds,
      uvi: hourly.uvi,
      visibility: hourly.visibility,
      windSpeed: hourly.wind_speed,
      weatherConditions: hourly.weather,
    })),
    dailyForecasts: response.daily.map((daily) => ({
      time: new Date(daily.dt * 1000),
      sunriseTime: new Date(daily.sunrise * 1000),
      sunsetTime: new Date(daily.sunset * 1000),
      temperature: daily.temp,
      feelsLikeTemperature: daily.feels_like,
      pressure: daily.pressure,
      humidity: daily.humidity,
      clouds: daily.clouds,
      uvi: daily.uvi,
      windSpeed: daily.wind_speed,
      weatherConditions: daily.weather,
    })),
  }
}
