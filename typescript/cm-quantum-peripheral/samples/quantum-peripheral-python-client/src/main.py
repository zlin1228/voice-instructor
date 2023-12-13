import os
import requests
from schema import SpotifyPlayRequest 
  
url = 'https://dev.os2.ai/quantum-peripheral/spotifyPlay'
# url = 'http://localhost:8080/quantum-peripheral/spotifyPlay'

params = SpotifyPlayRequest(
  token=os.environ['SPOTIFY_TOKEN'],
  trackUris=[
    "spotify:track:5tE3p4vIwoqUZLkKF2PNeB",
    "spotify:track:3lSOZb5rruEnFbe9xWELF6",
    "spotify:track:4nPNK2LaoHoUlW7e6YyJ31",
  ]
)

r = requests.post(url=url, json=params.json(exclude_unset=True))
data = r.json()
print(data)
