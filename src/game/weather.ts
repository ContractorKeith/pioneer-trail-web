export type SceneWeather = 'clear' | 'rain' | 'snow' | 'fog'

/** Cold air over damp lowlands produces mist without changing campaign weather or RNG. */
export function sceneWeather(weather: string, terrain: string): SceneWeather {
  if (/snow|blizzard/i.test(weather)) return 'snow'
  if (/rain|storm/i.test(weather)) return 'rain'
  if (/fog/i.test(weather) || (/cold/i.test(weather) && /RiverValley|Forest/i.test(terrain)))
    return 'fog'
  return 'clear'
}
