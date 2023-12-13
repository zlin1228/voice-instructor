import json


def load_json(path):
    """Load JSON file."""
    with open(path, 'r') as f:
        return json.load(f)


def save_json(path, data):
    """Save JSON file."""
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)


def main():
    # replay_path = 'records/actions-spotify-create-playlist.json'
    replay_path = 'records/actions-spotify-add-song-to-playlist.json'
    target_url = 'https://open.spotify.com'

    all_actions = load_json(replay_path)

    actions = []
    for action in all_actions:
        if action['state']['url'].startswith(target_url):
            actions.append(action)
        else:
            actions = []

    save_json(replay_path, actions)


if __name__ == '__main__':
    main()