# SunsetLights

Program to run every minute that will set all currently on Hue lights to slowly dim to an orange-ish color as the sun sets.

## Installation

1. Create an `.env` file inside the `SunsetLights` folder with your latitude and longitude.

```sh
SUNSET_LAT=<your latitude>
SUNSET_LONG=<your longitude>
```

2. Install node modules:

```sh
npm i
```

## Usage

```sh
# inside the SunsetLights folder
$ node runLights.js
```

The first time you do this, the API needs to create a new user on your Hue hub.

You may see this error:

```sh
The Link button on the bridge was not pressed. Please press the Link button and try again.
```

In that case, you should press the huge button on the top of the hub and try again.

Once this runs the first time, it will create a new user on your hub and then store that username as a new key in your `.env` file. As long as you keep that username, the program will just use that instead of creating a new one every time.

## Crontab

To get this to run every minute, set `crontab`:

```sh
crontab -e
```

NOTE: Replace `<absolute_path_to_runLights.js_file>` with the, like, actual path.

```sh
* * * * * node <absolute_path_to_runLights.js_file>
```