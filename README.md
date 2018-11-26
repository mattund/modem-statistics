# modem-statistics
![Data flow](https://i.imgur.com/DZkeUAz.png)

This project houses a series of node.js+InfluxDB modem statistic collection scripts.  These scripts will automatically log in, and ping your modem (see `models` directory for modems supported) over HTTP every 15 seconds or so to collect various RF environment datapoints.

Please note, this may leave your modem constantly "logged in", which could pose a security risk in some cases.  To avoid this, some modems allow you to log in from an IP address off of your WAN subnet or address, such as 192.168.100.2.

Visualization is achieved through the use of the popular data/graphing tool Grafana, which even supports alerts.  The example provided Grafana dashboard has alerts attached for various recommended signal levels such as: SNR (>=30dB), power (-15 to +15dBmV), and affixing your channel bond count to detect upgrades/partial service mode.

I recommend you have the alerts in Grafana route to a slack-based notification channel, or Email.  It's possible to use Discord as a message target, like I do, using a slack-to-discord push notification relay.

![Dashboard](https://i.imgur.com/0IvDqej.png)

Most of the collection scripts in the project will buffer datapoints, so even if InfluxDB goes down, they will eventually all sink without loss.

Alerts (via a slack-to-discord relay):

![Alerts](https://i.imgur.com/5ydhO5G.png)

# Feature Overview

 - Detect physical-layer upgrades (channel bond count, DOCSIS 3.1 OFDM carrier) within seconds
 - Analyze modem data to correlate transport/IP-level issues with RF environment issues
 - Share information with your Internet Service Provider (ISP) for troubleshooting
 - Diagnose and/or audit new equipment or physical changes on your system

# Supported Modems

**Coaxial Cable Modems**:
 - MB8600 (DOCSIS 3.1)
 
**DSL Modems**:
 - SR555ac

If you would like to have a modem supported with a node.js scraper script, either create a pull request, or open an issue with the modem's path to the signal statistics page.  Make sure to include an HTML excerpt of the signal level markup, and remove any personal information such as CM MAC address, TFTP IP address, any other IP addresses, or configuration file names.

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
