# modem-statistics
This project houses a series of node.js+InfluxDB modem statistic collection scripts.  These scripts will automatically log in, and ping your modem (see `models` directory for modems supported) every 15 seconds or so to collect various RF environment datapoints.

Visualization is achieved through the use of the popular data/graphing tool Grafana, which even supports alerts.  The example provided Grafana dashboard has alerts attached for various recommended signal levels such as: SNR (>=30dB), power (-15 to +15dBmV), and affixing your channel bond count to detect upgrades/partial service mode.

I recommend you have the alerts in Grafana route to a slack-based notification channel, or Email.  It's possible to use Discord as a message target, like I do, using a slack-to-discord push notification relay.

![Dashboard](https://i.imgur.com/0IvDqej.png)
