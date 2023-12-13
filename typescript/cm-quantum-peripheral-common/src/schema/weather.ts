import {
  arrayType,
  CookType,
  doubleType,
  int32Type,
  objectType,
  stringType,
  timestampType,
} from "base-core/lib/types.js"
import { emptyResponseType, geoLocationType } from "./common.js"

export const weatherQueryRequestType = objectType([
  { name: "geoLocation", type: geoLocationType },
] as const)

export type WeatherQueryRequest = CookType<typeof weatherQueryRequestType>

// https://openweathermap.org/api/one-call-3

export const weatherWeatherConditionType = objectType([
  { name: "id", type: int32Type },
  { name: "main", type: stringType },
  { name: "description", type: stringType },
] as const)

export type WeatherWeatherCondition = CookType<
  typeof weatherWeatherConditionType
>

export const weatherCurrentType = objectType([
  { name: "time", type: timestampType },
  { name: "sunriseTime", type: timestampType },
  { name: "sunsetTime", type: timestampType },

  // Unit: kelvin
  { name: "temperature", type: doubleType },

  // Unit: kelvin
  { name: "feelsLikeTemperature", type: doubleType },

  // Atmospheric pressure on the sea level, hPa
  { name: "pressure", type: doubleType },

  // Humidity, %
  { name: "humidity", type: doubleType },

  // Cloudiness, %
  { name: "clouds", type: doubleType },

  // UV index
  { name: "uvi", type: doubleType },

  // Average visibility, metres.
  { name: "visibility", type: doubleType },

  // Wind speed (metre/sec)
  { name: "windSpeed", type: doubleType },

  { name: "weatherConditions", type: arrayType(weatherWeatherConditionType) },
] as const)

export const weatherHourlyType = objectType([
  { name: "time", type: timestampType },

  // Unit: kelvin
  { name: "temperature", type: doubleType },

  // Unit: kelvin
  { name: "feelsLikeTemperature", type: doubleType },

  // Atmospheric pressure on the sea level, hPa
  { name: "pressure", type: doubleType },

  // Humidity, %
  { name: "humidity", type: doubleType },

  // Cloudiness, %
  { name: "clouds", type: doubleType },

  // UV index
  { name: "uvi", type: doubleType },

  // Average visibility, metres.
  { name: "visibility", type: doubleType },

  // Wind speed (metre/sec)
  { name: "windSpeed", type: doubleType },

  { name: "weatherConditions", type: arrayType(weatherWeatherConditionType) },
] as const)

export const weatherDailyType = objectType([
  { name: "time", type: timestampType },
  { name: "sunriseTime", type: timestampType },
  { name: "sunsetTime", type: timestampType },

  // Unit: kelvin
  {
    name: "temperature",
    type: objectType([
      { name: "morn", type: doubleType },
      { name: "day", type: doubleType },
      { name: "eve", type: doubleType },
      { name: "night", type: doubleType },
      { name: "min", type: doubleType },
      { name: "max", type: doubleType },
    ] as const),
  },
  // Unit: kelvin
  {
    name: "feelsLikeTemperature",
    type: objectType([
      { name: "morn", type: doubleType },
      { name: "day", type: doubleType },
      { name: "eve", type: doubleType },
      { name: "night", type: doubleType },
    ] as const),
  },

  // Atmospheric pressure on the sea level, hPa
  { name: "pressure", type: doubleType },

  // Humidity, %
  { name: "humidity", type: doubleType },

  // Cloudiness, %
  { name: "clouds", type: doubleType },

  // UV index
  { name: "uvi", type: doubleType },

  // Wind speed (metre/sec)
  { name: "windSpeed", type: doubleType },

  { name: "weatherConditions", type: arrayType(weatherWeatherConditionType) },
] as const)

export const weatherQueryResponseType = objectType([
  { name: "current", type: weatherCurrentType },
  { name: "hourlyForecasts", type: arrayType(weatherHourlyType) },
  { name: "dailyForecasts", type: arrayType(weatherDailyType) },
] as const)

export type WeatherQueryResponse = CookType<typeof weatherQueryResponseType>

export const weatherEndpoints = [
  {
    kind: "post",
    value: {
      name: "weatherQuery",
      request: {
        kind: "json",
        value: weatherQueryRequestType,
      },
      response: {
        kind: "json",
        value: weatherQueryResponseType,
      },
    },
  },
] as const
