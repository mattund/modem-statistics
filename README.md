# modem-statistics
This project houses a series of node.js+InfluxDB modem statistic collection scripts.  These scripts will automatically log in, and ping your modem (see `models` directory for modems supported) every 15 seconds or so to collect various RF environment datapoints.

Visualization is achieved through the use of the popular data/graphing tool Grafana, which even supports alerts.  The example provided Grafana dashboard has alerts attached for various recommended signal levels such as: SNR (>=30dB), power (-15 to +15dBmV), and affixing your channel bond count to detect upgrades/partial service mode.

I recommend you have the alerts in Grafana route to a slack-based notification channel, or Email.  It's possible to use Discord as a message target, like I do, using a slack-to-discord push notification relay.

![Dashboard](https://i.imgur.com/0IvDqej.png)

Most of the collection scripts in the project will buffer datapoints, so even if InfluxDB goes down, they will eventually all sink without loss.

# Usage

To run the scripts in this project, create a `config.json` file in the run directory of the script, such as:

NOTE: Configuration depends on the model which data is collected from.
```
{
	"modem": {
		"host": "192.168.100.1",
		"username": "admin",
		"password": "motorola"
	},
	"influxdb": {
		"host": "(mongodb.yourdomain.net, or 10.12.34.56)",
		"port": 8086
	}
}
```

You may need dependencies.  Most scripts require: `request`, `jsdom`, `influx`, and `moment`.  You can install those using `npm install <package>` in the run directory you want to use, with your `config.json`.

Then, you can schedule a task in either Task Scheduler on Windows, or make a systemd/initd script to run the node.js script:
`node server.js`
