# Office Transit Snapshot

## Use Case
Get transit data for a physical office location to see what the energy is like for that week. This is useful for understanding the astrological climate of a workspace.

## Example: Melbourne Office

For an office located in Melbourne, Australia, we want to get the transits data for that location to see what the energy is like for that week.

### Payload Structure

The payload uses today's date as the chart moment (birth_date/birth_time), with the office location coordinates:

```json
{
  "request": "transits",
  "name": "Melbourne Office Snapshot",
  "birth_date": "2025-11-13",
  "birth_time": "09:00",
  "location": "Melbourne, Australia",
  "latitude": -37.8136,
  "longitude": 144.9631,
  "tz": "Australia/Melbourne",
  "utc": "2025-11-12T22:00:00.000Z",
  "house_system": "P",
  "zodiac_type": "tropical",
  "reportType": null,
  "user_id": null
}
```

### Notes

- `birth_date` and `birth_time` represent the current moment (today's date and time)
- `location` can be a city name or address (translator-edge will geocode if needed)
- `latitude` and `longitude` can be provided directly or inferred from location
- `tz` is the timezone for the location
- `utc` is the ISO UTC timestamp (will be calculated by translator-edge if not provided)
- `house_system` defaults to "P" (Placidus) if not specified
- `zodiac_type` can be "tropical" or "sidereal"
- The `request` field must be "transits" to hit the `/transits` endpoint

### Implementation

This will come from the user as a request which will be wired up later. The payload structure above is ready to send to the translator-edge function, which will route it to the Swiss API `/transits` endpoint.

