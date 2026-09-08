import { expect, test } from 'vitest'
import { sceneWeather } from './weather'

test('cold damp regions develop fog while dry regions retain their campaign conditions', () => {
  expect(sceneWeather('Cold', 'RiverValley')).toBe('fog')
  expect(sceneWeather('Cold', 'Forest')).toBe('fog')
  expect(sceneWeather('Cold', 'Desert')).toBe('clear')
  expect(sceneWeather('Cold', 'Mountains')).toBe('clear')
  expect(sceneWeather('Snow', 'Mountains')).toBe('snow')
  expect(sceneWeather('Storm', 'RiverValley')).toBe('rain')
  expect(sceneWeather('Clear', 'RiverValley')).toBe('clear')
})
